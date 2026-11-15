import { useState } from 'react';
import { store } from '../lib/store.js';
import { HomeIllustration } from './Illustrations.jsx';

export default function Auth({ onDone }) {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      if (mode === 'in') {
        await store.signIn(email.trim(), password);
        await onDone();
      } else {
        const r = await store.signUp(email.trim(), password);
        if (r?.needsConfirm) { setInfo('Check je mailbox en klik op de link om je account te bevestigen. Log daarna hier in.'); setMode('in'); }
        else await onDone();
      }
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="center-page">
      <form className="stack screen" onSubmit={submit}>
        <HomeIllustration />
        <h1>{mode === 'in' ? 'Welkom terug' : 'Account maken'}</h1>
        <p className="small muted" style={{ margin: 0 }}>Jullie huishoudboekje, samen op elke telefoon.</p>
        <label className="field">E-mail<input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Wachtwoord<input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        {info && <div className="notice">{info}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Even geduld…' : mode === 'in' ? 'Inloggen' : 'Account maken'}</button>
        <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); }}>
          {mode === 'in' ? 'Nog geen account? Maak er een' : 'Ik heb al een account'}
        </button>
      </form>
    </div>
  );
}
