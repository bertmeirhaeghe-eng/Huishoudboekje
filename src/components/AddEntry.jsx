import { useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { categoriesFor } from '../lib/categories.js';
import { parseAmount, todayISO } from '../lib/format.js';
import { pressKey } from '../lib/keypad.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

export default function AddEntry({ book: startBook, isOwner, onCancel, onSave }) {
  const [type, setType] = useState('uit');
  const [book, setBook] = useState(isOwner ? startBook : 'gezin');
  const [amount, setAmount] = useState('0');
  const [cat, setCat] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cats = categoriesFor(book, type);
  const cents = parseAmount(amount);
  const canSave = cents > 0 && cat && !busy;

  const change = (fn) => { fn(); setCat(null); };

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      await onSave({ book, type, amount_cents: cents, category: cat, date, note: note.trim() || null });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 14, maxWidth: 560, margin: '0 auto' }}>
      <div className="spread">
        <button className="icon-btn" onClick={onCancel} aria-label="Annuleren"><Icon name="close" /></button>
        <div className="seg" role="group" aria-label="Soort" style={{ width: 230 }}>
          <button aria-pressed={type === 'uit'} onClick={() => change(() => setType('uit'))}>Uitgave</button>
          <button aria-pressed={type === 'in'} onClick={() => change(() => setType('in'))}>Inkomst</button>
        </div>
        <span style={{ width: 44 }} />
      </div>

      <div key={amount} className={'amount-display bump' + (type === 'in' ? ' in' : '')} aria-live="polite">€ {amount}</div>

      {isOwner && (
        <div className="seg" role="group" aria-label="Boekje">
          <button aria-pressed={book === 'gezin'} onClick={() => change(() => setBook('gezin'))}>Gezin (privé)</button>
          <button aria-pressed={book === 'zaak'} onClick={() => change(() => setBook('zaak'))}>Zaak</button>
        </div>
      )}

      <div className="cats stagger" key={book + type} role="group" aria-label="Categorie">
        {cats.map((c) => (
          <button key={c.id} className="cat" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            <CatIcon id={c.id} selected={cat === c.id} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="row">
        <label className="field" style={{ flex: '0 0 auto' }}>
          <span className="tiny muted">Datum</span>
          <input className="input" type="date" value={date} max="2099-12-31" onChange={(e) => setDate(e.target.value || todayISO())} />
        </label>
        <label className="field grow">
          <span className="tiny muted">Notitie (mag leeg)</span>
          <input className="input" value={note} maxLength={300} placeholder="bv. Delhaize" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} onClick={() => setAmount((a) => pressKey(a, k))} aria-label={k === '⌫' ? 'Wissen' : k === ',' ? 'Komma' : k}>{k}</button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}
      {!cat && cents > 0 && <div className="small muted" style={{ textAlign: 'center' }}>Kies nog een categorie.</div>}
      <button className={'btn' + (book === 'zaak' ? ' blue' : '')} disabled={!canSave} onClick={save}>
        <Icon name="check" /> {busy ? 'Bewaren…' : 'Bewaren'}
      </button>
    </div>
  );
}
