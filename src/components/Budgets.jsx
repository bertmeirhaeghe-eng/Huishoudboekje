import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { MonthSwitcher } from './Chart.jsx';
import { categoriesFor } from '../lib/categories.js';
import { money, parseAmount } from '../lib/format.js';
import { summarize } from '../lib/stats.js';
import { store } from '../lib/store.js';

export default function Budgets({ household, book, month, setMonth, budgets, entries, onChange }) {
  const sum = useMemo(() => summarize(entries), [entries]);
  const total = Object.values(budgets).reduce((a, b) => a + b, 0);
  return (
    <div className="stack">
      <h1>Budgetten {book === 'zaak' ? '(zaak)' : ''}</h1>
      <p className="small muted" style={{ margin: 0 }}>Een bedrag per maand per categorie. Laat leeg als je geen budget wil. Totaal: <b>{money(total)}</b> per maand.</p>
      <MonthSwitcher month={month} setMonth={setMonth} />
      <div className="card list">
        {categoriesFor(book, 'uit').map((c) => (
          <BudgetRow key={c.id} hid={household.id} book={book} cat={c} value={budgets[c.id] || 0} used={sum.byCategory[c.id] || 0} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function BudgetRow({ hid, book, cat, value, used, onChange }) {
  const [text, setText] = useState(value ? String(value / 100).replace('.', ',') : '');
  const [state, setState] = useState('');

  async function commit() {
    const cents = text.trim() === '' ? 0 : parseAmount(text);
    if (cents === null) { setState('Ongeldig bedrag'); return; }
    if (cents === value) return;
    setState('…');
    try {
      await store.setBudget(hid, book, cat.id, cents);
      setState('Bewaard');
      onChange();
    } catch (e) {
      setState(e.message);
    }
  }

  const ratio = value ? used / value : 0;
  return (
    <div className="entry" style={{ alignItems: 'center' }}>
      <span className="ico"><Icon name={cat.icon} /></span>
      <label className="grow" htmlFor={'b-' + cat.id}>
        <span style={{ display: 'block', fontWeight: 600 }}>{cat.name}</span>
        <span className="tiny muted" style={{ color: ratio > 1 ? 'var(--danger)' : undefined }}>
          {state || `${money(used)} uitgegeven`}
        </span>
      </label>
      <div style={{ position: 'relative', width: 110 }}>
        <span className="muted" style={{ position: 'absolute', left: 12, top: 14 }}>€</span>
        <input id={'b-' + cat.id} className="input" inputMode="decimal" style={{ paddingLeft: 28, textAlign: 'right' }} value={text} placeholder="geen" onChange={(e) => { setText(e.target.value); setState(''); }} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      </div>
    </div>
  );
}
