import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { CalendarIllustration } from './Illustrations.jsx';
import * as gcal from '../lib/gcal.js';
import { addDays } from '../lib/kitchen.js';
import { dayLabel, todayISO } from '../lib/format.js';
import { eventsBetween } from '../lib/ics.js';
import { store } from '../lib/store.js';

const SPAN = 28;

// De iCal-agenda even onthouden, zodat wisselen tussen schermen niet telkens opnieuw laadt.
let icsCache = null; // { text, at }
export function forgetCalendar() { icsCache = null; }
async function loadIcs(force = false) {
  if (!force && icsCache && Date.now() - icsCache.at < 5 * 60000) return icsCache.text;
  const text = await store.calendarIcs();
  icsCache = { text, at: Date.now() };
  return text;
}

// Afspraak bewaren: rechtstreeks in Google Agenda als dat gekoppeld is,
// anders Google Agenda openen met alles al ingevuld. Geeft 'google' of 'link' terug.
export async function saveEvent(ev) {
  if (gcal.gcalConfigured()) {
    try {
      if (!gcal.getToken()) await gcal.connect({ silent: gcal.wasConnected() });
      await gcal.addEvent(ev);
      return 'google';
    } catch (e) {
      if (!e.needsAuth) throw e;
      await gcal.connect();
      await gcal.addEvent(ev);
      return 'google';
    }
  }
  window.open(gcal.templateLink(ev), '_blank', 'noopener');
  forgetCalendar();
  return 'link';
}

export default function Agenda({ home, members, toast, isOwner, onOpenSettings }) {
  const today = todayISO();
  const configured = gcal.gcalConfigured();
  const [ics, setIcs] = useState(null); // null = nog niet geweten, true/false = wel of geen iCal-koppeling
  const [token, setToken] = useState(gcal.getToken());
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [pickCal, setPickCal] = useState(false);
  const to = addDays(today, SPAN - 1);

  const load = useCallback(async (force = false) => {
    try {
      if (configured) {
        if (!gcal.getToken()) return;
        setEvents(await gcal.listEvents(today, to));
      } else {
        const has = await store.hasCalendar();
        setIcs(has);
        if (!has) return;
        const text = await loadIcs(force);
        setEvents(text ? eventsBetween(text, today, to) : []);
      }
      setError('');
    } catch (e) {
      if (e.needsAuth) setToken(null);
      else setError(e.message);
    }
  }, [today, to, configured]);

  useEffect(() => { if (token || !configured) load(); }, [token, configured, load]);

  async function connect() {
    setError('');
    try {
      await gcal.connect();
      setToken(gcal.getToken());
    } catch (e) {
      setError(e.message);
    }
  }

  const days = Array.from({ length: SPAN }, (_, i) => addDays(today, i));
  const byDay = days
    .map((iso) => ({ iso, ev: (events || []).filter((e) => e.date === iso), meal: home.menu.find((m) => m.date === iso) }))
    .filter((x, i) => i < 7 || x.ev.length || x.meal);

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="spread">
        <h1>Agenda</h1>
        <button className="btn" onClick={() => setAdding(true)} style={{ minHeight: 44 }}><Icon name="plus" /> Afspraak</button>
      </div>

      {!configured && ics === false && (
        <div className="card empty">
          <CalendarIllustration />
          <b>Je Google Agenda</b>
          <span className="small muted">Afspraken die je hier of met de microfoon toevoegt, openen in Google Agenda met alles al ingevuld. Daar tik je op Opslaan.</span>
          <span className="small muted">{isOwner ? 'Wil je je afspraken ook hier zien? Koppel je agenda onder Meer.' : 'De eigenaar van het gezin kan de agenda koppelen onder Meer.'}</span>
          {isOwner && <button className="btn" onClick={onOpenSettings} style={{ marginTop: 6 }}><Icon name="link" /> Agenda koppelen</button>}
          <a className="btn ghost" href="https://calendar.google.com/" target="_blank" rel="noopener" style={{ marginTop: 6 }}><Icon name="calendar" /> Google Agenda openen</a>
        </div>
      )}

      {configured && !token && (
        <div className="card empty">
          <CalendarIllustration />
          <b>{gcal.wasConnected() ? 'Even opnieuw verbinden' : 'Koppel je Google Agenda'}</b>
          <span className="small muted">{gcal.wasConnected() ? 'Google vraagt dit af en toe voor je veiligheid.' : 'Dan zie je je afspraken hier, samen met het weekmenu, en kan je ze toevoegen met je stem.'}</span>
          <button className="btn" onClick={connect} style={{ marginTop: 6 }}><Icon name="google" /> {gcal.wasConnected() ? 'Verbinden' : 'Koppelen met Google'}</button>
        </div>
      )}

      {configured && token && (
        <button className="tiny bold link" style={{ alignSelf: 'flex-start' }} onClick={() => setPickCal(true)}>Agenda: {gcal.calendarName()} · wijzigen</button>
      )}

      {error && <div className="error">{error}</div>}

      {!configured && ics && (
        <div className="spread">
          <span className="tiny muted">Uit je Google Agenda. Nieuwe afspraken verschijnen hier na enkele minuten.</span>
          <button className="tiny bold link" onClick={() => load(true)}>Vernieuwen</button>
        </div>
      )}

      {(token || ics || home.menu.length > 0) && (
        <div className="stack stagger" style={{ gap: 10 }}>
          {byDay.map(({ iso, ev, meal }) => (
            <div key={iso} className={'agenda-day' + (iso === today ? ' today' : '')}>
              <span className="tiny bold muted" style={{ paddingLeft: 4 }}>{dayLabel(iso, today) === 'Vandaag' ? 'Vandaag' : cap(dayLabel(iso, today))}</span>
              <div className="card list">
                {ev.map((e) => (
                  <button key={e.id} className="entry" onClick={() => setOpen(e)}>
                    <span className="time">{e.time || 'hele dag'}</span>
                    <span className="grow bold">{e.title}</span>
                  </button>
                ))}
                {meal && (
                  <div className="entry meal-line">
                    <span className="time"><Icon name="pot" size={18} /></span>
                    <span className="grow">{meal.meal}</span>
                  </div>
                )}
                {!ev.length && !meal && <div className="entry tiny muted">{token || ics ? 'Niets gepland' : ''}</div>}
              </div>
            </div>
          ))}
          {(token || ics) && events === null && <div className="small muted">Afspraken laden…</div>}
        </div>
      )}

      {adding && (
        <EventSheet
          members={members}
          onClose={() => setAdding(false)}
          onSave={async (ev) => {
            const how = await saveEvent(ev);
            setAdding(false);
            if (how === 'google') { setToken(gcal.getToken()); toast('In je Google Agenda gezet'); load(); }
            else toast('Tik in Google Agenda op Opslaan');
          }}
        />
      )}
      {open && <EventDetail ev={open} canDelete={configured} onClose={() => setOpen(null)} onDelete={async () => { await gcal.deleteEvent(open.id); setOpen(null); load(); }} />}
      {pickCal && <CalendarPicker onClose={() => setPickCal(false)} onPick={() => { setPickCal(false); setEvents(null); load(); }} />}
    </div>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function EventSheet({ initial = {}, members = [], onClose, onSave }) {
  const [title, setTitle] = useState(initial.title || '');
  const [date, setDate] = useState(initial.date || todayISO());
  const [time, setTime] = useState(initial.time || '');
  const [minutes, setMinutes] = useState(60);
  const [who, setWho] = useState(initial.who || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Afspraak" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="spread">
          <h2>Nieuwe afspraak</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <label className="field">Wat?<input className="input" value={title} maxLength={120} placeholder="bv. Zwemles" onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="row">
          <label className="field grow">Dag<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></label>
          <label className="field" style={{ width: 130 }}>Uur<input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        {time && (
          <div className="seg small-seg" role="group" aria-label="Duur">
            {[30, 60, 90, 120].map((m) => <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m < 60 ? `${m} min` : `${m / 60} u`.replace('.5', ',5')}</button>)}
          </div>
        )}
        {members.length > 1 && (
          <div className="chips-wrap">
            {members.map((m) => <button key={m} className="pill" aria-pressed={who === m} onClick={() => setWho(who === m ? null : m)}>{m}</button>)}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={!title.trim() || busy} onClick={async () => {
          setBusy(true); setError('');
          try { await onSave({ title: title.trim(), date, time: time || null, minutes, who }); } catch (e) { setError(e.message); setBusy(false); }
        }}>
          <Icon name="calendar" /> {busy ? 'Bewaren…' : 'In Google Agenda zetten'}
        </button>
      </div>
    </div>
  );
}

function EventDetail({ ev, canDelete, onClose, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Afspraak" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <div>
            <h2>{ev.title}</h2>
            <span className="small muted">{cap(dayLabel(ev.date))}{ev.time ? `, ${ev.time}${ev.endTime ? ` tot ${ev.endTime}` : ''}` : ', hele dag'}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <a className="btn ghost" href={ev.link || `https://calendar.google.com/calendar/r/day/${ev.date.replace(/-/g, '/')}`} target="_blank" rel="noopener"><Icon name="calendar" /> Openen in Google Agenda</a>
        {!canDelete ? null : !confirm
          ? <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" /> Verwijderen</button>
          : (
            <div className="row">
              <button className="btn ghost grow" onClick={() => setConfirm(false)}>Nee</button>
              <button className="btn danger grow" onClick={onDelete}>Ja, verwijderen</button>
            </div>
          )}
      </div>
    </div>
  );
}

function CalendarPicker({ onClose, onPick }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { gcal.listCalendars().then(setList).catch((e) => setError(e.message)); }, []);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Welke agenda?" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85dvh', overflowY: 'auto' }}>
        <div className="spread">
          <h2>Welke agenda?</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <span className="small muted">Kies bv. jullie gedeelde gezinsagenda.</span>
        {error && <div className="error">{error}</div>}
        {!list && !error && <span className="small muted">Laden…</span>}
        {list && list.map((c) => (
          <button key={c.id} className="plan-day" onClick={() => { gcal.setCalendar(c.primary ? 'primary' : c.id, c.name); onPick(); }}>
            <span className="row" style={{ gap: 10 }}><span style={{ width: 14, height: 14, borderRadius: 7, background: c.color || 'var(--blue)' }} /> <b>{c.name}</b></span>
            {(gcal.calendarId() === c.id || (c.primary && gcal.calendarId() === 'primary')) && <Icon name="check" />}
          </button>
        ))}
      </div>
    </div>
  );
}
