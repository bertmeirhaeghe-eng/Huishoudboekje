import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { category } from '../lib/categories.js';
import { dayLabel, money } from '../lib/format.js';
import { parseSpeech } from '../lib/voice.js';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const EXAMPLES = ['25 euro tanken', 'Gisteren 64,30 bij Delhaize', 'Houtskool 45 euro op de zaak', 'Loon ontvangen 3800 euro', '12 euro bakker en 8 euro apotheek'];

export default function Voice({ isOwner, onCancel, onSave, onEdit }) {
  const [phase, setPhase] = useState(SR ? 'luisteren' : 'typen'); // luisteren | begrepen | typen | fout
  const [heard, setHeard] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const recRef = useRef(null);

  function stopListening() {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onresult = rec.onend = rec.onerror = null; try { rec.abort(); } catch {} }
  }

  function understand(text) {
    const r = parseSpeech(text, { allowZaak: isOwner });
    setHeard(text);
    setItems(r);
    setPhase('begrepen');
  }

  function listen() {
    if (!SR) { setPhase('typen'); return; }
    setError('');
    setHeard('');
    setPhase('luisteren');
    stopListening();
    const rec = new SR();
    rec.lang = 'nl-BE';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setHeard((finalText + ' ' + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('De app mag de microfoon niet gebruiken. Sta de microfoon toe in Chrome (slotje naast het adres) of typ hieronder.');
      else if (e.error === 'no-speech') setError('Ik hoorde niets. Tik op de microfoon en probeer opnieuw.');
      else if (e.error === 'network') setError('Spraakherkenning heeft internet nodig. Typ het anders hieronder.');
      else if (e.error !== 'aborted') setError('Dat lukte niet. Probeer opnieuw of typ het hieronder.');
      setPhase('fout');
    };
    rec.onend = () => {
      if (finalText.trim()) understand(finalText.trim());
      else setPhase((p) => (p === 'luisteren' ? 'fout' : p));
    };
    recRef.current = rec;
    try { rec.start(); } catch { setPhase('fout'); }
  }

  useEffect(() => {
    if (SR) listen();
    return stopListening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ok = items.length > 0 && items.every((i) => i.amount_cents > 0);

  async function confirm() {
    setBusy(true);
    try {
      await onSave(items.map(({ type, book, amount_cents, category, date, note }) => ({ type, book, amount_cents, category, date, note })));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="voice">
      <div className="spread">
        <button className="icon-btn dark" onClick={onCancel} aria-label="Sluiten"><Icon name="close" /></button>
        <span className="small bold" style={{ color: '#C9D1D9' }}>Nederlands (België)</span>
        <span style={{ width: 44 }} />
      </div>

      {(phase === 'luisteren' || phase === 'fout' || phase === 'typen') && (
        <div className="voice-center">
          {phase !== 'typen' && (
            <>
              <h2 className="voice-title">{phase === 'luisteren' ? 'Ik luister…' : 'Tik om te spreken'}</h2>
              <button className={'mic' + (phase === 'luisteren' ? ' live' : '')} onClick={() => (phase === 'luisteren' ? recRef.current?.stop() : listen())} aria-label={phase === 'luisteren' ? 'Stoppen met luisteren' : 'Opnieuw spreken'}>
                <span className="ring" /><span className="ring r2" />
                <Icon name="mic" size={52} stroke={2} />
              </button>
              <p className="voice-heard" aria-live="polite">{heard ? `“${heard}”` : 'Zeg het gewoon zoals je het zou zeggen.'}</p>
            </>
          )}
          {phase === 'typen' && (
            <>
              <h2 className="voice-title">Typ het gewoon</h2>
              <p className="voice-heard">Spraak werkt niet in deze browser. Gebruik Chrome op Android, of typ hieronder.</p>
            </>
          )}
          {error && <div className="error">{error}</div>}
          <form className="row" style={{ width: '100%' }} onSubmit={(e) => { e.preventDefault(); if (!typed.trim()) return; stopListening(); understand(typed.trim()); }}>
            <input className="input dark grow" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="bv. 25 euro tanken" aria-label="Of typ het hier" />
            <button className="btn" disabled={!typed.trim()} style={{ minHeight: 50 }}>OK</button>
          </form>
          <div className="examples">
            <span className="tiny" style={{ color: '#C9D1D9' }}>Probeer bijvoorbeeld</span>
            {EXAMPLES.map((x) => (
              <button key={x} className="chip" onClick={() => { stopListening(); understand(x); }}>“{x}”</button>
            ))}
          </div>
        </div>
      )}

      {phase === 'begrepen' && (
        <div className="stack screen" style={{ gap: 14, flex: 1 }}>
          <span className="small" style={{ color: '#C9D1D9' }}>Je zei:</span>
          <p className="voice-said">“{heard}”</p>
          <div className="stack stagger" style={{ gap: 10 }}>
            {items.map((it, i) => (
              <Understood key={i} item={it} onEdit={() => onEdit(it)} />
            ))}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="grow" />
          <button className="btn" disabled={!ok || busy} onClick={confirm}>
            <Icon name="check" /> {busy ? 'Bewaren…' : items.length > 1 ? `Klopt, bewaar alle ${items.length}` : 'Klopt, bewaren'}
          </button>
          <div className="row">
            <button className="btn dark grow" onClick={() => onEdit(items[0])}>Aanpassen</button>
            <button className="btn dark grow" onClick={listen}><Icon name="mic" size={20} /> Opnieuw</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Understood({ item, onEdit }) {
  const c = category(item.category);
  const noAmount = item.amount_cents <= 0;
  return (
    <div className="understood">
      <div className="spread">
        <span className="tiny bold" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: item.book === 'zaak' ? 'var(--blue)' : 'var(--green)' }}>
          {item.type === 'in' ? 'Inkomst' : 'Uitgave'} · {item.book === 'zaak' ? 'Zaak' : 'Gezin'}
        </span>
        <button className="tiny bold link" onClick={onEdit}>Aanpassen</button>
      </div>
      <div className="row">
        <CatIcon id={item.category} selected />
        <div className="grow">
          <div className="bold">{c.name}</div>
          <div className="tiny muted">{dayLabel(item.date)}{item.note && item.note.toLowerCase() !== c.name.toLowerCase() ? ` · ${item.note}` : ''}</div>
        </div>
        <span className={'amt' + (item.type === 'in' ? ' in' : '')} style={{ fontSize: 20 }}>
          {noAmount ? '?' : `${item.type === 'in' ? '+' : '−'} ${money(item.amount_cents)}`}
        </span>
      </div>
      {noAmount && <div className="notice">Ik hoorde geen bedrag. Zeg het opnieuw met een bedrag, of tik op Aanpassen.</div>}
      {!noAmount && item.missing.includes('categorie') && <div className="notice">Ik weet niet goed waarvoor. Het staat bij Andere; tik op Aanpassen om te kiezen.</div>}
    </div>
  );
}
