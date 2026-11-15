// Bedragen worden overal als centen (gehele getallen) bewaard, zo zijn er geen afrondingsfouten.

const eur = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' });
const eurRound = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function money(cents, { round = false } = {}) {
  return (round ? eurRound : eur).format((cents || 0) / 100);
}

// "25" -> 2500, "25,5" -> 2550, "1.234,56" -> 123456. Ongeldig -> null.
export function parseAmount(text) {
  if (text == null) return null;
  let t = String(text).trim().replace(/\s|€/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Maand als "2026-11".
export function monthKey(d = new Date()) {
  return todayISO(d).slice(0, 7);
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` };
}

const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const monthShort = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const dayNames = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${monthNames[m - 1]} ${y}`;
}

export function monthShortLabel(key) {
  return monthShort[Number(key.split('-')[1]) - 1];
}

export function dayLabel(iso, today = todayISO()) {
  if (iso === today) return 'Vandaag';
  const t = new Date(today + 'T12:00:00');
  t.setDate(t.getDate() - 1);
  if (iso === todayISO(t)) return 'Gisteren';
  const d = new Date(iso + 'T12:00:00');
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

export function longToday(d = new Date()) {
  const s = `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
