// Pure rekenfuncties, los van de database, zodat ze makkelijk te testen zijn.

export function summarize(entries) {
  let income = 0;
  let expense = 0;
  const byCategory = {};
  for (const e of entries) {
    if (e.type === 'in') income += e.amount_cents;
    else {
      expense += e.amount_cents;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount_cents;
    }
  }
  return { income, expense, balance: income - expense, byCategory };
}

// Budgetregels voor één boekje: elke categorie met budget of met uitgaven deze maand.
export function budgetRows(byCategory, budgets) {
  const ids = new Set([...Object.keys(budgets), ...Object.keys(byCategory)]);
  return [...ids]
    .map((id) => {
      const used = byCategory[id] || 0;
      const max = budgets[id] || 0;
      return { id, used, max, ratio: max > 0 ? used / max : null };
    })
    .sort((a, b) => (b.max > 0) - (a.max > 0) || b.used - a.used);
}

// Groepeer per maand ("2026-11") voor de grafiek.
export function perMonth(entries, months) {
  const out = Object.fromEntries(months.map((m) => [m, { month: m, income: 0, expense: 0 }]));
  for (const e of entries) {
    const m = e.date.slice(0, 7);
    if (!out[m]) continue;
    if (e.type === 'in') out[m].income += e.amount_cents;
    else out[m].expense += e.amount_cents;
  }
  return months.map((m) => out[m]);
}

export function groupByDate(entries) {
  const groups = [];
  const sorted = [...entries].sort((a, b) => (b.date + (b.created_at || '')).localeCompare(a.date + (a.created_at || '')));
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }
  return groups;
}

export function toCSV(entries, categoryName) {
  const head = ['datum', 'boekje', 'soort', 'categorie', 'bedrag', 'notitie'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date,
      e.book,
      e.type === 'in' ? 'inkomst' : 'uitgave',
      categoryName(e.category),
      ((e.type === 'in' ? 1 : -1) * e.amount_cents / 100).toFixed(2).replace('.', ','),
      e.note || '',
    ]);
  // Puntkomma als scheidingsteken: zo opent Excel in België het correct.
  return [head, ...rows].map((r) => r.map(esc).join(';')).join('\n');
}
