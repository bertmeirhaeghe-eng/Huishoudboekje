// Leest een iCal-bestand (zoals het geheime adres van Google Agenda) en geeft de afspraken
// tussen twee datums, met herhalende afspraken uitgerold. Tijden in Belgische tijd.

const TZ = 'Europe/Brussels';

// Regels die over meerdere lijnen gesplitst zijn weer samenvoegen.
function unfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescape(v) {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

function parseLine(line) {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name, ...params] = head.split(';');
  const p = {};
  for (const x of params) {
    const [k, v] = x.split('=');
    p[k.toUpperCase()] = (v || '').replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params: p, value };
}

const pad = (n) => String(n).padStart(2, '0');

// Een UTC-moment naar Belgische datum en uur.
function toLocal(ms) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

// Een ICS-tijd: { allDay, date, time, ms } waarbij ms enkel dient om te sorteren en te rekenen.
export function parseTime(value, params = {}) {
  const v = value.trim();
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return { allDay: true, date, time: null, ms: Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)) };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z) {
    const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi);
    return { allDay: false, utc: true, ...toLocal(ms), ms };
  }
  // Met TZID (meestal Europe/Brussels) of zonder: we tonen het uur zoals het er staat.
  return { allDay: false, date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, ms: Date.UTC(+y, +mo - 1, +d, +h, +mi) };
}

export function parseICS(text) {
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const l = parseLine(line);
    if (!l) continue;
    if (l.name === 'SUMMARY') cur.title = unescape(l.value);
    else if (l.name === 'UID') cur.uid = l.value;
    else if (l.name === 'DTSTART') cur.start = parseTime(l.value, l.params);
    else if (l.name === 'DTEND') cur.end = parseTime(l.value, l.params);
    else if (l.name === 'RRULE') cur.rrule = Object.fromEntries(l.value.split(';').map((x) => x.split('=')));
    else if (l.name === 'EXDATE') for (const v of l.value.split(',')) { const t = parseTime(v, l.params); if (t) cur.exdates.push(t.date + (t.time || '')); }
    else if (l.name === 'RECURRENCE-ID') cur.recurrenceId = parseTime(l.value, l.params);
    else if (l.name === 'STATUS') cur.status = l.value.trim();
  }
  return events;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const dayMs = 86400000;
const isoFromMs = (ms) => new Date(ms).toISOString().slice(0, 10);

function addMonths(ms, n) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  if (day > last) return null; // bv. 31 februari bestaat niet
  d.setUTCDate(day);
  return d.getTime();
}

// Alle starttijden (als "wandklok"-ms) van een afspraak tot en met 'toMs'.
function occurrences(ev, toMs, limit = 2000) {
  const start = ev.start.ms;
  if (!ev.rrule) return [start];
  const r = ev.rrule;
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL || 1));
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? parseTime(r.UNTIL).ms + (r.UNTIL.length === 8 ? dayMs - 1 : 0) : Infinity;
  const byDay = r.BYDAY ? r.BYDAY.split(',').map((x) => x.replace(/^[+-]?\d+/, '')).map((x) => DAY_CODES.indexOf(x)).filter((x) => x >= 0) : null;
  const out = [];
  const push = (ms) => {
    if (ms < start || ms > until || ms > toMs || out.length >= count) return false;
    out.push(ms);
    return true;
  };
  if (freq === 'WEEKLY') {
    const days = byDay && byDay.length ? byDay : [new Date(start).getUTCDay()];
    const startDow = new Date(start).getUTCDay();
    const weekStart = start - ((startDow + 6) % 7) * dayMs; // maandag van de eerste week
    for (let w = 0; w < limit; w++) {
      const base = weekStart + w * interval * 7 * dayMs;
      if (base > toMs || base > until || out.length >= count) break;
      for (const dow of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const ms = base + ((dow + 6) % 7) * dayMs;
        if (ms >= start) push(ms);
        if (out.length >= count) break;
      }
    }
  } else if (freq === 'DAILY') {
    for (let i = 0; i < limit * 10; i++) {
      const ms = start + i * interval * dayMs;
      if (ms > toMs || ms > until || out.length >= count) break;
      push(ms);
    }
  } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
    const step = freq === 'MONTHLY' ? interval : 12 * interval;
    for (let i = 0; i < limit; i++) {
      const ms = addMonths(start, i * step);
      if (ms == null) continue;
      if (ms > toMs || ms > until || out.length >= count) break;
      push(ms);
    }
  } else {
    out.push(start);
  }
  return out;
}

// Afspraken tussen 'from' en 'to' (YYYY-MM-DD, tot en met), gesorteerd.
export function eventsBetween(text, from, to) {
  const all = parseICS(text).filter((e) => e.status !== 'CANCELLED');
  const fromMs = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const toMs = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) + dayMs - 1;
  const overrides = new Set(all.filter((e) => e.recurrenceId).map((e) => e.uid + '|' + e.recurrenceId.date + (e.recurrenceId.time || '')));
  const out = [];
  for (const ev of all) {
    const dur = ev.end ? ev.end.ms - ev.start.ms : 0;
    for (const ms of ev.recurrenceId ? [ev.start.ms] : occurrences(ev, toMs)) {
      const startMs = ms;
      // Afspraken van meerdere dagen tonen we vanaf de eerste dag die in beeld komt.
      if (startMs + Math.max(dur, 1) <= fromMs || startMs > toMs) continue;
      let date; let time;
      if (ev.start.allDay) { date = isoFromMs(startMs); time = null; }
      else if (ev.start.utc) ({ date, time } = toLocal(startMs));
      else { const d = new Date(startMs); date = isoFromMs(startMs); time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
      const key = date + (time || '');
      if (ev.exdates.includes(key)) continue;
      if (!ev.recurrenceId && ev.rrule && overrides.has(ev.uid + '|' + key)) continue;
      let endTime = null;
      if (!ev.start.allDay && dur > 0) {
        const t = (+time.slice(0, 2)) * 60 + (+time.slice(3, 5)) + Math.round(dur / 60000);
        endTime = `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
      }
      out.push({ id: (ev.uid || ev.title) + '|' + key, title: ev.title || '(zonder titel)', date: date < from ? from : date, time, endTime, link: null });
    }
  }
  return out.sort((a, b) => (a.date + (a.time || '00:00')).localeCompare(b.date + (b.time || '00:00')));
}
