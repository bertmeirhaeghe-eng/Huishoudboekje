import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { categoriesFor } from '../lib/categories.js';
import { markDuplicates, readBankCSV, shiftDate, NEAR_BEFORE, NEAR_AFTER } from '../lib/bankimport.js';
import { dayLabel, money } from '../lib/format.js';
import { store } from '../lib/store.js';

const NAMES_KEY = 'boekje-eigen-namen';
const PAGE = 80;

function loadNames(fallback) {
  try { const v = localStorage.getItem(NAMES_KEY); if (v != null) return v; } catch {}
  return fallback;
}

export default function BankImport({ household, isOwner, onBack, onDone }) {
  const [book, setBook] = useState('gezin');
  const [names, setNames] = useState(() => loadNames(household.members.map((m) => m.display_name).filter(Boolean).join(', ')));
  const [file, setFile] = useState(null); // { name, text }
  const [rows, setRows] = useState(null);
  const [bank, setBank] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(PAGE);
  const [tab, setTab] = useState('nieuw');
  const input = useRef(null);

  async function read(f, b = book, n = names) {
    setError('');
    setRows(null);
    try {
      const text = f.text;
      const own = n.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
      const r = readBankCSV(text, { ownNames: own });
      const dates = r.rows.map((x) => x.date).sort();
      const existing = (await store.listEntries(household.id, shiftDate(dates[0], -NEAR_BEFORE), shiftDate(dates[dates.length - 1], NEAR_AFTER))).filter((e) => e.book === b);
      const marked = markDuplicates(r.rows, existing).map((x, i) => ({ ...x, i, on: !x.dup && !x.maybe, category: b === 'zaak' ? (x.type === 'in' ? 'andere_zaak_in' : 'andere_zaak') : x.category }));
      setBank(r.bank);
      setRows(marked);
      setShow(PAGE);
    } catch (e) {
      setError(e.message);
    }
  }

  async function pick(f) {
    if (!f) return;
    // Crelan bewaart in UTF-8; oudere exports soms in Windows-1252.
    const buf = await f.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    const ff = { name: f.name, text };
    setFile(ff);
    read(ff);
  }

  const set = (i, patch) => setRows((rs) => rs.map((r) => (r.i === i ? { ...r, ...patch } : r)));
  const chosen = rows ? rows.filter((r) => r.on) : [];
  const skipped = rows ? rows.filter((r) => !r.on) : [];
  const list = tab === 'nieuw' ? chosen : skipped;
  const sumIn = chosen.filter((r) => r.type === 'in').reduce((a, r) => a + r.amount_cents, 0);
  const sumOut = chosen.filter((r) => r.type === 'uit').reduce((a, r) => a + r.amount_cents, 0);

  async function save() {
    setBusy(true);
    setError('');
    try {
      const n = await store.addEntries(chosen.map((r) => ({ household_id: household.id, book, type: r.type, amount_cents: r.amount_cents, category: r.category, date: r.date, note: r.note || null })));
      onDone(n, chosen[0]?.date);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Terug"><Icon name="back" /></button>
        <h1>Bankafschrift importeren</h1>
      </div>

      {!rows && (
        <section className="card stack" style={{ gap: 12 }}>
          <span className="small muted">Download je verrichtingen als CSV-bestand in myCrelan (of de app van je bank) en kies het hier. Je ziet eerst alles en beslist zelf wat erin komt. Wat al in het boekje staat, slaat de app over, ook als je het zelf of met je stem al had ingegeven.</span>
          <button className="btn" onClick={() => input.current?.click()}><Icon name="download" /> CSV-bestand kiezen</button>
          <input ref={input} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <details className="small">
            <summary className="bold">Zo vind je het bestand bij Crelan</summary>
            <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.5 }}>
              <li>Log in op myCrelan op de computer.</li>
              <li>Open je rekening en kies de periode.</li>
              <li>Klik op exporteren en kies CSV.</li>
            </ol>
          </details>
        </section>
      )}

      {isOwner && (
        <div className="seg" role="group" aria-label="Boekje">
          <button aria-pressed={book === 'gezin'} onClick={() => { setBook('gezin'); if (file) read(file, 'gezin'); }}>In het gezinsboekje</button>
          <button aria-pressed={book === 'zaak'} onClick={() => { setBook('zaak'); if (file) read(file, 'zaak'); }}>In het zaakboekje</button>
        </div>
      )}

      <label className="field">
        Overschrijvingen tussen jullie eigen rekeningen herkennen <span className="tiny muted" style={{ fontWeight: 400 }}>namen, gescheiden door een komma</span>
        <input className="input" value={names} onChange={(e) => setNames(e.target.value)} onBlur={() => { try { localStorage.setItem(NAMES_KEY, names); } catch {} if (file) read(file, book, names); }} placeholder="bv. Jan Peeters, An Janssens" />
      </label>

      {error && <div className="error">{error}</div>}

      {rows && (
        <>
          <section className="card stack" style={{ gap: 8 }}>
            <div className="spread"><b>{bank} · {file?.name}</b><button className="tiny bold link" onClick={() => { setRows(null); setFile(null); }}>Ander bestand</button></div>
            <div className="spread small"><span>Nieuwe boekingen</span><b>{chosen.length}</b></div>
            <div className="spread small"><span>In / uit</span><b><span style={{ color: 'var(--green)' }}>+ {money(sumIn)}</span> / − {money(sumOut)}</b></div>
            <div className="spread small muted"><span>Overgeslagen (staat er al of misschien al)</span><span>{skipped.length}</span></div>
          </section>

          <div className="seg" role="group" aria-label="Tonen">
            <button aria-pressed={tab === 'nieuw'} onClick={() => { setTab('nieuw'); setShow(PAGE); }}>Importeren ({chosen.length})</button>
            <button aria-pressed={tab === 'over'} onClick={() => { setTab('over'); setShow(PAGE); }}>Overgeslagen ({skipped.length})</button>
          </div>

          <div className="card list">
            {list.slice(0, show).map((r) => (
              <ImportRow key={r.i} r={r} book={book} onToggle={() => set(r.i, { on: !r.on })} onCat={(c) => set(r.i, { category: c })} />
            ))}
            {!list.length && <div className="entry small muted">Niets hier.</div>}
          </div>
          {list.length > show && <button className="btn ghost" onClick={() => setShow((s) => s + PAGE)}>Toon meer ({list.length - show})</button>}

          <button className={'btn' + (book === 'zaak' ? ' blue' : '')} disabled={!chosen.length || busy} onClick={save} style={{ position: 'sticky', bottom: 'calc(var(--nav-h) + 12px + env(safe-area-inset-bottom))' }}>
            <Icon name="check" /> {busy ? 'Importeren…' : `${chosen.length} boekingen importeren`}
          </button>
        </>
      )}
    </div>
  );
}

function ImportRow({ r, book, onToggle, onCat }) {
  const cats = categoriesFor(book, r.type);
  const why = r.dup ? `staat er al${r.dupNote && r.dupNote !== r.note ? `: "${r.dupNote}"` : ''}` : r.maybe ? `staat er misschien al: ${r.maybe.note ? `"${r.maybe.note}" ` : ''}op ${dayLabel(r.maybe.date)}` : r.own ? 'eigen overschrijving' : r.cash ? 'cash' : null;
  return (
    <div className="import-row">
      <button className="check" role="checkbox" aria-checked={r.on} onClick={onToggle} aria-label={r.note} style={{ flex: '0 0 auto', minHeight: 44, padding: 0 }}>
        <span className="box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </button>
      <CatIcon id={r.category} size={18} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="spread" style={{ gap: 8 }}>
          <span className="bold ellipsis">{r.note}</span>
          <span className={'amt' + (r.type === 'in' ? ' in' : '')}>{r.type === 'in' ? '+ ' : '− '}{money(r.amount_cents)}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="tiny muted" style={{ whiteSpace: r.maybe || r.dup ? 'normal' : 'nowrap' }}>{dayLabel(r.date)}{why ? ` · ${why}` : ''}</span>
          <select className="cat-select" value={cats.some((c) => c.id === r.category) ? r.category : cats[cats.length - 1].id} onChange={(e) => onCat(e.target.value)} aria-label="Categorie">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

