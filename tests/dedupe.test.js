import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicates } from '../src/lib/dedupe.js';

let n = 0;
const e = (at, over = {}) => ({ id: `e${++n}`, book: 'gezin', date: '2026-11-16', type: 'uit', amount_cents: 213, note: 'CRF MKT WAREGEM', created_at: at, ...over });
const load = (at, k = 3) => Array.from({ length: k }, (_, i) => e(at, { amount_cents: 1000 + i, note: `x${n}` }));

test('twee keer hetzelfde afschrift: één blijft', () => {
  const a = e('2026-11-16T10:00:00Z'), b = e('2026-11-17T08:00:00Z');
  const g = findDuplicates([a, b, ...load('2026-11-16T10:00:01Z'), ...load('2026-11-17T08:00:01Z')]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].keep.map((x) => x.id), [a.id]);
  assert.deepEqual(g[0].remove.map((x) => x.id), [b.id]);
  assert.equal(g[0].sure, true);
});

test('twee koffies in één import: getoond, maar niet aangevinkt', () => {
  const g = findDuplicates([e('2026-11-16T10:00:00Z'), e('2026-11-16T10:00:00Z'), ...load('2026-11-16T10:00:00Z')]);
  assert.equal(g.length, 1);
  assert.equal(g[0].sure, false);
  assert.equal(g[0].sameLoad, true);
  assert.equal(g[0].remove.length, 1);
});

test('twee keer op importeren getikt (een paar seconden na elkaar): wel dubbel', () => {
  const first = '2026-11-17T09:00:00.120Z', second = '2026-11-17T09:00:01.480Z';
  const a = e(first, { type: 'in', amount_cents: 170000, note: 'Ellen Bogaert' });
  const b = e(second, { type: 'in', amount_cents: 170000, note: 'Ellen Bogaert' });
  const g = findDuplicates([a, b, ...load(first), ...load(second)]);
  const ellen = g.find((x) => x.keep[0].note === 'Ellen Bogaert');
  assert.deepEqual(ellen.keep.map((x) => x.id), [a.id]);
  assert.deepEqual(ellen.remove.map((x) => x.id), [b.id]);
  assert.equal(ellen.sure, true);
});

test('twee koffies, en het afschrift opnieuw: twee blijven, twee weg', () => {
  const list = [e('2026-11-16T10:00:00Z'), e('2026-11-16T10:00:00Z'), e('2026-11-17T08:00:00Z'), e('2026-11-17T08:00:00Z'), ...load('2026-11-16T10:00:00Z'), ...load('2026-11-17T08:00:00Z')];
  const g = findDuplicates(list);
  assert.equal(g[0].keep.length, 2);
  assert.equal(g[0].remove.length, 2);
});

test('zelf ingegeven: wel gevonden, maar nakijken', () => {
  const g = findDuplicates([e('2026-11-16T10:00:00Z', { note: 'koffie' }), e('2026-11-16T15:00:00Z', { note: 'Koffie ' })]);
  assert.equal(g.length, 1);
  assert.equal(g[0].sure, false);
});

test('ander bedrag, dag, boekje of omschrijving is geen dubbel', () => {
  const base = '2026-11-16T10:00:00Z', later = '2026-11-17T10:00:00Z';
  const g = findDuplicates([e(base), e(later, { amount_cents: 214 }), e(later, { date: '2026-11-15' }), e(later, { book: 'zaak' }), e(later, { note: 'ander' }), e(later, { type: 'in' })]);
  assert.equal(g.length, 0);
});
