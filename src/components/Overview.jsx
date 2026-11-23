import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { CoinStack, PiggyIllustration } from './Illustrations.jsx';
import { useCountUp } from '../lib/anim.js';
import { MonthBars, MonthSwitcher } from './Chart.jsx';
import CategorySplit from './CategorySplit.jsx';
import { analyze, changeLabel } from '../lib/insights.js';
import { categoriesFor, category } from '../lib/categories.js';
import { dayLabel, longToday, monthKey, monthLabel, money, parseAmount, todayISO } from '../lib/format.js';
import { budgetMonth, budgetRows, groupByDate, perMonth, summarize, totalsByCategory } from '../lib/stats.js';
import { expectedPayments, getHidden, saveHidden } from '../lib/recurring.js';

export default function Overview({ household, isOwner, book, setBook, month, setMonth, period = 'maand', setPeriod, entries, chartEntries, months, earlyDays = 0, budgets, account = null, onSaveBalance, onDelete, onChangeCategory, onOpenChart, onOpenBudgets, onOpenInsights, today = {}, onOpenList, onOpenMenu, onOpenTax }) {
  const [open, setOpen] = useState(null);
  const [kind, setKind] = useState('uit');
  const [catFilter, setCatFilter] = useState(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  useEffect(() => setCatFilter(null), [book, month, period]);
  const sum = useMemo(() => summarize(entries), [entries]);
  const jaar = period === 'jaar';
  const year = month.slice(0, 4);
  // In het jaaroverzicht: maandbudget x 12.
  const rows = useMemo(() => {
    const b = jaar ? Object.fromEntries(Object.entries(budgets).map(([k, v]) => [k, v * 12])) : budgets;
    return budgetRows(sum.byCategory, b).slice(0, 4);
  }, [sum, budgets, jaar]);
  const filterOn = !jaar && kind === 'uit' && catFilter;
  const groups = useMemo(() => groupByDate(entries.filter((e) => e.type === kind && (!filterOn || e.category === catFilter))), [entries, kind, filterOn, catFilter]);
  const cats = useMemo(() => totalsByCategory(entries, 'uit'), [entries]);
  // Vergelijking met de maanden ervoor (in de maandweergave), en het opvallendste voor het inzichtenblok.
  const insight = useMemo(() => (jaar ? null : analyze({ entries: chartEntries, scope: 'maand', month, earlyDays, today: month })), [jaar, chartEntries, month, earlyDays]);
  const compare = insight?.hasBase ? Object.fromEntries(insight.rows.map((r) => [r.id, changeLabel(r)])) : null;
  const teaser = insight?.outliers.find((o) => o.kind === 'hoger' || o.kind === 'groot') || insight?.outliers[0];
  const series = useMemo(() => perMonth(chartEntries, months, earlyDays), [chartEntries, months, earlyDays]);
  const names = Object.fromEntries(household.members.map((m) => [m.user_id, m.display_name]));

  const zaak = book === 'zaak';
  // Deze maand, met een echte rekeningstand: dan toont de kaart wat er nu echt op de rekening staat.
  const thisMonth = !jaar && month === monthKey();
  const real = thisMonth && account ? account : null;
  const heroValue = real ? real.balance : sum.balance;
  const shown = useCountUp(heroValue);
  const heroLabel = real ? 'Nu op de rekening'
    : jaar ? (zaak ? `Resultaat vennootschap ${year}` : `Saldo heel ${year}`)
    : zaak ? 'Resultaat vennootschap'
    : thisMonth ? 'Nog te besteden' : `Saldo ${monthLabel(month).split(' ')[0]}`;
  // Vaste betalingen (zoals het woningkrediet) die deze maand nog van de rekening moeten.
  const [hidden, setHidden] = useState(() => getHidden(household.id, book));
  useEffect(() => setHidden(getHidden(household.id, book)), [household.id, book]);
  const [openDue, setOpenDue] = useState(null);
  const due = useMemo(() => (thisMonth ? expectedPayments(chartEntries, month, { hidden }) : { pending: [], paid: [], total: 0 }), [thisMonth, chartEntries, month, hidden]);
  const dueList = due.pending.filter((p) => !filterOn || p.category === catFilter);
  const afterDue = heroValue - due.total;
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
          <section className={'hero' + (zaak ? ' zaak' : '')} aria-label={real ? 'Nu op de rekening' : jaar ? `Saldo ${year}` : 'Saldo deze maand'}>
            <span className="small bold" style={{ opacity: 0.92 }}>{heroLabel}</span>
            <CoinStack />
            <span className="big" aria-label={money(heroValue)}>{money(shown, { round: Math.abs(heroValue) >= 100000 })}</span>
            {real && (
              <span className="tiny" style={{ opacity: 0.92, marginTop: -6 }}>
                Stand {dayLabel(real.asOf).toLowerCase()} 's avonds: <b>{money(real.start)}</b>
                {real.count > 0 ? `, daarna ${[real.income ? `+\u00a0${money(real.income)}` : '', real.expense ? `−\u00a0${money(real.expense)}` : ''].filter(Boolean).join(' en ')}` : ', sindsdien nog niets geboekt'}
              </span>
            )}
            <div className="bar" key={book + period + month}><span style={{ width: `${Math.round(spentRatio * 100)}%` }} /></div>
            {real && <span className="tiny bold" style={{ opacity: 0.92, marginBottom: -8 }}>Deze maand · saldo {sum.balance < 0 ? '− ' : '+ '}{money(Math.abs(sum.balance))}</span>}
            <div className="spread small">
              <span>In: <b>{money(sum.income)}</b></span>
              <span>Uit: <b>{money(sum.expense)}</b></span>
            </div>
            {due.total > 0 && (
              <div className="hero-due" aria-label="Komt nog deze maand">
                <span>Komt nog: <b>−&nbsp;{money(due.total)}</b></span>
                <span>{real ? 'Einde maand' : 'Na vaste kosten'}: <b>{afterDue < 0 ? '−\u00a0' : ''}{money(Math.abs(afterDue))}</b></span>
              </div>
            )}
            {thisMonth && onSaveBalance && (
              <button className="hero-link" onClick={() => setBalanceOpen(true)}>
                <Icon name="wallet" size={16} /> {real ? 'Rekeningstand aanpassen' : 'Echte rekeningstand ingeven'}
              </button>
            )}
          </section>

          {zaak && onOpenTax && (
            <button className="card tile-wide" onClick={onOpenTax}>
              <span className="tile-ico blue"><Icon name="scale" size={20} /></span>
              <span className="grow"><b style={{ display: 'block' }}>Privé of zaak?</b><span className="tiny muted">Check een aankoop voor je ze doet</span></span>
              <Icon name="next" size={18} />
            </button>
          )}

          {onOpenInsights && (
            <button className="insight-teaser" onClick={onOpenInsights}>
              <span className="tile-ico"><Icon name="sparkle" size={20} /></span>
              <span className="grow">
                <b style={{ display: 'block' }}>Inzichten</b>
                <span className="tiny">{teaser ? `Opvallend: ${teaser.title}` : 'Grafieken, uitschieters en tips'}</span>
              </span>
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
              <h2>Uitgaven per categorie</h2>
              {!jaar && cats.length > 0 && <span className="tiny muted">Tik om te filteren</span>}
            </div>
            <CategorySplit
              key={book + period + month}
              totals={cats}
              total={sum.expense}
              picked={filterOn ? catFilter : null}
              onPick={jaar ? null : (id) => { setCatFilter(id); setKind('uit'); }}
              compare={compare}
              emptyText={jaar ? `Nog geen uitgaven in ${year}.` : 'Nog geen uitgaven deze maand.'}
            />
          </section>

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
          <YearDetail series={series} entries={entries} sum={sum} year={year} onPickMonth={(m) => { setMonth(m); setPeriod('maand'); }} keyBase={book + month} />
        ) : (
        <section className="stack" style={{ gap: 10 }}>
          <h2>Boekingen</h2>
          <div className="seg" role="group" aria-label="Soort boekingen">
            <button aria-pressed={kind === 'uit'} onClick={() => setKind('uit')}>Uitgaven · {money(sum.expense, { round: true })}</button>
            <button aria-pressed={kind === 'in'} onClick={() => setKind('in')}>Inkomsten · {money(sum.income, { round: true })}</button>
          </div>
          {filterOn && (
            <span className="pill on filter-chip">
              <CatIcon id={catFilter} size={14} /> Alleen {category(catFilter).name.toLowerCase()} · {money(sum.byCategory[catFilter] || 0, { round: true })}
              <button onClick={() => setCatFilter(null)} aria-label="Filter wissen"><Icon name="close" size={16} /></button>
            </span>
          )}
          {kind === 'uit' && dueList.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="tiny bold muted" style={{ paddingLeft: 4 }}>Komt nog deze maand</span>
              <div className="card list due-list">
                {dueList.map((p) => (
                  <button key={p.key} className="entry due" onClick={() => setOpenDue(p)}>
                    <CatIcon id={p.category} />
                    <span className="grow">
                      <span style={{ display: 'block', fontWeight: 600 }}>{p.note}</span>
                      <span className="tiny muted">Verwacht rond {dayLabel(p.date).toLowerCase()} · elke maand</span>
                    </span>
                    <span className="amt muted">−&nbsp;{money(p.amount_cents)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
          <div className="stack stagger" style={{ gap: 10 }} key={book + month + kind + (filterOn ? catFilter : '')}>
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

      {balanceOpen && (
        <BalanceSheet
          account={account}
          zaak={zaak}
          onClose={() => setBalanceOpen(false)}
          onSave={async (asOf, cents) => { await onSaveBalance(asOf, cents); setBalanceOpen(false); }}
        />
      )}

      {openDue && (
        <DueSheet
          item={openDue}
          onClose={() => setOpenDue(null)}
          onHide={() => { const next = [...hidden, openDue.key]; saveHidden(household.id, book, next); setHidden(next); setOpenDue(null); }}
        />
      )}

      {open && (
        <EntrySheet
          entry={open}
          who={names[open.created_by]}
          onClose={() => setOpen(null)}
          onDelete={async () => { await onDelete(open.id); setOpen(null); }}
          onChangeCategory={async (cat) => { await onChangeCategory(open.id, cat); setOpen(null); }}
        />
      )}
    </div>
  );
}

// Rechterkolom van het jaaroverzicht: elke maand op een rij, en waar het geld naartoe ging of vandaan kwam.
function YearDetail({ series, entries, sum, year, onPickMonth, keyBase }) {
  const kind = 'in';
  const cats = useMemo(() => totalsByCategory(entries, kind), [entries]);
  const total = sum.income;
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
      <h2>Inkomsten per categorie</h2>
      <div className="card stack stagger" style={{ gap: 12 }} key={kind + keyBase}>
        {cats.length === 0 && <span className="small muted">{`Nog geen inkomsten in ${year}.`}</span>}
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

function EntrySheet({ entry, who, onClose, onDelete, onChangeCategory }) {
  const [confirm, setConfirm] = useState(false);
  const [cat, setCat] = useState(entry.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const c = category(cat);
  const book = entry.book === 'zaak' ? 'zaak' : 'gezin';
  const type = entry.type === 'in' ? 'in' : 'uit';
  const cats = categoriesFor(book, type);
  const changed = cat !== entry.category;
  async function save() {
    setBusy(true);
    setError('');
    try { await onChangeCategory(cat); } catch (e) { setError(e?.message || 'Bewaren lukte niet.'); setBusy(false); }
  }
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Boeking" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <div className="row">
            <CatIcon id={cat} selected />
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
        <div className="stack" style={{ gap: 8 }}>
          <span className="tiny bold muted">Categorie</span>
          <div className="cats" role="group" aria-label="Categorie">
            {cats.map((x) => (
              <button key={x.id} className="cat" aria-pressed={cat === x.id} onClick={() => setCat(x.id)}>
                <CatIcon id={x.id} selected={cat === x.id} />
                {x.name}
              </button>
            ))}
          </div>
        </div>
        {error && <span className="small" style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</span>}
        {changed && (
          <button className={'btn' + (book === 'zaak' ? ' blue' : '')} disabled={busy} onClick={save}><Icon name="check" /> {busy ? 'Bewaren…' : `Bewaren als ${c.name}`}</button>
        )}
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

// De echte stand van de rekening ingeven, op een dag 's avonds. Mag ook in het verleden:
// alles wat na die dag geboekt is, rekent de app er vanzelf bij.
function BalanceSheet({ account, zaak, onClose, onSave }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  async function save() {
    const t = text.trim();
    const neg = /^[-−]/.test(t);
    const cents = parseAmount(t.replace(/^[-−]\s*/, ''));
    if (cents === null) { setError('Typ het bedrag, bv. 569,53'); return; }
    if (!date || date > today) { setError('Kies vandaag of een dag in het verleden.'); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(date, neg ? -cents : cents);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Rekeningstand" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2>Echte rekeningstand</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <span className="small muted">Kijk in je bankapp wat er op de rekening staat. De app neemt dat bedrag als vertrekpunt en telt er alles bij wat je na die dag boekt.</span>
        {account && <span className="small">Nu: <b>{money(account.start)}</b> op {dayLabel(account.asOf).toLowerCase()}</span>}
        <label className="field">
          Op de rekening
          <div style={{ position: 'relative' }}>
            <span className="muted" style={{ position: 'absolute', left: 14, top: 14 }}>€</span>
            <input className="input" inputMode="decimal" autoFocus style={{ paddingLeft: 30, fontSize: 20 }} value={text} placeholder="bv. 569,53" onChange={(e) => { setText(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
        </label>
        <label className="field">
          Op welke dag ('s avonds)?
          <input className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className={'btn' + (zaak ? ' blue' : '')} disabled={busy} onClick={save}><Icon name="check" /> {busy ? 'Bewaren…' : 'Bewaren'}</button>
        <span className="tiny muted">Tip: importeer je een bankbestand van Crelan, dan zet de app de stand vanzelf juist.</span>
      </div>
    </div>
  );
}

// Uitleg bij een vaste betaling die nog moet komen, met de keuze om ze niet meer te verwachten.
function DueSheet({ item, onClose, onHide }) {
  const c = category(item.category);
  const seen = item.seen.map((m) => monthLabel(m).split(' ')[0]).join(', ');
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Komt nog" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <div className="row">
            <CatIcon id={item.category} selected />
            <div>
              <div className="bold">{item.note}</div>
              <div className="tiny muted">{c.name} · komt nog</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <div className="amount-display" style={{ fontSize: 36, opacity: 0.7 }}>−&nbsp;{money(item.amount_cents)}</div>
        <div className="small muted" style={{ textAlign: 'center' }}>Verwacht rond {dayLabel(item.date).toLowerCase()}</div>
        <span className="small">Dit ging elke maand van de rekening (gezien in {seen}). De app rekent het al mee, zodat je ziet wat er op het einde van de maand overblijft. Zodra de bank het boekt, verdwijnt het hier vanzelf en telt het maar één keer.</span>
        <button className="btn ghost" onClick={onHide}><Icon name="close" /> Niet meer verwachten</button>
      </div>
    </div>
  );
}
