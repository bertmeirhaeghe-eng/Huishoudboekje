import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import CategorySplit from './CategorySplit.jsx';
import { store } from '../lib/store.js';
import { analyze, changeLabel } from '../lib/insights.js';
import { category, tone } from '../lib/categories.js';
import { money, monthKey, monthLabel, monthShortLabel, shiftMonth } from '../lib/format.js';

const SCOPES = [['maand', 'Maand'], ['jaar', 'Jaar'], ['alles', 'Alle jaren']];

// Het inzichtenscherm: grafieken, wat opvalt en tips, per maand, per jaar of over de jaren heen.
export default function Insights({ refresh, household, isOwner, book, setBook, month, setMonth, earlyDays = 0, budgets = {}, onBack, onOpenKitchen }) {
  const [scope, setScope] = useState('maand');
  const [all, setAll] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => store.listEntries(household.id, '2000-01-01', '2999-12-31')
      .then((e) => { if (live) { setAll(e); setError(''); } })
      .catch((err) => live && setError(err.message));
    load();
    return () => { live = false; };
    // Herladen wanneer het overzicht nieuwe boekingen binnenkreeg (refresh verandert dan).
  }, [household.id, refresh]);

  const entries = useMemo(() => (all || []).filter((e) => e.book === book), [all, book]);
  const a = useMemo(() => analyze({ entries, scope, month, earlyDays, budgets, book }), [entries, scope, month, earlyDays, budgets, book]);
  const zaak = book === 'zaak';
  const step = scope === 'jaar' ? 12 : 1;
  const thisMonth = monthKey();

  return (
    <div className="stack insights">
      <div className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Terug naar het overzicht"><Icon name="back" /></button>
        <div className="grow">
          <h1>Inzichten</h1>
          <div className="tiny muted">{zaak ? 'Zaak (vennootschap)' : 'Gezin'} · {a.count} boekingen</div>
        </div>
        <span className="tile-ico orange" style={{ width: 44, height: 44 }}><Icon name="sparkle" size={22} /></span>
      </div>

      {isOwner && (
        <div className="seg" role="group" aria-label="Boekje">
          <button aria-pressed={!zaak} onClick={() => setBook('gezin')}>Gezin</button>
          <button aria-pressed={zaak} onClick={() => setBook('zaak')}>Zaak (vennootschap)</button>
        </div>
      )}

      <div className="card" style={{ padding: 6 }}>
        {scope !== 'alles' && (
          <div className="spread">
            <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -step))} aria-label={scope === 'jaar' ? 'Vorig jaar' : 'Vorige maand'}><Icon name="back" /></button>
            <span className="bold" style={{ textTransform: 'capitalize' }}>{scope === 'jaar' ? `Heel ${month.slice(0, 4)}` : monthLabel(month)}</span>
            <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, step))} disabled={scope === 'maand' ? month >= thisMonth : month.slice(0, 4) >= thisMonth.slice(0, 4)} aria-label={scope === 'jaar' ? 'Volgend jaar' : 'Volgende maand'}><Icon name="next" /></button>
          </div>
        )}
        <div className="seg period-seg" role="group" aria-label="Periode" style={scope === 'alles' ? { marginTop: 0 } : undefined}>
          {SCOPES.map(([id, label]) => <button key={id} aria-pressed={scope === id} onClick={() => setScope(id)}>{label}</button>)}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {!all && !error && <div className="card small muted">Even rekenen…</div>}
      {all && a.count === 0 && (
        <div className="card empty">
          <b>Nog niets te tonen</b>
          <span className="small muted">Er zijn geen boekingen in {scope === 'maand' ? monthLabel(month) : scope === 'jaar' ? month.slice(0, 4) : 'dit boekje'}.</span>
        </div>
      )}

      {all && a.count > 0 && (
        <div key={book + scope + month} className="stack">
          <Kpis a={a} zaak={zaak} />

          <div className="two-col">
            <div className="stack">
              <section className="card stack" style={{ gap: 10 }}>
                <h2>{a.trend.kind === 'maanden' ? 'Uitgaven, laatste 12 maanden' : a.trend.kind === 'jaar' ? `Uitgaven per maand in ${month.slice(0, 4)}` : 'Per jaar (gemiddeld per maand)'}</h2>
                {a.trend.kind === 'jaren' ? <YearsChart points={a.trend.points} /> : <TrendChart trend={a.trend} />}
              </section>

              {a.cum && <MonthPace cum={a.cum} month={month} current={month === thisMonth} />}

              <section className="stack" style={{ gap: 10 }}>
                <h2>Waar ging het geld naartoe?</h2>
                <CategorySplit
                  totals={a.rows.filter((r) => r.now > 0).map((r) => [r.id, r.now])}
                  total={a.cur.expense}
                  compare={a.hasBase ? Object.fromEntries(a.rows.map((r) => [r.id, changeLabel(r)])) : null}
                  emptyText="Nog geen uitgaven."
                />
                {a.perMonth && <span className="tiny muted">Bedragen per maand, gemiddeld over {a.months.length} {a.months.length === 1 ? 'maand' : 'maanden'}.</span>}
              </section>
            </div>

            <div className="stack">
              <Outliers list={a.outliers} hasBase={a.hasBase} scope={a.scope} />
              {a.hasBase && <Compare rows={a.rows} scope={a.scope} cap={a.cap} />}
              {a.trend.kind === 'jaren' && a.trend.points.length > 1 && <CategoryYears points={a.trend.points} />}
              <Weekdays values={a.weekday} />
              <Tips tips={a.tips} onOpenKitchen={onOpenKitchen} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Delta({ now, before, invert = false, vs }) {
  if (!before) return null;
  const d = Math.round(((now - before) / before) * 100);
  if (!d) return <span className="tiny muted">zelfde als {vs.replace('vs ', '')}</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={'tiny delta ' + (good ? 'down' : 'up')}>
      <Icon name={d > 0 ? 'up' : 'down'} size={12} stroke={2.6} /> {Math.abs(d)}% <span className="muted" style={{ fontWeight: 400 }}>{vs}</span>
    </span>
  );
}

function Kpis({ a, zaak }) {
  const per = a.perMonth ? ' / maand' : '';
  const rate = a.total.income > 0 ? Math.round(((a.total.income - a.total.expense) / a.total.income) * 100) : null;
  const vs = a.scope === 'maand' ? 'vs vorige maand' : a.scope === 'jaar' ? 'vs vorig jaar' : '';
  return (
    <div className="kpis stagger">
      <div className="kpi">
        <span className="tiny muted">Uitgaven{per}</span>
        <b>{money(a.cur.expense, { round: true })}</b>
        {a.hasPrev && a.scope !== 'alles' ? <Delta now={a.cur.expense} before={a.prev.expense} invert vs={vs} /> : <span className="tiny muted">{a.perMonth ? `${money(a.total.expense, { round: true })} in totaal` : ' '}</span>}
      </div>
      <div className="kpi">
        <span className="tiny muted">Inkomsten{per}</span>
        <b className="in">{money(a.cur.income, { round: true })}</b>
        {a.hasPrev && a.scope !== 'alles' ? <Delta now={a.cur.income} before={a.prev.income} vs={vs} /> : <span className="tiny muted">{a.perMonth ? `${money(a.total.income, { round: true })} in totaal` : ' '}</span>}
      </div>
      <div className={'kpi ' + (rate == null ? '' : rate < 0 ? 'bad' : 'good')}>
        <span className="tiny muted">{zaak ? 'Marge' : 'Overgehouden'}</span>
        <b>{rate == null ? '–' : `${rate}%`}</b>
        <span className="tiny muted">{money(a.total.income - a.total.expense, { round: true })}{a.scope === 'maand' ? '' : ' in totaal'}</span>
      </div>
    </div>
  );
}

// Staafjes per maand, met gewoonlijk niveau (stippellijn) of het jaar ervoor (grijze lijn). Tik een staaf aan voor de cijfers.
function TrendChart({ trend }) {
  const pts = trend.points;
  const [sel, setSel] = useState(trend.focus ? pts.findIndex((p) => p.key === trend.focus) : null);
  const W = 340, H = 180, top = 14, bottom = 22, left = 4, right = 4;
  const max = Math.max(1, ...pts.flatMap((p) => [p.expense, p.before || 0, trend.avg || 0]));
  const slot = (W - left - right) / pts.length;
  const bw = Math.min(18, slot * 0.6);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const x = (i) => left + slot * i + slot / 2;
  const prevLine = trend.kind === 'jaar' ? pts.map((p, i) => (p.before == null ? null : [x(i), y(p.before)])) : [];
  const p = sel != null && sel >= 0 ? pts[sel] : null;
  return (
    <div>
      <div className="chart-readout small">
        {p ? (
          <>
            <b style={{ textTransform: 'capitalize' }}>{monthLabel(p.key)}</b>
            <span>Uit <b>{money(p.expense, { round: true })}</b></span>
            <span className="muted">In {money(p.income, { round: true })}</span>
            {p.before != null && <span className="muted">Vorig jaar {money(p.before, { round: true })}</span>}
          </>
        ) : <span className="muted">Tik op een maand voor de cijfers.</span>}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={pts.map((q) => `${monthShortLabel(q.key)}: ${money(q.expense, { round: true })}`).join('; ')}>
        {[0.5, 1].map((f) => <line key={f} x1={left} x2={W - right} y1={y(max * f)} y2={y(max * f)} stroke="var(--line-soft)" />)}
        <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        {pts.map((q, i) => {
          const on = i === sel || q.key === trend.focus;
          return (
            <g key={q.key} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={x(i) - slot / 2} y={0} width={slot} height={H} fill="transparent" />
              {q.expense > 0 && (
                <rect className="bar" style={{ animationDelay: `${i * 0.03}s` }} x={x(i) - bw / 2} y={y(q.expense)} width={bw} height={H - bottom - y(q.expense)} rx="4" fill="var(--orange)" opacity={on || sel == null ? 1 : 0.45}>
                  <title>{`${monthLabel(q.key)}: ${money(q.expense)}`}</title>
                </rect>
              )}
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fontWeight={i === sel ? 700 : 400} fill={i === sel ? 'var(--ink)' : 'var(--muted)'}>{monthShortLabel(q.key)}</text>
            </g>
          );
        })}
        {trend.avg != null && trend.avg > 0 && (
          <g pointerEvents="none">
            <line x1={left} x2={W - right} y1={y(trend.avg)} y2={y(trend.avg)} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.55" />
          </g>
        )}
        {prevLine.some(Boolean) && (
          <g pointerEvents="none">
            <path d={prevLine.map((pt, i) => (pt ? `${prevLine[i - 1] ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}` : '')).join('')} fill="none" stroke="#7B8794" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
            {prevLine.map((pt, i) => pt && <circle key={i} cx={pt[0]} cy={pt[1]} r="3.5" fill="#7B8794" stroke="var(--card)" strokeWidth="2" />)}
          </g>
        )}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--orange)' }} />Uitgaven</span>
        {trend.avg != null && trend.avg > 0 && <span><i className="dash" />Gewoonlijk ({money(trend.avg, { round: true })})</span>}
        {trend.kind === 'jaar' && <span><i className="dash gray" />Vorig jaar</span>}
      </div>
    </div>
  );
}

// Per jaar: gemiddeld per maand in en uit.
function YearsChart({ points }) {
  const [sel, setSel] = useState(points.length - 1);
  const W = 340, H = 180, top = 14, bottom = 22;
  const max = Math.max(1, ...points.flatMap((p) => [p.avgIncome, p.avgExpense]));
  const slot = W / points.length;
  const bw = Math.min(26, slot / 3);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const p = points[sel];
  return (
    <div>
      <div className="chart-readout small">
        <b>{p.key}</b>
        <span className="in">In <b>{money(p.avgIncome, { round: true })}</b></span>
        <span>Uit <b>{money(p.avgExpense, { round: true })}</b></span>
        <span className="muted">{p.months} {p.months === 1 ? 'maand' : 'maanden'}</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={points.map((q) => `${q.key}: in ${money(q.avgIncome, { round: true })}, uit ${money(q.avgExpense, { round: true })} per maand`).join('; ')}>
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        {points.map((q, i) => {
          const cx = slot * i + slot / 2;
          return (
            <g key={q.key} onClick={() => setSel(i)} style={{ cursor: 'pointer' }} opacity={i === sel ? 1 : 0.55}>
              <rect x={slot * i} y="0" width={slot} height={H} fill="transparent" />
              <rect className="bar" x={cx - bw - 1} y={y(q.avgIncome)} width={bw} height={H - bottom - y(q.avgIncome)} rx="4" fill="var(--green)"><title>{`In ${money(q.avgIncome)}`}</title></rect>
              <rect className="bar" x={cx + 1} y={y(q.avgExpense)} width={bw} height={H - bottom - y(q.avgExpense)} rx="4" fill="var(--orange)"><title>{`Uit ${money(q.avgExpense)}`}</title></rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fontWeight={i === sel ? 700 : 400} fill="var(--muted)">{q.key}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--green)' }} />In</span><span><i style={{ background: 'var(--orange)' }} />Uit</span></div>
    </div>
  );
}

// Verloop van de maand: opgeteld per dag, tegenover een gewone maand.
function MonthPace({ cum, month, current }) {
  const today = Number(new Date().getDate());
  const nowLen = current ? Math.min(today, cum.now.length) : cum.now.length;
  const now = cum.now.slice(0, nowLen);
  const usual = cum.usual ? cum.usual.slice(0, cum.now.length) : null;
  const W = 340, H = 170, top = 16, bottom = 22, left = 4, right = 8;
  const max = Math.max(1, ...now, ...(usual || []));
  const x = (i) => left + ((W - left - right) * i) / (cum.now.length - 1);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = now[now.length - 1] || 0;
  const usualAtDay = usual ? usual[nowLen - 1] : null;
  const diff = usualAtDay != null ? last - usualAtDay : null;
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>Verloop van de maand</h2>
      <p className="small" style={{ margin: 0 }}>
        {diff == null ? <>Op dag {nowLen}: <b>{money(last, { round: true })}</b> uitgegeven.</>
          : Math.abs(diff) < 2500 ? <>Op dag {nowLen} zit je ongeveer op <b>je gewone tempo</b> ({money(last, { round: true })}).</>
            : diff > 0 ? <>Op dag {nowLen} zit je <b className="txt-orange">{money(diff, { round: true })} boven</b> een gewone maand.</>
              : <>Op dag {nowLen} zit je <b className="txt-green">{money(-diff, { round: true })} onder</b> een gewone maand. Goed bezig!</>}
      </p>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Opgeteld uitgegeven in ${monthLabel(month)}: ${money(last)} op dag ${nowLen}`}>
        <defs>
          <linearGradient id="paceFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--orange)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--orange)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.5, 1].map((f) => <line key={f} x1={left} x2={W - right} y1={y(max * f)} y2={y(max * f)} stroke="var(--line-soft)" />)}
        <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        {usual && <path d={line(usual)} fill="none" stroke="#7B8794" strokeWidth="2" strokeDasharray="5 4" />}
        {now.length > 1 && <path d={`${line(now)}L${x(now.length - 1)},${H - bottom}L${x(0)},${H - bottom}Z`} fill="url(#paceFill)" />}
        {now.length > 1 && <path className="draw" d={line(now)} fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        <circle cx={x(now.length - 1)} cy={y(last)} r="5" fill="var(--orange)" stroke="var(--card)" strokeWidth="2" />
        {[1, 10, 20, cum.now.length].map((d) => <text key={d} x={x(d - 1)} y={H - 6} textAnchor={d === 1 ? 'start' : d === cum.now.length ? 'end' : 'middle'} fontSize="11" fill="var(--muted)">{d}</text>)}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--orange)' }} />Deze maand</span>
        {usual && <span><i className="dash gray" />Gewone maand</span>}
      </div>
    </section>
  );
}

const KIND = {
  hoger: { icon: 'up', cls: 'up', label: 'Meer dan gewoonlijk' },
  lager: { icon: 'down', cls: 'down', label: 'Minder dan gewoonlijk' },
  nieuw: { icon: 'sparkle', cls: 'new', label: 'Nieuw' },
  groot: { icon: 'alert', cls: 'big', label: 'Grote uitgave' },
};

function Outliers({ list, hasBase, scope }) {
  return (
    <section className="stack" style={{ gap: 10 }}>
      <h2>Opvallend</h2>
      {list.length === 0 && (
        <div className="card small muted">
          {hasBase || scope === 'alles' ? 'Niets bijzonders: alles ligt in de lijn van wat je gewoon bent.' : 'Nog te weinig geschiedenis om te vergelijken. Na een paar maanden boekingen zie je hier wat opvalt.'}
        </div>
      )}
      <div className="stack stagger" style={{ gap: 8 }}>
        {list.map((o, i) => {
          const k = KIND[o.kind];
          return (
            <div key={i} className={'card outlier ' + k.cls}>
              <CatIcon id={o.id} size={20} />
              <div className="grow">
                <span className={'tiny bold flag ' + k.cls}><Icon name={k.icon} size={12} stroke={2.6} /> {k.label}</span>
                <div className="bold">{o.title}</div>
                <div className="small muted">{o.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Nu tegenover gewoonlijk, per categorie: een staaf voor nu en een streepje voor gewoonlijk.
function Compare({ rows, scope, cap }) {
  const list = rows.filter((r) => r.usual != null && (r.now > 0 || r.usual > 0)).slice(0, 8);
  const max = Math.max(1, ...list.flatMap((r) => [r.now, r.usual]));
  return (
    <section className="card stack" style={{ gap: 12 }}>
      <div>
        <h2>Nu en gewoonlijk</h2>
        <span className="tiny muted">{scope === 'maand' ? (cap ? `Tot nu toe (dag ${cap}) tegenover dezelfde periode in de maanden ervoor.` : 'Deze maand tegenover het gemiddelde van de maanden ervoor.') : 'Per maand, tegenover het jaar ervoor.'}</span>
      </div>
      {list.map((r) => {
        const up = r.diff > 0;
        return (
          <div key={r.id} className="cmp-row">
            <span className="spread small">
              <span className="row" style={{ gap: 8 }}><span className="dot" style={{ background: tone(r.id)[0] }} /><span className="bold">{category(r.id).name}</span></span>
              <span>
                <b>{money(r.now, { round: true })}</b>
                {changeLabel(r) && <span className={'tiny delta ' + (up ? 'up' : 'down')} style={{ marginLeft: 6 }}>{changeLabel(r).short}</span>}
              </span>
            </span>
            <span className="cmp-track">
              <span className="cmp-now" style={{ width: `${(r.now / max) * 100}%`, background: tone(r.id)[0] }} />
              {r.usual > 0 && <span className="cmp-usual" style={{ left: `${(r.usual / max) * 100}%` }} title={`Gewoonlijk ${money(r.usual)}`} />}
            </span>
          </div>
        );
      })}
      <div className="legend"><span><i style={{ background: 'var(--muted)' }} />Nu</span><span><i className="tick" />Gewoonlijk</span></div>
    </section>
  );
}

// Over de jaren: hoe evolueren de grootste categorieën (gemiddeld per maand)?
function CategoryYears({ points }) {
  const totals = {};
  for (const p of points) for (const [k, v] of Object.entries(p.cats)) totals[k] = (totals[k] || 0) + v;
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  return (
    <section className="card stack" style={{ gap: 12 }}>
      <div>
        <h2>Evolutie per categorie</h2>
        <span className="tiny muted">Gemiddeld per maand, {points[0].key} tot {points[points.length - 1].key}.</span>
      </div>
      {top.map((id) => {
        const vals = points.map((p) => Math.round((p.cats[id] || 0) / p.months));
        const first = vals.find((v) => v > 0) || 0;
        const last = vals[vals.length - 1];
        const ch = first ? Math.round(((last - first) / first) * 100) : null;
        const max = Math.max(1, ...vals);
        const W = 90, H = 28;
        const d = vals.map((v, i) => `${i ? 'L' : 'M'}${((W - 6) * i) / Math.max(1, vals.length - 1) + 3},${H - 3 - (H - 6) * (v / max)}`).join('');
        return (
          <div key={id} className="row" style={{ gap: 10 }}>
            <CatIcon id={id} size={18} />
            <span className="grow small bold ellipsis">{category(id).name}</span>
            <svg width={W} height={H} aria-hidden="true"><path d={d} fill="none" stroke={tone(id)[0]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /><circle cx={W - 3} cy={H - 3 - (H - 6) * (last / max)} r="3" fill={tone(id)[0]} /></svg>
            <span className="small" style={{ minWidth: 70, textAlign: 'right' }}>
              <b>{money(last, { round: true })}</b>
              {ch != null && Math.abs(ch) >= 5 && <span className={'tiny delta ' + (ch > 0 ? 'up' : 'down')} style={{ display: 'block' }}>{ch > 0 ? '+' : '−'}{Math.abs(ch)}%</span>}
            </span>
          </div>
        );
      })}
    </section>
  );
}

const WD = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

function Weekdays({ values }) {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const max = Math.max(...values);
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <h2>Op welke dag geef je uit?</h2>
      <div className="weekdays" role="img" aria-label={values.map((v, i) => `${WD[i]} ${Math.round((v / total) * 100)}%`).join(', ')}>
        {values.map((v, i) => (
          <div key={i} className={'wd' + (v === max ? ' top' : '')} title={money(v)}>
            <span className="tiny muted">{Math.round((v / total) * 100)}%</span>
            <span className="wd-track"><span style={{ height: `${Math.max(3, (v / max) * 100)}%`, animationDelay: `${i * 0.04}s` }} /></span>
            <span className="tiny bold">{WD[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tips({ tips, onOpenKitchen }) {
  if (!tips.length) return null;
  return (
    <section className="stack" style={{ gap: 10 }}>
      <h2>Tips</h2>
      <div className="stack stagger" style={{ gap: 8 }}>
        {tips.map((t, i) => (
          <div key={i} className={'card tip ' + t.tone}>
            <span className="tip-ico"><Icon name={t.icon === 'dots' ? 'bulb' : t.icon} size={20} /></span>
            <div className="grow">
              <div className="bold">{t.title}</div>
              <div className="small muted">{t.text}</div>
              {t.cat === 'boodschappen' && t.tone === 'warn' && onOpenKitchen && <button className="link small bold" onClick={onOpenKitchen}>Naar het weekmenu</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
