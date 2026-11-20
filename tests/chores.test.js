import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/lib/commands.js';
import { agendaState, choreDay, groupChores, needsAgenda, quickDates } from '../src/lib/chores.js';

const T = '2026-11-20'; // vrijdag
const cmd = (t) => parseCommand(t, { today: T, recipes: [], members: ['Bert'] });

test('klusje inspreken zonder datum', () => {
  const c = cmd('Klusje: lamp vervangen in de gang');
  assert.deepEqual([c.kind, c.title, c.date, c.time], ['klus', 'Lamp vervangen in de gang', null, null]);
  assert.equal(cmd('Zet dakgoot kuisen op de klusjeslijst').title, 'Dakgoot kuisen');
  assert.equal(cmd('nieuw klusje kraan in de badkamer lekt').title, 'Kraan in de badkamer lekt');
});

test('klusje inspreken met datum en uur', () => {
  const c = cmd('Klusje gras maaien op zaterdag');
  assert.deepEqual([c.kind, c.title, c.date, c.time], ['klus', 'Gras maaien', '2026-11-21', null]);
  const d = cmd('klusje volgende week dinsdag om 10 uur haag snoeien');
  assert.deepEqual([d.title, d.date, d.time], ['Haag snoeien', '2026-11-24', '10:00']);
});

test('klusjes storen de rest van de spraak niet', () => {
  assert.equal(cmd('Melk en eieren op de lijst').kind, 'lijst');
  assert.equal(cmd('Zaterdag om 10 uur zwemles').kind, 'agenda');
  assert.equal(cmd('25 euro tanken').kind, 'geld');
});

test('wanneer moet de agenda mee', () => {
  const zonder = { title: 'A', planned_date: null, gcal_event_id: null };
  const met = { title: 'A', planned_date: '2026-11-22', gcal_event_id: 'ev1' };
  assert.equal(needsAgenda(zonder, { planned_date: '2026-11-22' }), true); // datum erop
  assert.equal(needsAgenda(zonder, { title: 'B' }), false); // geen datum, niets in de agenda
  assert.equal(needsAgenda(met, { planned_date: '2026-11-23' }), true); // datum gewijzigd
  assert.equal(needsAgenda(met, { planned_date: null }), true); // datum weg: uit de agenda
  assert.equal(needsAgenda(met, { planned_date: '2026-11-22', title: 'A' }), false); // niets veranderd
  assert.equal(needsAgenda(met, { done: true }), true);
});

test('lijst ordenen', () => {
  const g = groupChores([
    { id: 1, title: 'a', planned_date: '2026-11-25', done: false },
    { id: 2, title: 'b', planned_date: '2026-11-18', done: false },
    { id: 3, title: 'c', planned_date: '2026-11-21', done: false },
    { id: 4, title: 'd', planned_date: null, done: false, created_at: '1' },
    { id: 5, title: 'e', planned_date: null, done: false, created_at: '2' },
    { id: 6, title: 'f', planned_date: null, done: true, done_at: 'x' },
  ], T);
  assert.deepEqual(g.late.map((c) => c.id), [2]);
  assert.deepEqual(g.planned.map((c) => c.id), [3, 1]);
  assert.deepEqual(g.later.map((c) => c.id), [5, 4]);
  assert.deepEqual(g.done.map((c) => c.id), [6]);
});

test('dagen tonen en snel kiezen', () => {
  assert.equal(choreDay('2026-11-20', T), 'Vandaag');
  assert.equal(choreDay('2026-11-21', T), 'Morgen');
  assert.equal(choreDay('2026-11-24', T), 'di 24 nov');
  assert.equal(choreDay('2027-01-04', T), 'ma 4 jan 2027');
  // Vrijdag: morgen = zaterdag, dus geen twee keer dezelfde dag.
  assert.deepEqual(quickDates(T).map((q) => [q.label, q.date]), [['Morgen', '2026-11-21'], ['Zondag', '2026-11-22'], ['Volgende week', '2026-11-23']]);
});

test('staat het in de agenda', () => {
  assert.equal(agendaState({ planned_date: null }, true), null);
  assert.equal(agendaState({ planned_date: '2026-11-22' }, false), 'niet-gekoppeld');
  assert.equal(agendaState({ planned_date: '2026-11-22', gcal_dirty: true, gcal_event_id: 'x' }, true), 'bezig');
  assert.equal(agendaState({ planned_date: '2026-11-22', gcal_dirty: false, gcal_event_id: 'x' }, true), 'ok');
});
