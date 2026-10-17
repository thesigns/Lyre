// App wiring: start menu, pointer input, audio and drawing.

import { AudioEngine, stringT60 } from './audio/engine.js';
import { GestureTracker } from './gesture.js';
import { computeLayout } from './layout.js';
import { Renderer } from './render.js';
import { E3, frequencies, scaleRatios } from './tuning.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('strings');
const menu = document.getElementById('menu');
const playButton = document.getElementById('play');
const menuButton = document.getElementById('menu-button');
const hint = document.getElementById('hint');
const debug = document.getElementById('debug');

const engine = new AudioEngine();
const tracker = new GestureTracker();
const renderer = new Renderer(canvas);

let canvasRect = canvas.getBoundingClientRect();
let holdTimer = 0;
let lastInputLag = null;

// Volume from the finger speed at the crossing (px/ms), with a floor so that
// a slow pull is still clearly audible (4.2).
function speedToAmp(speed) {
  return 0.35 + 0.65 * Math.min(1, Math.pow(speed / 2.5, 0.8));
}

function applyTuning() {
  const freqs = frequencies(E3, scaleRatios('diatonic-pythagorean', 'heptachord'));
  engine.setTuning(freqs);
  renderer.setDecays(freqs.map(stringT60));
}

function relayout() {
  canvasRect = canvas.getBoundingClientRect();
  const layout = computeLayout(canvasRect.width, canvasRect.height);
  tracker.setLayout(layout);
  renderer.setLayout(layout);
  hint.hidden = !layout.tooNarrow;
}

// Plucks that arrive together keep their spacing in time, relative to the first
// one, which plays right away (7.2).
function handle(events) {
  let base = null;
  const now = engine.currentTime;
  for (const ev of events) {
    if (ev.type === 'pluck') {
      if (base === null) {
        base = ev.t;
        lastInputLag = performance.now() - ev.t;
      }
      const amp = speedToAmp(ev.speed);
      engine.pluck(ev.string, now + (ev.t - base) / 1000, amp, ev.position);
      renderer.pluck(ev.string, amp, ev.position);
    } else if (ev.type === 'damp') {
      engine.damp(ev.string, ev.on);
      renderer.damp(ev.string, ev.on);
    }
  }
  if (base !== null) showDebug();
}

function scheduleHoldCheck() {
  clearTimeout(holdTimer);
  const deadline = tracker.nextDeadline();
  if (deadline === Infinity) return;
  holdTimer = setTimeout(() => {
    handle(tracker.tick(performance.now()));
    scheduleHoldCheck();
  }, Math.max(0, deadline - performance.now()) + 5);
}

function local(e) {
  return { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top, t: e.timeStamp };
}

stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  const p = local(e);
  handle(tracker.down(e.pointerId, p.x, p.y, p.t));
  scheduleHoldCheck();
});

stage.addEventListener('pointermove', (e) => {
  if (!tracker.has(e.pointerId)) return;
  const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const points = (coalesced.length ? coalesced : [e]).map(local);
  handle(tracker.move(e.pointerId, points));
  scheduleHoldCheck();
});

for (const type of ['pointerup', 'pointercancel']) {
  stage.addEventListener(type, (e) => {
    handle(tracker.up(e.pointerId, e.timeStamp));
    scheduleHoldCheck();
  });
}

playButton.addEventListener('click', () => {
  engine.resume().then(showDebug, showDebug);
  menu.hidden = true;
});

menuButton.addEventListener('click', () => {
  menu.hidden = false;
});

// After returning from the background, iOS may need a new click to restart audio (10.1).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || engine.running) return;
  engine.resume().catch(() => {});
  setTimeout(() => {
    if (!engine.running) menu.hidden = false;
    showDebug();
  }, 300);
});

function showDebug() {
  const info = engine.latencyInfo();
  const ms = (s) => (typeof s === 'number' ? `${(s * 1000).toFixed(1)} ms` : 'n/a');
  debug.textContent = [
    `audio: ${info.state}, ${info.sampleRate} Hz`,
    `base latency: ${ms(info.baseLatency)}`,
    `output latency: ${ms(info.outputLatency)}`,
    `input lag: ${lastInputLag === null ? 'n/a' : `${lastInputLag.toFixed(1)} ms`}`,
  ].join('\n');
}

new ResizeObserver(relayout).observe(canvas);
engine.init().then(showDebug, (err) => {
  debug.textContent = `audio init failed: ${err.message}`;
});
applyTuning();
relayout();
showDebug();
