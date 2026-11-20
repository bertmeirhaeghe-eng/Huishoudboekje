import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { categoriesFor } from '../lib/categories.js';
import { apiClosing, closingBalance, markDuplicates, readBankApi, readBankCSV, shiftDate, NEAR_BEFORE, NEAR_AFTER } from '../lib/bankimport.js';
import { dayLabel, money, todayISO } from '../lib/format.js';
import { store } from '../lib/store.js';
import { aiCategoryRequest, applyAiCategories, chunks, rowsForAi } from '../lib/ai.js';

const NAMES_KEY = 'boekje-eigen-namen';
const PAGE = 80;

function loadNames(fallback) {
  try { const v = localStorage.getItem(NAMES_KEY); if (v != null) return v; } catch {}
  return fallback;
}

// Welk boekje hoort bij welke bankrekening? Onthouden op het toestel.
const BOOK_KEY = 'boekje-bank-boek-';
function bookFor(iban) {
  try { return localStorage.getItem(BOOK_KEY + iban) || 'gezin'; } catch { return 'gezin'; }
}

export default function BankImport({ household, isOwner, onBack, onDone, bankReturn = null }) {
  const [book, setBook] = useState('gezin');
  const [names, setNames] = useState(() => loadNames(household.members.map((m) => m.display_name).filter(Boolean).join(', ')));
  const [file, setFile] = useState(null); // { name, text } of, rechtstreeks van de bank, { name, bank: { uid, iban, transactions, balances } }
  const [rows, setRows] = useState(null);
  const [bank, setBank] = useState('');
  const [closing, setClosing] = useState(null); // echte stand volgens de bank, als het bestand die heeft
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(PAGE);
  const [tab, setTab] = useState('nieuw');
  const input = useRef(null);
  const saving = useRef(false); // twee keer snel tikken mag niet twee keer importeren
  const run = useRef(0); // een nieuw bestand of ander boekje: oude AI-antwoorden negeren
  const [aiCat, setAiCat] = useState(null); // { state: 'bezig' | 'klaar' | 'fout', n, reden }

  // Wat de vaste regels niet herkennen (categorie "Andere"), laten we de AI (Gemini) voorstellen.
  async function askAi(list, b, me) {
    const todo = rowsForAi(list, b);
    if (!todo.length || store.mode === 'demo' || !store.ai) return;
    setAiCat({ state: 'bezig', n: todo.length });
    try {
      for (const part of chunks(todo, 100)) {
        const res = await store.ai('categorie', aiCategoryRequest(part, b));
        if (run.current !== me) return;
        setRows((rs) => applyAiCategories(rs, res?.items, b));
      }
      if (run.current === me) setAiCat({ state: 'klaar' });
    } catch (e) {
      if (run.current === me) setAiCat({ state: 'fout', reden: e.reden || e.message });
    }
  }

  async function read(f, b = book, n = names) {
    setError('');
    setRows(null);
    setAiCat(null);
    const me = ++run.current;
    try {
      const own = n.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
      const r = f.bank
        ? { bank: 'Crelan', rows: readBankApi(f.bank.transactions, { ownNames: own }) }
        : readBankCSV(f.text, { ownNames: own });
      const dates = r.rows.map((x) => x.date).sort();
      const existing = dates.length ? (await store.listEntries(household.id, shiftDate(dates[0], -NEAR_BEFORE), shiftDate(dates[dates.length - 1], NEAR_AFTER))).filter((e) => e.book === b) : [];
      const marked = markDuplicates(r.rows, existing).map((x, i) => ({ ...x, i, on: !x.dup && !x.maybe, category: b === 'zaak' ? (x.type === 'in' ? 'andere_zaak_in' : 'andere_zaak') : x.category }));
      setBank(r.bank);
      setClosing(f.bank ? apiClosing(r.rows, f.bank.balances) : closingBalance(r.rows));
      setRows(marked);
      setShow(PAGE);
      askAi(marked, b, me);
    } catch (e) {
      setError(e.message);
    }
  }

  function fromBank(acc) {
    const b = bookFor(acc.iban || acc.uid);
    const useBook = isOwner ? b : 'gezin';
    setBook(useBook);
    const ff = { name: acc.name || acc.iban || 'rekening', bank: acc };
    setFile(ff);
    read(ff, useBook);
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
  const aiCount = rows ? rows.filter((r) => r.catBy === 'ai').length : 0;
  const sumIn = chosen.filter((r) => r.type === 'in').reduce((a, r) => a + r.amount_cents, 0);
  const sumOut = chosen.filter((r) => r.type === 'uit').reduce((a, r) => a + r.amount_cents, 0);

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const n = chosen.length ? await store.addEntries(chosen.map((r) => ({ household_id: household.id, book, type: r.type, amount_cents: r.amount_cents, category: r.category, date: r.date, note: r.note || null }))) : 0;
      if (file?.bank) {
        // Onthouden tot waar we zijn, en welk boekje bij deze rekening hoort.
        try { localStorage.setItem(BOOK_KEY + (file.bank.iban || file.bank.uid), book); } catch {}
        try { await store.bank('saved', { account: file.bank.uid, date: todayISO() }); } catch { /* volgende keer gewoon wat meer overlap */ }
      }
      onDone(n, chosen[0]?.date, closing ? { ...closing, book } : null);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      saving.current = false;
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Terug"><Icon name="back" /></button>
        <h1>Bankafschrift importeren</h1>
      </div>

      {!rows && isOwner && <BankLink bankReturn={bankReturn} onFetched={fromBank} />}

      {!rows && (
        <section className="card stack" style={{ gap: 12 }}>
          {isOwner && store.mode !== 'demo' && <b>Of met een bestand</b>}
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
            <div className="spread"><b>{bank} · {file?.bank ? `opgehaald, ${file.name}` : file?.name}</b><button className="tiny bold link" onClick={() => { setRows(null); setFile(null); }}>{file?.bank ? 'Terug' : 'Ander bestand'}</button></div>
            <div className="spread small"><span>Nieuwe boekingen</span><b>{chosen.length}</b></div>
            <div className="spread small"><span>In / uit</span><b><span style={{ color: 'var(--green)' }}>+ {money(sumIn)}</span> / − {money(sumOut)}</b></div>
            <div className="spread small muted"><span>Overgeslagen (staat er al of misschien al)</span><span>{skipped.length}</span></div>
            {closing && <div className="spread small"><span>Op de rekening volgens de bank, {dayLabel(closing.date).toLowerCase()} 's avonds</span><b>{money(closing.amount_cents)}</b></div>}
            {closing && <span className="tiny muted">Na het importeren rekent de app vanaf deze stand verder.</span>}
          </section>

          {aiCat?.state === 'bezig' && <div className="notice ai-notice"><Icon name="sparkle" size={16} /> Gemini zoekt een categorie voor {aiCat.n} {aiCat.n === 1 ? 'boeking' : 'boekingen'} die de app niet herkende…</div>}
          {aiCat?.state === 'klaar' && aiCount > 0 && <div className="notice ai-notice"><Icon name="sparkle" size={16} /> Gemini koos een categorie voor {aiCount} {aiCount === 1 ? 'boeking' : 'boekingen'} (met een ✨). Kijk ze even na.</div>}
          {aiCat?.state === 'fout' && <div className="small muted">Categorieën voorstellen met AI lukte nu niet{aiCat.reden ? `: ${aiCat.reden}` : '.'} Je kan ze gewoon zelf kiezen.</div>}

          <div className="seg" role="group" aria-label="Tonen">
            <button aria-pressed={tab === 'nieuw'} onClick={() => { setTab('nieuw'); setShow(PAGE); }}>Importeren ({chosen.length})</button>
            <button aria-pressed={tab === 'over'} onClick={() => { setTab('over'); setShow(PAGE); }}>Overgeslagen ({skipped.length})</button>
          </div>

          <div className="card list">
            {list.slice(0, show).map((r) => (
              <ImportRow key={r.i} r={r} book={book} onToggle={() => set(r.i, { on: !r.on })} onCat={(c) => set(r.i, { category: c, catBy: 'jij' })} />
            ))}
            {!list.length && <div className="entry small muted">Niets hier.</div>}
          </div>
          {list.length > show && <button className="btn ghost" onClick={() => setShow((s) => s + PAGE)}>Toon meer ({list.length - show})</button>}

          <button className={'btn' + (book === 'zaak' ? ' blue' : '')} disabled={(!chosen.length && !(file?.bank && closing)) || busy} onClick={save} style={{ position: 'sticky', bottom: 'calc(var(--nav-h) + 12px + env(safe-area-inset-bottom))' }}>
            <Icon name="check" /> {busy ? 'Importeren…' : chosen.length ? `${chosen.length} boekingen importeren` : 'Alles staat er al · rekeningstand bijwerken'}
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
          {r.catBy === 'ai' && <span className="ai-tag" title="Categorie voorgesteld door Gemini">✨</span>}
          <select className="cat-select" value={cats.some((c) => c.id === r.category) ? r.category : cats[cats.length - 1].id} onChange={(e) => onCat(e.target.value)} aria-label="Categorie">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}


// ───────────── Rechtstreeks bij Crelan ophalen (Enable Banking) ─────────────

const longDate = (iso) => new Date(iso).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
// Een terugkeer van de bank mag maar één keer verwerkt worden (de code van de bank werkt maar één keer).
let handledReturn = null;
const daysLeft = (iso) => Math.floor((Date.parse(iso) - Date.now()) / 86400000);

function BankLink({ bankReturn, onFetched }) {
  const [status, setStatus] = useState(null); // null = laden
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [account, setAccount] = useState('');
  const [confirmOff, setConfirmOff] = useState(false);

  async function fetchNow(uid = account, st = status) {
    setBusy('ophalen');
    setError('');
    try {
      const res = await store.bank('fetch', { account: uid || st?.accounts?.[0]?.uid });
      const acc = res.accounts?.[0];
      if (!acc) throw new Error('De bank gaf geen rekening door.');
      onFetched(acc);
    } catch (e) {
      if (e.code === 'verlopen') setExpired(true);
      setError(e.message);
      setBusy('');
    }
  }

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        // Terug van de bank: eerst de toestemming bewaren, dan meteen ophalen.
        if (bankReturn && handledReturn !== bankReturn) {
          handledReturn = bankReturn;
          if (bankReturn.error) {
            setError(bankReturn.error === 'access_denied' ? 'Je gaf bij Crelan geen toestemming. Er is niets gekoppeld.' : `Crelan gaf een fout: ${bankReturn.description || bankReturn.error}`);
          } else {
            setBusy('koppelen');
            const st = await store.bank('finish', { code: bankReturn.code, state: bankReturn.state });
            if (off) return;
            const full = { ready: true, ...st };
            setStatus(full);
            setAccount(st.accounts?.[0]?.uid || '');
            await fetchNow(st.accounts?.[0]?.uid, full);
            return;
          }
        }
        const st = await store.bank('status');
        if (off) return;
        setStatus(st);
        setAccount(st.accounts?.[0]?.uid || '');
        if (st.valid_until && daysLeft(st.valid_until) < 0) setExpired(true);
      } catch (e) {
        if (off) return;
        setStatus((s) => s || { ready: e.code !== 'niet-ingesteld', linked: false, missing: e.code === 'niet-ingesteld' ? e.message : '' });
        if (e.code !== 'niet-ingesteld') setError(e.message);
        setBusy('');
      }
    })();
    return () => { off = true; };
  }, []);

  async function link() {
    setBusy('koppelen');
    setError('');
    try {
      const { url } = await store.bank('start');
      location.href = url; // naar Crelan; daarna komt de bank terug naar de app
    } catch (e) {
      setError(e.message);
      setBusy('');
    }
  }

  async function unlink() {
    setBusy('loskoppelen');
    try { await store.bank('unlink'); setStatus((s) => ({ ...s, linked: false, accounts: [] })); setExpired(false); } catch (e) { setError(e.message); }
    setBusy('');
    setConfirmOff(false);
  }

  if (!status || status.demo) {
    if (!status && (busy || bankReturn)) return <section className="card small muted">{busy === 'koppelen' ? 'Crelan koppelen…' : 'Even geduld…'}</section>;
    return null;
  }

  const left = status.valid_until ? daysLeft(status.valid_until) : null;
  const soon = expired || (left != null && left < 14);

  return (
    <section className="card stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10 }}><Icon name="link" /><b>Rechtstreeks van Crelan</b></div>

      {!status.ready && (
        <span className="small muted">
          Nog niet ingesteld. Volg eenmalig de stappen in de handleiding (Bank automatisch koppelen), daarna haalt de app je verrichtingen met één tik op.
          {status.missing ? ` ${status.missing}` : ''}
        </span>
      )}

      {status.ready && !status.linked && (
        <>
          <span className="small muted">Koppel één keer je rekening. Daarna haalt de app je verrichtingen met één tik op, zonder bestanden. De app kan alleen lezen, nooit geld overschrijven.</span>
          <button className="btn" disabled={Boolean(busy)} onClick={link}><Icon name="link" /> {busy === 'koppelen' ? 'Naar Crelan…' : 'Crelan koppelen'}</button>
        </>
      )}

      {status.ready && status.linked && (
        <>
          {status.accounts?.length > 1 && (
            <label className="field">
              Rekening
              <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
                {status.accounts.map((a) => <option key={a.uid} value={a.uid}>{[a.name, a.iban].filter(Boolean).join(' · ')}</option>)}
              </select>
            </label>
          )}
          {!expired && (
            <button className="btn" disabled={Boolean(busy)} onClick={() => fetchNow()}>
              <Icon name="download" /> {busy === 'ophalen' ? 'Ophalen bij Crelan…' : busy === 'koppelen' ? 'Crelan koppelen…' : 'Nieuwe verrichtingen ophalen'}
            </button>
          )}
          {status.valid_until && (
            <span className={'small' + (soon ? '' : ' muted')}>
              {expired ? 'De toestemming bij Crelan is verlopen. Vernieuw ze even, dat duurt een minuutje.' : soon ? `De toestemming loopt af op ${longDate(status.valid_until)}. Vernieuw ze even, dat duurt een minuutje.` : `Toestemming geldig tot ${longDate(status.valid_until)}.`}
            </span>
          )}
          {soon && <button className={'btn' + (expired ? '' : ' ghost')} disabled={Boolean(busy)} onClick={link}><Icon name="repeat" /> Toestemming vernieuwen</button>}
          {!confirmOff
            ? <button className="tiny link" style={{ alignSelf: 'flex-start', color: 'var(--muted)' }} onClick={() => setConfirmOff(true)}>Koppeling verwijderen</button>
            : (
              <div className="row small" style={{ gap: 12 }}>
                <span>Zeker? Je kan later opnieuw koppelen.</span>
                <button className="tiny bold link" disabled={Boolean(busy)} onClick={unlink}>Ja, verwijderen</button>
                <button className="tiny link" onClick={() => setConfirmOff(false)}>Nee</button>
              </div>
            )}
        </>
      )}

      {error && <div className="error">{error}</div>}
    </section>
  );
}
