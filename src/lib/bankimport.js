// Bankafschrift (CSV) inlezen en omzetten naar boekingen met een voorstel van categorie.
// Gemaakt voor Crelan, maar herkent ook de gebruikelijke kolommen van andere Belgische banken.

import { findRule } from './voice.js';

// ───────────── CSV ─────────────

export function parseCSV(text) {
  const t = String(text || '').replace(/^﻿/, '');
  const first = t.split('\n')[0] || '';
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Welke kolom is wat? Werkt op de kolomnamen.
const COLS = {
  date: ['datum', 'boekingsdatum', 'uitvoeringsdatum', 'valutadatum', 'transactiedatum', 'date'],
  amount: ['bedrag', 'amount', 'bedrag in eur'],
  name: ['tegenpartij', 'naam tegenpartij', 'naam van de tegenpartij', 'naam tegenpartij bevat', 'naam / omschrijving', 'begunstigde', 'counterparty'],
  account: ['rekening tegenpartij', 'rekening van de tegenpartij', 'rekeningnummer tegenpartij', 'tegenrekening'],
  type: ['type verrichting', 'type', 'omschrijving verrichting', 'transactietype'],
  saldo: ['saldo na verrichting', 'saldo'],
  note: ['mededeling', 'mededelingen', 'vrije mededeling', 'omschrijving', 'details', 'description'],
};

function columns(header) {
  const h = header.map(norm);
  const find = (names) => {
    for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; }
    for (const n of names) { const i = h.findIndex((x) => x.startsWith(n)); if (i >= 0) return i; }
    return -1;
  };
  const c = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, find(v)]));
  if (c.note === c.type) c.note = -1;
  return c;
}

export function parseBankAmount(s) {
  let t = String(s || '').replace(/[€\s]|EUR/gi, '');
  if (!t) return null;
  const neg = /^-|-$/.test(t) || /^\(.*\)$/.test(t);
  t = t.replace(/[-+()]/g, '');
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) * (neg ? -1 : 1);
}

export function parseBankDate(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// "CRF MKT GENT        GENT" -> "CRF MKT GENT"; kaartnummers en tijdstippen eruit.
export function cleanName(name, note, type) {
  let n = String(name || '').replace(/\s{2,}.*$/, '').replace(/\s+P2P MOBILE$/i, '').trim();
  if (!n || n === '"' || /^vervaldag krediet/i.test(n)) {
    if (/krediet/i.test(n) || /kredietlasten/i.test(type)) return 'Afbetaling krediet';
    const m = String(note || '').replace(/\d{2}-\d{2}-\d{4}.*$/, '').trim();
    return m || String(type || '').trim() || 'Bankverrichting';
  }
  return n.replace(/^Doccle\s*-\s*/i, '').replace(/^(Dhr|Mevr|Mr|Mw)\.?\s+/i, '').trim();
}

// ───────────── Categorie voorstellen ─────────────

const BANK_RULES = [
  { cat: 'boodschappen', words: ['crf mkt', 'carrefour', 'colruyt', 'albert heijn', 'delhaize', 'aldi', 'lidl', 'okay', 'spar', 'intermarche', 'jumbo', 'bakkerij', 'bakker', 'brood', 'slagerij', 'beenhouwerij', 'vleeshandel', 'groente en fruit', 'groenten', 'viscentrale', 'vishandel', 'drankcenter', 'too good to go', 'kruidvat', 'markt', 'consum', 'patisserie', 'mercadona'] },
  { cat: 'wonen', words: ['krediet', 'kredietlasten', 'woonkrediet', 'engie', 'electrabel', 'luminus', 'eneco', 'fluvius', 'watergroep', 'farys', 'imog', 'ivbo', 'hubo', 'brico', 'gamma', 'ikea', 'schrijnwerk', 'loodgieter'] },
  { cat: 'verzekering', words: ['baloise', 'cm verzekeringen', 'verzekeringen cm', 'ag insurance', 'ethias', 'axa', 'p&v', 'kbc verzekeringen', 'allianz', 'dvv', 'budgetplan'] },
  { cat: 'gezondheid', words: ['apotheek', 'farmacia', 'pharmacie', 'pharma', 'tandarts', 'dokter', 'huisarts', 'ziekenhuis', 'az ', 'kine', 'opticien'] },
  { cat: 'kinderen', words: ['school', 'basisschool', 'chiro', 'scouts', 'ksa', 'kinderopvang', 'baby', 'speelgoed', 'jeugd'] },
  { cat: 'abonnement', words: ['telenet', 'proximus', 'orange', 'base ', 'mobile vikings', 'netflix', 'spotify', 'disney', 'streamz', 'youtube', 'apple.com', 'google'] },
  { cat: 'vrije_tijd', words: ['bibliotheek', 'sport', 'zwembad', 'cinema', 'kinepolis', 'pretpark', 'museum', 'concert', 'ryanair', 'brussels airlines', 'booking', 'airbnb', 'hotel'] },
  { cat: 'kleding', words: ['mode', 'zara', 'h&m', 'primark', 'zeeman', 'jbc', 'c&a', 'schoenen'] },
  { cat: 'uit_eten', words: ['restaurant', 'resto', 'frituur', 'frietkot', 'pizza', 'cafe', 'brasserie', 'mcdonald', 'quick', 'domino', 'takeaway', 'deliveroo', 'uber eats'] },
  { cat: 'auto', words: ['tank', 'brandstof', 'q8', 'esso', 'total', 'shell', 'texaco', 'lukoil', 'dats 24', 'parking', 'garage', 'carwash'] },
];
const IN_RULES = [
  { cat: 'groeipakket', words: ['groeipakket', 'parentia', 'kidslife', 'fons', 'infino', 'gezinsbijslag'] },
  { cat: 'terugbetaling', words: ['mutualiteit', 'ziekenfonds', ' cm ', 'christelijke mutualiteit', 'helan', 'solidaris', 'partena', 'terugbetaling', 'federal finance', 'financien', 'belastingen'] },
  { cat: 'loon', words: ['loon', 'salaris', 'wedde', 'pensioen', 'vakantiegeld', 'eindejaarspremie', 'bezoldiging'] },
];
const BANK_COSTS = /debetintresten|recht op geschriften|debetkaart|beheerskosten|kosten|intresten/i;
const CASH = /opneming|geldopneming|atm|storting banksys|storting/i;

function match(rules, text) {
  for (const r of rules) {
    for (const w of r.words) if (text.includes(w)) return r.cat;
  }
  return null;
}

export function suggestCategory({ type, name, note, kind }) {
  const text = ' ' + norm(`${name} ${note} ${kind}`).replace(/\s+/g, ' ') + ' ';
  if (type === 'in') {
    return match(IN_RULES, text) || 'andere_in';
  }
  if (BANK_COSTS.test(kind)) return 'andere';
  if (/brandstof/i.test(kind)) return 'auto';
  const own = match(BANK_RULES, text);
  if (own) return own;
  const hit = findRule(text);
  if (hit && !hit.rule.type && !hit.rule.book) return hit.rule.cat;
  return 'andere';
}

// ───────────── Alles samen ─────────────

// Geeft { bank, rows } terug, of gooit een fout met uitleg.
export function readBankCSV(text, { ownNames = [] } = {}) {
  const table = parseCSV(text);
  if (table.length < 2) throw new Error('Dit bestand bevat geen verrichtingen.');
  const hi = table.findIndex((r) => r.some((c) => /^(datum|boekingsdatum|uitvoeringsdatum)$/i.test(c.trim())));
  if (hi < 0) throw new Error('Ik herken dit bestand niet. Exporteer de verrichtingen als CSV uit je homebanking.');
  const c = columns(table[hi]);
  if (c.date < 0 || c.amount < 0) throw new Error('Ik vind geen kolom met de datum of het bedrag.');
  const header = table[hi].map(norm).join('|');
  const bank = /saldo na verrichting/.test(header) && /rekening opdrachtgever/.test(header) ? 'Crelan' : 'Bank';
  const own = ownNames.map(norm).filter((x) => x.length >= 3);

  const rows = [];
  const seen = new Set();
  for (const r of table.slice(hi + 1)) {
    // Staat exact dezelfde lijn (met hetzelfde saldo erna) twee keer in het bestand? Dan is het een dubbele lijn.
    // Twee echte koffies hebben elk een ander saldo erna, die blijven allebei.
    if (c.saldo >= 0 && r[c.saldo]?.trim()) {
      const line = r.map((x) => x.trim()).join('|');
      if (seen.has(line)) continue;
      seen.add(line);
    }
    const date = parseBankDate(r[c.date]);
    const cents = parseBankAmount(r[c.amount]);
    if (!date || !cents) continue;
    const rawName = c.name >= 0 ? r[c.name] : '';
    const note = c.note >= 0 ? r[c.note] : '';
    const kind = c.type >= 0 ? r[c.type] : '';
    const type = cents > 0 ? 'in' : 'uit';
    const name = cleanName(rawName, note, kind);
    const nameN = norm(rawName);
    const isOwn = own.some((o) => nameN.includes(o) || o.split(/\s+/).filter((w) => w.length >= 3).every((w) => nameN.includes(w)));
    const isCash = CASH.test(kind);
    const memo = /\d{2}-\d{2}-\d{4} \d{2}:\d{2}/.test(note) || /^[\d/+*\s]+$/.test(note) ? '' : note.trim();
    rows.push({
      date,
      type,
      amount_cents: Math.abs(cents),
      category: suggestCategory({ type, name: rawName, note, kind }),
      note: (memo && memo.length <= 60 && !/^\/C\//.test(memo) ? `${name}: ${memo}` : name).slice(0, 300),
      kind: kind.trim(),
      own: isOwn,
      cash: isCash,
    });
  }
  if (!rows.length) throw new Error('Ik vond geen verrichtingen in dit bestand.');
  return { bank, rows: rows.sort((a, b) => b.date.localeCompare(a.date)) };
}

// Datum verschuiven: '2026-01-05' + 2 -> '2026-01-07'.
export function shiftDate(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Hoe ver een zelf ingetypte of ingesproken boeking van de bankdatum mag liggen.
// De bank boekt een kaartbetaling vaak een paar dagen later (weekend, feestdag).
export const NEAR_BEFORE = 5;
export const NEAR_AFTER = 2;

const dayDiff = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);

// Welke rijen staan al in het boekje?
// 1. Zelfde dag, bedrag en soort: staat er al (vorige import of zelf ingegeven). Niet aangevinkt.
// 2. Zelfde bedrag en soort, maar een paar dagen ervoor of erna: staat er misschien al
//    (bv. ingesproken op zaterdag, door de bank geboekt op maandag). Ook niet aangevinkt, met uitleg.
// Elke bestaande boeking telt maar voor één rij.
// Ook twee keer hetzelfde bestand (of twee bestanden die elkaar overlappen) geeft zo geen dubbels.
export function markDuplicates(rows, existing) {
  const left = existing.map((e) => ({ ...e, used: false }));
  const dup = new Map();
  const maybe = new Map();
  // Eerst de rijen die we zouden importeren, zodat cash of eigen overschrijvingen geen match "opgebruiken".
  const order = rows.map((r, i) => i).sort((a, b) => Number(Boolean(rows[a].own || rows[a].cash)) - Number(Boolean(rows[b].own || rows[b].cash)));
  for (const i of order) {
    const r = rows[i];
    const e = left.find((x) => !x.used && x.date === r.date && x.amount_cents === r.amount_cents && x.type === r.type);
    if (e) { e.used = true; dup.set(i, e.note || ''); }
  }
  for (const i of order) {
    if (dup.has(i)) continue;
    const r = rows[i];
    let best = null;
    for (const x of left) {
      if (x.used || x.amount_cents !== r.amount_cents || x.type !== r.type) continue;
      // Exact dezelfde omschrijving op een andere dag is een eerder geïmporteerde, terugkerende aankoop
      // (elke dag brood bij dezelfde bakker), geen dubbel.
      if (r.note && x.note === r.note) continue;
      const d = dayDiff(r.date, x.date); // > 0: zelf ingegeven vóór de bankdatum
      if (d > NEAR_BEFORE || d < -NEAR_AFTER) continue;
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { x, d };
    }
    if (best) { best.x.used = true; maybe.set(i, { date: best.x.date, note: best.x.note || '' }); }
  }
  return rows.map((r, i) => ({ ...r, dup: dup.has(i), dupNote: dup.get(i) || '', maybe: maybe.get(i) || null }));
}
