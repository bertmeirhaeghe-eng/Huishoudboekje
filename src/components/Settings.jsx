import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { category } from '../lib/categories.js';
import { todayISO } from '../lib/format.js';
import { toCSV } from '../lib/stats.js';
import { store } from '../lib/store.js';
import * as gcal from '../lib/gcal.js';
import { forgetCalendar } from './Agenda.jsx';
import { forgetPhotos } from '../lib/photos.js';
import { setStartsOnBoard, startsOnBoard } from '../lib/prefs.js';
import { canPrompt, isApple, isInstalled, onInstallChange, promptInstall } from '../lib/install.js';

export default function Settings({ household, onChange, onOpenTax, onOpenImport, onOpenBoard, earlyDays = 3, setEarlyDays }) {
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

      <InstallCard />

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

      {onOpenBoard && <BoardSettings isOwner={isOwner} onOpen={onOpenBoard} />}

      {onOpenImport && (
        <button className="card tile-wide" onClick={onOpenImport}>
          <span className="tile-ico green"><Icon name="download" size={20} /></span>
          <span className="grow" style={{ textAlign: 'left' }}><b style={{ display: 'block' }}>Bankafschrift importeren</b><span className="tiny muted">CSV van Crelan of een andere bank</span></span>
          <Icon name="next" size={18} />
        </button>
      )}

      {setEarlyDays && (
        <section className="card stack" style={{ gap: 10 }}>
          <h2>Vroege inkomsten</h2>
          <span className="small muted">Storten jullie je maandelijkse bijdrage al een paar dagen voor de eerste? Een inkomst in de laatste {earlyDays || 'X'} dagen van de maand telt dan mee voor de volgende maand.</span>
          <div className="seg" role="group" aria-label="Aantal dagen">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-pressed={earlyDays === n} onClick={() => setEarlyDays(n)}>{n === 0 ? 'Uit' : n}</button>
            ))}
          </div>
          <span className="tiny muted">{earlyDays ? `Bv. een storting op 30 oktober telt voor november.` : 'Elke inkomst telt voor de maand waarin ze binnenkomt.'} Uitgaven blijven altijd in hun eigen maand.</span>
        </section>
      )}

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

function InstallCard() {
  const [, refresh] = useState(0);
  useEffect(() => onInstallChange(() => refresh((n) => n + 1)), []);
  if (isInstalled()) return null;
  const apple = isApple();
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>Zet de app op je beginscherm</h2>
      <span className="small muted">Dan open je het huishoudboekje met één tik, zonder adresbalk, net als een gewone app.</span>
      {canPrompt() ? (
        <button className="btn" onClick={promptInstall}><Icon name="download" /> App installeren</button>
      ) : apple ? (
        <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Open deze pagina in <b>Safari</b>.</li>
          <li>Tik op de <b>Deel-knop</b> <Icon name="share" size={16} /> (vierkantje met pijltje omhoog).</li>
          <li>Kies <b>Zet op beginscherm</b> en tik op <b>Voeg toe</b>.</li>
        </ol>
      ) : (
        <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Open deze pagina in <b>Chrome</b>.</li>
          <li>Tik rechtsboven op de <b>drie puntjes</b>.</li>
          <li>Kies <b>App installeren</b> (of <b>Toevoegen aan startscherm</b>).</li>
        </ol>
      )}
    </section>
  );
}

function BoardSettings({ isOwner, onOpen }) {
  const [start, setStart] = useState(startsOnBoard);
  const [count, setCount] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { store.photoAlbumCount().then(setCount).catch(() => setCount(0)); }, []);

  async function save(urls) {
    setBusy(true); setError(''); setMsg('');
    try {
      await store.setPhotoAlbums(urls);
      forgetPhotos();
      const found = urls.length ? (await store.albumPhotos()).length : 0;
      setCount(urls.length);
      setText('');
      setMsg(!urls.length ? 'Albums verwijderd.' : found ? `${found} foto's gevonden. Ze verschijnen in de ruststand.` : 'Opgeslagen, maar ik vond nog geen foto\'s. Staat het album op "delen via link"?');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>Weekbord voor de tablet</h2>
      <span className="small muted">De week in één oogopslag: wat jullie eten (middag en avond) en wat er in de agenda staat. Na 2 minuten zonder aanraking toont het foto's, met wat er vandaag op het programma staat.</span>
      <button className="btn" onClick={onOpen}><Icon name="tablet" /> Weekbord openen</button>
      <label className="row" style={{ cursor: "pointer", gap: 10 }}>
        <input type="checkbox" checked={start} onChange={(e) => { setStart(e.target.checked); setStartsOnBoard(e.target.checked); }} style={{ width: 22, height: 22 }} />
        <span className="small">Dit toestel opent altijd het weekbord</span>
      </label>
      <h3 className="small bold" style={{ marginTop: 6 }}>Foto's uit Google Foto's</h3>
      {store.mode !== 'cloud' ? (
        <span className="small muted">Kan pas als de app aan Supabase gekoppeld is.</span>
      ) : isOwner ? (
        <>
          <span className="small muted">{count ? `${count} ${count === 1 ? 'album' : 'albums'} gekoppeld. ` : ''}Open een album in Google Foto's, tik op Delen en kies <b>Link maken</b>. Plak hier één link per regel (maximaal 10). De tablet kiest willekeurig uit alle albums.</span>
          <textarea className="input area" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://photos.app.goo.gl/…" aria-label="Links naar gedeelde albums" />
          <div className="row">
            <button className="btn grow" disabled={!text.trim() || busy} onClick={() => save(text.split(/\s+/).filter(Boolean))}><Icon name="image" /> {busy ? 'Zoeken…' : count ? 'Albums vervangen' : 'Albums koppelen'}</button>
            {count > 0 && <button className="btn ghost" disabled={busy} onClick={() => save([])}>Verwijderen</button>}
          </div>
        </>
      ) : (
        <span className="small muted">{count ? `${count} ${count === 1 ? 'album' : 'albums'} gekoppeld.` : 'De eigenaar van het gezin kan hier foto-albums koppelen.'}</span>
      )}
      {error && <div className="error">{error}</div>}
      {msg && <span className="small muted">{msg}</span>}
    </section>
  );
}
