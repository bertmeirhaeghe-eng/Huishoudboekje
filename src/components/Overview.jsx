import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { CoinStack, PiggyIllustration } from './Illustrations.jsx';
import { useCountUp } from '../lib/anim.js';
import { MonthBars, MonthSwitcher } from './Chart.jsx';
import { category } from '../lib/categories.js';
import { dayLabel, longToday, money } from '../lib/format.js';
import { budgetRows, groupByDate, perMonth, summarize } from '../lib/stats.js';

export default function Overview({ household, isOwner, book, setBook, month, setMonth, entries, chartEntries, months, budgets, onDelete, onOpenChart, onOpenBudgets, today = {}, onOpenList, onOpenMenu, onOpenTax }) {
  const [open, setOpen] = useState(null);
  const sum = useMemo(() => summarize(entries), [entries]);
  const rows = useMemo(() => budgetRows(sum.byCategory, budgets).slice(0, 4), [sum, budgets]);
  const groups = useMemo(() => groupByDate(entries), [entries]);
  const series = useMemo(() => perMonth(chartEntries, months), [chartEntries, months]);
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

      <MonthSwitcher month={month} setMonth={setMonth} />

      <div className="two-col">
        <div className="stack">
          <section className={'hero' + (zaak ? ' zaak' : '')} aria-label="Saldo deze maand">
            <span className="small bold" style={{ opacity: 0.92 }}>{zaak ? 'Resultaat vennootschap' : 'Nog te besteden'}</span>
            <CoinStack />
            <span className="big" aria-label={money(sum.balance)}>{money(shown, { round: Math.abs(sum.balance) >= 100000 })}</span>
            <div className="bar" key={book + month}><span style={{ width: `${Math.round(spentRatio * 100)}%` }} /></div>
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
              <h2>Laatste 6 maanden</h2>
              <Icon name="next" size={18} />
            </div>
            <MonthBars series={series} compact />
          </button>

          <section className="stack" style={{ gap: 10 }}>
            <div className="spread">
              <h2>Budgetten</h2>
              <button className="tiny bold" onClick={onOpenBudgets} style={{ border: 0, background: 'none', color: zaak ? 'var(--blue)' : 'var(--green)', minHeight: 44 }}>Aanpassen</button>
            </div>
            {rows.length === 0 && <div className="card small muted">Nog geen budgetten. Tik op Aanpassen om er een paar in te stellen.</div>}
            <div className="stack stagger" style={{ gap: 10 }} key={book + month}>
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

        <section className="stack" style={{ gap: 10 }}>
          <h2>Boekingen</h2>
          {groups.length === 0 && (
            <div className="card empty">
              <PiggyIllustration />
              <b>Nog niets deze maand</b>
              <span className="small muted">Tik op de microfoon en zeg bv. “25 euro tanken”, of tik op de plus.</span>
            </div>
          )}
          <div className="stack stagger" style={{ gap: 10 }} key={book + month}>
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
