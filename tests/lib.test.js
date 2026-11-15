import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, shiftMonth, monthRange, dayLabel } from '../src/lib/format.js';
import { summarize, budgetRows, perMonth, groupByDate, toCSV } from '../src/lib/stats.js';
import { pressKey } from '../src/lib/keypad.js';

test('parseAmount', () => {
  assert.equal(parseAmount('25'), 2500);
  assert.equal(parseAmount('25,5'), 2550);
  assert.equal(parseAmount('1.234,56'), 123456);
  assert.equal(parseAmount('€ 12,30'), 1230);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('1,234'), null);
});

test('maanden', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.equal(dayLabel('2026-11-15', '2026-11-15'), 'Vandaag');
  assert.equal(dayLabel('2026-11-14', '2026-11-15'), 'Gisteren');
});

const E = [
  { id: 1, type: 'in', amount_cents: 380000, category: 'loon', date: '2026-11-01', book: 'gezin' },
  { id: 2, type: 'uit', amount_cents: 6430, category: 'boodschappen', date: '2026-11-15', book: 'gezin', note: 'Delhaize; groot' },
  { id: 3, type: 'uit', amount_cents: 2500, category: 'auto', date: '2026-11-14', book: 'gezin' },
  { id: 4, type: 'uit', amount_cents: 1000, category: 'boodschappen', date: '2026-10-03', book: 'gezin' },
];

test('summarize en budgetten', () => {
  const s = summarize(E.filter((e) => e.date.startsWith('2026-11')));
  assert.equal(s.income, 380000);
  assert.equal(s.expense, 8930);
  assert.equal(s.balance, 371070);
  const rows = budgetRows(s.byCategory, { boodschappen: 60000, kinderen: 5000 });
  assert.equal(rows[0].max > 0, true);
  assert.equal(rows.find((r) => r.id === 'auto').ratio, null);
  assert.equal(rows.find((r) => r.id === 'kinderen').used, 0);
});

test('perMonth en groupByDate', () => {
  const pm = perMonth(E, ['2026-10', '2026-11']);
  assert.deepEqual(pm[0], { month: '2026-10', income: 0, expense: 1000 });
  assert.equal(pm[1].expense, 8930);
  const g = groupByDate(E);
  assert.equal(g[0].date, '2026-11-15');
  assert.equal(g.length, 4);
});

test('CSV', () => {
  const csv = toCSV(E.slice(0, 2), (id) => id);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'datum;boekje;soort;categorie;bedrag;notitie');
  assert.equal(lines[1], '2026-11-01;gezin;inkomst;loon;3800,00;');
  assert.equal(lines[2], '2026-11-15;gezin;uitgave;boodschappen;-64,30;"Delhaize; groot"');
});

test('klavier', () => {
  let a = '0';
  for (const k of ['2', '5', ',', '5', '0', '9']) a = pressKey(a, k);
  assert.equal(a, '25,50');
  assert.equal(pressKey('25,50', '⌫'), '25,5');
  assert.equal(pressKey('5', '⌫'), '0');
  assert.equal(pressKey('5,', ','), '5,');
});
