import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_POSITION, Lesson, normalizeMelody, noteTimes } from '../js/melody.js';

const data = JSON.parse(readFileSync(new URL('../melodies/melodies.json', import.meta.url), 'utf8'));
const melodies = data.melodies.map(normalizeMelody);
const seikilos = melodies.find((m) => m.id === 'seikilos');

test('every melody in melodies.json is valid and ids are unique', () => {
  assert.ok(melodies.length > 0);
  assert.equal(new Set(melodies.map((m) => m.id)).size, melodies.length);
});

test('Seikilos: eight bars of 6/8 using all seven strings', () => {
  const total = seikilos.notes.reduce((sum, n) => sum + n.length, 0);
  assert.equal(total, 8 * 6);
  assert.deepEqual([...new Set(seikilos.notes.map((n) => n.string))].sort(), [0, 1, 2, 3, 4, 5, 6]);
  // Strings E G A B C# D E: an octave from the lowest to the highest string.
  assert.equal(seikilos.ratios[6], 2);
  // Ends on the lowest string, the final E.
  assert.equal(seikilos.notes[seikilos.notes.length - 1].string, 0);
});

test('normalizing converts strings to 0-based and fills the default position', () => {
  const m = normalizeMelody({
    id: 't',
    title: 'T',
    tuning: { lowestNote: 52, ratios: ['1', '9/8', '4/3', '3/2', '27/16', '16/9', '2'] },
    tempo: 120,
    notes: [{ string: 1, length: 1 }, { string: 7, length: 2, position: 0.1 }],
  });
  assert.deepEqual(m.notes, [
    { string: 0, length: 1, position: DEFAULT_POSITION },
    { string: 6, length: 2, position: 0.1 },
  ]);
});

test('invalid melodies are rejected', () => {
  const base = {
    id: 'bad',
    title: 'Bad',
    tuning: { lowestNote: 52, ratios: ['1', '9/8', '4/3', '3/2', '27/16', '16/9', '2'] },
    tempo: 120,
    notes: [{ string: 1, length: 1 }],
  };
  assert.throws(() => normalizeMelody({ ...base, notes: [{ string: 8, length: 1 }] }));
  assert.throws(() => normalizeMelody({ ...base, notes: [{ string: 1, length: 0 }] }));
  assert.throws(() => normalizeMelody({ ...base, tuning: { lowestNote: 52, ratios: ['1', '2'] } }));
  assert.throws(() => normalizeMelody({ ...base, tempo: 0 }));
});

test('lesson waits for the right string and finishes after the last note', () => {
  const lesson = new Lesson(seikilos);
  assert.equal(lesson.current().string, 2);
  assert.equal(lesson.next().string, 6);
  assert.equal(lesson.pluck(5), false, 'a wrong string just plays');
  assert.equal(lesson.index, 0);
  for (const note of seikilos.notes) assert.equal(lesson.pluck(note.string), true);
  assert.ok(lesson.finished);
  assert.equal(lesson.current(), null);
  lesson.restart();
  assert.equal(lesson.index, 0);
});

test('note times follow lengths and tempo', () => {
  const times = noteTimes(seikilos);
  const unit = 60 / seikilos.tempo;
  assert.equal(times[0], 0);
  assert.ok(Math.abs(times[1] - unit) < 1e-9);
  assert.ok(Math.abs(times[2] - 3 * unit) < 1e-9);
});
