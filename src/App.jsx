import { useCallback, useEffect, useMemo, useState } from 'react';
import { store } from './lib/store.js';
import { monthKey, monthRange, shiftMonth, yearMonths } from './lib/format.js';
import Icon from './components/Icon.jsx';
import Auth from './components/Auth.jsx';
import Setup from './components/Setup.jsx';
import Overview from './components/Overview.jsx';
import AddEntry from './components/AddEntry.jsx';
import Budgets from './components/Budgets.jsx';
import Settings from './components/Settings.jsx';
import Chart from './components/Chart.jsx';
import Celebrate from './components/Celebrate.jsx';
import Voice from './components/Voice.jsx';
import Lists from './components/Lists.jsx';
import Kitchen from './components/Kitchen.jsx';
import Agenda, { saveEvent } from './components/Agenda.jsx';
import TaxHelper from './components/TaxHelper.jsx';
import BankImport from './components/BankImport.jsx';
import Cleanup from './components/Cleanup.jsx';
import Board from './components/Board.jsx';
import Insights from './components/Insights.jsx';
import { useHome } from './lib/useHome.js';
import { budgetMonth, inPeriod } from './lib/stats.js';
import { getEarlyDays, setEarlyDays as saveEarlyDays } from './lib/prefs.js';
import { addDays, mealFor } from './lib/kitchen.js';
import { startsOnBoard } from './lib/prefs.js';
import { todayISO } from './lib/format.js';
import { money } from './lib/format.js';
import { category } from './lib/categories.js';

const CHART_MONTHS = 6;

export default function App() {
  const [phase, setPhase] = useState('laden'); // laden | login | gezin | klaar
  const [household, setHousehold] = useState(null);

  const refreshHousehold = useCallback(async () => {
    const user = await store.getUser();
    if (!user) { setPhase('login'); return; }
    const h = await store.getMyHousehold();
    setHousehold(h);
    setPhase(h ? 'klaar' : 'gezin');
  }, []);

  useEffect(() => {
    refreshHousehold().catch(() => setPhase('login'));
    return store.onAuth(() => refreshHousehold().catch(() => setPhase('login')));
  }, [refreshHousehold]);

  if (phase === 'laden') return <div className="center-page muted">Even geduld…</div>;
  if (phase === 'login') return <Auth onDone={refreshHousehold} />;
  if (phase === 'gezin') return <Setup onDone={refreshHousehold} />;
  return <Boekje household={household} onHouseholdChange={refreshHousehold} />;
}

function Boekje({ household, onHouseholdChange }) {
  const isOwner = household.role === 'eigenaar';
  const [screen, setScreen] = useState(() => (startsOnBoard() ? 'bord' : 'overzicht'));
  const [book, setBook] = useState('gezin');
  const [month, setMonth] = useState(monthKey());
  const [period, setPeriod] = useState('maand'); // maand | jaar
  const [entries, setEntries] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [error, setError] = useState('');
  const [party, setParty] = useState(null);
  const [draft, setDraft] = useState(null); // voorinvulling vanuit spraak
  const [beforeVoice, setBeforeVoice] = useState('overzicht');
  const [listTab, setListTab] = useState('boodschappen');
  const [kitchenTab, setKitchenTab] = useState('menu');
  const [openRecipe, setOpenRecipe] = useState(null);
  const [menuFocus, setMenuFocus] = useState(null);
  const home = useHome(household.id);
  const memberNames = useMemo(() => household.members.map((m) => m.display_name).filter(Boolean), [household.members]);
  const toast = useCallback((text) => setParty({ text, id: Date.now() }), []);

  const [earlyDays, setEarlyDaysState] = useState(getEarlyDays);
  const setEarlyDays = (n) => { saveEarlyDays(n); setEarlyDaysState(n); };

  const months = useMemo(
    () => (period === 'jaar' ? yearMonths(month) : Array.from({ length: CHART_MONTHS }, (_, i) => shiftMonth(month, i - CHART_MONTHS + 1))),
    [month, period],
  );

  const load = useCallback(async () => {
    try {
      // Een paar dagen extra: vroege inkomsten van eind vorige maand tellen mee.
      const from = addDays(monthRange(months[0]).from, -10);
      const to = monthRange(months[months.length - 1]).to;
      const [e, b] = await Promise.all([store.listEntries(household.id, from, to), store.listBudgets(household.id)]);
      setEntries(e);
      setBudgets(b);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [household.id, months]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => store.subscribe(household.id, load), [household.id, load]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const bookEntries = useMemo(() => entries.filter((e) => e.book === book), [entries, book]);
  const monthEntries = useMemo(() => bookEntries.filter((e) => budgetMonth(e, earlyDays) === month), [bookEntries, month, earlyDays]);
  const periodEntries = useMemo(() => bookEntries.filter((e) => inPeriod(e, month, period, earlyDays)), [bookEntries, month, period, earlyDays]);
  const bookBudgets = useMemo(() => Object.fromEntries(budgets.filter((b) => b.book === book).map((b) => [b.category, b.amount_cents])), [budgets, book]);

  const go = (s) => { setScreen(s); window.scrollTo(0, 0); };

  // Spraak voor het huishouden: lijst, voorraad, menu, agenda.
  async function saveHome(cmd) {
    if (cmd.kind === 'lijst') {
      const n = await home.act.addShopping(cmd.items);
      setListTab('boodschappen'); go('lijst');
      toast(n ? `${n} ${n === 1 ? 'ding' : 'dingen'} op de lijst` : 'Stond al op de lijst');
    } else if (cmd.kind === 'voorraad') {
      await home.act.markOut(cmd.items, cmd.status);
      setListTab('boodschappen'); go('lijst');
      toast(`${cmd.items.map((i) => i.name).join(', ')} op de lijst`);
    } else if (cmd.kind === 'menu') {
      await home.act.setMenu(cmd.date, cmd.meal, cmd.recipe_id, cmd.slot || 'avond');
      setKitchenTab('menu'); setOpenRecipe(null); setMenuFocus(cmd.date); go('keuken');
      toast(`${cmd.meal} staat op het menu`);
    } else if (cmd.kind === 'agenda') {
      const how = await saveEvent({ title: cmd.title, date: cmd.date, time: cmd.time, who: cmd.who });
      go('agenda');
      if (how === 'google') toast('In je Google Agenda gezet');
    }
  }

  async function saveEntries(list) {
    for (const entry of list) await store.addEntry({ ...entry, household_id: household.id });
    const last = list[list.length - 1];
    if (last.book !== book) setBook(last.book);
    const lastMonth = budgetMonth(last, earlyDays);
    if (period === 'jaar' ? lastMonth.slice(0, 4) !== month.slice(0, 4) : lastMonth !== month) setMonth(lastMonth);
    await load();
    setDraft(null);
    go('overzicht');
    const text = list.length > 1
      ? `${list.length} boekingen bewaard`
      : `${last.type === 'in' ? '+' : '−'} ${money(last.amount_cents)} ${category(last.category).name} bewaard`;
    setParty({ text, id: Date.now() });
  }

  const common = { household, book, month, setMonth };
  let content;
  if (screen === 'toevoegen') {
    content = (
      <AddEntry
        {...common}
        isOwner={isOwner}
        initial={draft}
        onCancel={() => { setDraft(null); go('overzicht'); }}
        onSave={(entry) => saveEntries([entry])}
      />
    );
  } else if (screen === 'budgetten') {
    content = <Budgets {...common} budgets={bookBudgets} entries={monthEntries} onChange={load} />;
  } else if (screen === 'grafiek') {
    content = <Chart {...common} period={period} setPeriod={setPeriod} entries={bookEntries} months={months} earlyDays={earlyDays} />;
  } else if (screen === 'inzichten') {
    content = <Insights {...common} isOwner={isOwner} setBook={setBook} earlyDays={earlyDays} budgets={bookBudgets} onBack={() => go('overzicht')} onOpenKitchen={() => { setKitchenTab('menu'); setOpenRecipe(null); go('keuken'); }} />;
  } else if (screen === 'meer') {
    content = <Settings household={household} entries={entries} onChange={onHouseholdChange} onOpenTax={() => go('privezaak')} onOpenImport={() => go('import')} onOpenCleanup={() => go('dubbels')} onOpenBoard={() => go('bord')} earlyDays={earlyDays} setEarlyDays={setEarlyDays} />;
  } else if (screen === 'import') {
    content = <BankImport household={household} isOwner={isOwner} onBack={() => go('meer')} onDone={async (n, date) => { if (date) setMonth(budgetMonth({ date, type: 'uit' })); await load(); go('overzicht'); toast(`${n} boekingen geïmporteerd`); }} />;
  } else if (screen === 'dubbels') {
    content = <Cleanup household={household} onBack={() => go('meer')} onDone={async (n) => { await load(); go('meer'); toast(`${n} dubbels verwijderd`); }} />;
  } else if (screen === 'privezaak') {
    content = <TaxHelper onBack={() => go('meer')} onBook={(d) => { setDraft({ type: 'uit', date: todayISO(), ...d }); go('toevoegen'); }} />;
  } else if (screen === 'lijst') {
    content = <Lists home={home} tab={listTab} setTab={setListTab} toast={toast} />;
  } else if (screen === 'keuken') {
    content = <Kitchen home={home} tab={kitchenTab} setTab={setKitchenTab} toast={toast} openRecipe={openRecipe} setOpenRecipe={setOpenRecipe} focusDate={menuFocus} />;
  } else if (screen === 'agenda') {
    content = <Agenda home={home} members={memberNames} toast={toast} isOwner={isOwner} onOpenSettings={() => go('meer')} onOpenBoard={() => go('bord')} />;
  } else {
    content = (
      <Overview
        {...common}
        isOwner={isOwner}
        setBook={setBook}
        period={period}
        setPeriod={setPeriod}
        entries={periodEntries}
        chartEntries={bookEntries}
        months={months}
        earlyDays={earlyDays}
        budgets={bookBudgets}
        onDelete={async (id) => { await store.deleteEntry(id); await load(); }}
        onOpenChart={() => go('grafiek')}
        onOpenBudgets={() => go('budgetten')}
        onOpenInsights={() => go('inzichten')}
        today={{ meal: mealFor(home.menu, todayISO(), 'avond'), shopping: home.shopping.filter((x) => !x.done).length, low: home.pantry.filter((p) => p.status !== 'ok').length }}
        onOpenList={() => { setListTab('boodschappen'); go('lijst'); }}
        onOpenMenu={() => { setKitchenTab('menu'); setOpenRecipe(null); go('keuken'); }}
        onOpenTax={() => go('privezaak')}
      />
    );
  }

  // Het weekbord voor de tablet: volledig scherm, zonder menubalk.
  if (screen === 'bord') return <Board home={home} onClose={() => go('agenda')} />;

  return (
    <div className={'app' + (book === 'zaak' ? ' zaak-mode' : '')}>
      <nav className="nav" aria-label="Hoofdmenu">
        <NavBtn icon="wallet" label="Geld" on={MONEY.includes(screen)} onClick={() => go('overzicht')} />
        <NavBtn icon="list" label="Lijst" on={screen === 'lijst'} onClick={() => go('lijst')} badge={home.shopping.filter((x) => !x.done).length} />
        <button className="fab mic-fab" aria-label="Spreken" onClick={() => { if (screen !== 'spraak') setBeforeVoice(screen); setScreen('spraak'); }}>
          <Icon name="mic" size={30} stroke={2.2} />
        </button>
        {['overzicht', 'grafiek', 'budgetten'].includes(screen) && (
          <button className="add-fab" aria-label="Uitgave of inkomst toevoegen" onClick={() => { setDraft(null); go('toevoegen'); }}>
            <Icon name="plus" size={26} stroke={2.4} />
          </button>
        )}
        <NavBtn icon="pot" label="Keuken" on={screen === 'keuken'} onClick={() => { if (screen === 'keuken') setOpenRecipe(null); setMenuFocus(null); go('keuken'); }} />
        <NavBtn icon="calendar" label="Agenda" on={screen === 'agenda'} onClick={() => go('agenda')} />
        <NavBtn icon="tablet" label="Weekbord" on={false} onClick={() => go('bord')} className="wide-only" />
        <NavBtn icon="gear" label="Meer" on={screen === 'meer' || screen === 'privezaak' || screen === 'import'} onClick={() => go('meer')} />
      </nav>
      <main className="main">
        {store.mode === 'demo' && (
          <div className="banner" style={{ marginBottom: 14 }}>Proefmodus: gegevens blijven alleen op dit toestel.</div>
        )}
        {error && <div className="error" style={{ marginBottom: 14 }}>{error}</div>}
        {home.error && !error && ['lijst', 'keuken', 'agenda', 'overzicht'].includes(screen) && <div className="error" style={{ marginBottom: 14 }}>{home.error}</div>}
        <div className="screen" key={screen}>{content}</div>
      </main>
      {screen === 'spraak' && (
        <Voice
          isOwner={isOwner}
          recipes={home.recipes}
          members={memberNames}
          onHome={saveHome}
          onCancel={() => setScreen(beforeVoice)}
          onSave={saveEntries}
          onEdit={(item) => { setDraft(item); go('toevoegen'); }}
        />
      )}
      {party && <Celebrate key={party.id} text={party.text} onDone={() => setParty(null)} />}
    </div>
  );
}

const MONEY = ['overzicht', 'grafiek', 'budgetten', 'toevoegen', 'inzichten'];

function NavBtn({ icon, label, on, onClick, badge, className }) {
  return (
    <button onClick={onClick} aria-current={on ? 'page' : undefined} className={className}>
      <span className="nav-ico"><Icon name={icon} size={24} />{badge > 0 && <i className="badge">{badge > 99 ? '99+' : badge}</i>}</span>
      {label}
    </button>
  );
}
