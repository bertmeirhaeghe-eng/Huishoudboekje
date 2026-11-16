import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { CoinStack, PiggyIllustration } from './Illustrations.jsx';
import { useCountUp } from '../lib/anim.js';
import { MonthBars, MonthSwitcher } from './Chart.jsx';
import { category } from '../lib/categories.js';
import { dayLabel, longToday, monthLabel, money } from '../lib/format.js';
import { budgetMonth, budgetRows, groupByDate, perMonth, summarize, totalsByCategory } from '../lib/stats.js';

export default function Overview({ household, isOwner, book, setBook, month, setMonth, period = 'maand', setPeriod, entries, chartEntries, months, earlyDays = 0, budgets, onDelete, onOpenChart, onOpenBudgets, today = {}, onOpenList, onOpenMenu, onOpenTax }) {
  const [open, setOpen] = useState(null);
  const [kind, setKind] = useState('uit');
  const sum = useMemo(() => summarize(entries), [entries]);
  const jaar = period === 'jaar';
  const year = month.slice(0, 4);
  // In het jaaroverzicht: maandbudget x 12.
  const rows = useMemo(() => {
    const b = jaar ? Object.fromEntries(Object.entries(budgets).map(([k, v]) => [k, v * 12])) : budgets;
    return budgetRows(sum.byCategory, b).slice(0, 4);
  }, [sum, budgets, jaar]);
  const groups = useMemo(() => groupByDate(entries.filter((e) => e.type === kind)), [entries, kind]);
  const series = useMemo(() => perMonth(chartEntries, months, earlyDays), [chartEntries, months, earlyDays]);
  const names = Object.fromEntries(household.members.map((m) => [m.user_id, m.display_name]));

  const zaak = book === 'zaak';
  const shown = useCountUp(sum.balance);
  const spentRatio = sum.income > 0 ? Math.min(1, sum.expense / sum.income) : sum.expense > 0 ? 1 : 0;

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <div className="small muted">{longToday()}</div>
          <h1>{household.name}</h1>
        </div>
        <div className="row" style={{ gap: 0 }} aria-label="Gezinsleden">
          {household.members.slice(0, 4).map((m, i) => (
            <span key={m.user_id} title={m.display_name} style={{ width: 36, height: 36, borderRadius: 18, background: i % 2 ? 'var(--blue)' : 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, border: '2px solid var(--bg)', marginLeft: i ? -10 : 0 }}>
              {(m.display_name || '?').charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="tiles stagger" aria-label="Vandaag thuis">
        <button className="tile" onClick={onOpenMenu}>
          <span className="tile-ico orange"><Icon name="pot" size={20} /></span>
          <span className="grow"><span className="tiny muted" style={{ display: 'block' }}>Vanavond</span><b>{today.meal ? today.meal.meal : 'Nog niets gepland'}</b></span>
        </button>
        <button className="tile" onClick={onOpenList}>
          <span className="tile-ico green"><Icon name="cart" size={20} /></span>
          <span className="grow"><span className="tiny muted" style={{ display: 'block' }}>Boodschappen</span><b>{today.shopping ? `${today.shopping} op de lijst` : 'Lijst is leeg'}</b>{today.low > 0 && <span className="tiny" style={{ display: 'block', color: 'var(--orange)' }}>{today.low} bijna op in de voorraad</span>}</span>
        </button>
      </div>

      {isOwner && (
        <div className="seg" role="group" aria-label="Boekje">
          <button aria-pressed={!zaak} onClick={() => setBook('gezin')}>Gezin</button>
          <button aria-pressed={zaak} onClick={() => setBook('zaak')}>Zaak (vennootschap)</button>
        </div>
      )}

      <MonthSwitcher month={month} setMonth={setMonth} period={period} setPeriod={setPeriod} />

      <div className="two-col">
        <div className="stack">
          <section className={'hero' + (zaak ? ' zaak' : '')} aria-label={jaar ? `Saldo ${year}` : 'Saldo deze maand'}>
            <span className="small bold" style={{ opacity: 0.92 }}>{jaar ? (zaak ? `Resultaat vennootschap ${year}` : `Saldo heel ${year}`) : zaak ? 'Resultaat vennootschap' : 'Nog te besteden'}</span>
            <CoinStack />
            <span className="big" aria-label={money(sum.balance)}>{money(shown, { round: Math.abs(sum.balance) >= 100000 })}</span>
            <div className="bar" key={book + period + month}><span style={{ width: `${Math.round(spentRatio * 100)}%` }} /></div>
            <div className="spread small">
              <span>In: <b>{money(sum.income)}</b></span>
              <span>Uit: <b>{money(sum.expense)}</b></span>
            </div>
          </section>

          {zaak && onOpenTax && (
            <button className="card tile-wide" onClick={onOpenTax}>
              <span className="tile-ico blue"><Icon name="scale" size={20} /></span>
              <span className="grow"><b style={{ display: 'block' }}>Privé of zaak?</b><span className="tiny muted">Check een aankoop voor je ze doet</span></span>
              <Icon name="next" size={18} />
            </button>
          )}

          <button className="card" onClick={onOpenChart} style={{ border: 0, textAlign: 'left' }} aria-label="Grafiek openen">
            <div className="spread" style={{ marginBottom: 8 }}>
              <h2>{jaar ? `Per maand in ${year}` : 'Laatste 6 maanden'}</h2>
              <Icon name="next" size={18} />
            </div>
            <MonthBars series={series} compact />
          </button>

          <section className="stack" style={{ gap: 10 }}>
            <div className="spread">
              <h2>{jaar ? 'Budgetten (heel jaar)' : 'Budgetten'}</h2>
              <button className="tiny bold" onClick={onOpenBudgets} style={{ border: 0, background: 'none', color: zaak ? 'var(--blue)' : 'var(--green)', minHeight: 44 }}>Aanpassen</button>
            </div>
            {rows.length === 0 && <div className="card small muted">Nog geen budgetten. Tik op Aanpassen om er een paar in te stellen.</div>}
            <div className="stack stagger" style={{ gap: 10 }} key={book + period + month}>
            {rows.map((r) => (
              <div className="card" key={r.id}>
                <div className="spread small" style={{ marginBottom: 8 }}>
                  <span className="row" style={{ gap: 10 }}><CatIcon id={r.id} size={18} /><span className="bold">{category(r.id).name}</span></span>
                  <span className="muted">{money(r.used, { round: true })}{r.max ? ` van ${money(r.max, { round: true })}` : ''}</span>
                </div>
                <div className={'meter' + (r.ratio > 1 ? ' over' : r.ratio > 0.9 ? ' warn' : '')}>
                  <span style={{ width: `${Math.min(100, Math.round((r.ratio ?? 0) * 100))}%` }} />
                </div>
              </div>
            ))}
            </div>
          </section>
        </div>

        {jaar ? (
          <YearDetail series={series} entries={entries} sum={sum} kind={kind} setKind={setKind} year={year} onPickMonth={(m) => { setMonth(m); setPeriod('maand'); }} keyBase={book + month} />
        ) : (
        <section className="stack" style={{ gap: 10 }}>
          <h2>Boekingen</h2>
          <div className="seg" role="group" aria-label="Soort boekingen">
            <button aria-pressed={kind === 'uit'} onClick={() => setKind('uit')}>Uitgaven · {money(sum.expense, { round: true })}</button>
            <button aria-pressed={kind === 'in'} onClick={() => setKind('in')}>Inkomsten · {money(sum.income, { round: true })}</button>
          </div>
          {groups.length === 0 && entries.length > 0 && (
            <div className="card small muted">{kind === 'in' ? 'Nog geen inkomsten deze maand.' : 'Nog geen uitgaven deze maand.'}</div>
          )}
          {entries.length === 0 && (
            <div className="card empty">
              <PiggyIllustration />
              <b>Nog niets deze maand</b>
              <span className="small muted">Tik op de microfoon en zeg bv. “25 euro tanken”, of tik op de plus.</span>
            </div>
          )}
          <div className="stack stagger" style={{ gap: 10 }} key={book + month + kind}>
          {groups.map((g) => (
            <div key={g.date} className="stack" style={{ gap: 6 }}>
              <span className="tiny bold muted" style={{ paddingLeft: 4 }}>{dayLabel(g.date)}</span>
              <div className="card list">
                {g.items.map((e) => {
                  const c = category(e.category);
                  return (
                    <button key={e.id} className="entry" onClick={() => setOpen(e)}>
                      <CatIcon id={e.category} />
                      <span className="grow">
                        <span style={{ display: 'block', fontWeight: 600 }}>{e.note || c.name}</span>
                        <span className="tiny muted">{c.name}{names[e.created_by] ? ` · ${names[e.created_by]}` : ''}</span>
                        {budgetMonth(e, earlyDays) !== e.date.slice(0, 7) && <span className="tiny" style={{ display: 'block', color: 'var(--green)', fontWeight: 700 }}>telt voor {monthLabel(budgetMonth(e, earlyDays)).split(' ')[0]}</span>}
                      </span>
                      <span className={'amt' + (e.type === 'in' ? ' in' : '')}>{e.type === 'in' ? '+ ' : '− '}{money(e.amount_cents)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </section>
        )}
      </div>

      {open && (
        <EntrySheet
          entry={open}
          who={names[open.created_by]}
          onClose={() => setOpen(null)}
          onDelete={async () => { await onDelete(open.id); setOpen(null); }}
        />
      )}
    </div>
  );
}

// Rechterkolom van het jaaroverzicht: elke maand op een rij, en waar het geld naartoe ging of vandaan kwam.
function YearDetail({ series, entries, sum, kind, setKind, year, onPickMonth, keyBase }) {
  const cats = useMemo(() => totalsByCategory(entries, kind), [entries, kind]);
  const total = kind === 'in' ? sum.income : sum.expense;
  const max = cats.length ? cats[0][1] : 1;
  return (
    <section className="stack" style={{ gap: 10 }}>
      <h2>Per maand</h2>
      <div className="card list" key={'m' + keyBase}>
        {series.map((s) => {
          const saldo = s.income - s.expense;
          const leeg = !s.income && !s.expense;
          return (
            <button key={s.month} className="entry" onClick={() => onPickMonth(s.month)} aria-label={`${monthLabel(s.month)} openen`}>
              <span className="bold grow" style={{ textTransform: 'capitalize', opacity: leeg ? 0.5 : 1 }}>{monthLabel(s.month).split(' ')[0]}</span>
              <span className="small" style={{ textAlign: 'right' }}>
                <span className="amt in" style={{ display: 'block' }}>+ {money(s.income, { round: true })}</span>
                <span className="amt" style={{ display: 'block' }}>− {money(s.expense, { round: true })}</span>
              </span>
              <span className="small bold" style={{ minWidth: 76, textAlign: 'right', color: saldo < 0 ? 'var(--orange)' : 'var(--green)' }}>{leeg ? '' : `${saldo < 0 ? '− ' : '+ '}${money(Math.abs(saldo), { round: true })}`}</span>
            </button>
          );
        })}
      </div>
      <h2>Per categorie</h2>
      <div className="seg" role="group" aria-label="Soort">
        <button aria-pressed={kind === 'uit'} onClick={() => setKind('uit')}>Uitgaven · {money(sum.expense, { round: true })}</button>
        <button aria-pressed={kind === 'in'} onClick={() => setKind('in')}>Inkomsten · {money(sum.income, { round: true })}</button>
      </div>
      <div className="card stack stagger" style={{ gap: 12 }} key={kind + keyBase}>
        {cats.length === 0 && <span className="small muted">{kind === 'in' ? `Nog geen inkomsten in ${year}.` : `Nog geen uitgaven in ${year}.`}</span>}
        {cats.map(([id, v]) => (
          <div key={id}>
            <div className="spread small" style={{ marginBottom: 6 }}>
              <span className="row" style={{ gap: 10 }}><CatIcon id={id} size={18} /><span className="bold">{category(id).name}</span></span>
              <span className="muted">{money(v, { round: true })} · {total ? Math.round((v / total) * 100) : 0}%</span>
            </div>
            <div className="meter"><span style={{ width: `${Math.round((v / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EntrySheet({ entry, who, onClose, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const c = category(entry.category);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Boeking" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <div className="row">
            <CatIcon id={entry.category} selected />
            <div>
              <div className="bold">{entry.note || c.name}</div>
              <div className="tiny muted">{c.name} · {entry.book === 'zaak' ? 'Zaak' : 'Gezin'}</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <div className={'amount-display' + (entry.type === 'in' ? ' in' : '')} style={{ fontSize: 36 }}>
          {entry.type === 'in' ? '+ ' : '− '}{money(entry.amount_cents)}
        </div>
        <div className="small muted" style={{ textAlign: 'center' }}>{dayLabel(entry.date)}{who ? `, toegevoegd door ${who}` : ''}</div>
        {!confirm ? (
          <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" /> Verwijderen</button>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            <span className="small" style={{ textAlign: 'center' }}>Zeker? Dit kan je niet ongedaan maken.</span>
            <div className="row">
              <button className="btn ghost grow" onClick={() => setConfirm(false)}>Nee</button>
              <button className="btn danger grow" onClick={onDelete}>Ja, verwijderen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
