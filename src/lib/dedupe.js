// Dubbele boekingen opsporen: zelfde boekje, dag, soort, bedrag en omschrijving.
//
// Eén bankafschrift kan echt twee keer hetzelfde bevatten (twee keer een koffie van 2,50).
// Die komen dan in één keer binnen: dezelfde import, met exact hetzelfde tijdstip.
// Wat met een ANDERE import binnenkwam (ook al is dat maar een paar seconden later, bv. twee keer
// op de knop getikt), is dubbel. Daarom houden we per groep de grootste "lading" die samen
// binnenkwam, en stellen we de rest voor om te verwijderen.
// Staat iets twee keer in één en dezelfde import, dan tonen we het ook, maar niet aangevinkt:
// dat kan een echte herhaling zijn, of een bankbestand waarin alles dubbel stond.

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const t = (e) => Date.parse(e.created_at || 0) || 0;
// Eén lading = exact hetzelfde tijdstip (de database geeft alle rijen van één import hetzelfde tijdstip).
const loadOf = (e) => e.created_at || `zonder-${e.id}`;

// Seconden waarbinnen boekingen als één import tellen (om te weten of iets geïmporteerd is).
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

// Geeft groepen terug: { key, keep: [...], remove: [...], sure, sameLoad }.
// sure = alles in de groep kwam via verschillende imports binnen; anders eerst nakijken.
// sameLoad = alles kwam in één en dezelfde import binnen.
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
    const byLoad = new Map();
    for (const e of list) {
      if (!byLoad.has(loadOf(e))) byLoad.set(loadOf(e), []);
      byLoad.get(loadOf(e)).push(e);
    }
    const loads = [...byLoad.values()];
    const imported = list.every((e) => bulk.has(e.id));
    if (loads.length < 2) {
      // Alles in één import: echte herhaling (twee koffies) of een bestand met alles dubbel. Nakijken.
      if (imported) out.push({ key, keep: [list[0]], remove: list.slice(1), sure: false, sameLoad: true });
      continue;
    }
    let best = loads[0];
    for (const l of loads) if (l.length > best.length) best = l;
    const keep = best;
    const remove = list.filter((e) => !keep.includes(e));
    out.push({ key, keep, remove, sure: imported, sameLoad: false });
  }
  return out.sort((a, b) => b.keep[0].date.localeCompare(a.keep[0].date));
}
