import { useMemo } from 'react';
import Icon from './Icon.jsx';
import { category } from '../lib/categories.js';
import { money, monthLabel, monthShortLabel, shiftMonth } from '../lib/format.js';
import { perMonth, summarize } from '../lib/stats.js';

export function MonthSwitcher({ month, setMonth }) {
  return (
    <div className="spread card" style={{ padding: 6 }}>
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Vorige maand"><Icon name="back" /></button>
      <span className="bold" style={{ textTransform: 'capitalize' }}>{monthLabel(month)}</span>
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Volgende maand"><Icon name="next" /></button>
    </div>
  );
}

// Gegroepeerde staafjes: inkomsten en uitgaven per maand.
export function MonthBars({ series, compact = false }) {
  const W = 340;
  const H = compact ? 110 : 200;
  const top = 8;
  const bottom = 22;
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  const slot = W / series.length;
  const bw = Math.min(16, slot / 3);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const label = series.map((s) => `${monthShortLabel(s.month)}: in ${money(s.income, { round: true })}, uit ${money(s.expense, { round: true })}`).join('; ');
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        {series.map((s, i) => {
          const cx = slot * i + slot / 2;
          return (
            <g key={s.month}>
              <rect x={cx - bw - 1} y={y(s.income)} width={bw} height={H - bottom - y(s.income)} rx="3" fill="var(--green)">
                <title>{`In ${money(s.income)}`}</title>
              </rect>
              <rect x={cx + 1} y={y(s.expense)} width={bw} height={H - bottom - y(s.expense)} rx="3" fill="var(--orange)">
                <title>{`Uit ${money(s.expense)}`}</title>
              </rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{monthShortLabel(s.month)}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--green)' }} />In</span><span><i style={{ background: 'var(--orange)' }} />Uit</span></div>
    </div>
  );
}

export default function ChartScreen({ book, month, setMonth, entries, months }) {
  const series = useMemo(() => perMonth(entries, months), [entries, months]);
  const monthEntries = useMemo(() => entries.filter((e) => e.date.startsWith(month)), [entries, month]);
  const sum = useMemo(() => summarize(monthEntries), [monthEntries]);
  const cats = Object.entries(sum.byCategory).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;

  return (
    <div className="stack">
      <h1>Grafiek {book === 'zaak' ? '(zaak)' : ''}</h1>
      <MonthSwitcher month={month} setMonth={setMonth} />
      <div className="card"><MonthBars series={series} /></div>
      <h2>Waar ging het geld naartoe?</h2>
      <div className="card stack" style={{ gap: 12 }}>
        {cats.length === 0 && <span className="small muted">Nog geen uitgaven deze maand.</span>}
        {cats.map(([id, v]) => (
          <div key={id}>
            <div className="spread small" style={{ marginBottom: 6 }}>
              <span className="bold">{category(id).name}</span>
              <span className="muted">{money(v)} · {sum.expense ? Math.round((v / sum.expense) * 100) : 0}%</span>
            </div>
            <div className="meter"><span style={{ width: `${Math.round((v / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
