// Herkent wát je wil met een zin: iets op de boodschappenlijst, iets dat op is,
// een maaltijd op het weekmenu, een afspraak in de agenda, of een uitgave/inkomst.

import { todayISO } from './format.js';
import { digitize, parseSpeech } from './voice.js';
import { parseIngredient, sameThing } from './kitchen.js';

const W = (s) => `(?<![a-zà-ÿ])(?:${s})(?![a-zà-ÿ])`;
const has = (text, s) => new RegExp(W(s)).test(text);
const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const iso = (d) => todayISO(d);

// Datum in de toekomst: "morgen", "zaterdag", "volgende week dinsdag", "3 december".
export function findFutureDate(text, today = todayISO()) {
  const base = new Date(today + 'T12:00:00');
  const shift = (n) => { const d = new Date(base); d.setDate(d.getDate() + n); return iso(d); };
  let m;
  if ((m = text.match(new RegExp(W('overmorgen'))))) return { date: shift(2), match: m };
  if ((m = text.match(new RegExp(W('morgen(?:avond|middag|ochtend|vroeg)?'))))) return { date: shift(1), match: m };
  if ((m = text.match(new RegExp(W('vandaag|vanavond|vanmiddag|deze middag|deze avond|straks'))))) return { date: today, match: m };
  if ((m = text.match(new RegExp(W('(?:op\\s+)?(\\d{1,2})\\s+(' + MONTHS.join('|') + ')'))))) {
    let d = new Date(base.getFullYear(), MONTHS.indexOf(m[2]), Number(m[1]), 12);
    if (iso(d) < today) d = new Date(base.getFullYear() + 1, MONTHS.indexOf(m[2]), Number(m[1]), 12);
    return { date: iso(d), match: m };
  }
  if ((m = text.match(/(?<![\d,.])(?:op\s+)?(\d{1,2})\/(\d{1,2})(?![\d/])/))) {
    let d = new Date(base.getFullYear(), Number(m[2]) - 1, Number(m[1]), 12);
    if (iso(d) < today) d.setFullYear(d.getFullYear() + 1);
    return { date: iso(d), match: m };
  }
  if ((m = text.match(new RegExp(W('(volgende week|komende week)?\\s*(?:op\\s+)?(volgende\\s+|komende\\s+|deze\\s+)?(' + DAYS.join('|') + ')(?:avond|middag|ochtend)?')))) ) {
    const target = DAYS.indexOf(m[3]);
    let diff = (target - base.getDay() + 7) % 7;
    if (m[1]) diff = (((8 - base.getDay()) % 7) || 7) + ((target + 6) % 7); // maandag volgende week + dag
    else if (m[2] && /volgende/.test(m[2]) && diff === 0) diff = 7;
    return { date: shift(diff), match: m };
  }
  if ((m = text.match(new RegExp(W('volgende week|komende week'))))) {
    const toMonday = ((8 - base.getDay()) % 7) || 7;
    return { date: shift(toMonday), match: m };
  }
  return { date: null, match: null };
}

// Uur: "om 14 uur", "om 9u30", "om 14:30", "om half 3", "om kwart voor 8".
export function findTime(text) {
  let m;
  let h = null;
  let min = 0;
  if ((m = text.match(/(?:om\s+)?(?:half)\s+(\d{1,2})(?:\s*uur)?(?![\d,.])/))) { h = Number(m[1]) - 1; min = 30; }
  else if ((m = text.match(/(?:om\s+)?kwart\s+(over|voor)\s+(\d{1,2})(?:\s*uur)?(?![\d,.])/))) {
    h = Number(m[2]); min = 15;
    if (m[1] === 'voor') { h -= 1; min = 45; }
  } else if ((m = text.match(/(?:om\s+|van\s+|vanaf\s+)?(\d{1,2})\s*(?:uur|u|h|:)\s*(\d{2})?(?![\d,.])(?!\s*(?:euro|eur|€))/))) {
    h = Number(m[1]); min = Number(m[2] || 0);
    if (!/om|van|vanaf|uur|u|h|:/.test(m[0])) h = null;
  }
  if (h == null || h > 23 || min > 59) return null;
  const avond = /'?s\s*(avonds|middags|namiddags)|avond|namiddag|middag/.test(text);
  const ochtend = /'?s\s*(ochtends|morgens)|ochtend|voormiddag/.test(text);
  if (h < 12 && avond && h !== 0) h += 12;
  else if (h >= 1 && h <= 7 && !ochtend) h += 12; // "om 3 uur" bedoelt meestal de namiddag
  return { time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, match: m };
}

function cutOut(text, ...matches) {
  let t = text;
  for (const m of matches) {
    if (!m) continue;
    const i = t.indexOf(m[0]);
    if (i >= 0) t = t.slice(0, i) + ' ' + t.slice(i + m[0].length);
  }
  return t;
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const tidy = (s) => s.replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();

// ───────────── Boodschappenlijst en voorraad ─────────────

const LIST_RE = new RegExp(W('(?:op|aan|bij|naar)\\s+(?:de|het|mijn|onze|ons)?\\s*(?:boodschappen)?(?:lijst|lijstje)|boodschappenlijst(?:je)?|winkellijst(?:je)?'));
const BUY_RE = new RegExp(W('(?:we\\s+)?(?:moeten|moet)\\s+(?:nog\\s+)?(?:.+?)\\s+kopen|koop\\s+(?:nog\\s+)?|nog\\s+kopen|kopen'));
const OUT_RE = new RegExp(W('(?:is|zijn)\\s+(?:bijna\\s+)?op|(?:we\\s+)?(?:hebben|heb)\\s+(?:bijna\\s+)?geen\\s+.+?\\s+meer|is\\s+(?:bijna\\s+)?leeg|zijn\\s+(?:bijna\\s+)?leeg|raakt\\s+op|raken\\s+op'));
const LIST_FILLER = W("zet|zetten|voeg|toevoegen|toe|nog|ook|wat|graag|alsjeblieft|aub|a\\.u\\.b|kopen|koop|we|wij|moeten|moet|ik|er|op|aan|bij|naar|de|het|mijn|onze|ons|boodschappenlijst(?:je)?|winkellijst(?:je)?|lijst|lijstje|boodschappen|hebben|heb|geen|meer|is|zijn|bijna|leeg|raakt|raken|voor|morgen|vandaag|en dan|eens");

export function splitItems(text) {
  return tidy(text.replace(new RegExp(LIST_FILLER, 'g'), ' '))
    ? text
        .split(/,|;|(?<![a-zà-ÿ])(?:en|plus|en ook|ook nog)(?![a-zà-ÿ])/)
        .map((p) => tidy(p.replace(new RegExp(LIST_FILLER, 'g'), ' ')))
        .filter((p) => p && p.length >= 2)
        .map((p) => {
          const ing = parseIngredient(p.replace(/^een\s+/, ''));
          return ing ? { name: ing.name, qty: ing.qty } : null;
        })
        .filter(Boolean)
    : [];
}

// ───────────── Alles samen ─────────────

const MENU_RE = new RegExp(W('(?:week)?menu|(?:eten|koken|maken|bakken)\\s+we|we\\s+(?:eten|koken|maken)|gaan\\s+we\\s+(?:eten|koken)|wat\\s+eten\\s+we'));
const AGENDA_RE = new RegExp(W('agenda|kalender|afspraak|afspraken|herinner(?:ing)?|plan|inplannen'));
const EURO_RE = /(?:€|\beuro\b|\beur\b)/;

export function parseCommand(raw, { today = todayISO(), recipes = [], members = [], allowZaak = true } = {}) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const lower = digitize(text.toLowerCase().replace(/\s+/g, ' '));
  const euro = EURO_RE.test(lower);

  // "De melk is op", "we hebben geen eieren meer"
  if (!euro && OUT_RE.test(lower) && !MENU_RE.test(lower)) {
    const status = has(lower, 'bijna') || has(lower, 'raakt|raken') ? 'bijna' : 'op';
    let body = lower;
    const geen = lower.match(/geen\s+(.+?)\s+meer/);
    if (geen) body = geen[1];
    else body = lower.replace(new RegExp(W('(?:is|zijn)\\s+(?:bijna\\s+)?(?:op|leeg)|raakt\\s+op|raken\\s+op') + '.*$'), '');
    const items = splitItems(body);
    if (items.length) return { kind: 'voorraad', status, items, text };
  }

  if (LIST_RE.test(lower) || (!euro && BUY_RE.test(lower) && !MENU_RE.test(lower))) {
    const items = splitItems(lower);
    if (items.length) return { kind: 'lijst', items, text };
  }

  if (!euro && MENU_RE.test(lower) && !has(lower, 'agenda|afspraak')) {
    const d = findFutureDate(lower, today);
    let meal = cutOut(lower, d.match);
    const slot = has(lower, "'s middags|s middags|middag|middageten|als middageten|lunch|vanmiddag|over de middag") ? 'middag' : 'avond';
    meal = tidy(meal.replace(new RegExp(W("zet|zetten|voeg|toe|op|het|de|ons|onze|(?:week)?menu|voor|eten|koken|maken|bakken|we|wij|gaan|er|is|wat|dan|graag|als|'s avonds|s avonds|avondeten|vanavond|'s middags|s middags|over de middag|middageten|middag|lunch|vanmiddag|'s|deze week"), 'g'), ' '));
    if (meal) {
      const recipe = recipes.find((r) => r.title.toLowerCase() === meal) || recipes.find((r) => r.title.toLowerCase().includes(meal) || meal.includes(r.title.toLowerCase())) || recipes.find((r) => sameThing(r.title, meal));
      return { kind: 'menu', date: d.date || today, slot, meal: recipe ? recipe.title : cap(meal), recipe_id: recipe?.id || null, text };
    }
  }

  const time = euro ? null : findTime(lower);
  if (!euro && (AGENDA_RE.test(lower) || time)) {
    const d = findFutureDate(lower, today);
    const who = members.find((m) => m && new RegExp(W(m.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).test(lower)) || null;
    let title = cutOut(lower, d.match, time?.match);
    if (who) title = title.replace(new RegExp(W('(?:voor|met|van)?\\s*' + who.toLowerCase())), ' ');
    title = tidy(title.replace(new RegExp(W("zet|zetten|voeg|toe|in|de|het|mijn|onze|ons|agenda|kalender|een|nieuwe|afspraak|afspraken|noteer|plan|inplannen|herinner|herinnering|er|is|we|wij|ik|hebben|heb|moet|moeten|naar|bij|om|uur|op|aan|'s avonds|'s ochtends|'s morgens|'s middags|'s namiddags|avond|ochtend|middag|namiddag"), 'g'), ' '));
    if (title) return { kind: 'agenda', title: cap(title), date: d.date || today, time: time?.time || null, who, text };
  }

  const items = parseSpeech(text, { today, allowZaak });
  return { kind: 'geld', items, text };
}
