import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { ToolboxIllustration } from './Illustrations.jsx';
import { store } from '../lib/store.js';
import { todayISO } from '../lib/format.js';
import { agendaState, choreDay, chorePhoto, groupChores, longDay, quickDates } from '../lib/chores.js';

// Een terugkeer van Google mag maar één keer verwerkt worden (de code van Google werkt maar één keer).
let handledReturn = null;

export default function Chores({ home, toast, googleReturn = null }) {
  const { chores, act, agenda } = home;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(null); // null | klusje | { nieuw }
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [error, setError] = useState('');
  const cam = useRef(null);
  const today = todayISO();
  const g = groupChores(chores, today);
  const linked = Boolean(agenda?.linked);

  async function quickAdd(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText(''); setError('');
    try { await act.addChore({ title: t }); toast('Klusje genoteerd'); } catch (err) { setError(err.message); setText(t); }
  }

  async function onPhoto(file) {
    if (!file) return;
    setBusyPhoto(true);
    try {
      const p = await chorePhoto(file);
      setOpen({ nieuw: true, title: text.trim(), ...p });
      setText('');
    } catch (e) { setError(e.message); }
    setBusyPhoto(false);
  }

  const row = (c) => <ChoreRow key={c.id} c={c} today={today} linked={linked} onOpen={() => setOpen(c)} onTick={() => act.toggleChore(c).catch((e) => setError(e.message))} />;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <form className="row" onSubmit={quickAdd}>
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="bv. dakgoot kuisen" aria-label="Nieuw klusje" maxLength={120} enterKeyHint="done" />
        <button type="button" className="btn ghost" onClick={() => cam.current?.click()} disabled={busyPhoto} aria-label="Klusje met foto" style={{ minHeight: 50, padding: '0 14px' }}><Icon name="camera" /></button>
        <button className="btn" disabled={!text.trim()} aria-label="Toevoegen" style={{ minHeight: 50, padding: '0 16px' }}><Icon name="plus" /></button>
      </form>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />

      {(error || home.choresError) && <div className="error">{error || home.choresError}</div>}

      <AgendaCard home={home} googleReturn={googleReturn} toast={toast} />

      {!g.late.length && !g.planned.length && !g.later.length && (
        <div className="card empty">
          <ToolboxIllustration />
          <b>{g.done.length ? 'Alle klusjes gedaan, knap!' : 'Nog geen klusjes'}</b>
          <span className="small muted">Zie je iets dat moet gebeuren? Typ het hierboven, neem er een foto van, of zeg "klusje: lamp vervangen in de gang".</span>
        </div>
      )}

      <div className="stack stagger" style={{ gap: 12 }}>
        {g.late.length > 0 && <Group title="Datum voorbij">{g.late.map((c) => row(c))}</Group>}
        {g.planned.length > 0 && <Group title="Ingepland">{g.planned.map((c) => row(c))}</Group>}
        {g.later.length > 0 && <Group title="Nog in te plannen">{g.later.map((c) => row(c))}</Group>}
      </div>

      {g.done.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="spread">
            <span className="tiny bold muted" style={{ paddingLeft: 4 }}>Gedaan ({g.done.length})</span>
            <button className="tiny bold link" onClick={() => act.clearDoneChores()}>Wis gedaan</button>
          </div>
          <div className="card list done-list">{g.done.map((c) => row(c))}</div>
        </div>
      )}

      {open && (
        <ChoreSheet
          key={open.id || 'nieuw'}
          chore={open.nieuw ? null : open}
          initial={open.nieuw ? open : null}
          home={home}
          linked={linked}
          onClose={() => setOpen(null)}
          toast={toast}
        />
      )}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="tiny bold muted" style={{ paddingLeft: 4 }}>{title}</span>
      <div className="card list">{children}</div>
    </div>
  );
}

function ChoreRow({ c, today, linked, onOpen, onTick }) {
  const st = agendaState(c, linked);
  return (
    <div className={'check-row chore-row' + (c.done ? ' done' : '')}>
      <button className="check" role="checkbox" aria-checked={c.done} onClick={onTick} aria-label={`${c.title}: ${c.done ? 'gedaan' : 'nog te doen'}`} style={{ flex: 'none', paddingRight: 8 }}>
        <span className="box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </button>
      <button className="chore-body" onClick={onOpen}>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="name">{c.title}</span>
          <span className="tiny muted chore-sub">
            {c.planned_date
              ? <span className={'when' + (!c.done && c.planned_date < today ? ' late' : '')}><Icon name="calendar" size={14} /> {choreDay(c.planned_date, today)}{c.planned_time ? ` om ${c.planned_time}` : ''}</span>
              : !c.done && <span className="when plan">Inplannen</span>}
            {st === 'ok' && <span className="in-agenda" title="Staat in Google Agenda"><Icon name="check" size={13} stroke={3} /> agenda</span>}
            {st === 'bezig' && <span className="muted">· naar agenda…</span>}
            {c.note && <span className="note">{c.note}</span>}
          </span>
        </span>
        {c.thumb && <img className="thumb" src={c.thumb} alt="" />}
      </button>
    </div>
  );
}

function ChoreSheet({ chore, initial, home, linked, onClose, toast }) {
  const src = chore || initial || {};
  const [title, setTitle] = useState(src.title || '');
  const [note, setNote] = useState(src.note || '');
  const [date, setDate] = useState(src.planned_date || '');
  const [time, setTime] = useState(src.planned_time || '');
  const [thumb, setThumb] = useState(src.thumb || null);
  const [photo, setPhoto] = useState(src.photo || null); // grote foto; bestaande laden we hieronder
  const [photoChanged, setPhotoChanged] = useState(Boolean(initial?.photo));
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const cam = useRef(null);
  const gal = useRef(null);
  const today = todayISO();

  useEffect(() => {
    if (chore?.thumb && !photo) home.act.chorePhoto(chore.id).then((p) => p && setPhoto(p)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(file) {
    if (!file) return;
    try {
      const p = await chorePhoto(file);
      setThumb(p.thumb); setPhoto(p.photo); setPhotoChanged(true);
    } catch (e) { setError(e.message); }
  }

  async function save() {
    setBusy(true); setError('');
    const fields = { title: title.trim(), note: note.trim() || null, planned_date: date || null, planned_time: date && time ? time : null };
    try {
      if (chore) {
        const patch = { ...fields };
        if (photoChanged) { patch.thumb = thumb; patch.photo = photo; }
        await home.act.updateChore(chore.id, patch);
      } else {
        await home.act.addChore({ ...fields, thumb, photo });
      }
      onClose();
      const dated = fields.planned_date && fields.planned_date !== (chore?.planned_date || null);
      toast(dated && linked ? `Ingepland op ${longDay(fields.planned_date)} · komt in de agenda` : dated ? `Ingepland op ${longDay(fields.planned_date)}` : chore ? 'Klusje bewaard' : 'Klusje genoteerd');
    } catch (e) { setError(e.message); setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await home.act.deleteChore(chore.id); onClose(); toast(chore.gcal_event_id && !chore.done ? 'Klusje verwijderd, ook uit de agenda' : 'Klusje verwijderd'); }
    catch (e) { setError(e.message); setBusy(false); }
  }

  async function toggleDone() {
    setBusy(true);
    try { await home.act.toggleChore(chore); onClose(); toast(chore.done ? 'Weer op de lijst' : 'Gedaan, goed bezig!'); }
    catch (e) { setError(e.message); setBusy(false); }
  }

  const quick = quickDates(today);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Klusje" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
        <div className="spread">
          <h2>{chore ? 'Klusje' : 'Nieuw klusje'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>

        <div className="photo-pick">
          {thumb
            ? <button className="chore-photo" onClick={() => setBig(true)} aria-label="Foto groot bekijken"><img src={photo || thumb} alt="Foto van het klusje" /></button>
            : <span className="ph"><Icon name="camera" size={34} /></span>}
          <div className="stack grow" style={{ gap: 8, justifyContent: 'center' }}>
            <button className="btn ghost" onClick={() => cam.current?.click()}><Icon name="camera" /> {thumb ? 'Andere foto' : 'Foto nemen'}</button>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost grow" onClick={() => gal.current?.click()} style={{ padding: '0 10px' }}>Uit galerij</button>
              {thumb && <button className="btn ghost" onClick={() => { setThumb(null); setPhoto(null); setPhotoChanged(true); }} aria-label="Foto weghalen" style={{ padding: '0 12px' }}><Icon name="trash" /></button>}
            </div>
          </div>
        </div>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />

        <label className="field">Wat moet er gebeuren?<input className="input" value={title} maxLength={120} placeholder="bv. Lamp vervangen in de gang" onChange={(e) => setTitle(e.target.value)} autoFocus={!chore && !title} /></label>
        <label className="field">Extra uitleg (mag leeg)<textarea className="input textarea" value={note} maxLength={1000} rows={2} placeholder="bv. E27-lamp, ligt in de kelder" onChange={(e) => setNote(e.target.value)} /></label>

        <div className="stack" style={{ gap: 8 }}>
          <span className="small bold">Wanneer?</span>
          <div className="chips-wrap">
            {quick.map((q) => <button key={q.label} className="pill" aria-pressed={date === q.date} onClick={() => setDate(date === q.date ? '' : q.date)}>{q.label}</button>)}
            <button className="pill" aria-pressed={!date} onClick={() => { setDate(''); setTime(''); }}>Nog niet</button>
          </div>
          <div className="row">
            <input className="input grow" type="date" value={date} min={chore?.planned_date && chore.planned_date < today ? undefined : today} onChange={(e) => setDate(e.target.value)} aria-label="Dag" />
            {date && <input className="input" style={{ width: 120 }} type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Uur (mag leeg)" />}
          </div>
          {date && (
            <span className="tiny muted">
              {longDay(date)}{time ? ` om ${time}` : ', hele dag'}
              {linked ? ` · komt in ${home.agenda?.calendar || 'je Google Agenda'}` : ' · koppel Google Agenda om het daar ook te zien'}
            </span>
          )}
          {!date && chore?.gcal_event_id && <span className="tiny muted">Zonder datum gaat het klusje uit de agenda.</span>}
        </div>

        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={!title.trim() || busy} onClick={save}><Icon name="check" /> {busy ? 'Bewaren…' : date && date !== (chore?.planned_date || '') ? 'Inplannen' : 'Bewaren'}</button>

        {chore && (
          <>
            <button className="btn ghost" disabled={busy} onClick={toggleDone}><Icon name={chore.done ? 'repeat' : 'check'} /> {chore.done ? 'Toch nog niet gedaan' : 'Gedaan'}</button>
            {!confirm
              ? <button className="btn danger" disabled={busy} onClick={() => setConfirm(true)}><Icon name="trash" /> Verwijderen</button>
              : (
                <div className="stack" style={{ gap: 8 }}>
                  {chore.gcal_event_id && <span className="small muted">Het verdwijnt ook uit de agenda.</span>}
                  <div className="row">
                    <button className="btn ghost grow" onClick={() => setConfirm(false)}>Nee</button>
                    <button className="btn danger grow" disabled={busy} onClick={remove}>Ja, verwijderen</button>
                  </div>
                </div>
              )}
          </>
        )}
      </div>
      {big && (
        <div className="photo-full" onClick={(e) => { e.stopPropagation(); setBig(false); }} role="dialog" aria-label="Foto">
          <img src={photo || thumb} alt="Foto van het klusje" />
        </div>
      )}
    </div>
  );
}

// Is Google Agenda gekoppeld? Zo niet: uitleg, of (voor de eigenaar) de knop om te koppelen.
function AgendaCard({ home, googleReturn, toast }) {
  const { agenda, act, agendaError } = home;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pickCal, setPickCal] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  // Terug van Google: de toestemming bewaren, en meteen een agenda laten kiezen.
  // Anders: kijken of Google gekoppeld is, en wat nog niet in de agenda staat alsnog doen.
  useEffect(() => {
    if (!googleReturn || handledReturn === googleReturn) {
      act.agendaStatus().then((st) => { if (st?.linked) act.syncAgenda(); });
      return;
    }
    handledReturn = googleReturn;
    (async () => {
      if (googleReturn.error) {
        setError(googleReturn.error === 'access_denied' ? 'Je gaf bij Google geen toestemming. Er is niets gekoppeld.' : `Google gaf een fout: ${googleReturn.error}`);
        act.agendaStatus();
        return;
      }
      setBusy('koppelen');
      try {
        const st = await store.choresAgenda('finish', { code: googleReturn.code, state: googleReturn.state });
        act.setAgenda(st);
        toast('Google Agenda gekoppeld');
        setPickCal(true);
        act.syncAgenda();
      } catch (e) {
        setError(e.message);
        act.agendaStatus();
      }
      setBusy('');
    })();
  }, [googleReturn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function link() {
    setBusy('koppelen'); setError('');
    try {
      const { url } = await store.choresAgenda('start');
      location.href = url; // naar Google; daarna komt Google terug naar de app
    } catch (e) { setError(e.message); setBusy(''); }
  }

  async function unlink() {
    setBusy('los');
    try { act.setAgenda(await store.choresAgenda('unlink')); } catch (e) { setError(e.message); }
    setBusy(''); setConfirmOff(false);
  }

  if (busy === 'koppelen' && !agenda?.linked) return <section className="card small muted">Google Agenda koppelen…</section>;
  if (!agenda || agenda.demo) return null;
  const err = error || agendaError;

  if (agenda.linked) {
    return (
      <>
        <div className="spread" style={{ gap: 8 }}>
          <span className="tiny muted row" style={{ gap: 6 }}><Icon name="calendar" size={16} /> Met een datum komt een klusje in <b>{agenda.calendar || 'je Google Agenda'}</b></span>
          {agenda.owner && <button className="tiny bold link" onClick={() => setPickCal(true)}>Wijzigen</button>}
        </div>
        {err && <div className="error">{err}</div>}
        {pickCal && (
          <CalendarPicker
            onClose={() => setPickCal(false)}
            onUnlink={() => { setPickCal(false); setConfirmOff(true); }}
            onPick={async (c) => {
              setPickCal(false);
              try { act.setAgenda(await store.choresAgenda('set-calendar', { id: c.id, name: c.name })); act.syncAgenda(); toast(`Klusjes komen nu in ${c.name}`); } catch (e) { setError(e.message); }
            }}
          />
        )}
        {confirmOff && (
          <div className="row small" style={{ gap: 12 }}>
            <span>Google Agenda loskoppelen?</span>
            <button className="tiny bold link" disabled={Boolean(busy)} onClick={unlink}>Ja</button>
            <button className="tiny link" onClick={() => setConfirmOff(false)}>Nee</button>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}><Icon name="google" /><b>{agenda.expired ? 'Google Agenda opnieuw koppelen' : 'Klusjes in je Google Agenda'}</b></div>
      {!agenda.ready && (
        <span className="small muted">
          {agenda.owner === false
            ? 'Met een datum kan een klusje vanzelf in jullie Google Agenda komen. De eigenaar van het gezin kan dat instellen.'
            : 'Met een datum kan een klusje vanzelf in jullie Google Agenda komen. Volg daarvoor eenmalig de stappen in de handleiding (Klusjes in Google Agenda).'}
          {agenda.missing ? ` ${agenda.missing}` : ''}
        </span>
      )}
      {agenda.ready && agenda.owner && (
        <>
          <span className="small muted">{agenda.expired ? 'Google vraagt om de toestemming te vernieuwen. Dat duurt een minuutje.' : 'Koppel één keer jullie Google Agenda. Daarna komt elk klusje met een datum er vanzelf in, en verschuift het mee als je de datum wijzigt.'}</span>
          <button className="btn" disabled={Boolean(busy)} onClick={link}><Icon name="link" /> {busy === 'koppelen' ? 'Naar Google…' : 'Google Agenda koppelen'}</button>
        </>
      )}
      {agenda.ready && !agenda.owner && <span className="small muted">De eigenaar van het gezin kan Google Agenda koppelen. Daarna komen klusjes met een datum er vanzelf in.</span>}
      {err && <div className="error">{err}</div>}
    </section>
  );
}

function CalendarPicker({ onClose, onPick, onUnlink }) {
  const [list, setList] = useState(null);
  const [current, setCurrent] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    store.choresAgenda('calendars').then((r) => { setList(r.calendars || []); setCurrent(r.current || 'primary'); }).catch((e) => setError(e.message));
  }, []);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Welke agenda?" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85dvh', overflowY: 'auto' }}>
        <div className="spread">
          <h2>In welke agenda?</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <span className="small muted">Kies bv. jullie gedeelde gezinsagenda. Wat al ingepland is, verhuist mee.</span>
        {error && <div className="error">{error}</div>}
        {!list && !error && <span className="small muted">Laden…</span>}
        {list && list.map((c) => (
          <button key={c.id} className="plan-day" onClick={() => onPick(c)}>
            <span className="row" style={{ gap: 10 }}><span style={{ width: 14, height: 14, borderRadius: 7, background: c.color || 'var(--blue)' }} /> <b>{c.name}</b></span>
            {current === c.id && <Icon name="check" />}
          </button>
        ))}
        <button className="tiny link" style={{ alignSelf: 'flex-start', color: 'var(--muted)' }} onClick={onUnlink}>Google Agenda loskoppelen</button>
      </div>
    </div>
  );
}
