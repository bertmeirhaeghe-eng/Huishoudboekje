import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { category } from '../lib/categories.js';
import { todayISO } from '../lib/format.js';
import { toCSV } from '../lib/stats.js';
import { store } from '../lib/store.js';
import * as gcal from '../lib/gcal.js';
import { forgetCalendar } from './Agenda.jsx';

export default function Settings({ household, onChange, onOpenTax }) {
  const [msg, setMsg] = useState('');
  const isOwner = household.role === 'eigenaar';

  async function share() {
    const text = `Doe mee met ons huishoudboekje "${household.name}". Open ${location.href.split('#')[0]} , maak een account en vul deze code in: ${household.invite_code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Huishoudboekje', text });
      else { await navigator.clipboard.writeText(text); setMsg('Uitnodiging gekopieerd. Plak ze in een bericht.'); }
    } catch {}
  }

  async function exportCSV(book) {
    const all = await store.listEntries(household.id, '2000-01-01', '2099-12-31');
    const rows = all.filter((e) => !book || e.book === book);
    const blob = new Blob(['﻿' + toCSV(rows, (id) => category(id).name)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `huishoudboekje-${book || 'alles'}-${todayISO()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>Meer</h1>

      <section className="card stack" style={{ gap: 12 }}>
        <h2>Gezinsleden</h2>
        {household.members.map((m) => (
          <div key={m.user_id} className="spread small">
            <span className="bold">{m.display_name || 'Zonder naam'}</span>
            <span className="muted">{m.role === 'eigenaar' ? 'eigenaar, ziet ook de zaak' : 'gezinslid'}</span>
          </div>
        ))}
        {store.mode === 'cloud' && (
          <>
            <div className="notice">Uitnodigingscode: <b style={{ fontSize: 18, letterSpacing: 2 }}>{household.invite_code}</b><br />Wie meedoet, ziet het gezinsboekje. Het zaakboekje blijft alleen voor jou.</div>
            <button className="btn" onClick={share}><Icon name="share" /> Iemand uitnodigen</button>
          </>
        )}
        {msg && <span className="small muted">{msg}</span>}
      </section>

      {isOwner && onOpenTax && (
        <button className="card tile-wide" onClick={onOpenTax}>
          <span className="tile-ico blue"><Icon name="scale" size={20} /></span>
          <span className="grow" style={{ textAlign: 'left' }}><b style={{ display: 'block' }}>Privé of zaak?</b><span className="tiny muted">Vuistregels voor je vennootschap</span></span>
          <Icon name="next" size={18} />
        </button>
      )}

      <MyName household={household} onChange={onChange} />

      <GoogleCalendar isOwner={isOwner} />

      <section className="card stack" style={{ gap: 10 }}>
        <h2>Exporteren</h2>
        <span className="small muted">Een CSV-bestand dat je opent in Excel of doorstuurt naar je boekhouder.</span>
        <button className="btn ghost" onClick={() => exportCSV('gezin')}><Icon name="download" /> Gezinsboekje</button>
        {isOwner && <button className="btn ghost" onClick={() => exportCSV('zaak')}><Icon name="download" /> Zaakboekje (voor de boekhouder)</button>}
      </section>

      {store.mode === 'cloud' ? (
        <button className="btn ghost" onClick={() => store.signOut()}>Afmelden</button>
      ) : (
        <section className="card stack" style={{ gap: 10 }}>
          <h2>Proefmodus</h2>
          <span className="small muted">De app is nog niet aan Supabase gekoppeld. Alles wat je invult, blijft alleen op dit toestel.</span>
          <button className="btn danger" onClick={() => { store.reset(); location.reload(); }}>Proefgegevens wissen</button>
        </section>
      )}
    </div>
  );
}

function MyName({ household, onChange }) {
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>Mijn naam</h2>
      <div className="row">
        <input className="input grow" value={name} maxLength={40} placeholder="Hoe heet je in het boekje?" onChange={(e) => { setName(e.target.value); setDone(false); }} aria-label="Mijn naam" />
        <button className="btn" disabled={!name.trim()} onClick={async () => { await store.updateMyName(household.id, name.trim()); setDone(true); onChange(); }}>Bewaren</button>
      </div>
      {done && <span className="small muted">Bewaard.</span>}
    </section>
  );
}

function GoogleCalendar({ isOwner }) {
  const [, force] = useState(0);
  const [has, setHas] = useState(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!gcal.gcalConfigured() && store.mode === 'cloud') store.hasCalendar().then(setHas).catch(() => setHas(false));
  }, []);

  if (gcal.gcalConfigured()) {
    const on = gcal.wasConnected();
    return (
      <section className="card stack" style={{ gap: 10 }}>
        <h2>Google Agenda</h2>
        {on ? (
          <>
            <span className="small muted">Gekoppeld op dit toestel. Afspraken gaan naar: <b>{gcal.calendarName()}</b>.</span>
            <button className="btn ghost" onClick={() => { gcal.disconnect(); force((n) => n + 1); }}>Ontkoppelen</button>
          </>
        ) : (
          <>
            <span className="small muted">Elk gezinslid koppelt met een eigen Google-account.</span>
            <button className="btn ghost" onClick={async () => { setError(''); try { await gcal.connect(); force((n) => n + 1); } catch (e) { setError(e.message); } }}><Icon name="google" /> Koppelen met Google</button>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </section>
    );
  }

  async function save(value) {
    setBusy(true); setError(''); setMsg('');
    try {
      await store.setCalendarUrl(value);
      forgetCalendar();
      if (value) await store.calendarIcs(); // meteen testen of het adres werkt
      setHas(Boolean(value));
      setUrl('');
      setMsg(value ? 'Gekoppeld. Je afspraken staan nu onder Agenda.' : 'Ontkoppeld.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>Google Agenda</h2>
      {store.mode !== 'cloud' ? (
        <span className="small muted">Kan pas als de app aan Supabase gekoppeld is.</span>
      ) : has ? (
        <>
          <span className="small muted">Gekoppeld. Iedereen in het gezin ziet je afspraken onder Agenda. Nieuwe afspraken maak je in Google Agenda (de app opent die voor je).</span>
          {isOwner && <button className="btn ghost" disabled={busy} onClick={() => save('')}>Ontkoppelen</button>}
        </>
      ) : isOwner ? (
        <>
          <span className="small muted">Plak hier het <b>geheime adres in iCal-indeling</b>. Je vindt het in Google Agenda op de computer: Instellingen &gt; je agenda &gt; Agenda integreren. Het adres wordt veilig in de database bewaard, niet in de app.</span>
          <input className="input" type="password" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" aria-label="Geheim iCal-adres" />
          <button className="btn" disabled={!url.trim() || busy} onClick={() => save(url.trim())}><Icon name="link" /> {busy ? 'Koppelen…' : 'Koppelen'}</button>
        </>
      ) : (
        <span className="small muted">De eigenaar van het gezin kan de agenda hier koppelen.</span>
      )}
      {error && <div className="error">{error}</div>}
      {msg && <span className="small muted">{msg}</span>}
    </section>
  );
}
