import { useState } from 'react';
import Icon from './Icon.jsx';
import { category } from '../lib/categories.js';
import { todayISO } from '../lib/format.js';
import { toCSV } from '../lib/stats.js';
import { store } from '../lib/store.js';
import * as gcal from '../lib/gcal.js';

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

      <GoogleCalendar />

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

function GoogleCalendar() {
  const [, force] = useState(0);
  const [error, setError] = useState('');
  const on = gcal.wasConnected();
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>Google Agenda</h2>
      {!gcal.gcalConfigured() ? (
        <span className="small muted">Nog niet ingesteld. Afspraken openen voorlopig in Google Agenda om op te slaan.</span>
      ) : on ? (
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
