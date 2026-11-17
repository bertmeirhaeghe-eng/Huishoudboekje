import test from 'node:test';
import assert from 'node:assert/strict';
import { readBankCSV, markDuplicates, shiftDate, parseBankAmount, cleanName } from '../src/lib/bankimport.js';

// Verzonnen voorbeeld in het formaat van een Crelan-export.
const CRELAN = `Datum;Bedrag;Saldo na verrichting;Munt;Tegenpartij;Rekening tegenpartij;Type verrichting;Mededeling;Rekening opdrachtgever
02/01/2026;-0.15;908.66;EUR;" ";BE00 0000 0000 0000;Recht op geschriften;;BE00 0000 0000 0000
03/01/2026;-57.12;851.54;EUR;CRF MKT GENT        GENT;;Betaling Bancontact contactless;CRF MKT GENT 03-01-2026 10:38 GENT BE 123456******837;BE00 0000 0000 0000
04/01/2026;-8.35;843.19;EUR;Bakkerij Jan           GENT;;Betaling Bancontact contactless;Bakkerij Jan 04-01-2026 08:01 GENT 123456******8;BE00 0000 0000 0000
05/01/2026;1700.00;2543.19;EUR;Jan Peeters;BE11 1111 1111 1111;Overschrijving in uw voordeel;maand;BE00 0000 0000 0000
05/01/2026;-1400.00;1143.19;EUR;Vervaldag krediet - Echéance crédit;;Betaling kredietlasten;;BE00 0000 0000 0000
06/01/2026;180.50;1323.69;EUR;PARENTIA VLAANDEREN VZW;BE22 2222 2222 2222;Overschrijving in uw voordeel;/C/ Groeipakket - Gezinsbijslagen 12/2025;BE00 0000 0000 0000
07/01/2026;-36.08;1287.61;EUR;Doccle -Telenet BVBA   Mechelen;;eCommerce Mobile;Doccle -Telenet BVBA 07-01-2026 08:57 Mechelen 123456******8;BE00 0000 0000 0000
08/01/2026;-50.00;1237.61;EUR;;;Opneming Bancontact;;BE00 0000 0000 0000
09/01/2026;-25.00;1212.61;EUR;CHRISTELIJKE MUTUALITEIT;BE33 3333 3333 3333;Domiciliëring;lidgeld;BE00 0000 0000 0000
10/01/2026;-12.40;1200.21;EUR;Gemeentelijke Basisschool;BE44 4444 4444 4444;Overschrijving via Crelan Mobile;000/0000/00000;BE00 0000 0000 0000
`;

test('Crelan-export lezen', () => {
  const { bank, rows } = readBankCSV(CRELAN, { ownNames: ['Jan Peeters'] });
  assert.equal(bank, 'Crelan');
  assert.equal(rows.length, 10);
  const by = (d, a) => rows.find((r) => r.date === d && r.amount_cents === a);
  assert.deepEqual(pick(by('2026-01-03', 5712)), { type: 'uit', category: 'boodschappen', note: 'CRF MKT GENT' });
  assert.equal(by('2026-01-04', 835).category, 'boodschappen');
  assert.equal(by('2026-01-05', 170000).own, true);
  assert.deepEqual(pick(by('2026-01-05', 140000)), { type: 'uit', category: 'wonen', note: 'Afbetaling krediet' });
  assert.deepEqual(pick(by('2026-01-06', 18050)), { type: 'in', category: 'groeipakket', note: 'PARENTIA VLAANDEREN VZW' });
  assert.deepEqual(pick(by('2026-01-07', 3608)), { type: 'uit', category: 'abonnement', note: 'Telenet BVBA' });
  assert.equal(by('2026-01-08', 5000).cash, true);
  assert.equal(by('2026-01-10', 1240).category, 'kinderen');
  assert.equal(by('2026-01-02', 15).category, 'andere');
});

const pick = (r) => ({ type: r.type, category: r.category, note: r.note });

test('andere bank met komma-bedragen', () => {
  const csv = 'Boekingsdatum;Bedrag;Naam tegenpartij bevat;Mededelingen\n"15/02/2026";"-1.234,56";"IKEA GENT";"kast"\n16/02/2026;"2.000,00";"Werkgever NV";"loon februari"\n';
  const { rows } = readBankCSV(csv);
  assert.deepEqual(rows.map((r) => [r.date, r.type, r.amount_cents, r.category]), [['2026-02-16', 'in', 200000, 'loon'], ['2026-02-15', 'uit', 123456, 'wonen']]);
});

test('dubbels overslaan', () => {
  const rows = [{ date: '2026-01-03', amount_cents: 500, type: 'uit' }, { date: '2026-01-03', amount_cents: 500, type: 'uit' }, { date: '2026-01-04', amount_cents: 500, type: 'uit' }];
  const r = markDuplicates(rows, [{ date: '2026-01-03', amount_cents: 500, type: 'uit' }]);
  assert.deepEqual(r.map((x) => x.dup), [true, false, false]);
});

test('bedragen en namen', () => {
  assert.equal(parseBankAmount('-0.02'), -2);
  assert.equal(parseBankAmount('1.234,56'), 123456);
  assert.equal(parseBankAmount('€ 12,5'), 1250);
  assert.equal(cleanName('RAES PAULINE    P2P MOBILE'), 'RAES PAULINE');
  assert.equal(cleanName('Mevr. Ellen Peeters'), 'Ellen Peeters');
});

test('onbekend bestand geeft uitleg', () => {
  assert.throws(() => readBankCSV('a;b\n1;2'), /herken dit bestand niet/);
});

test('cash gebruikt geen dubbel-match op', () => {
  const rows = [{ date: 'd', amount_cents: 800, type: 'in', cash: true }, { date: 'd', amount_cents: 800, type: 'in' }];
  assert.deepEqual(markDuplicates(rows, [{ date: 'd', amount_cents: 800, type: 'in' }]).map((x) => x.dup), [false, true]);
});

test('opnieuw hetzelfde bestand importeren geeft geen dubbels', () => {
  const { rows } = readBankCSV(CRELAN, { ownNames: ['Jan Peeters'] });
  const first = markDuplicates(rows, []).filter((r) => !r.own && !r.cash);
  const saved = first.map((r) => ({ date: r.date, amount_cents: r.amount_cents, type: r.type, note: r.note }));
  const again = markDuplicates(rows, saved);
  assert.equal(again.filter((r) => !r.dup && !r.maybe && !r.own && !r.cash).length, 0);
});

test('zelf ingesproken boeking een paar dagen eerder: staat er misschien al', () => {
  const rows = [{ date: '2026-01-05', amount_cents: 5712, type: 'uit', note: 'CRF MKT GENT' }];
  const r = markDuplicates(rows, [{ date: '2026-01-03', amount_cents: 5712, type: 'uit', note: 'boodschappen' }]);
  assert.equal(r[0].dup, false);
  assert.deepEqual(r[0].maybe, { date: '2026-01-03', note: 'boodschappen' });
});

test('te ver uit elkaar of ander bedrag: gewoon nieuw', () => {
  const rows = [{ date: '2026-01-15', amount_cents: 5712, type: 'uit', note: 'X' }, { date: '2026-01-05', amount_cents: 5713, type: 'uit', note: 'Y' }];
  const r = markDuplicates(rows, [{ date: '2026-01-03', amount_cents: 5712, type: 'uit', note: 'z' }]);
  assert.deepEqual(r.map((x) => [x.dup, x.maybe]), [[false, null], [false, null]]);
});

test('elke dag hetzelfde brood is geen dubbel', () => {
  const rows = [{ date: '2026-01-06', amount_cents: 240, type: 'uit', note: 'Bakkerij Jan' }];
  const r = markDuplicates(rows, [{ date: '2026-01-05', amount_cents: 240, type: 'uit', note: 'Bakkerij Jan' }]);
  assert.equal(r[0].maybe, null);
});

test('één ingegeven boeking telt maar voor één bankregel', () => {
  const rows = [{ date: '2026-01-05', amount_cents: 1000, type: 'uit', note: 'A' }, { date: '2026-01-06', amount_cents: 1000, type: 'uit', note: 'B' }];
  const r = markDuplicates(rows, [{ date: '2026-01-05', amount_cents: 1000, type: 'uit', note: 'zelf' }]);
  assert.deepEqual(r.map((x) => [x.dup, Boolean(x.maybe)]), [[true, false], [false, false]]);
});

test('datum verschuiven over de maandgrens', () => {
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('2026-12-31', 2), '2027-01-02');
});
