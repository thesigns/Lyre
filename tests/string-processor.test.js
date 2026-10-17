import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E3, frequencies, scaleRatios } from '../js/tuning.js';

// Minimal AudioWorkletGlobalScope so the processor can run offline.
let Processor = null;
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { onmessage: null };
  }
};
globalThis.registerProcessor = (name, cls) => {
  Processor = cls;
};

async function load(rate) {
  globalThis.sampleRate = rate;
  globalThis.currentTime = 0;
  await import(`../js/audio/string-processor.js?rate=${rate}`);
  return Processor;
}

function render(proc, rate, seconds) {
  const frames = Math.round(rate * seconds / 128) * 128;
  const out = new Float32Array(frames);
  const block = [[new Float32Array(128)]];
  for (let i = 0; i < frames; i += 128) {
    globalThis.currentTime = i / rate;
    proc.process([], block);
    out.set(block[0][0], i);
  }
  return out;
}

function send(proc, msg) {
  proc.port.onmessage({ data: msg });
}

// Fundamental by autocorrelation with parabolic interpolation, searched near the expected period.
function pitch(signal, rate, expected) {
  const start = Math.round(rate * 0.05);
  const n = Math.round(rate * 0.4);
  const p = rate / expected;
  const corr = (lag) => {
    let s = 0;
    for (let i = start; i < start + n; i++) s += signal[i] * signal[i + lag];
    return s;
  };
  let best = 0;
  let bestLag = 0;
  for (let lag = Math.floor(p * 0.9); lag <= Math.ceil(p * 1.1); lag++) {
    const c = corr(lag);
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  const a = corr(bestLag - 1);
  const b = best;
  const c = corr(bestLag + 1);
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return rate / (bestLag + shift);
}

const cents = (f, ref) => 1200 * Math.log2(f / ref);

for (const rate of [44100, 48000]) {
  test(`strings are in tune at ${rate} Hz`, async () => {
    const Cls = await load(rate);
    const freqs = frequencies(E3, scaleRatios('diatonic-pythagorean', 'heptachord'));
    for (let s = 0; s < freqs.length; s++) {
      const proc = new Cls();
      send(proc, {
        type: 'tune',
        strings: freqs.map((freq) => ({ freq, t60: 3 })),
        fadeT60: 0.08,
      });
      send(proc, { type: 'pluck', string: s, when: 0, amp: 0.8, position: 0.2 });
      const f = pitch(render(proc, rate, 0.5), rate, freqs[s]);
      assert.ok(Math.abs(cents(f, freqs[s])) < 3, `string ${s}: ${f.toFixed(2)} Hz vs ${freqs[s].toFixed(2)} Hz`);
    }
  });
}

test('retuning applies from the next pluck of a ringing string', async () => {
  const rate = 48000;
  const Cls = await load(rate);
  const proc = new Cls();
  const tune = (freq) => send(proc, { type: 'tune', strings: Array(7).fill({ freq, t60: 3 }), fadeT60: 0.08 });
  tune(220);
  send(proc, { type: 'pluck', string: 0, when: 0, amp: 1, position: 0.2 });
  render(proc, rate, 0.2);
  tune(330);
  assert.ok(Math.abs(cents(pitch(render(proc, rate, 0.5), rate, 220), 220)) < 3, 'still the old pitch');
  send(proc, { type: 'pluck', string: 0, when: 0, amp: 1, position: 0.2 });
  assert.ok(Math.abs(cents(pitch(render(proc, rate, 0.5), rate, 330), 330)) < 3, 'new pitch after pluck');
});

test('scales have seven notes and the expected spans', () => {
  const hepta = scaleRatios('diatonic-pythagorean', 'heptachord');
  assert.equal(hepta.length, 7);
  assert.ok(Math.abs(hepta[3] - 4 / 3) < 1e-12);
  assert.ok(Math.abs(hepta[6] - 16 / 9) < 1e-12);
  for (const genus of ['diatonic-archytas', 'chromatic-archytas', 'enharmonic-archytas']) {
    assert.ok(Math.abs(scaleRatios(genus, 'heptachord')[3] - 4 / 3) < 1e-12, genus);
  }
  // Dorian octave species without its top note: the octave is one more step (9/8) up.
  const dorian = scaleRatios('diatonic-pythagorean', 'dorian');
  assert.ok(Math.abs(dorian[6] * (9 / 8) - 2) < 1e-12);
  const phrygian = scaleRatios('diatonic-pythagorean', 'phrygian');
  assert.ok(Math.abs(phrygian[1] - 9 / 8) < 1e-12);
});
