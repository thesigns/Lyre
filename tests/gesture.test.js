import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureTracker } from '../js/gesture.js';
import { computeLayout } from '../js/layout.js';

// 400 px wide: spacing ~50 px, strings at x ~ 50, 100, ... 350, tap zones ±20 px.
const layout = computeLayout(400, 800);
const X = layout.strings.map((s) => s.x);
const GAP = (i) => (X[i] + X[i + 1]) / 2; // silent point between strings i and i+1
const OUTSIDE = 22; // offset from a string that is outside its tap zone
const MID_Y = 400;

function tracker() {
  const t = new GestureTracker();
  t.setLayout(layout);
  return t;
}

// Touches at xs[0], then moves through the rest (one segment per entry), 8 ms per segment.
function drag(t, xs, { id = 1, y = MID_Y, t0 = 0, dt = 8 } = {}) {
  const plucks = t.down(id, xs[0], y, t0);
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

test('tap zones are narrower than half the spacing, leaving silent gaps', () => {
  assert.ok(layout.tapHalf < layout.spacing / 2);
  assert.ok(OUTSIDE > layout.tapHalf);
});

// Taps (7.3)

test('touching a string plays it immediately', () => {
  const t = tracker();
  const plucks = t.down(1, X[2] + 5, MID_Y, 100);
  assert.equal(plucks.length, 1);
  assert.equal(plucks[0].string, 2);
  assert.equal(plucks[0].t, 100);
  assert.equal(plucks[0].tap, true);
});

test('tap position follows the touch along the string', () => {
  const [low] = tracker().down(1, X[0], layout.bottom - 1, 0);
  const [high] = tracker().down(1, X[0], layout.top + 1, 0);
  assert.ok(low.position < 0.05);
  assert.ok(high.position > 0.95);
});

test('touching between strings or on the margin plays nothing', () => {
  assert.deepEqual(tracker().down(1, GAP(2), MID_Y, 0), []);
  assert.deepEqual(tracker().down(1, X[0] - OUTSIDE - 10, MID_Y, 0), []);
});

test('touching beyond the bridge or the yoke plays nothing', () => {
  assert.deepEqual(tracker().down(1, X[3], layout.bottom + 10, 0), []);
  assert.deepEqual(tracker().down(1, X[3], layout.top - 10, 0), []);
});

test('tapping a string twice plays it twice', () => {
  const t = tracker();
  const a = t.down(1, X[4], MID_Y, 0);
  t.up(1);
  const b = t.down(1, X[4], MID_Y, 200);
  assert.deepEqual(plucked([...a, ...b]), [4, 4]);
});

test('small movement after a tap does not play the string again', () => {
  const jitter = [X[3] + 3, X[3] - 3, X[3] + 4, X[3] - 2, X[3] + 10];
  assert.deepEqual(plucked(drag(tracker(), jitter)), [3]);
});

test('sliding off a tapped string in either direction does not replay it', () => {
  assert.deepEqual(plucked(drag(tracker(), [X[3] + 5, GAP(2)])), [3]);
  assert.deepEqual(plucked(drag(tracker(), [X[3] + 5, GAP(3)])), [3]);
});

// Strumming (7.2)

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

test('sweep started between strings plays only the strings crossed', () => {
  assert.deepEqual(plucked(drag(tracker(), path(GAP(2), GAP(4)))), [3, 4]);
});

test('strum started on a string plays it on touch and not again', () => {
  const ev = drag(tracker(), path(X[1], X[3] + OUTSIDE));
  assert.deepEqual(plucked(ev), [1, 2, 3]);
  assert.equal(ev[0].tap, true);
  assert.equal(ev[1].tap, false);
});

test('strum started on a string, leaving it backwards, does not replay it', () => {
  assert.deepEqual(plucked(drag(tracker(), path(X[3] + 5, X[1] - OUTSIDE))), [3, 2, 1]);
});

test('jitter on a string line plays at most once', () => {
  const x = X[2];
  const jitter = [x + OUTSIDE, x - 1, x + 1, x - 1.5, x + 1, x - 1, x + 2, x - 1];
  assert.deepEqual(plucked(drag(tracker(), jitter)), [2]);
});

test('back and forth between two strings plays every pass', () => {
  const left = X[2] - OUTSIDE;
  const right = X[3] + OUTSIDE;
  const xs = [left, right, left, right, left];
  assert.deepEqual(plucked(drag(tracker(), xs)), [2, 3, 3, 2, 2, 3, 3, 2]);
});

test('direction change replays strings in the new order', () => {
  const xs = [...path(X[1], X[3] + OUTSIDE), ...path(X[3] + OUTSIDE, X[1] - OUTSIDE)];
  assert.deepEqual(plucked(drag(tracker(), xs)), [1, 2, 3, 3, 2, 1]);
});

test('moving along a string plays nothing', () => {
  const t = tracker();
  t.down(1, X[4] + OUTSIDE, 200, 0);
  const ev = [];
  for (let i = 1; i <= 40; i++) ev.push(...t.move(1, [{ x: X[4] + OUTSIDE, y: 200 + i * 10, t: i * 8 }]));
  assert.deepEqual(plucked(ev), []);
});

test('crossing beyond the bridge does not pluck', () => {
  const ev = drag(tracker(), [10, 390], { y: layout.bottom + 20 });
  assert.deepEqual(plucked(ev), []);
});

test('crossing position is 0 at the bridge and 1 at the yoke', () => {
  const [low] = drag(tracker(), [X[0] - OUTSIDE, X[0] + OUTSIDE], { y: layout.bottom - 1 });
  const [high] = drag(tracker(), [X[0] - OUTSIDE, X[0] + OUTSIDE], { y: layout.top + 1 });
  assert.ok(low.position < 0.05);
  assert.ok(high.position > 0.95);
});

test('two fingers are tracked independently', () => {
  const t = tracker();
  t.down(1, X[0] - OUTSIDE, MID_Y, 0);
  t.down(2, X[6] + OUTSIDE, MID_Y, 0);
  const a = t.move(1, [{ x: X[1] + OUTSIDE, y: MID_Y, t: 8 }]);
  const b = t.move(2, [{ x: X[5] - OUTSIDE, y: MID_Y, t: 8 }]);
  assert.deepEqual(plucked(a), [0, 1]);
  assert.deepEqual(plucked(b), [6, 5]);
});
