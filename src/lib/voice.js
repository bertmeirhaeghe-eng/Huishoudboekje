// Begrijpt Nederlandse (Vlaamse) zinnen zoals "25 euro tanken" of "gisteren 64,30 bij Delhaize".
// Werkt volledig op het toestel, zonder internet en zonder kosten.

import { todayISO } from './format.js';

// ───────────── Getallen in woorden ─────────────

const UNITS = { nul: 0, een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18, negentien: 19 };
const TENS = { twintig: 20, dertig: 30, veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80, negentig: 90 };

// "vijfentwintig" -> 25, "driehonderdvijftig" -> 350, "tweeduizend" -> 2000. Geen getal -> null.
export function wordToNumber(w) {
  if (!w) return null;
  w = w.toLowerCase().replace(/[ë]/g, 'e').replace(/-/g, '');
  if (/^\d+$/.test(w)) return Number(w);
  if (w === 'honderd') return 100;
  if (w === 'duizend') return 1000;
  const k = w.indexOf('duizend');
  if (k >= 0) {
    const before = w.slice(0, k);
    const after = w.slice(k + 7);
    const a = before ? wordToNumber(before) : 1;
    const b = after ? wordToNumber(after) : 0;
    return a == null || b == null ? null : a * 1000 + b;
  }
  const h = w.indexOf('honderd');
  if (h >= 0) {
    const before = w.slice(0, h);
    const after = w.slice(h + 7).replace(/^en/, '');
    const a = before ? wordToNumber(before) : 1;
    const b = after ? wordToNumber(after) : 0;
    return a == null || b == null || a > 99 ? null : a * 100 + b;
  }
  if (w in UNITS) return UNITS[w];
  if (w in TENS) return TENS[w];
  const m = w.match(/^(een|twee|drie|vier|vijf|zes|zeven|acht|negen)en(twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig)$/);
  if (m) return UNITS[m[1]] + TENS[m[2]];
  return null;
}

// Spraak schrijft een kommagetal soms als "85, 25" of "85 komma 25". Maak er "85,25" van.
export function joinDecimals(text) {
  return text
    .replace(/(\d)\s*(?:komma|punt)\s*(\d{1,2})(?!\d)/gi, '$1,$2')
    .replace(/(\d),\s+(\d{2})(?![\d,.])(?!\s*(?:uur|u\b))/g, '$1,$2')
    .replace(/(\d),\s+(\d)(?![\d,.])(?=\s*(?:euro|eur|€))/gi, '$1,$2');
}

// Zet getallen in woorden om naar cijfers: "vijfentwintig euro vijftig" -> "25 euro 50".
export function digitize(text) {
  return joinDecimals(text)
    .split(/(\s+)/)
    .map((tok) => {
      const n = wordToNumber(tok);
      return n != null && !/^\d+$/.test(tok) && tok !== 'een' && tok !== 'één' ? String(n) : tok;
    })
    .join('')
    .replace(/\banderhalve?\b/g, '1,5')
    .replace(/\bhalve\b/g, '0,5')
    .replace(/(\d)\s*(?:komma|punt)\s*(\d{1,2})(?!\d)/gi, '$1,$2');
}

// ───────────── Bedrag ─────────────

// Zoekt het bedrag en geeft { cents, start, end } terug.
export function findAmount(text) {
  const t = text;
  const patterns = [
    // 25 euro 50 / 25 euro en 50 cent
    /(?:€\s*)?(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*(?:euro|eur|€)\s*(?:en\s*)?(\d{1,2})\b(?!\s*(?:uur|u\b|euro|\/|-))(?:\s*cent)?/,
    // 25,50 euro / € 25,50 / 25.50
    /€\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:[,.](\d{1,2}))?\b/,
    /(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(?:euro|eur|€)/,
    /(\d{1,3}(?:\.\d{3})+|\d+)[,.](\d{1,2})\b/,
    // los getal (laatste redmiddel), niet als het een uur, dag of datum is
    /(?<![\d\/:-])(\d+)(?![\d\/:-])(?!\s*(?:uur|u\b|november|december|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|ste\b|de\b))/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const euros = Number(String(m[1]).replace(/[.\s]/g, ''));
      let cents = m[2] ? Number(m[2].length === 1 ? m[2] + '0' : m[2]) : 0;
      if (!Number.isFinite(euros)) continue;
      return { cents: euros * 100 + cents, start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

// ───────────── Datum ─────────────

const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export function findDate(text, today = todayISO()) {
  const base = new Date(today + 'T12:00:00');
  const shift = (days) => { const d = new Date(base); d.setDate(d.getDate() + days); return todayISO(d); };
  let m;
  if ((m = text.match(/\beergisteren\b/))) return { date: shift(-2), match: m };
  if ((m = text.match(/\bgisteren\b/))) return { date: shift(-1), match: m };
  if ((m = text.match(/\bvandaag\b/))) return { date: today, match: m };
  if ((m = text.match(/\b(?:op\s+)?(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\b/))) {
    const month = MONTHS.indexOf(m[2]);
    let y = base.getFullYear();
    if (month > base.getMonth()) y -= 1; // een datum in de toekomst bedoelt meestal vorig jaar
    const d = new Date(y, month, Number(m[1]), 12);
    return { date: todayISO(d), match: m };
  }
  if ((m = text.match(/\b(?:op\s+)?(\d{1,2})\/(\d{1,2})\b/))) {
    const d = new Date(base.getFullYear(), Number(m[2]) - 1, Number(m[1]), 12);
    if (d > base) d.setFullYear(d.getFullYear() - 1);
    return { date: todayISO(d), match: m };
  }
  if ((m = text.match(/\b(?:vorige\s+|afgelopen\s+)?(zondag|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag)\b/))) {
    const target = DAYS.indexOf(m[1]);
    let diff = base.getDay() - target;
    if (diff <= 0) diff += 7; // altijd de laatst voorbije dag
    return { date: shift(-diff), match: m };
  }
  return { date: today, match: null };
}

// ───────────── Categorie ─────────────

// Trefwoorden per categorie. Volgorde telt: specifiekere eerst.
const RULES = [
  // Zaak, uitgaven
  { cat: 'resto_klant', book: 'zaak', words: ['met een klant', 'met klant', 'zakenlunch', 'zakendiner', 'lunch met', 'etentje met klant'] },
  { cat: 'it_materiaal', book: 'zaak', words: ['laptop', 'computer', 'pc', 'scherm', 'monitor', 'software', 'licentie', 'server', 'hosting', 'domeinnaam', 'muis', 'toetsenbord', 'harde schijf'] },
  { cat: 'bbq_materiaal', book: 'zaak', words: ['bbq', 'barbecue', 'houtskool', 'grill', 'rooster', 'smoker', 'aanmaakblokjes', 'briketten'] },
  { cat: 'boekhouder', book: 'zaak', words: ['boekhouder', 'accountant', 'boekhouding'] },
  { cat: 'opleiding', book: 'zaak', words: ['opleiding', 'cursus', 'training', 'seminarie', 'congres', 'vakboek'] },
  { cat: 'ingredienten', book: 'zaak', words: ['ingrediënten', 'ingredienten', 'groothandel', 'makro', 'hanos', 'bidfood'] },
  { cat: 'loon_prive', book: 'zaak', words: ['loon naar privé', 'loon naar prive', 'mezelf uitbetaald', 'bezoldiging'] },
  // Zaak, inkomsten
  { cat: 'factuur_it', book: 'zaak', type: 'in', words: ['factuur', 'consultancy', 'it-opdracht', 'it opdracht', 'klant betaald', 'klant heeft betaald'] },
  { cat: 'workshop', book: 'zaak', type: 'in', words: ['workshop'] },
  { cat: 'catering', book: 'zaak', type: 'in', words: ['catering', 'traiteur'] },
  // Gezin, inkomsten
  { cat: 'loon', type: 'in', words: ['loon', 'salaris', 'wedde', 'pensioen', 'vakantiegeld', 'eindejaarspremie'] },
  { cat: 'groeipakket', type: 'in', words: ['groeipakket', 'kindergeld', 'kinderbijslag'] },
  { cat: 'terugbetaling', type: 'in', words: ['terugbetaling', 'terugbetaald', 'mutualiteit', 'ziekenfonds', 'cm ', 'teruggestort', 'terug gekregen', 'teruggekregen'] },
  // Gezin, uitgaven (bij een zaakzin vertalen we sommige naar de zaakcategorie)
  { cat: 'auto', zaak: 'auto_zaak', words: ['tanken', 'getankt', 'benzine', 'diesel', 'brandstof', 'opladen', 'laadpaal', 'parking', 'parkeren', 'garage', 'onderhoud auto', 'carwash', 'banden', 'auto', 'wagen', 'tolweg', 'vignet'] },
  { cat: 'telefoon', book: 'zaak', words: ['proximus', 'telenet', 'orange', 'mobile vikings', 'gsm-rekening', 'gsm rekening', 'telefoonrekening', 'internetrekening'] },
  { cat: 'boodschappen', zaak: 'ingredienten', words: ['boodschappen', 'supermarkt', 'winkel', 'delhaize', 'colruyt', 'aldi', 'lidl', 'carrefour', 'albert heijn', 'okay', 'spar', 'intermarché', 'intermarche', 'jumbo', 'bakker', 'beenhouwer', 'slager', 'brood', 'melk', 'groenten', 'fruit', 'vlees', 'markt'] },
  { cat: 'uit_eten', zaak: 'resto_klant', words: ['restaurant', 'resto', 'frietkot', 'frituur', 'friet', 'pizza', 'take-away', 'takeaway', 'afhaal', 'sushi', 'kebab', 'café', 'cafe', 'uit eten', 'gaan eten', 'iets gaan drinken', 'brasserie', 'lunch', 'ontbijt'] },
  { cat: 'wonen', words: ['huur', 'woonkrediet', 'lening huis', 'hypotheek', 'elektriciteit', 'stroom', 'gas', 'water', 'energie', 'verwarming', 'stookolie', 'mazout', 'meubel', 'ikea', 'brico', 'gamma', 'hubo', 'klusjes', 'loodgieter', 'schilder'] },
  { cat: 'kinderen', words: ['school', 'schoolreis', 'kinderopvang', 'opvang', 'crèche', 'creche', 'speelgoed', 'zakgeld', 'kinderen', 'luiers', 'jeugdbeweging', 'chiro', 'scouts', 'ksa'] },
  { cat: 'gezondheid', words: ['apotheek', 'dokter', 'huisarts', 'tandarts', 'ziekenhuis', 'kinesist', 'kiné', 'kine', 'medicijnen', 'medicatie', 'bril', 'lenzen', 'specialist'] },
  { cat: 'vrije_tijd', words: ['cinema', 'film', 'sport', 'voetbal', 'fitness', 'zwembad', 'uitstap', 'pretpark', 'hobby', 'vakantie', 'concert', 'museum', 'boek', 'spel', 'game', 'dagje uit'] },
  { cat: 'kleding', words: ['kleren', 'kleding', 'schoenen', 'jas', 'broek', 'trui', 'kleedje', 'zara', 'h&m', 'primark', 'zeeman', 'jbc'] },
  { cat: 'verzekering', words: ['verzekering', 'polis', 'familiale', 'brandverzekering', 'autoverzekering'] },
  { cat: 'abonnement', zaak: 'telefoon', words: ['netflix', 'spotify', 'disney', 'streamz', 'abonnement', 'streaming', 'krant', 'internet', 'gsm'] },
  { cat: 'cadeaus', words: ['cadeau', 'cadeautje', 'geschenk', 'verjaardag', 'kado', 'sinterklaas', 'kerstcadeau'] },
];

const ZAAK_WORDS = /(?<![a-zà-ÿ])(op de zaak|voor de zaak|zaak|vennootschap|bedrijf|firma|zakelijk|professioneel|beroepskost|bv)(?![a-zà-ÿ])/;
const GEZIN_WORDS = /(?<![a-zà-ÿ])(privé|prive|gezin|thuis|persoonlijk)(?![a-zà-ÿ])/;
const IN_WORDS = /(?<![a-zà-ÿ])(ontvangen|gekregen|kreeg|inkomst|inkomsten|verdiend|binnengekomen|binnen gekregen|gestort op|storting|betaald gekregen|uitbetaald)(?![a-zà-ÿ])/;
const OUT_WORDS = /(?<![a-zà-ÿ])(uitgegeven|betaald|gekocht|kost|kostte|uitgave|aankoop)(?![a-zà-ÿ])/;

export function findRule(text) {
  for (const r of RULES) {
    for (const w of r.words) {
      const re = new RegExp('(^|[^a-zà-ÿ])' + w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-zà-ÿ]|$)');
      const m = text.match(re);
      if (m) return { rule: r, word: w.trim(), index: m.index + m[1].length };
    }
  }
  return null;
}

// ───────────── Alles samen ─────────────

const FILLER = /(?<![a-zà-ÿ])(ik|we|wij|heb|hebben|heeft|net|juist|voor|bij|aan|in|de|het|een|van|op|met|euro|eur|cent|en|is|was|zet|zetten|maar|toevoegen|noteer|noteren|graag|uitgegeven|betaald|gekocht|ontvangen|gekregen|vandaag|gisteren|eergisteren|op de zaak|voor de zaak|zaak|privé|prive|gezin|uitgave|inkomst)(?![a-zà-ÿ])/g;

function cleanNote(text, amount, date) {
  let t = text;
  const cut = (s, e) => { t = t.slice(0, s) + ' '.repeat(e - s) + t.slice(e); };
  if (amount) cut(amount.start, amount.end);
  if (date?.match) cut(date.match.index, date.match.index + date.match[0].length);
  t = t.replace(/[€,.!?]/g, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 3) return null;
  t = t.slice(0, 60);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Eén opdracht ("25 euro tanken") -> boeking.
export function parseOne(raw, { today = todayISO(), allowZaak = true } = {}) {
  const lower = digitize(raw.toLowerCase().replace(/\s+/g, ' ').trim());
  const amount = findAmount(lower);
  const date = findDate(lower, today);
  const hit = findRule(lower);

  let book = 'gezin';
  if (ZAAK_WORDS.test(lower)) book = 'zaak';
  else if (!GEZIN_WORDS.test(lower) && hit?.rule.book === 'zaak') book = 'zaak';
  if (!allowZaak) book = 'gezin';

  let type = 'uit';
  if (hit?.rule.type === 'in') type = 'in';
  if (IN_WORDS.test(lower) && !OUT_WORDS.test(lower.replace(/betaald gekregen|uitbetaald/g, ''))) type = 'in';

  let category = null;
  if (hit) {
    const r = hit.rule;
    if (book === 'zaak') category = r.book === 'zaak' ? r.cat : r.zaak || null;
    else category = r.book === 'zaak' ? (r.type === 'in' ? 'andere_in' : 'andere') : r.cat;
    if (category && type === 'in' && r.type !== 'in') category = null;
    if (category && type === 'uit' && r.type === 'in') type = 'in';
  }
  if (!category) {
    category = book === 'zaak' ? (type === 'in' ? 'andere_zaak_in' : 'andere_zaak') : (type === 'in' ? 'andere_in' : 'andere');
  }

  const missing = [];
  if (!amount || amount.cents <= 0) missing.push('bedrag');
  if (!hit) missing.push('categorie');

  return {
    text: raw.trim(),
    type,
    book,
    amount_cents: amount ? amount.cents : 0,
    category,
    date: date.date,
    note: cleanNote(lower, amount, date),
    missing,
  };
}

// Een zin kan meerdere boekingen bevatten: "25 euro tanken en 12 euro bij de bakker".
export function parseSpeech(raw, opts = {}) {
  const text = joinDecimals(digitize(String(raw || '').trim()));
  if (!text) return [];
  const parts = text
    .split(/\s*(?:,(?!\d)|(?<!\d),|;|\ben daarna\b|\ben ook\b|\ben\b|\bplus\b)\s*(?=(?:[^\s]+\s+){0,3}?(?:€\s*)?\d|(?:[^\s]+\s+){0,3}?[a-zë]+(?:en)?(?:twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig|honderd|duizend|tien|twaalf|elf)\b)/i)
    .filter((p) => p && p.trim());
  // Alleen opsplitsen als elk deel een bedrag heeft; anders is het één opdracht.
  const parsed = parts.map((p) => parseOne(p, opts));
  if (parts.length > 1 && parsed.every((p) => p.amount_cents > 0)) return parsed;
  return [parseOne(text, opts)];
}
