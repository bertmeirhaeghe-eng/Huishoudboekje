import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiCategoryRequest, applyAiCategories, chunks, fallbackCat, fromAiInsight, insightFacts, rowsForAi } from '../src/lib/ai.js';
import { analyze } from '../src/lib/insights.js';

const row = (i, extra = {}) => ({ i, type: 'uit', amount_cents: 1250, category: 'andere', note: `Winkel ${i}`, kind: 'Betaling Bancontact', ...extra });

test('enkel wat in "Andere" viel gaat naar de AI', () => {
  const rows = [row(0), row(1, { category: 'boodschappen' }), row(2, { dup: true }), row(3, { own: true }), row(4, { catBy: 'jij' }), row(5, { type: 'in', category: 'andere_in' })];
  assert.deepEqual(rowsForAi(rows, 'gezin').map((r) => r.i), [0, 5]);
  assert.equal(fallbackCat('zaak', 'uit'), 'andere_zaak');
  assert.equal(fallbackCat('zaak', 'in'), 'andere_zaak_in');
});

test('de vraag bevat geen rekeningnummers en wel de categorieën', () => {
  const req = aiCategoryRequest([row(7, { note: 'Jan Peeters BE68 5390 0754 7034 huur' })], 'gezin');
  assert.equal(req.items[0].id, 7);
  assert.ok(!/BE68/.test(req.items[0].text));
  assert.ok(req.cats.uit.some((c) => c.id === 'boodschappen'));
  assert.ok(req.cats.in.some((c) => c.id === 'loon'));
});

test('AI-antwoord toepassen: ongeldige of al gekozen categorieën blijven staan', () => {
  const rows = [row(0), row(1), row(2, { category: 'auto' }), row(3), row(4, { type: 'in', category: 'andere_in' })];
  const out = applyAiCategories(rows, [
    { id: 0, cat: 'boodschappen' },
    { id: 1, cat: 'bestaat_niet' },
    { id: 2, cat: 'kleding' },
    { id: 4, cat: 'boodschappen' }, // uitgave-categorie voor een inkomst: niet
  ], 'gezin');
  assert.equal(out[0].category, 'boodschappen');
  assert.equal(out[0].catBy, 'ai');
  assert.equal(out[1].category, 'andere');
  assert.equal(out[2].category, 'auto');
  assert.equal(out[3], rows[3]);
  assert.equal(out[4].category, 'andere_in');
});

test('in stukjes', () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('cijfers voor de inzichten', () => {
  const e = (date, category, euro, type = 'uit', note = '') => ({ date, category, amount_cents: euro * 100, type, book: 'gezin', note });
  const entries = [e('2026-09-01', 'loon', 3000, 'in'), e('2026-09-03', 'boodschappen', 120), e('2026-10-01', 'loon', 3000, 'in'), e('2026-10-03', 'boodschappen', 150), e('2026-10-08', 'uit_eten', 80, 'uit', 'Pizzeria')];
  const a = analyze({ entries, scope: 'maand', month: '2026-10', today: '2026-10', todayDate: '2026-10-31' });
  const facts = insightFacts(a, 'gezin');
  assert.match(facts, /Boekje: gezin/);
  assert.match(facts, /Boodschappen/);
  assert.match(facts, /Pizzeria/);
});

test('AI-inzichten netjes maken', () => {
  assert.equal(fromAiInsight(null), null);
  assert.equal(fromAiInsight({ samenvatting: '', tips: [] }), null);
  const r = fromAiInsight({ samenvatting: 'Goed bezig.', tips: [{ titel: 'Minder resto', tekst: 'Je at 3 keer buiten.', toon: 'raar' }, { titel: '', tekst: 'x' }], bron: 'Gemini' });
  assert.equal(r.summary, 'Goed bezig.');
  assert.equal(r.tips.length, 1);
  assert.equal(r.tips[0].tone, 'info');
  assert.equal(r.bron, 'Gemini');
});
