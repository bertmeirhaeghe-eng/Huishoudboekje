// Klusjes: wat er in en rond het huis moet gebeuren. Met een datum komen ze in de Google Agenda.

import { todayISO } from './format.js';

const DAY = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DAY_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const at = (iso) => new Date(iso + 'T12:00:00');
export function shiftDay(iso, n) {
  const d = at(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

// Wat er in de agenda moet komen: wijzigt een van deze, dan moet de agenda mee.
export const AGENDA_FIELDS = ['title', 'note', 'planned_date', 'planned_time', 'done'];

// Moet de agenda bijgewerkt worden na deze wijziging?
export function needsAgenda(before, patch) {
  const changed = AGENDA_FIELDS.some((k) => k in patch && (patch[k] ?? null) !== (before?.[k] ?? null));
  if (!changed) return false;
  // Nooit in de agenda geweest en nog altijd geen datum: niets te doen.
  return Boolean(before?.gcal_event_id || ('planned_date' in patch ? patch.planned_date : before?.planned_date));
}

// Snel een dag kiezen: morgen, zaterdag, volgende week…
export function quickDates(today = todayISO()) {
  const dow = at(today).getDay();
  const toSat = (6 - dow + 7) % 7 || 7;
  const toMon = (8 - dow) % 7 || 7;
  const out = [
    { label: 'Morgen', date: shiftDay(today, 1) },
    { label: dow === 6 ? 'Volgende zaterdag' : 'Zaterdag', date: shiftDay(today, toSat) },
    { label: dow === 0 ? 'Volgende zondag' : 'Zondag', date: shiftDay(today, (7 - dow) % 7 || 7) },
    { label: 'Volgende week', date: shiftDay(today, toMon) },
  ];
  // Geen dubbele dagen (bv. op zaterdag is "morgen" zondag).
  return out.filter((q, i) => out.findIndex((x) => x.date === q.date) === i);
}

// "za 22 nov", met "vandaag" en "morgen" waar dat kan.
export function choreDay(iso, today = todayISO()) {
  if (!iso) return '';
  if (iso === today) return 'Vandaag';
  if (iso === shiftDay(today, 1)) return 'Morgen';
  const d = at(iso);
  const year = d.getFullYear() !== at(today).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}${year}`;
}
export const longDay = (iso) => { const d = at(iso); return `${DAY_LONG[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };

// Ingepland (op datum), nog in te plannen (nieuwste eerst), en gedaan (laatst gedaan eerst).
export function groupChores(chores, today = todayISO()) {
  const open = chores.filter((c) => !c.done);
  const planned = open.filter((c) => c.planned_date)
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date) || String(a.planned_time || '').localeCompare(String(b.planned_time || '')));
  const late = planned.filter((c) => c.planned_date < today);
  return {
    late,
    planned: planned.filter((c) => c.planned_date >= today),
    later: open.filter((c) => !c.planned_date).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    done: chores.filter((c) => c.done).sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || ''))),
  };
}

// Staat het klusje (zoals het nu is) in de agenda?
export function agendaState(c, linked) {
  if (!c.planned_date) return null;
  if (!linked) return 'niet-gekoppeld';
  if (c.gcal_dirty || !c.gcal_event_id) return 'bezig';
  return 'ok';
}

// ───────────── Foto ─────────────

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => reject(new Error('Deze foto kan ik niet openen.'));
    img.src = url;
  });
}

function shrink(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

// Een klein fotootje voor de lijst en een grotere om goed te zien wat er moet gebeuren.
export async function chorePhoto(file) {
  const img = await loadImage(file);
  let photo = shrink(img, 1280, 0.72);
  if (photo.length > 650000) photo = shrink(img, 960, 0.62);
  return { thumb: shrink(img, 200, 0.7), photo };
}
