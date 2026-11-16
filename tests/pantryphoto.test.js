import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewList, guessFromLabels } from '../src/lib/pantryphoto.js';

const pantry = [
  { id: 'p1', name: 'Pasta', place: 'kast', status: 'op' },
  { id: 'p2', name: 'Melk', place: 'koelkast', status: 'ok' },
];

test('foto: nakijklijst zonder dubbels, bestaande producten herkend', () => {
  const rows = reviewList([
    { name: 'spaghetti', status: 'ok' },
    { name: 'pasta', status: 'ok' },
    { name: 'melk', status: 'ok' },
    { name: 'tomatensaus', status: 'bijna' },
    { name: 'Tomatensaus', status: 'ok' },
    { name: ' ' },
  ], pantry, 'kast');
  assert.deepEqual(rows.map((r) => r.name), ['Spaghetti', 'Pasta', 'Melk', 'Tomatensaus']);
  const pasta = rows[1];
  assert.equal(pasta.existing.id, 'p1');
  assert.equal(pasta.keep, true); // stond op "op", nu gezien: terug op genoeg
  assert.equal(rows[2].keep, false); // melk stond al op genoeg: niets te doen
  assert.equal(rows[2].place, 'koelkast'); // bestaande plaats blijft
  assert.equal(rows[3].status, 'bijna');
});

test('foto zonder AI: producten uit etiketten', () => {
  const found = guessFromLabels('BARILLA Spaghetti n.5\nBruine suiker 1kg\nKikkererwten 400g Olijfolie extra vierge\nBonduelle', pantry).map((f) => f.name);
  assert.ok(found.includes('spaghetti'));
  assert.ok(found.includes('bruine suiker'));
  assert.ok(found.includes('kikkererwten'));
  assert.ok(found.includes('olijfolie'));
  assert.ok(!found.includes('suiker'));
  assert.deepEqual(guessFromLabels('', pantry), []);
});
