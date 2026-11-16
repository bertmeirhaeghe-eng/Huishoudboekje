import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardDayTitle, dayTimeline, nowTime, pickDayForIdle, sizedPhoto, stillComing } from '../src/lib/board.js';

test('weekbord: dagnamen en uur', () => {
  assert.equal(boardDayTitle('2026-11-16', '2026-11-16'), 'Vandaag');
  assert.equal(boardDayTitle('2026-11-17', '2026-11-16'), 'Morgen');
  assert.equal(boardDayTitle('2026-11-18', '2026-11-16'), 'Woensdag 18');
  assert.equal(boardDayTitle('2026-11-16', '2026-11-16', true), 'Maandag 16 november');
  assert.equal(nowTime(new Date(2026, 10, 16, 7, 5)), '07:05');
});

test('ruststand: na 20 uur al morgen', () => {
  assert.deepEqual(pickDayForIdle(new Date(2026, 10, 16, 19, 59)), { iso: '2026-11-16', label: 'Vandaag' });
  assert.deepEqual(pickDayForIdle(new Date(2026, 10, 30, 20, 0)), { iso: '2026-12-01', label: 'Morgen' });
});

test('fotogrootte', () => {
  assert.equal(sizedPhoto('https://lh3.googleusercontent.com/pw/AP1abc', 1920, 1200), 'https://lh3.googleusercontent.com/pw/AP1abc=w1920-h1200');
  assert.equal(sizedPhoto('https://lh3.googleusercontent.com/pw/AP1abc=w100-h100', 4000, 4000), 'https://lh3.googleusercontent.com/pw/AP1abc=w2560-h2560');
});

test('weekbord: alles chronologisch, maaltijden op hun uur', () => {
  const t = dayTimeline({ middag: { meal: 'Soep' }, avond: null }, [
    { id: 'a', title: 'Zwemles', time: '14:00' }, { id: 'b', title: 'Verjaardag', time: null }, { id: 'c', title: 'Tandarts', time: '08:30', endTime: '09:00' }, { id: 'd', title: 'Volley', time: '19:30' },
  ]);
  assert.deepEqual(t.map((x) => x.kind === 'meal' ? x.slot : x.title), ['Verjaardag', 'Tandarts', 'middag', 'Zwemles', 'avond', 'Volley']);
  assert.equal(t[2].meal.meal, 'Soep');
  assert.equal(t[4].meal, null);
  assert.deepEqual(stillComing(t, '13:30').map((x) => x.kind === 'meal' ? x.slot : x.title), ['Verjaardag', 'Zwemles', 'avond', 'Volley']);
});
