import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inPeriod, totalsByCategory } from '../src/lib/stats.js';
import { yearMonths } from '../src/lib/format.js';

test('jaaroverzicht: vroege inkomsten schuiven over de jaargrens', () => {
  const dec = { date: '2025-12-30', type: 'in', amount_cents: 100, category: 'loon' };
  assert.equal(inPeriod(dec, '2026-05', 'jaar', 3), true);
  assert.equal(inPeriod(dec, '2025-05', 'jaar', 3), false);
  assert.equal(inPeriod(dec, '2025-05', 'jaar', 0), true);
  const uit = { date: '2025-12-30', type: 'uit', amount_cents: 100, category: 'eten' };
  assert.equal(inPeriod(uit, '2025-01', 'jaar', 3), true);
  assert.equal(inPeriod(uit, '2025-12', 'maand', 3), true);
});

test('jaarmaanden en totalen per categorie', () => {
  assert.deepEqual(yearMonths('2026-11').slice(0, 2), ['2026-01', '2026-02']);
  assert.equal(yearMonths('2026-11').length, 12);
  const list = [
    { type: 'uit', category: 'a', amount_cents: 5 },
    { type: 'uit', category: 'b', amount_cents: 9 },
    { type: 'uit', category: 'a', amount_cents: 6 },
    { type: 'in', category: 'c', amount_cents: 1 },
  ];
  assert.deepEqual(totalsByCategory(list, 'uit'), [['a', 11], ['b', 9]]);
});
