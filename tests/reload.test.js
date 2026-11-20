import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChunkError } from '../src/lib/reload.js';

test('herkent een scherm van een oude versie dat niet meer laadt', () => {
  assert.ok(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/PantryPhoto-Bye7c9aV.js')));
  assert.ok(isChunkError(new TypeError('Importing a module script failed.')));
  assert.ok(isChunkError(new Error('error loading dynamically imported module')));
  assert.ok(!isChunkError(new Error('Cannot read properties of undefined')));
});
