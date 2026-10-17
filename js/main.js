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
function play(plucks) {
  if (!plucks.length) return;
  const base = plucks[0].t;
  const now = engine.currentTime;
  lastInputLag = performance.now() - base;
  for (const p of plucks) {
    const amp = speedToAmp(p.speed);
    engine.pluck(p.string, now + (p.t - base) / 1000, amp, p.position);
    renderer.pluck(p.string, amp, p.position);
  }
  showDebug();
}

function local(e) {
  return { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top, t: e.timeStamp };
}

stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  const p = local(e);
  tracker.down(e.pointerId, p.x, p.y, p.t);
});

stage.addEventListener('pointermove', (e) => {
  if (!tracker.has(e.pointerId)) return;
  const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const points = (coalesced.length ? coalesced : [e]).map(local);
  play(tracker.move(e.pointerId, points));
});

for (const type of ['pointerup', 'pointercancel']) {
  stage.addEventListener(type, (e) => tracker.up(e.pointerId));
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
