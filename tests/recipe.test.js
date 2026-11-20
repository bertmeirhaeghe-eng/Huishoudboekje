import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleQty, scaleIngredients } from '../src/lib/kitchen.js';
import { fromAiRecipe } from '../src/lib/ai.js';

test('personen: hoeveelheden omrekenen', () => {
  assert.equal(scaleQty('200 g', 1.5), '300 g');
  assert.equal(scaleQty('250g', 1.5), '375g');
  assert.equal(scaleQty('2', 0.5), '1');
  assert.equal(scaleQty('3', 1 / 3), '1');
  assert.equal(scaleQty('1,5 dl', 2), '3 dl');
  assert.equal(scaleQty('½ l', 2), '1 l');
  assert.equal(scaleQty('0,5 l', 1.5), '0,75 l');
  assert.equal(scaleQty('1/4 tl', 2), '½ tl');
  assert.equal(scaleQty('1 1/2 kop', 2), '3 kop');
  assert.equal(scaleQty('2-3 el', 2), '4-6 el');
  assert.equal(scaleQty('anderhalve kg', 2), '3 kg');
  assert.equal(scaleQty('1 ui', 0.5), '½ ui');
});

test('personen: eenheden in enkelvoud of meervoud', () => {
  assert.equal(scaleQty('1 teentje', 2), '2 teentjes');
  assert.equal(scaleQty('2 teentjes', 0.5), '1 teentje');
  assert.equal(scaleQty('1 stuk', 3), '3 stuks');
});

test('personen: zonder getal blijft het zoals het is', () => {
  assert.equal(scaleQty('snufje', 2), 'snufje');
  assert.equal(scaleQty('naar smaak', 2), 'naar smaak');
  assert.equal(scaleQty(null, 2), null);
  assert.equal(scaleQty('200 g', 1), '200 g');
});

test('personen: hele lijst van 4 naar 6', () => {
  const out = scaleIngredients([{ qty: '400 g', name: 'spaghetti' }, { qty: null, name: 'zout' }, { qty: '2', name: 'uien', note: 'gesnipperd' }], 4, 6);
  assert.deepEqual(out, [{ qty: '600 g', name: 'spaghetti' }, { qty: null, name: 'zout' }, { qty: '3', name: 'uien', note: 'gesnipperd' }]);
  assert.equal(scaleIngredients([{ qty: '1 el', name: 'olie' }], null, 6)[0].qty, '1 el');
});

test('AI-recept: antwoord netjes omzetten', () => {
  const r = fromAiRecipe({
    titel: 'Spaghetti bolognese.',
    personen: 4,
    ingredienten: [{ hoeveelheid: '400 g', naam: 'Spaghetti', opmerking: '' }, { hoeveelheid: '', naam: 'zout', opmerking: 'naar smaak' }, { hoeveelheid: '1', naam: '', opmerking: '' }],
    stappen: ['1. Kook de pasta.', 'Maak de saus.', ''],
    bron: 'Gemini',
  });
  assert.deepEqual(r, {
    title: 'Spaghetti bolognese',
    servings: 4,
    ingredients: [{ qty: '400 g', name: 'spaghetti', note: null }, { qty: null, name: 'zout', note: 'naar smaak' }],
    steps: 'Kook de pasta.\nMaak de saus.',
    bron: 'Gemini',
  });
});

test('AI-recept: geen personen of leeg antwoord', () => {
  assert.equal(fromAiRecipe({ titel: 'X', personen: 0, ingredienten: [{ naam: 'ei' }], stappen: [] }).servings, null);
  assert.equal(fromAiRecipe({ titel: '', personen: 0, ingredienten: [], stappen: [] }), null);
  assert.equal(fromAiRecipe(null), null);
});
