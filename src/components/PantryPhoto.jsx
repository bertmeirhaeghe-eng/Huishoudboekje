import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { store } from '../lib/store.js';
import { prepareImage, reviewList, guessFromLabels } from '../lib/pantryphoto.js';
import { sameThing } from '../lib/kitchen.js';

const PLACES = [
  { id: 'kast', name: 'Kast' },
  { id: 'koelkast', name: 'Koelkast' },
  { id: 'diepvries', name: 'Diepvries' },
  { id: 'andere', name: 'Andere' },
];

// Foto van de kast -> wat ik zie -> jij kijkt na -> in de voorraad.
export default function PantryPhoto({ file, home, place: startPlace, onClose, toast }) {
  const [step, setStep] = useState('kijken'); // kijken | lezen | nakijken | fout
  const [pct, setPct] = useState(0);
  const [rows, setRows] = useState([]);
  const [place, setPlace] = useState(startPlace || 'kast');
  const [labelsOnly, setLabelsOnly] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    let stop = false;
    (async () => {
      let found = [];
      let where = startPlace || 'kast';
      try {
        const img = await prepareImage(file);
        const res = await store.scanPantryPhoto({ ...img, known: home.pantry.map((p) => p.name) });
        found = res.items || [];
        if (res.plaats) where = res.plaats;
      } catch (e) {
        if (e.code !== 'geen-ai') { if (!stop) { setError(e.message); setStep('fout'); } return; }
        // Geen AI ingesteld: dan lezen we de etiketten op het toestel zelf.
        if (stop) return;
        setLabelsOnly(e.reden || true);
        setStep('lezen');
        try {
          const { readText } = await import('../lib/ocr.js');
          const text = await readText(file, (p) => setPct(p.step === 'laden' ? Math.max(5, p.pct / 3) : 33 + p.pct * 0.67));
          found = guessFromLabels(text, home.pantry);
        } catch (e2) {
          if (!stop) { setError(e2.message); setStep('fout'); }
          return;
        }
      }
      if (stop) return;
      setPlace(where);
      setRows(reviewList(found, home.pantry, where));
      setStep('nakijken');
    })();
    return () => { stop = true; URL.revokeObjectURL(url); };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.keep && r.name.trim());

  function choosePlace(p) {
    setPlace(p);
    // Nieuwe producten volgen de gekozen plaats; wat al in de voorraad staat, blijft waar het stond.
    setRows((rs) => rs.map((r) => (r.existing ? r : { ...r, place: p })));
  }

  function addExtra(e) {
    e.preventDefault();
    const t = extra.trim();
    if (!t) return;
    const [more] = reviewList([{ name: t }], home.pantry, place);
    if (more && !rows.some((r) => sameThing(r.name, more.name))) {
      setRows((rs) => [...rs, { ...more, key: Date.now(), keep: true }]);
    }
    setExtra('');
  }

  async function save() {
    setBusy(true);
    try {
      const { added, updated, listed } = await home.act.applyPhotoScan(chosen);
      const parts = [];
      if (added) parts.push(`${added} ${added === 1 ? 'product' : 'producten'} erbij`);
      if (updated) parts.push(`${updated} bijgewerkt`);
      if (listed) parts.push(`${listed} op de boodschappenlijst`);
      toast(parts.length ? `Voorraad: ${parts.join(', ')}` : 'De voorraad was al in orde');
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onClick={busy ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Voorraad van een foto" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="spread">
          <h2>{step === 'nakijken' ? 'Klopt dit?' : 'Voorraad van een foto'}</h2>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>

        {preview && <img src={preview} alt="Jouw foto" style={{ width: '100%', maxHeight: step === 'nakijken' ? 140 : 260, objectFit: 'cover', borderRadius: 14 }} />}

        {(step === 'kijken' || step === 'lezen') && (
          <div className="stack" style={{ gap: 8 }} aria-live="polite">
            <span className="small bold">{step === 'kijken' ? 'Ik kijk wat er in de kast staat…' : 'Ik lees de etiketten…'}</span>
            <div className="meter"><span className={step === 'kijken' ? 'busy' : ''} style={{ width: step === 'kijken' ? '60%' : `${pct}%`, transition: 'width .3s' }} /></div>
          </div>
        )}

        {step === 'fout' && (
          <>
            <div className="error">{error || 'Dat lukte niet.'}</div>
            <button className="btn ghost" onClick={onClose}>Sluiten</button>
          </>
        )}

        {step === 'nakijken' && (
          <>
            {labelsOnly && <div className="notice">Ik heb alleen de etiketten gelezen, dus ik mis wellicht wat. De slimme herkenning met AI staat nog niet aan.{typeof labelsOnly === 'string' && <><br /><b>Reden:</b> {labelsOnly}</>}</div>}
            <div className="seg small-seg" role="group" aria-label="Waar is de foto genomen?">
              {PLACES.map((p) => <button key={p.id} aria-pressed={place === p.id} onClick={() => choosePlace(p.id)}>{p.name}</button>)}
            </div>
            {rows.length === 0 && <div className="small muted">Ik herkende niets op deze foto. Probeer van wat dichterbij, met goed licht, of typ hieronder wat er staat.</div>}
            <div className="card" style={{ padding: '2px 12px' }}>
              {rows.map((r) => (
                <div key={r.key} className={'check-row' + (r.keep ? '' : ' off')}>
                  <button className="check" role="checkbox" aria-checked={r.keep} onClick={() => change(r.key, { keep: !r.keep })} aria-label={`${r.name} meenemen`} style={{ flex: '0 0 auto' }}>
                    <span className="box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  </button>
                  <span className="grow" style={{ minWidth: 0, padding: '6px 0' }}>
                    <input className="input" value={r.name} maxLength={80} aria-label="Naam" onChange={(e) => change(r.key, { name: e.target.value, keep: true })} style={{ minHeight: 40, padding: '0 10px' }} />
                    <span className="tiny muted" style={{ display: 'block', marginTop: 2 }}>{r.existing ? `staat al in de voorraad (${PLACES.find((p) => p.id === r.existing.place)?.name.toLowerCase()})` : 'nieuw'}</span>
                  </span>
                  <button className={'pill' + (r.status === 'bijna' ? ' on' : '')} onClick={() => change(r.key, { status: r.status === 'bijna' ? 'ok' : 'bijna', keep: true })} aria-label={`${r.name}: ${r.status === 'bijna' ? 'bijna op' : 'genoeg'}. Tik om te wijzigen.`} style={{ flexShrink: 0, minWidth: 92, justifyContent: 'center' }}>
                    {r.status === 'bijna' ? 'Bijna op' : 'Genoeg'}
                  </button>
                </div>
              ))}
            </div>
            <form className="row" onSubmit={addExtra}>
              <input className="input grow" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Iets vergeten? Typ het hier" aria-label="Product toevoegen" maxLength={80} enterKeyHint="done" />
              <button className="btn" disabled={!extra.trim()} aria-label="Toevoegen" style={{ minHeight: 50, padding: '0 16px' }}><Icon name="plus" /></button>
            </form>
            {error && <div className="error">{error}</div>}
            <span className="tiny muted">Vink uit wat niet klopt. Wat bijna op is, zet ik ook op de boodschappenlijst.</span>
            <button className="btn" disabled={!chosen.length || busy} onClick={save}>
              <Icon name="check" /> {busy ? 'Bewaren…' : chosen.length === 1 ? '1 product bewaren' : `${chosen.length} producten bewaren`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
