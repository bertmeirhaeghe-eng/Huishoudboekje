import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { loadIcs } from './Agenda.jsx';
import * as gcal from '../lib/gcal.js';
import { eventsBetween } from '../lib/ics.js';
import { addDays, mealFor, SLOT_LABEL } from '../lib/kitchen.js';
import { todayISO } from '../lib/format.js';
import { store } from '../lib/store.js';
import { usePhotos } from '../lib/photos.js';
import { boardDayTitle, dayTimeline, nowTime, pickDayForIdle, stillComing } from '../lib/board.js';

const DAYS = 7;
const IDLE_MS = 2 * 60000;
const SLIDE_MS = 20000;

// Afspraken van Google Agenda: via de koppeling met Google, of via het geheime iCal-adres.
async function fetchEvents(from, to, force) {
  if (gcal.gcalConfigured()) {
    if (!gcal.getToken()) return null;
    return gcal.listEvents(from, to);
  }
  if (!(await store.hasCalendar())) return null;
  const text = await loadIcs(force);
  return text ? eventsBetween(text, from, to) : [];
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Het scherm niet laten uitgaan zolang het bord open staat.
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let gone = false;
    const get = async () => {
      try { if (document.visibilityState === 'visible' && navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch {}
      if (gone && lock) lock.release().catch(() => {});
    };
    get();
    document.addEventListener('visibilitychange', get);
    return () => { gone = true; document.removeEventListener('visibilitychange', get); lock?.release().catch(() => {}); };
  }, []);
}

export default function Board({ home, onClose }) {
  const now = useNow();
  const today = todayISO(now);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  const [events, setEvents] = useState(null);
  const [calError, setCalError] = useState('');
  const [idle, setIdle] = useState(false);
  const last = useRef(Date.now());
  const photos = usePhotos();
  useWakeLock();

  const load = useCallback(async (force = false) => {
    try {
      setEvents(await fetchEvents(today, addDays(today, DAYS), force));
      setCalError('');
    } catch (e) {
      setCalError(e.message);
    }
  }, [today]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 10 * 60000);
    return () => clearInterval(t);
  }, [load]);

  // Ruststand na een paar minuten zonder aanraking.
  useEffect(() => {
    const wake = () => { last.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    const t = setInterval(() => { if (Date.now() - last.current > IDLE_MS) setIdle(true); }, 5000);
    return () => { evs.forEach((e) => window.removeEventListener(e, wake)); clearInterval(t); };
  }, []);

  const wakeUp = () => { last.current = Date.now(); setIdle(false); };
  const mealsFor = (iso) => ({ middag: mealFor(home.menu, iso, 'middag'), avond: mealFor(home.menu, iso, 'avond') });
  const evOn = (iso) => (events || []).filter((e) => e.date === iso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  function fullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="board">
      <header className="board-top">
        <div>
          <div className="board-clock">{nowTime(now)}</div>
          <div className="board-date">{boardDayTitle(today, today, true)}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {calError && <span className="tiny" style={{ color: 'var(--danger)' }}>Agenda: {calError}</span>}
          {events === null && !calError && <span className="tiny muted">Geen agenda gekoppeld</span>}
          <button className="icon-btn" onClick={() => setIdle(true)} aria-label="Ruststand"><Icon name="moon" /></button>
          {document.documentElement.requestFullscreen && <button className="icon-btn" onClick={fullscreen} aria-label="Volledig scherm"><Icon name="expand" /></button>}
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten"><Icon name="close" /></button>
        </div>
      </header>

      <div className="board-week">
        {days.map((iso) => {
          return (
            <section key={iso} className={'board-day' + (iso === today ? ' today' : '')} aria-label={boardDayTitle(iso, today)}>
              <h2 className="board-day-title">{boardDayTitle(iso, today)}</h2>
              <div className="board-items">
                {dayTimeline(mealsFor(iso), evOn(iso)).map((x) => (x.kind === 'meal' ? (
                  <div key={x.slot} className={'board-item meal' + (x.meal ? '' : ' none')}>
                    <span className="board-time">{x.time} – {x.endTime}</span>
                    <span className="board-what">{x.meal ? x.meal.meal : SLOT_LABEL[x.slot] + ': nog niets'}</span>
                  </div>
                ) : (
                  <div key={x.id} className="board-item event">
                    <span className="board-time">{x.time ? (x.endTime ? `${x.time} – ${x.endTime}` : x.time) : 'Hele dag'}</span>
                    <span className="board-what">{x.title}</span>
                  </div>
                )))}
              </div>
            </section>
          );
        })}
      </div>

      {idle && <Rest now={now} home={home} events={events} photos={photos} onWake={wakeUp} />}
    </div>
  );
}

// ───────────── Ruststand ─────────────

function Rest({ now, home, events, photos, onWake }) {
  const day = pickDayForIdle(now);
  const ev = (events || []).filter((e) => e.date === day.iso);
  const all = dayTimeline({ middag: mealFor(home.menu, day.iso, 'middag'), avond: mealFor(home.menu, day.iso, 'avond') }, ev)
    .filter((x) => x.kind === 'event' || x.meal);
  const upcoming = day.label === 'Vandaag' ? stillComing(all, nowTime(now)) : all;
  return (
    <div className="rest" onClick={onWake} role="button" tabIndex={0} aria-label="Tik om verder te gaan">
      <Slides photos={photos} />
      <div className="rest-shade" />
      <div className="rest-info">
        <div>
          <div className="rest-clock">{nowTime(now)}</div>
          <div className="rest-date">{boardDayTitle(todayISO(now), todayISO(now), true)}</div>
        </div>
        {upcoming.length > 0 && (
          <div className="rest-card">
            <div className="rest-card-title">{day.label}</div>
            {upcoming.slice(0, 5).map((x) => (x.kind === 'meal' ? (
              <div key={x.slot} className="rest-line meal"><span className="rest-k">{x.time}</span><b>{x.meal.meal}</b></div>
            ) : (
              <div key={x.id} className="rest-line"><span className="rest-k">{x.time || 'Hele dag'}</span><span>{x.title}</span></div>
            )))}
            {upcoming.length > 5 && <div className="rest-line"><span className="rest-k" /><span>en nog {upcoming.length - 5}</span></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Twee lagen die in elkaar overvloeien. De volgende foto laadt eerst, dan pas wisselen we.
function Slides({ photos }) {
  const [shown, setShown] = useState([null, null]);
  const [front, setFront] = useState(0);
  const order = useRef([]);
  const pos = useRef(0);

  useEffect(() => {
    if (!photos.length) return undefined;
    order.current = shuffle(photos);
    pos.current = 0;
    let alive = true;
    let layer = 0;
    const next = () => {
      if (pos.current >= order.current.length) { order.current = shuffle(photos); pos.current = 0; }
      const url = order.current[pos.current++];
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        layer = 1 - layer;
        const l = layer;
        setShown((s) => (l === 0 ? [url, s[1]] : [s[0], url]));
        setFront(l);
      };
      img.onerror = () => { if (alive) setTimeout(next, 500); };
      img.src = url;
    };
    next();
    const t = setInterval(next, SLIDE_MS);
    return () => { alive = false; clearInterval(t); };
  }, [photos]);

  if (!photos.length) return <div className="slide-empty" />;
  return (
    <>
      {shown.map((url, i) => url && (
        <div key={i} className={'slide' + (front === i ? ' on' : '')}>
          <div className="slide-bg" style={{ backgroundImage: `url("${url}")` }} />
          <img className="slide-img" src={url} alt="" key={url} />
        </div>
      ))}
    </>
  );
}
