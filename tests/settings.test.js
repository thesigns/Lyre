import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, sanitize } from '../js/settings.js';

test('missing or broken storage gives the defaults', () => {
  assert.deepEqual(sanitize(null), DEFAULTS);
  assert.deepEqual(sanitize('nonsense'), DEFAULTS);
});

test('valid values are kept', () => {
  const s = {
    genus: 'enharmonic-archytas',
    scale: 'lydian',
    lowestNote: 57,
    leftHanded: true,
    volume: 0.4,
    showLatency: true,
  };
  assert.deepEqual(sanitize(s), s);
});

test('invalid values fall back to defaults one by one', () => {
  const s = sanitize({
    genus: 'toString',
    scale: 'ionian',
    lowestNote: 99,
    leftHanded: 'yes',
    volume: 3,
    showLatency: 1,
  });
  assert.deepEqual(s, DEFAULTS);
  assert.equal(sanitize({ lowestNote: 52.5 }).lowestNote, DEFAULTS.lowestNote);
});
