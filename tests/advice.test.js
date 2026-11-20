import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromAi, adviseFor } from '../src/lib/advice.js';

test('AI-antwoord wordt netjes gemaakt', () => {
  const t = fromAi({ verdict: 'deels', pct: 50.4, btw: true, cat: 'bbq_materiaal', title: ' Buitenkeuken ', why: 'Staat in je eigen tuin.', tips: ['a', 'a', 'b', 'c', 'd'], bron: 'Gemini' });
  assert.equal(t.ai, true);
  assert.equal(t.verdict, 'deels');
  assert.equal(t.pct, 50);
  assert.equal(t.title, 'Buitenkeuken');
  assert.deepEqual(t.tips, ['a', 'b', 'c']);
  assert.equal(t.bron, 'Gemini');
});

test('AI-antwoord: rare waarden worden veilig', () => {
  assert.equal(fromAi(null), null);
  assert.equal(fromAi({ verdict: 'misschien', why: 'x' }), null);
  assert.equal(fromAi({ verdict: 'zaak', why: '' }), null);
  const auto = fromAi({ verdict: 'deels', pct: -1, btw: true, cat: 'raket', why: 'Hangt af van de wagen.' });
  assert.equal(auto.pct, null);
  assert.equal(auto.cat, 'andere_zaak');
  const prive = fromAi({ verdict: 'prive', pct: 80, btw: true, cat: 'it_materiaal', why: 'Privé.' });
  assert.equal(prive.pct, 0);
  assert.equal(prive.btw, false);
  assert.equal(fromAi({ verdict: 'twijfel', pct: 40, why: 'Hangt af.' }).pct, null);
});

test('vaste vuistregels blijven werken als terugval', () => {
  assert.equal(adviseFor('nieuwe laptop').id, 'it');
  assert.equal(adviseFor('buitenkeuken').id, 'algemeen');
});
