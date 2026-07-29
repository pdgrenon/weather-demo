import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vitePkg = require('vite/package.json');

test('vite version is 8.x', () => {
  assert.match(vitePkg.version, /^8\./);
});
