// Inzichten: wat valt op, hoe evolueert het, en wat kan beter?
// Pure rekenfuncties (bedragen in centen), los van het scherm, zodat ze te testen zijn.

import { budgetMonth } from './stats.js';
import { category } from './categories.js';
import { monthKey, monthLabel, shiftMonth, todayISO, yearMonths, money } from './format.js';

// Alles per maand: { '2026-11': { income, expense, cats: { boodschappen: 12345 } } }
export function byMonth(entries, earlyDays = 0) {
  const out = {};
  for (const e of entries) {
    const m = budgetMonth(e, earlyDays);
    const t = (out[m] ||= { income: 0, expense: 0, cats: {} });
    if (e.type === 'in') t.income += e.amount_cents;
    else {
      t.expense += e.amount_cents;
      t.cats[e.category] = (t.cats[e.category] || 0) + e.amount_cents;
    }
  }
  return out;
}

const empty = () => ({ income: 0, expense: 0, cats: {} });

function addUp(table, months) {
  const t = empty();
  for (const m of months) {
    const r = table[m];
    if (!r) continue;
    t.income += r.income;
    t.expense += r.expense;
    for (const [k, v] of Object.entries(r.cats)) t.cats[k] = (t.cats[k] || 0) + v;
  }
  return t;
}

function divide(t, n) {
  if (!n) return empty();
  return {
    income: Math.round(t.income / n),
    expense: Math.round(t.expense / n),
    cats: Object.fromEntries(Object.entries(t.cats).map(([k, v]) => [k, Math.round(v / n)])),
  };
}

const median = (list) => {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

// Hoe zeg je een verschil? "+35%" of, bij grote sprongen, "4× zoveel". Kleine verschillen (onder 15% of 25 euro) tellen niet.
export function changeLabel(r) {
  if (!r || r.change == null || r.usual == null) return null;
  if (Math.abs(r.change) < 15 || Math.abs(r.diff) < 2500) return null;
  const up = r.diff > 0;
  const times = r.now / r.usual;
  const text = up && times >= 3 ? `${Math.round(times)}× zoveel als gewoonlijk` : `${Math.abs(r.change)}% ${up ? 'meer' : 'minder'} dan gewoonlijk`;
  return { up, text, short: up && times >= 3 ? `${Math.round(times)}×` : `${up ? '+' : '−'}${Math.abs(r.change)}%` };
}

// De periode die je bekijkt.
//  scope 'maand': één maand, vergeleken met het gemiddelde van de 6 maanden ervoor (met boekingen).
//  scope 'jaar' : een jaar, per maand gemiddeld, vergeleken met het jaar ervoor.
//  scope 'alles': alle jaren naast elkaar.
export function periodFor(scope, month, table, today = monthKey()) {
  const has = (m) => !!table[m];
  if (scope === 'maand') {
    const before = Array.from({ length: 6 }, (_, i) => shiftMonth(month, -(i + 1))).filter(has);
    return { months: [month], base: before, prev: [shiftMonth(month, -1)], perMonth: false };
  }
  if (scope === 'jaar') {
    const months = yearMonths(month).filter((m) => m <= today);
    const prevYear = yearMonths(shiftMonth(month, -12));
    return { months, base: prevYear.filter(has), prev: prevYear, perMonth: true };
  }
  const all = Object.keys(table).sort().filter((m) => m <= today);
  return { months: all, base: [], prev: [], perMonth: true };
}

// Per categorie: nu tegenover gewoonlijk (in de maand-weergave totalen, anders per maand gemiddeld).
export function categoryRows(cur, base, hasBase) {
  const ids = new Set([...Object.keys(cur.cats), ...(hasBase ? Object.keys(base.cats) : [])]);
  return [...ids]
    .map((id) => {
      const now = cur.cats[id] || 0;
      const usual = hasBase ? base.cats[id] || 0 : null;
      return { id, now, usual, diff: usual == null ? null : now - usual, change: usual ? pct(now, usual) : null };
    })
    .filter((r) => r.now > 0 || (r.usual || 0) > 0)
    .sort((a, b) => b.now - a.now || (b.usual || 0) - (a.usual || 0));
}

// Wat valt op? Een lijst van uitschieters, de belangrijkste eerst.
export function findOutliers({ rows, periodEntries, history, hasBase, perMonth, scope, cap = null }) {
  const out = [];
  const unit = perMonth ? ' per maand' : '';
  const when = cap ? `tot nu toe` : scope === 'maand' ? 'deze maand' : scope === 'jaar' ? 'dit jaar' : '';
  const MIN = 2500; // verschillen onder 25 euro zijn ruis
  if (hasBase) {
    for (const r of rows) {
      const name = category(r.id).name;
      if (r.usual > 0 && r.now > r.usual * 1.25 && r.diff >= MIN) {
        out.push({ kind: 'hoger', id: r.id, score: r.diff, title: r.now >= r.usual * 3 ? `${name}: ${Math.round(r.now / r.usual)}× zoveel` : `${name}: ${r.change}% meer`, text: `${money(r.now, { round: true })}${unit} ${when}, gewoonlijk ${money(r.usual, { round: true })}${unit}${cap ? ` op dag ${cap}` : ''}.` });
      } else if (r.usual > 0 && r.now < r.usual * 0.75 && -r.diff >= MIN) {
        out.push({ kind: 'lager', id: r.id, score: -r.diff * 0.8, title: `${name}: ${Math.abs(r.change)}% minder`, text: `${money(r.now, { round: true })}${unit} ${when}, gewoonlijk ${money(r.usual, { round: true })}${unit}${cap ? ` op dag ${cap}` : ''}. Goed bezig!` });
      } else if (!r.usual && r.now >= MIN) {
        out.push({ kind: 'nieuw', id: r.id, score: r.now * 0.6, title: `${name}: nieuw`, text: `${money(r.now, { round: true })}${unit} ${when}, daarvoor niets.` });
      }
    }
  }
  // Ongewoon grote losse uitgaven: veel groter dan wat je normaal in die categorie betaalt.
  const perCat = {};
  for (const e of history) if (e.type === 'uit') (perCat[e.category] ||= []).push(e.amount_cents);
  const big = periodEntries
    .filter((e) => e.type === 'uit')
    .filter((e) => {
      const list = perCat[e.category] || [];
      return list.length >= 5 && e.amount_cents >= 7500 && e.amount_cents >= 3 * median(list);
    })
    .sort((a, b) => b.amount_cents - a.amount_cents)
    .slice(0, 3);
  for (const e of big) {
    const typical = median(perCat[e.category]);
    out.push({
      kind: 'groot', id: e.category, entry: e, score: e.amount_cents - typical,
      title: `${e.note || category(e.category).name}`,
      text: `${money(e.amount_cents)} op ${Number(e.date.slice(8))}/${Number(e.date.slice(5, 7))}. Normaal betaal je in ${category(e.category).name.toLowerCase()} zo'n ${money(typical, { round: true })}.`,
    });
  }
  // Verklaart één grote uitgave de stijging al, dan tonen we die en niet ook nog de stijging.
  const bigCats = new Set(big.map((e) => e.category));
  return out.filter((o) => !(o.kind === 'hoger' && bigCats.has(o.id))).sort((a, b) => b.score - a.score).slice(0, 6);
}

const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

// Uitgaven per weekdag, maandag eerst.
export function perWeekday(entries) {
  const t = [0, 0, 0, 0, 0, 0, 0];
  for (const e of entries) if (e.type === 'uit') t[(new Date(e.date + 'T12:00:00').getDay() + 6) % 7] += e.amount_cents;
  return t;
}

// Opgeteld per dag van de maand: [dag 1, dag 1+2, ...].
export function cumulative(entries, month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const t = Array(days).fill(0);
  for (const e of entries) if (e.type === 'uit' && e.date.slice(0, 7) === month) t[Number(e.date.slice(8)) - 1] += e.amount_cents;
  for (let i = 1; i < days; i++) t[i] += t[i - 1];
  return t;
}

// Gewoonlijk verloop: per dag het gemiddelde van de vorige maanden (31 dagen, korte maanden blijven op hun eindstand).
export function usualCumulative(entries, months) {
  if (!months.length) return null;
  const sum = Array(31).fill(0);
  for (const m of months) {
    const c = cumulative(entries, m);
    for (let i = 0; i < 31; i++) sum[i] += c[Math.min(i, c.length - 1)];
  }
  return sum.map((v) => Math.round(v / months.length));
}

// Tips: vriendelijke, concrete suggesties op basis van de cijfers.
const CAT_TIPS = {
  uit_eten: 'Spreek samen één vaste resto-avond per maand af, en kook de andere keren iets lekkers uit het weekmenu.',
  boodschappen: 'Maak een weekmenu en ga met een lijstje naar de winkel: dat scheelt impulsaankopen. Beide zitten in de app onder Keuken en Lijst.',
  abonnement: 'Overloop je abonnementen: welke gebruik je eigenlijk niet meer?',
  auto: 'Vergelijk de prijzen aan de pomp (bv. via carbu.com) en tank liefst bij een goedkope witte pomp.',
  wonen: 'Vergelijk je energiecontract eens met de V-test van de VREG: overstappen is gratis.',
  kleding: 'Zet een vast kledingbudget per seizoen, dan weet je wat er nog kan.',
  vrije_tijd: 'Kijk eens naar gratis uitstappen of de UiTPAS van je gemeente: die geeft korting op activiteiten.',
  cadeaus: 'Spreek in de familie een maximumbedrag of lootjes af voor verjaardagen en feesten.',
  verzekering: 'Laat je verzekeringen eens vergelijken: een paar offertes vragen loont vaak.',
  gezondheid: 'Vergeet niet je doktersbriefjes en terugbetalingen bij je ziekenfonds in te dienen.',
  kinderen: 'Kinderkosten schommelen (kamp, schoolreis). Zet in rustige maanden wat opzij voor de dure maanden.',
  resto_klant: 'Restaurant met klanten is maar voor 69% aftrekbaar. Noteer telkens met wie en waarom.',
  it_materiaal: 'Duurder IT-materiaal schrijf je af over enkele jaren. Bespreek grote aankopen vooraf met je boekhouder.',
  auto_zaak: 'De aftrek van autokosten hangt af van de wagen. Laat het zeker berekenen door je boekhouder.',
};

export function makeTips({ scope, cur, rows, outliers, weekday, budgets = {}, book, months, periodEntries }) {
  const tips = [];
  const n = Math.max(1, months.length);
  const zaak = book === 'zaak';

  // Hoeveel hield je over?
  if (cur.income > 0) {
    const rate = Math.round(((cur.income - cur.expense) / cur.income) * 100);
    if (zaak) {
      tips.push(rate >= 0
        ? { tone: 'good', icon: 'briefcase', title: `Marge van ${rate}%`, text: `Van elke 100 euro die binnenkwam, bleef er ${rate} euro over na kosten.` }
        : { tone: 'warn', icon: 'briefcase', title: 'Meer kosten dan inkomsten', text: `De kosten liggen ${Math.abs(rate)}% hoger dan de inkomsten. Kijk of er facturen nog moeten binnenkomen.` });
    } else if (rate >= 20) {
      tips.push({ tone: 'good', icon: 'target', title: `Je hield ${rate}% over`, text: `Mooi! Zet een deel daarvan meteen op een spaarrekening, dan raakt het niet zomaar op.` });
    } else if (rate >= 0) {
      const aim = Math.round(cur.income / n / 10 / 1000) * 1000; // 10% van het inkomen, afgerond op 10 euro
      tips.push({ tone: 'info', icon: 'target', title: `Je hield ${rate}% over`, text: aim > 0 ? `Probeer elke maand vast ${money(aim, { round: true })} (10% van het inkomen) opzij te zetten, liefst meteen bij het binnenkomen.` : 'Probeer elke maand vast een bedrag opzij te zetten.' });
    } else {
      tips.push({ tone: 'warn', icon: 'target', title: 'Meer uit dan in', text: `Je gaf ${money(cur.expense - cur.income, { round: true })} meer uit dan er binnenkwam. Kijk hieronder waar het meeste naartoe ging.` });
    }
  }

  // De grootste stijger: een tip die erbij past.
  const up = outliers.find((o) => o.kind === 'hoger' && CAT_TIPS[o.id]);
  if (up) tips.push({ tone: 'warn', icon: category(up.id).icon, cat: up.id, title: `${category(up.id).name} loopt op`, text: CAT_TIPS[up.id] });

  // Over budget.
  const over = rows.filter((r) => budgets[r.id] && r.now > budgets[r.id]).map((r) => category(r.id).name);
  if (over.length) tips.push({ tone: 'warn', icon: 'target', title: over.length === 1 ? `${over[0]} zit over het budget` : `${over.length} categorieën over budget`, text: over.length === 1 ? 'Kijk of het budget nog klopt, of hou het de rest van de maand rustig.' : `${over.join(', ')}. Pas de budgetten aan als ze niet meer kloppen.` });

  // Abonnementen per jaar.
  const sub = cur.cats.abonnement || 0;
  if (sub > 0) {
    const perMonthSub = Math.round(sub / n);
    tips.push({ tone: 'info', icon: 'repeat', cat: 'abonnement', title: `Abonnementen: ${money(perMonthSub * 12, { round: true })} per jaar`, text: `Dat is ${money(perMonthSub, { round: true })} per maand. ${CAT_TIPS.abonnement}` });
  }

  // Kleine uitgaven tellen op.
  const small = periodEntries.filter((e) => e.type === 'uit' && e.amount_cents < 1000);
  const smallSum = small.reduce((a, e) => a + e.amount_cents, 0);
  if (small.length >= 10 * n && smallSum >= 5000 * n) {
    tips.push({ tone: 'info', icon: 'dots', title: 'Kleine uitgaven tellen op', text: `${small.length} keer minder dan 10 euro, samen ${money(smallSum, { round: true })}. Een koffie hier, een snoepje daar...` });
  }

  // Duurste weekdag.
  const totalW = weekday.reduce((a, b) => a + b, 0);
  if (totalW > 0) {
    const i = weekday.indexOf(Math.max(...weekday));
    const share = Math.round((weekday[i] / totalW) * 100);
    if (share >= 25) tips.push({ tone: 'info', icon: 'calendar', title: `De ${DAYS[(i + 1) % 7]} is je duurste dag`, text: `${share}% van de uitgaven valt op ${DAYS[(i + 1) % 7]}. Is dat de grote boodschappendag?` });
  }

  // Een categorie die het goed doet.
  const down = outliers.find((o) => o.kind === 'lager');
  if (down) tips.push({ tone: 'good', icon: category(down.id).icon, cat: down.id, title: `Minder aan ${category(down.id).name.toLowerCase()}`, text: down.text });

  return tips.slice(0, 6);
}

// Alles in één keer voor het inzichtenscherm.
export function analyze({ entries, scope = 'maand', month = monthKey(), earlyDays = 0, budgets = {}, book = 'gezin', today = monthKey(), todayDate = todayISO() }) {
  const table = byMonth(entries, earlyDays);
  // Loopt de maand nog? Vergelijk dan eerlijk: de vorige maanden ook maar tot dezelfde dag.
  const cap = scope === 'maand' && todayDate.slice(0, 7) === month ? Number(todayDate.slice(8, 10)) : null;
  const capped = cap ? byMonth(entries.filter((e) => Number(e.date.slice(8, 10)) <= cap || e.type === 'in'), earlyDays) : table;
  const p = periodFor(scope, month, table, today);
  const inMonths = new Set(p.months);
  const periodEntries = entries.filter((e) => inMonths.has(budgetMonth(e, earlyDays)));
  const total = addUp(table, p.months);
  const nNow = Math.max(1, p.months.length);
  const cur = p.perMonth ? divide(total, nNow) : total;
  const hasBase = p.base.length > 0;
  const base = hasBase ? divide(addUp(capped, p.base), p.base.length) : empty();
  const prevTotal = addUp(capped, p.prev);
  const prev = p.perMonth ? divide(prevTotal, p.prev.filter((m) => table[m]).length || 1) : prevTotal;
  const hasPrev = p.prev.some((m) => table[m]);
  const rows = categoryRows(cur, base, hasBase);
  const weekday = perWeekday(periodEntries);
  const outliers = findOutliers({ rows, periodEntries, history: entries, hasBase, perMonth: p.perMonth, scope, cap });
  const tips = makeTips({ scope, cur: total, rows, outliers, weekday, budgets, book, months: p.months, periodEntries });

  // Trend voor de grafiek bovenaan.
  let trend;
  if (scope === 'maand') {
    const ms = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
    trend = { kind: 'maanden', points: ms.map((m) => ({ key: m, ...(table[m] || empty()) })), focus: month, avg: hasBase ? divide(addUp(table, p.base), p.base.length).expense : null };
  } else if (scope === 'jaar') {
    const ms = yearMonths(month);
    const py = yearMonths(shiftMonth(month, -12));
    trend = { kind: 'jaar', points: ms.map((m, i) => ({ key: m, ...(table[m] || empty()), before: table[py[i]]?.expense ?? null })), focus: null };
  } else {
    const years = [...new Set(p.months.map((m) => m.slice(0, 4)))].sort();
    trend = {
      kind: 'jaren',
      points: years.map((y) => {
        const ms = p.months.filter((m) => m.startsWith(y));
        const t = addUp(table, ms);
        return { key: y, months: ms.length, income: t.income, expense: t.expense, avgIncome: Math.round(t.income / ms.length), avgExpense: Math.round(t.expense / ms.length), cats: t.cats };
      }),
    };
  }

  return {
    scope, months: p.months, base: p.base, perMonth: p.perMonth,
    total, cur, prev, hasPrev, baseTotals: base, hasBase,
    rows, outliers, tips, weekday, periodEntries, trend,
    cum: scope === 'maand' ? { now: cumulative(entries, month), usual: usualCumulative(entries, p.base) } : null,
    cap,
    label: scope === 'maand' ? monthLabel(month) : scope === 'jaar' ? month.slice(0, 4) : 'alle jaren',
    count: periodEntries.length,
  };
}

// Een korte zin voor op het overzicht: het meest opvallende van deze maand.
export function headline(entries, month, earlyDays = 0) {
  const a = analyze({ entries, scope: 'maand', month, earlyDays, today: month });
  const o = a.outliers.find((x) => x.kind === 'hoger' || x.kind === 'groot') || a.outliers[0];
  return o ? o.title : null;
}
