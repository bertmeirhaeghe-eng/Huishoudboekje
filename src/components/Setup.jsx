import { useState } from 'react';
import { store } from '../lib/store.js';

export default function Setup({ onDone }) {
  const [mode, setMode] = useState('nieuw');
  const [name, setName] = useState('');
  const [hname, setHname] = useState('Ons gezin');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'nieuw') await store.createHousehold(hname.trim(), name.trim());
      else await store.joinHousehold(code, name.trim());
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="stack" onSubmit={submit}>
        <h1>Bijna klaar</h1>
        <div className="seg" role="group" aria-label="Kies">
          <button type="button" aria-pressed={mode === 'nieuw'} onClick={() => setMode('nieuw')}>Nieuw boekje</button>
          <button type="button" aria-pressed={mode === 'code'} onClick={() => setMode('code')}>Ik heb een code</button>
        </div>
        <label className="field">Jouw naam<input className="input" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. Bert" /></label>
        {mode === 'nieuw' ? (
          <label className="field">Naam van het boekje<input className="input" required maxLength={80} value={hname} onChange={(e) => setHname(e.target.value)} /></label>
        ) : (
          <label className="field">Uitnodigingscode<input className="input" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6 tekens" style={{ letterSpacing: 3, textTransform: 'uppercase' }} /></label>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          {mode === 'nieuw' ? 'Jij wordt eigenaar: je ziet het gezinsboekje en je eigen zaakboekje. Daarna nodig je je gezin uit.' : 'Je ziet het gezinsboekje van wie je uitnodigde.'}
        </p>
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Even geduld…' : 'Starten'}</button>
      </form>
    </div>
  );
}
