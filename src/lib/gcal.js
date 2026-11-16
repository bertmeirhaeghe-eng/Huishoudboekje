// Google Agenda: afspraken lezen en toevoegen, rechtstreeks vanuit de browser.
// Gratis: Google Identity Services geeft een toegangssleutel van een uur, zonder server.

import { GOOGLE_CLIENT_ID } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const TOKEN_KEY = 'boekje-gcal-token';
const CAL_KEY = 'boekje-gcal-calendar';
const API = 'https://www.googleapis.com/calendar/v3';
export const TZ = 'Europe/Brussels';

export const gcalConfigured = () => Boolean(GOOGLE_CLIENT_ID);

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeJSON(key, v) {
  try { v == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export function getToken() {
  const t = readJSON(TOKEN_KEY);
  return t && t.expires > Date.now() + 60000 ? t.access_token : null;
}
export function wasConnected() { return Boolean(readJSON(TOKEN_KEY)); }
export function calendarId() { return readJSON(CAL_KEY)?.id || 'primary'; }
export function calendarName() { return readJSON(CAL_KEY)?.name || 'Hoofdagenda'; }
export function setCalendar(id, name) { writeJSON(CAL_KEY, { id, name }); }
export function disconnect() {
  const t = readJSON(TOKEN_KEY);
  writeJSON(TOKEN_KEY, null);
  if (t?.access_token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t.access_token, () => {});
}

let gisPromise;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gisPromise = null; reject(new Error('Google is niet bereikbaar. Controleer je internet.')); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

// Moet vanuit een tik van de gebruiker gebeuren (anders blokkeert de browser het venster).
export async function connect({ silent = false } = {}) {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google Agenda is nog niet ingesteld.');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      ...(silent ? { prompt: '' } : {}),
      callback: (r) => {
        if (r.error) { reject(new Error(r.error === 'access_denied' ? 'Je gaf geen toestemming voor Google Agenda.' : 'Aanmelden bij Google lukte niet.')); return; }
        writeJSON(TOKEN_KEY, { access_token: r.access_token, expires: Date.now() + Number(r.expires_in || 3600) * 1000 });
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e?.type === 'popup_closed' ? 'Het Google-venster werd gesloten.' : 'Aanmelden bij Google lukte niet.')),
    });
    client.requestAccessToken();
  });
}

async function call(path, { method = 'GET', body, params } = {}) {
  const token = getToken();
  if (!token) { const e = new Error('Opnieuw verbinden met Google nodig.'); e.needsAuth = true; throw e; }
  const url = new URL(API + path);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { writeJSON(TOKEN_KEY, null); const e = new Error('Opnieuw verbinden met Google nodig.'); e.needsAuth = true; throw e; }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Google Agenda gaf een fout.');
  return data;
}

export async function listCalendars() {
  const r = await call('/users/me/calendarList', { params: { minAccessRole: 'writer' } });
  return (r.items || []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, primary: Boolean(c.primary), color: c.backgroundColor }));
}

// Afspraken tussen twee datums (YYYY-MM-DD, tot en met).
export async function listEvents(from, to) {
  const r = await call(`/calendars/${encodeURIComponent(calendarId())}/events`, {
    params: { timeMin: `${addDay(from, -1)}T00:00:00Z`, timeMax: `${addDay(to)}T23:59:59Z`, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: TZ },
  });
  return (r.items || []).filter((e) => e.status !== 'cancelled').map(fromGoogle).filter((e) => e.date >= from && e.date <= to);
}

export async function addEvent(ev) {
  const r = await call(`/calendars/${encodeURIComponent(calendarId())}/events`, { method: 'POST', body: toGoogle(ev) });
  return fromGoogle(r);
}

export async function deleteEvent(id) {
  await call(`/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function addDay(iso, n = 1) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function plusMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + minutes;
  const dayShift = Math.floor(t / 1440);
  const r = ((t % 1440) + 1440) % 1440;
  return { time: `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`, dayShift };
}

// { title, date, time?, minutes? } -> Google-formaat
export function toGoogle({ title, date, time, minutes = 60, who }) {
  const summary = who ? `${title} (${who})` : title;
  if (!time) return { summary, start: { date }, end: { date: addDay(date) } };
  const end = plusMinutes(time, minutes);
  return {
    summary,
    start: { dateTime: `${date}T${time}:00`, timeZone: TZ },
    end: { dateTime: `${addDay(date, end.dayShift)}T${end.time}:00`, timeZone: TZ },
  };
}

export function fromGoogle(e) {
  const allDay = Boolean(e.start?.date);
  const startLocal = allDay ? null : localParts(e.start.dateTime);
  return {
    id: e.id,
    title: e.summary || '(zonder titel)',
    date: allDay ? e.start.date : startLocal.date,
    time: allDay ? null : startLocal.time,
    endTime: allDay || !e.end?.dateTime ? null : localParts(e.end.dateTime).time,
    link: e.htmlLink || null,
  };
}

// Tijdstip omzetten naar Belgische datum en uur.
function localParts(dt) {
  const d = new Date(dt);
  const f = new Intl.DateTimeFormat('nl-BE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

// Zonder koppeling: een link die Google Agenda opent met alles al ingevuld.
export function templateLink(ev) {
  const g = toGoogle(ev);
  const fmt = (x) => (x.date ? x.date.replace(/-/g, '') : x.dateTime.replace(/[-:]/g, ''));
  const u = new URL('https://calendar.google.com/calendar/render');
  u.searchParams.set('action', 'TEMPLATE');
  u.searchParams.set('text', g.summary);
  u.searchParams.set('dates', `${fmt(g.start)}/${fmt(g.end)}`);
  if (ev.time) u.searchParams.set('ctz', TZ);
  return u.toString();
}
