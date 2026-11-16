import { useMemo } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { category } from '../lib/categories.js';
import { money, monthLabel, monthShortLabel, shiftMonth } from '../lib/format.js';
import { inPeriod, perMonth, summarize, totalsByCategory } from '../lib/stats.js';

// Bovenaan: kies een maand, of (met period/setPeriod) een heel jaar.
export function MonthSwitcher({ month, setMonth, period = 'maand', setPeriod }) {
  const jaar = period === 'jaar';
  const step = jaar ? 12 : 1;
  return (
    <div className="card" style={{ padding: 6 }}>
      <div className="spread">
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -step))} aria-label={jaar ? 'Vorig jaar' : 'Vorige maand'}><Icon name="back" /></button>
        <span className="bold" style={{ textTransform: 'capitalize' }}>{jaar ? `Heel ${month.slice(0, 4)}` : monthLabel(month)}</span>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, step))} aria-label={jaar ? 'Volgend jaar' : 'Volgende maand'}><Icon name="next" /></button>
      </div>
      {setPeriod && (
        <div className="seg period-seg" role="group" aria-label="Periode">
          <button aria-pressed={!jaar} onClick={() => setPeriod('maand')}>Maand</button>
          <button aria-pressed={jaar} onClick={() => setPeriod('jaar')}>Jaar</button>
        </div>
      )}
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
      <svg key={series.map((s) => s.month + s.income + s.expense).join()} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        {series.map((s, i) => {
          const cx = slot * i + slot / 2;
          return (
            <g key={s.month}>
              <rect className="bar" style={{ animationDelay: `${i * 0.06}s` }} x={cx - bw - 1} y={y(s.income)} width={bw} height={H - bottom - y(s.income)} rx="3" fill="var(--green)">
                <title>{`In ${money(s.income)}`}</title>
              </rect>
              <rect className="bar" style={{ animationDelay: `${i * 0.06 + 0.03}s` }} x={cx + 1} y={y(s.expense)} width={bw} height={H - bottom - y(s.expense)} rx="3" fill="var(--orange)">
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

export default function ChartScreen({ book, month, setMonth, period = 'maand', setPeriod, entries, months, earlyDays = 0 }) {
  const series = useMemo(() => perMonth(entries, months, earlyDays), [entries, months, earlyDays]);
  const monthEntries = useMemo(() => entries.filter((e) => inPeriod(e, month, period, earlyDays)), [entries, month, period, earlyDays]);
  const sum = useMemo(() => summarize(monthEntries), [monthEntries]);
  const income = totalsByCategory(monthEntries, 'in');
  const when = period === 'jaar' ? 'dit jaar' : 'deze maand';
  const cats = Object.entries(sum.byCategory).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;

  return (
    <div className="stack">
      <h1>Grafiek {book === 'zaak' ? '(zaak)' : ''}</h1>
      <MonthSwitcher month={month} setMonth={setMonth} period={period} setPeriod={setPeriod} />
      <div className="card"><MonthBars series={series} /></div>
      <h2>Waar ging het geld naartoe?</h2>
      <div className="card stack stagger" style={{ gap: 12 }} key={period + month + book}>
        {cats.length === 0 && <span className="small muted">Nog geen uitgaven {when}.</span>}
        {cats.map(([id, v]) => (
          <div key={id}>
            <div className="spread small" style={{ marginBottom: 6 }}>
              <span className="row" style={{ gap: 10 }}><CatIcon id={id} size={18} /><span className="bold">{category(id).name}</span></span>
              <span className="muted">{money(v)} · {sum.expense ? Math.round((v / sum.expense) * 100) : 0}%</span>
            </div>
            <div className="meter"><span style={{ width: `${Math.round((v / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      <h2>Waar kwam het geld vandaan?</h2>
      <div className="card stack" style={{ gap: 10 }} key={'in' + period + month + book}>
        {income.length === 0 && <span className="small muted">Nog geen inkomsten {when}.</span>}
        {income.map(([id, v]) => (
          <div key={id} className="spread small">
            <span className="row" style={{ gap: 10 }}><CatIcon id={id} size={18} /><span className="bold">{category(id).name}</span></span>
            <span className="amt in">+ {money(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
