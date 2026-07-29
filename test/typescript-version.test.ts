import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

test('typescript version is 7.x', () => {
  assert.match(ts.version, /^7\./);
});
