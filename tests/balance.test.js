import test from 'node:test';
import assert from 'node:assert/strict';
import { accountBalance } from '../src/lib/stats.js';
import { closingBalance, readBankCSV } from '../src/lib/bankimport.js';

const e = (date, type, euro) => ({ date, type, amount_cents: Math.round(euro * 100) });

test('rekeningstand: stand van 17/11 plus alles van de dagen erna', () => {
  const entries = [
    e('2026-11-03', 'in', 2500), // vóór de stand: zit er al in
    e('2026-11-17', 'uit', 40), // dezelfde dag: zit er al in ('s avonds)
    e('2026-11-18', 'uit', 25.5),
    e('2026-11-18', 'in', 100),
    e('2026-11-25', 'uit', 1000), // in de toekomst gepland: nog niet
  ];
  const r = accountBalance({ as_of: '2026-11-17', amount_cents: 56953 }, entries, '2026-11-18');
  assert.equal(r.balance, 56953 - 2550 + 10000);
  assert.equal(r.count, 2);
  assert.equal(r.start, 56953);
});

test('rekeningstand: zonder stand geen berekening, negatieve stand mag', () => {
  assert.equal(accountBalance(null, []), null);
  assert.equal(accountBalance({ as_of: '2026-11-17', amount_cents: -1000 }, [e('2026-11-18', 'uit', 5)]).balance, -1500);
});

test('bankbestand: stand op het einde van de laatste dag', () => {
  const csv = `Datum;Bedrag;Saldo na verrichting;Munt;Tegenpartij;Rekening tegenpartij;Type verrichting;Mededeling;Rekening opdrachtgever
17/11/2026;-20.00;569.53;EUR;Bakker;;Betaling Bancontact;;BE00
17/11/2026;-10.47;589.53;EUR;Apotheek;;Betaling Bancontact;;BE00
16/11/2026;-5.00;600.00;EUR;Koffie;;Betaling Bancontact;;BE00`;
  assert.deepEqual(closingBalance(readBankCSV(csv).rows), { date: '2026-11-17', amount_cents: 56953 });
  // Ook als de bank de oudste verrichting eerst zet.
  const flipped = csv.split('\n');
  const rev = [flipped[0], ...flipped.slice(1).reverse()].join('\n');
  assert.deepEqual(closingBalance(readBankCSV(rev).rows), { date: '2026-11-17', amount_cents: 56953 });
});

test('bankbestand zonder saldo-kolom: geen stand', () => {
  const csv = `Datum;Bedrag;Omschrijving
17/11/2026;-20,00;Bakker`;
  assert.equal(closingBalance(readBankCSV(csv).rows), null);
});
