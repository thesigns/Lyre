// Melodies: data format, learning progress and listen playback, see docs/Lyre.md 9.

import { STRING_COUNT, parseRatio } from './tuning.js';

// Pluck position (from the bridge) for notes that do not set one.
export const DEFAULT_POSITION = 0.3;

// Converts a melody from the JSON format (strings numbered 1..7, lowest first)
// into the form the app uses (0-based strings, numeric ratios). Throws on bad data.
export function normalizeMelody(raw) {
  const fail = (msg) => {
    throw new Error(`melody "${raw && raw.id}": ${msg}`);
  };
  if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string') fail('missing id or title');
  const tuning = raw.tuning || {};
  if (!Number.isInteger(tuning.lowestNote)) fail('tuning.lowestNote must be a MIDI note number');
  if (!Array.isArray(tuning.ratios) || tuning.ratios.length !== STRING_COUNT) fail(`tuning needs ${STRING_COUNT} ratios`);
  const ratios = tuning.ratios.map(parseRatio);
  if (ratios.some((r, i) => !(r > 0) || (i > 0 && r <= ratios[i - 1]))) fail('ratios must be positive and rising');
  if (!(raw.tempo > 0)) fail('tempo must be positive');
  if (!Array.isArray(raw.notes) || raw.notes.length === 0) fail('no notes');
  const notes = raw.notes.map((n, i) => {
    if (!Number.isInteger(n.string) || n.string < 1 || n.string > STRING_COUNT) fail(`note ${i}: bad string`);
    if (!(n.length > 0)) fail(`note ${i}: bad length`);
    const position = n.position === undefined ? DEFAULT_POSITION : n.position;
    if (!(position >= 0 && position <= 1)) fail(`note ${i}: position must be 0..1`);
    return { string: n.string - 1, length: n.length, position };
  });
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description || '',
    lowestNote: tuning.lowestNote,
    ratios,
    tempo: raw.tempo, // length units per minute
    notes,
  };
}

// Learning mode: waits for the right string, without time pressure (9.1).
export class Lesson {
  constructor(melody) {
    this.melody = melody;
    this.index = 0;
  }

  get finished() {
    return this.index >= this.melody.notes.length;
  }

  current() {
    return this.melody.notes[this.index] || null;
  }

  next() {
    return this.melody.notes[this.index + 1] || null;
  }

  // Any pluck of the expected string counts, wherever it lands. Returns true if it advanced.
  pluck(string) {
    const note = this.current();
    if (!note || note.string !== string) return false;
    this.index++;
    return true;
  }

  restart() {
    this.index = 0;
  }
}

// Start time of every note in seconds from the beginning.
export function noteTimes(melody) {
  const unit = 60 / melody.tempo;
  let t = 0;
  return melody.notes.map((n) => {
    const start = t;
    t += n.length * unit;
    return start;
  });
}

// Plays a melody through the engine with a small lookahead, so that it can be stopped
// at any time. onNote(index) fires when a note sounds; onEnd() after the last one.
export class MelodyPlayer {
  constructor(engine, { onNote, onEnd, amp = 0.6 }) {
    this.engine = engine;
    this.onNote = onNote;
    this.onEnd = onEnd;
    this.amp = amp;
    this.timer = 0;
    this.timeouts = [];
  }

  get playing() {
    return this.timer !== 0;
  }

  start(melody) {
    this.stop();
    this.melody = melody;
    this.times = noteTimes(melody);
    this.next = 0;
    this.startTime = this.engine.currentTime + 0.15;
    const last = melody.notes.length - 1;
    this.endTime = this.startTime + this.times[last] + melody.notes[last].length * (60 / melody.tempo);
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }

  pump() {
    const now = this.engine.currentTime;
    const notes = this.melody.notes;
    while (this.next < notes.length && this.startTime + this.times[this.next] < now + 0.1) {
      const i = this.next++;
      const when = this.startTime + this.times[i];
      this.engine.pluck(notes[i].string, when, this.amp, notes[i].position);
      const id = setTimeout(() => this.onNote(i), Math.max(0, (when - now) * 1000));
      this.timeouts.push(id);
    }
    if (this.next >= notes.length && now >= this.endTime) {
      this.stop();
      this.onEnd();
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts = [];
  }
}
