// Vaste betalingen die nog moeten komen (bv. de afbetaling van het woningkrediet op het einde van de maand).
//
// We kijken naar de uitgaven van de vorige maanden. Een betaling met dezelfde omschrijving die
// elke maand precies één keer terugkomt, met (bijna) hetzelfde bedrag, is "vast". Staat ze deze
// maand nog niet in het boekje, dan tonen we ze als "komt nog".
// Zodra de bank ze boekt (zelfde omschrijving, of zelfde categorie en bedrag rond dezelfde dag),
// verdwijnt ze uit "komt nog", zodat ze nooit twee keer meetelt.

import { shiftMonth } from './format.js';

// Typische bankteksten voor iets dat elke maand terugkomt: dan volstaat het één keer gezien te hebben.
const VAST_WOORD = /krediet|lening|afbetaling|domicili|doorlopende opdracht|huur\b|verzekering/;

// Omschrijving vergelijkbaar maken: hoofdletters, accenten, spaties en datums maken niet uit.
// Cijfers zoals een dossiernummer blijven staan: zo blijven twee kredieten twee aparte betalingen.
export function recurringKey(note) {
  return String(note || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const near = (a, b, pct) => Math.abs(a - b) <= Math.max(100, Math.round(Math.max(a, b) * pct));
const dayDiff = (a, b) => Math.abs(Date.parse(a + 'T12:00:00') - Date.parse(b + 'T12:00:00')) / 86400000;

function sameDayIn(month, date) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const d = Math.min(Number(date.slice(8, 10)), last);
  return `${month}-${String(d).padStart(2, '0')}`;
}

// entries: alle boekingen van één boekje (minstens de vorige 'lookback' maanden en de maand zelf).
// Geeft terug: { pending: [...], paid: [...], total } — total = som van wat nog moet komen.
// Elk item: { key, note, category, amount_cents, date, seen: ['2026-10', ...] }.
export function expectedPayments(entries, month, { lookback = 3, hidden = [] } = {}) {
  const prev = Array.from({ length: lookback }, (_, i) => shiftMonth(month, -(i + 1)));
  const skip = new Set(hidden);
  const byKey = new Map();
  for (const e of entries) {
    if (e.type === 'in' || !e.note) continue;
    const m = e.date.slice(0, 7);
    if (!prev.includes(m)) continue;
    const key = recurringKey(e.note);
    if (!key || skip.has(key)) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(e);
  }

  const vast = [];
  for (const [key, list] of byKey) {
    list.sort((a, b) => b.date.localeCompare(a.date));
    const last = list[0];
    // Het moet recent nog gebeurd zijn: vorige maand of die daarvoor.
    if (last.date.slice(0, 7) !== prev[0] && last.date.slice(0, 7) !== prev[1]) continue;
    // Ongeveer om de maand (een betaling die eens een dag verschuift door een weekend mag),
    // niet elke week zoals de Colruyt.
    if (!list.every((e, i) => i === 0 || (dayDiff(list[i - 1].date, e.date) >= 20 && dayDiff(list[i - 1].date, e.date) <= 40))) continue;
    if (!list.every((e) => near(e.amount_cents, last.amount_cents, 0.1))) continue;
    if (list.length < 2 && !VAST_WOORD.test(key)) continue;
    const seen = [...new Set(list.map((e) => e.date.slice(0, 7)))];
    vast.push({ key, note: last.note, category: last.category, amount_cents: last.amount_cents, date: sameDayIn(month, last.date), seen });
  }

  // Wat is deze maand al geboekt? Eerst op omschrijving, daarna op categorie + bedrag + dag.
  const now = entries.filter((e) => e.type !== 'in' && e.date.slice(0, 7) === month);
  const used = new Set();
  const pending = [];
  const paid = [];
  const match = (v, test) => {
    const hit = now.find((e) => !used.has(e.id) && test(e));
    if (hit) used.add(hit.id);
    return hit;
  };
  const sorted = [...vast].sort((a, b) => a.date.localeCompare(b.date) || b.amount_cents - a.amount_cents);
  const left = sorted.filter((v) => {
    const hit = match(v, (e) => recurringKey(e.note) === v.key);
    if (hit) paid.push({ ...v, entry: hit });
    return !hit;
  });
  for (const v of left) {
    const hit = match(v, (e) => e.category === v.category && near(e.amount_cents, v.amount_cents, 0.01) && dayDiff(e.date, v.date) <= 7);
    if (hit) paid.push({ ...v, entry: hit });
    else pending.push(v);
  }
  pending.sort((a, b) => a.date.localeCompare(b.date) || b.amount_cents - a.amount_cents);
  return { pending, paid, total: pending.reduce((s, v) => s + v.amount_cents, 0) };
}

// "Niet meer verwachten": per boekje op dit toestel onthouden.
const HIDE_KEY = (hid, book) => `boekje-niet-verwacht-${hid}-${book}`;
export function getHidden(hid, book) {
  try { return JSON.parse(localStorage.getItem(HIDE_KEY(hid, book)) || '[]'); } catch { return []; }
}
export function saveHidden(hid, book, list) {
  try { localStorage.setItem(HIDE_KEY(hid, book), JSON.stringify(list)); } catch { /* niet erg */ }
}
