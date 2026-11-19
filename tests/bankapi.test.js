import test from 'node:test';
import assert from 'node:assert/strict';
import { readBankApi, apiClosing, markDuplicates } from '../src/lib/bankimport.js';

// Verzonnen verrichtingen in het formaat van Enable Banking (PSD2).
const TX = [
  { entry_reference: 'a1', status: 'BOOK', transaction_amount: { amount: '57.12', currency: 'EUR' }, credit_debit_indicator: 'DBIT', booking_date: '2026-01-03', creditor: null, remittance_information: ['CRF MKT GENT 03-01-2026 10:38 GENT BE 123456******837'], bank_transaction_code: { description: 'Betaling Bancontact contactless' }, balance_after_transaction: { amount: '851.54', currency: 'EUR' } },
  { entry_reference: 'a2', status: 'BOOK', transaction_amount: { amount: '1700.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', booking_date: '2026-01-05', debtor: { name: 'Jan Peeters' }, remittance_information: ['maand'], bank_transaction_code: { description: 'Overschrijving in uw voordeel' }, balance_after_transaction: { amount: '2543.19', currency: 'EUR' } },
  { entry_reference: 'a2', status: 'BOOK', transaction_amount: { amount: '1700.00', currency: 'EUR' }, credit_debit_indicator: 'CRDT', booking_date: '2026-01-05', debtor: { name: 'Jan Peeters' } },
  { entry_reference: 'a3', status: 'BOOK', transaction_amount: { amount: '180.50', currency: 'EUR' }, credit_debit_indicator: 'CRDT', booking_date: '2026-01-06', debtor: { name: 'PARENTIA VLAANDEREN VZW' }, remittance_information: ['/C/ Groeipakket - Gezinsbijslagen 12/2025'], balance_after_transaction: { amount: '2723.69', currency: 'EUR' } },
  { entry_reference: 'a4', status: 'BOOK', transaction_amount: { amount: '50.00', currency: 'EUR' }, credit_debit_indicator: 'DBIT', booking_date: '2026-01-08', bank_transaction_code: { description: 'Opneming Bancontact' }, balance_after_transaction: { amount: '2673.69', currency: 'EUR' } },
  { entry_reference: 'p1', status: 'PDNG', transaction_amount: { amount: '9.99', currency: 'EUR' }, credit_debit_indicator: 'DBIT', booking_date: '2026-01-09', creditor: { name: 'Spotify' } },
];

test('verrichtingen van de bank lezen zoals een CSV', () => {
  const rows = readBankApi(TX, { ownNames: ['Jan Peeters'] });
  assert.equal(rows.length, 4, 'dubbele referentie en nog niet geboekte verrichting vallen weg');
  const by = (d) => rows.find((r) => r.date === d);
  assert.deepEqual([by('2026-01-03').type, by('2026-01-03').amount_cents, by('2026-01-03').category, by('2026-01-03').note], ['uit', 5712, 'boodschappen', 'CRF MKT GENT']);
  assert.equal(by('2026-01-05').own, true);
  assert.deepEqual([by('2026-01-06').type, by('2026-01-06').category], ['in', 'groeipakket']);
  assert.equal(by('2026-01-08').cash, true);
});

test('wat al via een CSV-bestand binnenkwam, wordt overgeslagen', () => {
  const rows = readBankApi(TX);
  const existing = [{ date: '2026-01-03', type: 'uit', amount_cents: 5712, note: 'CRF MKT GENT', book: 'gezin' }];
  const marked = markDuplicates(rows, existing);
  assert.equal(marked.find((r) => r.date === '2026-01-03').dup, true);
  assert.equal(marked.filter((r) => r.dup).length, 1);
});

test('rekeningstand: saldo na verrichting, anders het geboekte saldo', () => {
  const rows = readBankApi(TX);
  assert.deepEqual(apiClosing(rows, []), { date: '2026-01-08', amount_cents: 267369 });
  const bare = readBankApi(TX.map(({ balance_after_transaction, ...t }) => t));
  const balances = [
    { balance_type: 'ITAV', balance_amount: { amount: '3000.00' } },
    { balance_type: 'CLBD', balance_amount: { amount: '2673.69' }, reference_date: '2026-01-08' },
  ];
  assert.deepEqual(apiClosing(bare, balances), { date: '2026-01-08', amount_cents: 267369 });
  assert.deepEqual(apiClosing(bare, [{ balance_type: 'ITBD', balance_amount: { amount: '-12.50' } }]), { date: '2026-01-08', amount_cents: -1250 });
  assert.equal(apiClosing(bare, [{ balance_type: 'ITAV', balance_amount: { amount: '1.00' } }]), null);
});
