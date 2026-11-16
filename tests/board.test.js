import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardDayTitle, nowTime, pickDayForIdle, sizedPhoto } from '../src/lib/board.js';

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
