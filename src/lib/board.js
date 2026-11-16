// Kleine hulpjes voor het weekbord op de tablet.
import { addDays } from './kitchen.js';
import { todayISO } from './format.js';

const DAY = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTH = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function nowTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "Vandaag", "Morgen", "Woensdag 18". Lang: "Maandag 16 november".
export function boardDayTitle(iso, today, long = false) {
  const d = new Date(iso + 'T12:00:00');
  if (long) return cap(`${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`);
  if (iso === today) return 'Vandaag';
  if (iso === addDays(today, 1)) return 'Morgen';
  return cap(`${DAY[d.getDay()]} ${d.getDate()}`);
}

// Wat toont de ruststand? Tot 20 uur vandaag, daarna al morgen.
export function pickDayForIdle(now = new Date()) {
  const today = todayISO(now);
  if (now.getHours() >= 20) return { iso: addDays(today, 1), label: 'Morgen' };
  return { iso: today, label: 'Vandaag' };
}

// Grootte van de foto's uit een gedeeld Google Foto's-album: zo groot als het scherm, niet groter.
export function sizedPhoto(url, w, h) {
  const base = String(url).replace(/=[^/]*$/, '');
  return `${base}=w${Math.min(2560, Math.round(w))}-h${Math.min(2560, Math.round(h))}`;
}

// Wanneer eten we? Zo staan de maaltijden tussen de afspraken op de juiste plek.
export const MEAL_TIMES = { middag: ['12:00', '13:00'], avond: ['18:00', '19:00'] };

// Alles van één dag in volgorde van het uur: eerst wat de hele dag duurt, dan per uur.
// meals: { middag: {meal} | null, avond: {meal} | null }
export function dayTimeline(meals, events = []) {
  const items = [
    ...Object.entries(MEAL_TIMES).map(([slot, [time, endTime]]) => ({ kind: 'meal', slot, time, endTime, meal: meals[slot] || null })),
    ...events.map((e) => ({ kind: 'event', ...e })),
  ];
  const key = (x) => (x.time ? x.time : '');
  return items.sort((a, b) => key(a).localeCompare(key(b)) || (a.kind === 'meal' ? -1 : 1) - (b.kind === 'meal' ? -1 : 1));
}

// Wat staat er nog te gebeuren? Alles waarvan het einde nog niet voorbij is.
export function stillComing(items, now) {
  return items.filter((x) => !x.time || (x.endTime || x.time) > now);
}
