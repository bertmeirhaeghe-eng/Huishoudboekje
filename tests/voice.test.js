import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpeech, parseOne, wordToNumber, findDate } from '../src/lib/voice.js';

const T = '2026-11-15'; // een zondag
const p1 = (s, o = {}) => parseOne(s, { today: T, ...o });
const pick = (r) => ({ type: r.type, book: r.book, amount_cents: r.amount_cents, category: r.category, date: r.date });

test('getallen in woorden', () => {
  assert.equal(wordToNumber('vijfentwintig'), 25);
  assert.equal(wordToNumber('driehonderdvijftig'), 350);
  assert.equal(wordToNumber('tweeduizend'), 2000);
  assert.equal(wordToNumber('negentien'), 19);
  assert.equal(wordToNumber('vierhonderdtweeëntwintig'), 422);
  assert.equal(wordToNumber('appel'), null);
});

test('datums', () => {
  assert.equal(findDate('gisteren', T).date, '2026-11-14');
  assert.equal(findDate('eergisteren', T).date, '2026-11-13');
  assert.equal(findDate('vrijdag', T).date, '2026-11-13');
  assert.equal(findDate('zondag', T).date, '2026-11-08');
  assert.equal(findDate('op 3 november', T).date, '2026-11-03');
  assert.equal(findDate('op 20 december', T).date, '2025-12-20');
  assert.equal(findDate('12/11', T).date, '2026-11-12');
  assert.equal(findDate('niets', T).date, T);
});

const cases = [
  ['25 euro tanken', { type: 'uit', book: 'gezin', amount_cents: 2500, category: 'auto', date: T }],
  ['Vijfentwintig euro getankt', { type: 'uit', book: 'gezin', amount_cents: 2500, category: 'auto', date: T }],
  ['64,30 bij Delhaize', { type: 'uit', book: 'gezin', amount_cents: 6430, category: 'boodschappen', date: T }],
  ['gisteren 12 euro 50 bij de bakker', { type: 'uit', book: 'gezin', amount_cents: 1250, category: 'boodschappen', date: '2026-11-14' }],
  ['€ 1.400 voor een laptop', { type: 'uit', book: 'zaak', amount_cents: 140000, category: 'it_materiaal', date: T }],
  ['laptop van 1400 euro privé', { type: 'uit', book: 'gezin', amount_cents: 140000, category: 'andere', date: T }],
  ['loon ontvangen 3800 euro', { type: 'in', book: 'gezin', amount_cents: 380000, category: 'loon', date: T }],
  ['factuur van 4840 euro betaald door klant', { type: 'in', book: 'zaak', amount_cents: 484000, category: 'factuur_it', date: T }],
  ['houtskool 45 euro op de zaak', { type: 'uit', book: 'zaak', amount_cents: 4500, category: 'bbq_materiaal', date: T }],
  ['50 euro tanken voor de zaak', { type: 'uit', book: 'zaak', amount_cents: 5000, category: 'auto_zaak', date: T }],
  ['restaurant met klant 86 euro', { type: 'uit', book: 'zaak', amount_cents: 8600, category: 'resto_klant', date: T }],
  ['frietkot vrijdag 32 euro', { type: 'uit', book: 'gezin', amount_cents: 3200, category: 'uit_eten', date: '2026-11-13' }],
  ['tandarts 45 euro', { type: 'uit', book: 'gezin', amount_cents: 4500, category: 'gezondheid', date: T }],
  ['18 euro terugbetaald van de mutualiteit', { type: 'in', book: 'gezin', amount_cents: 1800, category: 'terugbetaling', date: T }],
  ['Netflix 13,99', { type: 'uit', book: 'gezin', amount_cents: 1399, category: 'abonnement', date: T }],
  ['workshop 12 deelnemers 780 euro ontvangen', { type: 'in', book: 'zaak', amount_cents: 78000, category: 'workshop', date: T }],
  ['twintig euro cadeau voor verjaardag', { type: 'uit', book: 'gezin', amount_cents: 2000, category: 'cadeaus', date: T }],
  ['huur 950 euro', { type: 'uit', book: 'gezin', amount_cents: 95000, category: 'wonen', date: T }],
];

for (const [s, want] of cases) {
  test('zin: ' + s, () => assert.deepEqual(pick(p1(s)), want));
}

test('niet-eigenaar kan niet op de zaak boeken', () => {
  assert.equal(p1('houtskool 45 euro op de zaak', { allowZaak: false }).book, 'gezin');
});

test('ontbrekende info', () => {
  assert.deepEqual(p1('tanken').missing, ['bedrag']);
  assert.deepEqual(p1('35 euro').missing, ['categorie']);
});

test('notitie', () => {
  assert.equal(p1('64,30 bij Delhaize').note, 'Delhaize');
});

test('meerdere boekingen in één zin', () => {
  const r = parseSpeech('25 euro tanken en 12 euro bij de bakker', { today: T });
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((x) => [x.amount_cents, x.category]), [[2500, 'auto'], [1200, 'boodschappen']]);
  const one = parseSpeech('brood en melk voor 8 euro', { today: T });
  assert.equal(one.length, 1);
  assert.equal(one[0].amount_cents, 800);
});
