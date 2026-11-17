// Dubbele boekingen opsporen: zelfde boekje, dag, soort, bedrag en omschrijving.
//
// Eén bankafschrift kan echt twee keer hetzelfde bevatten (twee keer een koffie van 2,50).
// Die komen dan in één keer binnen (zelfde import, zelfde tijdstip). Pas wat er bij een
// LATERE keer nog eens bijkwam, is dubbel. Daarom houden we per groep de grootste
// "lading" die samen binnenkwam, en stellen we de rest voor om te verwijderen.

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const t = (e) => Date.parse(e.created_at || 0) || 0;

// Seconden waarbinnen boekingen als één lading tellen.
export const SAME_LOAD_MS = 10000;

export function entryKey(e) {
  return [e.book, e.date, e.type, e.amount_cents, norm(e.note)].join('|');
}

// Welke boekingen kwamen met een import binnen (minstens 3 tegelijk)?
function bulkIds(entries) {
  const sorted = [...entries].sort((a, b) => t(a) - t(b));
  const ids = new Set();
  let lo = 0;
  for (let hi = 0; hi < sorted.length; hi++) {
    while (t(sorted[hi]) - t(sorted[lo]) > SAME_LOAD_MS) lo++;
    if (hi - lo + 1 >= 3) for (let k = lo; k <= hi; k++) ids.add(sorted[k].id);
  }
  return ids;
}

// Geeft groepen terug: { key, keep: [...], remove: [...], sure }.
// sure = alles in de groep kwam via een import binnen; anders (zelf of met de stem ingegeven) eerst nakijken.
export function findDuplicates(entries) {
  const groups = new Map();
  for (const e of entries) {
    const k = entryKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const bulk = bulkIds(entries);
  const out = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => t(a) - t(b) || String(a.id).localeCompare(String(b.id)));
    const loads = [];
    for (const e of list) {
      const last = loads[loads.length - 1];
      if (last && t(e) - t(last[0]) <= SAME_LOAD_MS) last.push(e);
      else loads.push([e]);
    }
    if (loads.length < 2) continue; // alles kwam samen binnen: echte herhaling
    let best = loads[0];
    for (const l of loads) if (l.length > best.length) best = l;
    const keep = best;
    const remove = list.filter((e) => !keep.includes(e));
    out.push({ key, keep, remove, sure: list.every((e) => bulk.has(e.id)) });
  }
  return out.sort((a, b) => b.keep[0].date.localeCompare(a.keep[0].date));
}
