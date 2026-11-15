import { useCallback, useEffect, useMemo, useState } from 'react';
import { store } from './lib/store.js';
import { monthKey, monthRange, shiftMonth } from './lib/format.js';
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
  const [screen, setScreen] = useState('overzicht');
  const [book, setBook] = useState('gezin');
  const [month, setMonth] = useState(monthKey());
  const [entries, setEntries] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [error, setError] = useState('');
  const [party, setParty] = useState(null);
  const [draft, setDraft] = useState(null); // voorinvulling vanuit spraak

  const months = useMemo(() => Array.from({ length: CHART_MONTHS }, (_, i) => shiftMonth(month, i - CHART_MONTHS + 1)), [month]);

  const load = useCallback(async () => {
    try {
      const from = monthRange(months[0]).from;
      const to = monthRange(month).to;
      const [e, b] = await Promise.all([store.listEntries(household.id, from, to), store.listBudgets(household.id)]);
      setEntries(e);
      setBudgets(b);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [household.id, month, months]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => store.subscribe(household.id, load), [household.id, load]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const bookEntries = useMemo(() => entries.filter((e) => e.book === book), [entries, book]);
  const monthEntries = useMemo(() => bookEntries.filter((e) => e.date.startsWith(month)), [bookEntries, month]);
  const bookBudgets = useMemo(() => Object.fromEntries(budgets.filter((b) => b.book === book).map((b) => [b.category, b.amount_cents])), [budgets, book]);

  const go = (s) => { setScreen(s); window.scrollTo(0, 0); };

  async function saveEntries(list) {
    for (const entry of list) await store.addEntry({ ...entry, household_id: household.id });
    const last = list[list.length - 1];
    if (last.book !== book) setBook(last.book);
    if (!last.date.startsWith(month)) setMonth(last.date.slice(0, 7));
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
    content = <Chart {...common} entries={bookEntries} months={months} />;
  } else if (screen === 'meer') {
    content = <Settings household={household} entries={entries} onChange={onHouseholdChange} />;
  } else {
    content = (
      <Overview
        {...common}
        isOwner={isOwner}
        setBook={setBook}
        entries={monthEntries}
        chartEntries={bookEntries}
        months={months}
        budgets={bookBudgets}
        onDelete={async (id) => { await store.deleteEntry(id); await load(); }}
        onOpenChart={() => go('grafiek')}
        onOpenBudgets={() => go('budgetten')}
      />
    );
  }

  return (
    <div className={'app' + (book === 'zaak' ? ' zaak-mode' : '')}>
      <nav className="nav" aria-label="Hoofdmenu">
        <NavBtn icon="home" label="Overzicht" on={screen === 'overzicht'} onClick={() => go('overzicht')} />
        <NavBtn icon="chart" label="Grafiek" on={screen === 'grafiek'} onClick={() => go('grafiek')} />
        <button className="fab mic-fab" aria-label="Spreken" onClick={() => setScreen('spraak')}>
          <Icon name="mic" size={30} stroke={2.2} />
        </button>
        <button className={'add-fab' + (screen === 'toevoegen' ? ' hidden-on-phone' : '')} aria-label="Uitgave of inkomst toevoegen" aria-current={screen === 'toevoegen' ? 'page' : undefined} onClick={() => { setDraft(null); go('toevoegen'); }}>
          <Icon name="plus" size={26} stroke={2.4} />
        </button>
        <NavBtn icon="target" label="Budgetten" on={screen === 'budgetten'} onClick={() => go('budgetten')} />
        <NavBtn icon="gear" label="Meer" on={screen === 'meer'} onClick={() => go('meer')} />
      </nav>
      <main className="main">
        {store.mode === 'demo' && (
          <div className="banner" style={{ marginBottom: 14 }}>Proefmodus: gegevens blijven alleen op dit toestel.</div>
        )}
        {error && <div className="error" style={{ marginBottom: 14 }}>{error}</div>}
        <div className="screen" key={screen}>{content}</div>
      </main>
      {screen === 'spraak' && (
        <Voice
          isOwner={isOwner}
          onCancel={() => setScreen('overzicht')}
          onSave={saveEntries}
          onEdit={(item) => { setDraft(item); go('toevoegen'); }}
        />
      )}
      {party && <Celebrate key={party.id} text={party.text} onDone={() => setParty(null)} />}
    </div>
  );
}

function NavBtn({ icon, label, on, onClick }) {
  return (
    <button onClick={onClick} aria-current={on ? 'page' : undefined}>
      <Icon name={icon} size={24} />
      {label}
    </button>
  );
}
