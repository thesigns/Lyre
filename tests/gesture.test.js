import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureTracker } from '../js/gesture.js';
import { computeLayout } from '../js/layout.js';

// 400 px wide: spacing ~50 px, strings at x ~ 50, 100, ... 350.
const layout = computeLayout(400, 800);
const X = layout.strings.map((s) => s.x);
const MID_Y = 400;

function tracker() {
  const t = new GestureTracker();
  t.setLayout(layout);
  return t;
}

// Moves a finger through xs (one segment per entry), 8 ms per segment.
function drag(t, xs, { id = 1, y = MID_Y, t0 = 0, dt = 8 } = {}) {
  t.down(id, xs[0], y, t0);
  const plucks = [];
  let time = t0;
  for (const x of xs.slice(1)) {
    time += dt;
    plucks.push(...t.move(id, [{ x, y, t: time }]));
  }
  t.up(id);
  return plucks;
}

const plucked = (plucks) => plucks.map((p) => p.string);

// Points every `step` px from a to b.
function path(a, b, step = 4) {
  const out = [];
  const n = Math.ceil(Math.abs(b - a) / step);
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

test('one huge segment across all strings plays all seven in order', () => {
  const ev = drag(tracker(), [10, 390]);
  assert.deepEqual(plucked(ev), [0, 1, 2, 3, 4, 5, 6]);
  const times = ev.map((e) => e.t);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.ok(times[6] > times[0], 'plucks are spread in time, not a chord');
});

test('fast sweep right to left plays all seven in reverse', () => {
  assert.deepEqual(plucked(drag(tracker(), [390, 300, 170, 10])), [6, 5, 4, 3, 2, 1, 0]);
});

test('slow sweep plays each string exactly once', () => {
  assert.deepEqual(plucked(drag(tracker(), path(10, 390, 2))), [0, 1, 2, 3, 4, 5, 6]);
});

test('sweep between strings plays only the strings crossed', () => {
  const from = (X[2] + X[3]) / 2;
  const to = (X[4] + X[5]) / 2;
  assert.deepEqual(plucked(drag(tracker(), path(from, to))), [3, 4]);
});

test('gesture started on a string plays that string too', () => {
  const ev = drag(tracker(), path(X[1], X[3] + 20));
  assert.deepEqual(plucked(ev), [1, 2, 3]);
});

test('pulling off a string plays it once, in either direction', () => {
  assert.deepEqual(plucked(drag(tracker(), [X[3], X[3] + 15])), [3]);
  assert.deepEqual(plucked(drag(tracker(), [X[3], X[3] - 15])), [3]);
});

test('touch without movement plays nothing', () => {
  assert.deepEqual(plucked(drag(tracker(), [X[2]])), []);
});

test('jitter on a string line plays at most once', () => {
  const x = X[2];
  const jitter = [x + 10, x - 1, x + 1, x - 1.5, x + 1, x - 1, x + 2, x - 1];
  assert.deepEqual(plucked(drag(tracker(), jitter)), [2]);
});

test('back and forth between two strings plays every pass', () => {
  const left = X[2] - 10;
  const right = X[3] + 10;
  const xs = [left, right, left, right, left];
  assert.deepEqual(plucked(drag(tracker(), xs)), [2, 3, 3, 2, 2, 3, 3, 2]);
});

test('direction change replays strings in the new order', () => {
  const xs = [...path(X[1], X[3] + 15), ...path(X[3] + 15, X[1] - 15)];
  assert.deepEqual(plucked(drag(tracker(), xs)), [1, 2, 3, 3, 2, 1]);
});

test('moving along a string plays nothing', () => {
  const t = tracker();
  t.down(1, X[4] + 15, 200, 0);
  const ev = [];
  for (let i = 1; i <= 40; i++) ev.push(...t.move(1, [{ x: X[4] + 15, y: 200 + i * 10, t: i * 8 }]));
  assert.deepEqual(plucked(ev), []);
});

test('crossing beyond the bridge does not pluck', () => {
  const ev = drag(tracker(), [10, 390], { y: layout.bottom + 20 });
  assert.deepEqual(plucked(ev), []);
});

test('pluck position is 0 at the bridge and 1 at the yoke', () => {
  const [low] = drag(tracker(), [X[0] - 20, X[0] + 20], { y: layout.bottom - 1 });
  const [high] = drag(tracker(), [X[0] - 20, X[0] + 20], { y: layout.top + 1 });
  assert.ok(low.position < 0.05);
  assert.ok(high.position > 0.95);
});

test('two fingers are tracked independently', () => {
  const t = tracker();
  t.down(1, X[0] - 20, MID_Y, 0);
  t.down(2, X[6] + 20, MID_Y, 0);
  const a = t.move(1, [{ x: X[1] + 20, y: MID_Y, t: 8 }]);
  const b = t.move(2, [{ x: X[5] - 20, y: MID_Y, t: 8 }]);
  assert.deepEqual(plucked(a), [0, 1]);
  assert.deepEqual(plucked(b), [6, 5]);
});
