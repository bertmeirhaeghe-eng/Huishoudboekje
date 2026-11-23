import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedPayments, recurringKey } from '../src/lib/recurring.js';

let n = 0;
const uit = (date, cents, note, category = 'wonen') => ({ id: ++n, type: 'uit', book: 'gezin', date, amount_cents: cents, note, category });
const K1 = 'Afbetaling krediet: DOSSIERNUMMER : 103863433040';
const K2 = 'Afbetaling krediet: DOSSIERNUMMER : 103863432939';

const history = [
  uit('2026-09-30', 62224, K1), uit('2026-09-30', 117217, K2),
  uit('2026-10-30', 62224, K1), uit('2026-10-30', 117217, K2),
  // Colruyt: vaak, wisselende bedragen: geen vaste betaling.
  uit('2026-10-03', 3972, '3795 COLRUYT WAREGEM', 'boodschappen'), uit('2026-10-10', 5210, '3795 COLRUYT WAREGEM', 'boodschappen'),
  uit('2026-10-17', 4410, '3795 COLRUYT WAREGEM', 'boodschappen'),
  uit('2026-11-05', 2550, '3795 COLRUYT WAREGEM', 'boodschappen'),
];

test('twee kredieten blijven apart en komen nog deze maand', () => {
  const r = expectedPayments(history, '2026-11');
  assert.equal(r.pending.length, 2);
  assert.deepEqual(r.pending.map((p) => p.amount_cents), [117217, 62224]);
  assert.equal(r.pending[0].date, '2026-11-30');
  assert.equal(r.total, 179441);
  assert.equal(r.paid.length, 0);
});

test('zodra de bank het boekt, telt het niet meer als "komt nog"', () => {
  const r = expectedPayments([...history, uit('2026-11-28', 62224, K1)], '2026-11');
  assert.equal(r.pending.length, 1);
  assert.equal(r.pending[0].amount_cents, 117217);
  assert.equal(r.paid.length, 1);
  assert.equal(r.total, 117217);
});

test('ook herkend met een iets andere omschrijving: zelfde categorie, bedrag en dag', () => {
  const r = expectedPayments([...history, uit('2026-11-29', 117217, 'Krediet 103863432939')], '2026-11');
  assert.deepEqual(r.pending.map((p) => p.amount_cents), [62224]);
});

test('één keer gezien volstaat voor een krediet, niet voor een gewone aankoop', () => {
  const r = expectedPayments([uit('2026-10-30', 62224, K1), uit('2026-10-12', 8999, 'MediaMarkt Kortrijk', 'huis')], '2026-11');
  assert.deepEqual(r.pending.map((p) => p.note), [K1]);
});

test('een maandelijks abonnement wordt na twee maanden herkend, ook met een licht ander bedrag', () => {
  const r = expectedPayments([uit('2026-09-12', 1799, 'Netflix', 'vrije-tijd'), uit('2026-10-12', 1999, 'Netflix', 'vrije-tijd')], '2026-11');
  assert.equal(r.pending[0].date, '2026-11-12');
  assert.equal(r.pending[0].amount_cents, 1999);
});

test('verborgen en lang niet meer geziene betalingen tellen niet', () => {
  assert.equal(expectedPayments(history, '2026-11', { hidden: [recurringKey(K1), recurringKey(K2)] }).pending.length, 0);
  assert.equal(expectedPayments([uit('2026-08-30', 62224, K1)], '2026-11').pending.length, 0);
});

test('dag 31 wordt de laatste dag van een kortere maand', () => {
  const r = expectedPayments([uit('2026-12-31', 50000, 'Huur appartement')], '2027-01');
  assert.equal(r.pending[0].date, '2027-01-31');
  const f = expectedPayments([uit('2027-01-31', 50000, 'Huur appartement')], '2027-02');
  assert.equal(f.pending[0].date, '2027-02-28');
});

test('omschrijving: datums en hoofdletters tellen niet mee', () => {
  assert.equal(recurringKey('Huur  OKT 30/10/2026'), recurringKey('huur okt 30-11-2026'));
});
