import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, byMonth, cumulative, perWeekday } from '../src/lib/insights.js';

const e = (date, category, euro, type = 'uit', note = '') => ({ date, category, amount_cents: Math.round(euro * 100), type, book: 'gezin', note });

// Zes gewone maanden, dan een maand met veel meer uit eten en één dure aankoop.
function history() {
  const list = [];
  for (const m of ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']) {
    list.push(e(`${m}-01`, 'loon', 3000, 'in'));
    for (const d of ['03', '10', '17', '24']) list.push(e(`${m}-${d}`, 'boodschappen', 100));
    list.push(e(`${m}-12`, 'uit_eten', 50));
    list.push(e(`${m}-15`, 'abonnement', 20));
    list.push(e(`${m}-20`, 'kleding', 40));
  }
  list.push(e('2026-10-01', 'loon', 3000, 'in'));
  for (const d of ['03', '10', '17', '24']) list.push(e(`2026-10-${d}`, 'boodschappen', 100));
  list.push(e('2026-10-12', 'uit_eten', 90), e('2026-10-19', 'uit_eten', 110));
  list.push(e('2026-10-15', 'abonnement', 20));
  list.push(e('2026-10-21', 'kleding', 400, 'uit', 'Winterjas'));
  return list;
}

test('inzichten per maand: hoger dan gewoonlijk en grote uitgave', () => {
  const a = analyze({ entries: history(), scope: 'maand', month: '2026-10', today: '2026-11', todayDate: '2026-11-17' });
  assert.equal(a.base.length, 6);
  assert.equal(a.cur.expense, 400 * 100 + 200 * 100 + 20 * 100 + 400 * 100);
  const eten = a.rows.find((r) => r.id === 'uit_eten');
  assert.equal(eten.usual, 5000);
  assert.equal(eten.change, 300);
  const kinds = a.outliers.map((o) => o.kind + ':' + o.id);
  assert.ok(kinds.includes('hoger:uit_eten'));
  assert.ok(!kinds.includes('hoger:kleding')); // de winterjas verklaart het al
  assert.ok(kinds.includes('groot:kleding'));
  assert.ok(a.tips.some((t) => t.title.startsWith('Abonnementen')));
  assert.equal(a.trend.points.length, 12);
  assert.equal(a.trend.points[11].key, '2026-10');
});

test('inzichten per jaar en over de jaren: per maand gemiddeld', () => {
  const list = [...history(), e('2025-06-05', 'boodschappen', 300), e('2025-06-01', 'loon', 2800, 'in')];
  const y = analyze({ entries: list, scope: 'jaar', month: '2026-10', today: '2026-10' });
  assert.equal(y.months.length, 10);
  assert.equal(y.hasPrev, true);
  assert.equal(y.prev.expense, 30000);
  const all = analyze({ entries: list, scope: 'alles', month: '2026-10', today: '2026-11' });
  assert.deepEqual(all.trend.points.map((p) => p.key), ['2025', '2026']);
  assert.equal(all.trend.points[0].avgExpense, 30000);
});

test('zonder geschiedenis: geen vergelijking, wel een saldo-tip', () => {
  const a = analyze({ todayDate: '2026-11-30', entries: [e('2026-11-02', 'loon', 1000, 'in'), e('2026-11-03', 'boodschappen', 950)], scope: 'maand', month: '2026-11', today: '2026-11' });
  assert.equal(a.hasBase, false);
  assert.equal(a.outliers.length, 0);
  assert.match(a.tips[0].title, /5% over/);
});

test('hulpjes: per maand, opgeteld per dag en per weekdag', () => {
  const t = byMonth([e('2026-10-30', 'loon', 10, 'in'), e('2026-10-30', 'auto', 5)], 3);
  assert.equal(t['2026-11'].income, 1000);
  assert.equal(t['2026-10'].expense, 500);
  const c = cumulative([e('2026-02-01', 'auto', 1), e('2026-02-03', 'auto', 2)], '2026-02');
  assert.equal(c.length, 28);
  assert.deepEqual(c.slice(0, 4), [100, 100, 300, 300]);
  const w = perWeekday([e('2026-11-16', 'auto', 1), e('2026-11-22', 'auto', 2)]); // maandag, zondag
  assert.equal(w[0], 100);
  assert.equal(w[6], 200);
});

test('lopende maand: vergelijk tot dezelfde dag', () => {
  const list = [];
  for (const m of ['2026-08', '2026-09', '2026-10']) list.push(e(`${m}-05`, 'boodschappen', 100), e(`${m}-25`, 'boodschappen', 100));
  list.push(e('2026-11-05', 'boodschappen', 100));
  const a = analyze({ entries: list, scope: 'maand', month: '2026-11', today: '2026-11', todayDate: '2026-11-10' });
  assert.equal(a.cap, 10);
  assert.equal(a.rows[0].usual, 10000);
  assert.equal(a.rows[0].change, 0);
  assert.equal(a.trend.avg, 20000); // de grafiek toont wel volle maanden
});
