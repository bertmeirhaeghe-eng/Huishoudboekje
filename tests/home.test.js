import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, findFutureDate, findTime } from '../src/lib/commands.js';
import { sameThing, parseIngredient, parseRecipeText, checkIngredients, aisle, mondayOf, shoppingForWeek, weekDays, mealFor, mealsOn } from '../src/lib/kitchen.js';
import { adviseFor } from '../src/lib/advice.js';

const T = '2026-11-15'; // zondag
const opts = { today: T, recipes: [{ id: 'r1', title: 'Spaghetti bolognese' }, { id: 'r2', title: 'Lasagne' }], members: ['Bert', 'Lotte'] };
const cmd = (t) => parseCommand(t, opts);

test('boodschappenlijst', () => {
  assert.deepEqual(cmd('Zet melk en eieren op de lijst').items.map((i) => i.name), ['melk', 'eieren']);
  const r = cmd('2 liter melk, brood en wc-papier op de boodschappenlijst');
  assert.equal(r.kind, 'lijst');
  assert.deepEqual(r.items, [{ name: 'melk', qty: '2 liter' }, { name: 'brood', qty: null }, { name: 'wc-papier', qty: null }]);
  assert.deepEqual(cmd('We moeten nog tandpasta kopen').items.map((i) => i.name), ['tandpasta']);
});

test('iets is op', () => {
  assert.deepEqual(cmd('De melk is op'), { kind: 'voorraad', status: 'op', items: [{ name: 'melk', qty: null }], text: 'De melk is op' });
  assert.equal(cmd('We hebben geen eieren meer').items[0].name, 'eieren');
  assert.equal(cmd('De koffie is bijna op').status, 'bijna');
});

test('weekmenu', () => {
  assert.deepEqual(cmd('Maandag eten we spaghetti'), { kind: 'menu', date: '2026-11-16', slot: 'avond', meal: 'Spaghetti bolognese', recipe_id: 'r1', text: 'Maandag eten we spaghetti' });
  assert.equal(cmd('Zet lasagne op het menu voor vrijdag').date, '2026-11-20');
  assert.equal(cmd('Morgen soep op het menu').meal, 'Soep');
  assert.equal(cmd('Vanavond eten we frietjes').date, T);
  const m = cmd("Woensdag 's middags eten we soep");
  assert.deepEqual([m.slot, m.meal, m.date], ['middag', 'Soep', '2026-11-18']);
  assert.equal(cmd('Zet croques op het menu voor zaterdag als middageten').slot, 'middag');
  assert.equal(cmd('Morgen lunch: pasta salade op het menu').meal, 'Pasta salade');
  assert.equal(cmd('Vrijdag eten we vis').slot, 'avond');
});

test('weekmenu met middag en avond', () => {
  const menu = [{ date: '2026-11-18', meal: 'Soep', slot: 'middag' }, { date: '2026-11-18', meal: 'Stoofvlees' }];
  assert.deepEqual(mealsOn(menu, '2026-11-18').map((m) => m.meal), ['Soep', 'Stoofvlees']);
  assert.equal(mealFor(menu, '2026-11-18', 'avond').meal, 'Stoofvlees');
  assert.equal(mealFor(menu, '2026-11-19', 'middag'), null);
});

test('agenda', () => {
  const z = cmd('Zaterdag om 10 uur zwemles voor Lotte');
  assert.deepEqual([z.kind, z.title, z.date, z.time, z.who], ['agenda', 'Zwemles', '2026-11-21', '10:00', 'Lotte']);
  const t = cmd('Afspraak bij de tandarts op 3 december om 9u30');
  assert.deepEqual([t.title, t.date, t.time], ['Tandarts', '2026-12-03', '09:30']);
  assert.equal(cmd('Om half 3 kapper').time, '14:30');
  assert.equal(cmd("Morgen om 8 uur 's avonds vergadering").time, '20:00');
  assert.equal(cmd('Zet in de agenda: verjaardag oma zondag').title, 'Verjaardag oma');
});

test('geld blijft geld', () => {
  assert.equal(cmd('25 euro tanken').kind, 'geld');
  assert.equal(cmd('Gisteren 64,30 bij Delhaize').items[0].amount_cents, 6430);
  assert.equal(cmd('Laptop gekocht voor 900 euro op de zaak').kind, 'geld');
});

test('datums en uren', () => {
  assert.equal(findFutureDate('volgende week dinsdag', '2026-11-18').date, '2026-11-24');
  assert.equal(findFutureDate('3 januari', T).date, '2027-01-03');
  assert.equal(findFutureDate('overmorgen', T).date, '2026-11-17');
  assert.equal(findTime('om kwart voor 8 ochtend').time, '07:45');
  assert.equal(findTime('om 14:15').time, '14:15');
});

test('zelfde product herkennen', () => {
  assert.ok(sameThing('tomaten', 'tomaat'));
  assert.ok(sameThing('rode ui', 'uien'));
  assert.ok(sameThing('olie', 'olijfolie'));
  assert.ok(sameThing('eieren', 'ei'));
  assert.ok(sameThing('2 teentjes knoflook', 'look'));
  assert.ok(!sameThing('bloem', 'bloemkool'));
  assert.ok(!sameThing('rijst', 'spaghetti'));
});

test('ingrediënt lezen', () => {
  assert.deepEqual(parseIngredient('200 g bloem, gezeefd'), { qty: '200 g', name: 'bloem', note: 'gezeefd' });
  assert.deepEqual(parseIngredient('- 2 teentjes knoflook'), { qty: '2 teentjes', name: 'knoflook', note: null });
  assert.deepEqual(parseIngredient('Parmezaan naar smaak'), { qty: null, name: 'parmezaan', note: 'naar smaak' });
});

test('recept uit tekst', () => {
  const r = parseRecipeText(`SPAGHETTI BOLOGNESE
Voor 4 personen
Bereidingstijd 40 min
Ingrediënten
400 g spaghetti
500 g gehakt
1 ui
2 teentjes look
1 blik tomatenblokjes
zout en peper
Bereiding
1. Fruit de ui en de look in wat olie.
2. Voeg het gehakt toe en bak het rul. Doe er de
tomaten bij en laat 20 minuten sudderen.
3. Kook de spaghetti.`);
  assert.equal(r.title, 'Spaghetti bolognese');
  assert.equal(r.servings, 4);
  assert.deepEqual(r.ingredients.map((i) => i.name), ['spaghetti', 'gehakt', 'ui', 'look', 'tomatenblokjes', 'zout', 'peper']);
  assert.equal(r.steps.split('\n').length, 3);
  assert.match(r.steps.split('\n')[1], /rul\. Doe er de tomaten bij/);
});

test('recept zonder koppen', () => {
  const r = parseRecipeText('Pannenkoeken\n250 g bloem\n3 eieren\n½ l melk\nMeng de bloem met de eieren en voeg beetje bij beetje de melk toe.');
  assert.equal(r.title, 'Pannenkoeken');
  assert.deepEqual(r.ingredients.map((i) => i.name), ['bloem', 'eieren', 'melk']);
  assert.match(r.steps, /^Meng/);
});

test('recept tegen voorraad', () => {
  const pantry = [{ name: 'Spaghetti', status: 'ok' }, { name: 'Ui', status: 'bijna' }, { name: 'Gehakt', status: 'op' }];
  const shopping = [{ name: 'tomatenblokjes', done: false }];
  const r = checkIngredients([{ name: 'spaghetti' }, { name: 'rode ui' }, { name: 'gehakt' }, { name: 'tomatenblokjes' }, { name: 'water' }, { name: 'basilicum' }], pantry, shopping);
  assert.deepEqual(r.map((x) => x.state), ['heb', 'bijna', 'kopen', 'op-lijst', 'heb', 'kopen']);
});

test('boodschappen voor de week', () => {
  const days = weekDays(mondayOf(T));
  assert.equal(days[0], '2026-11-09');
  const recipes = [{ id: 'a', title: 'Pasta', ingredients: [{ name: 'spaghetti' }, { name: 'tomaten' }] }, { id: 'b', title: 'Soep', ingredients: [{ name: 'tomaat' }, { name: 'ui' }] }];
  const menu = [{ date: '2026-11-10', recipe_id: 'a' }, { date: '2026-11-12', recipe_id: 'b' }];
  const out = shoppingForWeek(days, menu, recipes, [{ name: 'spaghetti', status: 'ok' }], []);
  assert.deepEqual(out.map((o) => [o.name, o.sources.length]), [['tomaten', 2], ['ui', 1]]);
});

test('rayons', () => {
  assert.deepEqual(['melk', 'tomaten', 'spaghetti', 'wc-papier', 'kipfilet', 'iets raars'].map(aisle), ['Zuivel & eieren', 'Groenten & fruit', 'Voorraadkast', 'Huishouden & verzorging', 'Vlees & vis', 'Andere']);
});

test('privé of zaak', () => {
  assert.equal(adviseFor('nieuwe laptop').verdict, 'zaak');
  assert.equal(adviseFor('restaurant met een klant').verdict, 'deels');
  assert.equal(adviseFor('jeans en een trui').verdict, 'prive');
  assert.equal(adviseFor('koksvest').verdict, 'zaak');
  assert.equal(adviseFor('iets helemaal onbekends').verdict, 'twijfel');
});

test('lastige namen', () => {
  assert.equal(parseIngredient('olijfolie').name, 'olijfolie');
  assert.ok(sameThing('gehakt', '500 g gehakt'));
  assert.ok(!sameThing('gehakt', 'ui'));
});

test('look is geen tomatenblokjes', () => {
  assert.ok(!sameThing('look', 'tomatenblokjes'));
  assert.ok(sameThing('look', 'knoflook'));
});
