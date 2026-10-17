// App wiring: start menu, settings, pointer input, audio and drawing.

import { AudioEngine, stringT60 } from './audio/engine.js';
import { GestureTracker } from './gesture.js';
import { computeLayout } from './layout.js';
import { Renderer } from './render.js';
import { loadSettings, saveSettings } from './settings.js';
import { GENERA, LOWEST_NOTES, SCALES, frequencies, midiToHz, noteName, scaleRatios } from './tuning.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('strings');
const menu = document.getElementById('menu');
const settingsPanel = document.getElementById('settings');
const settingsForm = document.getElementById('settings-form');
const menuButton = document.getElementById('menu-button');
const hint = document.getElementById('hint');
const debug = document.getElementById('debug');

const engine = new AudioEngine();
const tracker = new GestureTracker();
const renderer = new Renderer(canvas);
const settings = loadSettings();

let canvasRect = canvas.getBoundingClientRect();
let lastInputLag = null;

// Volume from the finger speed at the crossing (px/ms), with a floor so that
// a slow pull is still clearly audible (4.2).
function speedToAmp(speed) {
  return 0.35 + 0.65 * Math.min(1, Math.pow(speed / 2.5, 0.8));
}

// A tap has no movement to measure, so it plays at a medium volume.
const TAP_AMP = 0.6;

// New tuning applies from the next pluck of each string (5.3).
function applyTuning() {
  const ratios = scaleRatios(settings.genus, settings.scale);
  const freqs = frequencies(midiToHz(settings.lowestNote), ratios);
  engine.setTuning(freqs);
  renderer.setDecays(freqs.map(stringT60));
}

function relayout() {
  canvasRect = canvas.getBoundingClientRect();
  const layout = computeLayout(canvasRect.width, canvasRect.height, { leftHanded: settings.leftHanded });
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
    const amp = p.tap ? TAP_AMP : speedToAmp(p.speed);
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
  play(tracker.down(e.pointerId, p.x, p.y, p.t));
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

// Any menu button starts the audio, since a click is a user activation (10.1).
function startAudio() {
  engine.resume().then(showDebug, showDebug);
}

document.getElementById('play').addEventListener('click', () => {
  startAudio();
  menu.hidden = true;
});

document.getElementById('open-settings').addEventListener('click', () => {
  startAudio();
  settingsPanel.hidden = false;
});

document.getElementById('close-settings').addEventListener('click', () => {
  settingsPanel.hidden = true;
});

menuButton.addEventListener('click', () => {
  menu.hidden = false;
});

function fillOptions(select, entries) {
  for (const [value, label] of entries) select.add(new Option(label, value));
}

function initSettingsForm() {
  const f = settingsForm.elements;
  fillOptions(f.genus, Object.entries(GENERA).map(([id, g]) => [id, g.name]));
  fillOptions(f.scale, Object.entries(SCALES).map(([id, s]) => [id, s.name]));
  const notes = [];
  for (let m = LOWEST_NOTES.min; m <= LOWEST_NOTES.max; m++) notes.push([m, noteName(m)]);
  fillOptions(f.lowestNote, notes);

  f.genus.value = settings.genus;
  f.scale.value = settings.scale;
  f.lowestNote.value = settings.lowestNote;
  f.leftHanded.checked = settings.leftHanded;
  f.volume.value = settings.volume;
  f.showLatency.checked = settings.showLatency;

  settingsForm.addEventListener('input', (e) => {
    const el = e.target;
    switch (el.name) {
      case 'genus':
      case 'scale':
        settings[el.name] = el.value;
        applyTuning();
        break;
      case 'lowestNote':
        settings.lowestNote = Number(el.value);
        applyTuning();
        break;
      case 'leftHanded':
        settings.leftHanded = el.checked;
        relayout();
        break;
      case 'volume':
        settings.volume = Number(el.value);
        engine.setVolume(settings.volume);
        break;
      case 'showLatency':
        settings.showLatency = el.checked;
        debug.hidden = !el.checked;
        break;
    }
    saveSettings(settings);
  });
  settingsForm.addEventListener('submit', (e) => e.preventDefault());
}

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
  debug.hidden = false;
});
engine.setVolume(settings.volume);
debug.hidden = !settings.showLatency;
initSettingsForm();
applyTuning();
relayout();
showDebug();
