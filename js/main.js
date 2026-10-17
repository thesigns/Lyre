// App wiring: start menu, settings, pointer input, audio and drawing.

import { AudioEngine, stringT60 } from './audio/engine.js';
import { GestureTracker } from './gesture.js';
import { computeLayout } from './layout.js';
import { Renderer } from './render.js';
import { Lesson, MelodyPlayer, normalizeMelody } from './melody.js';
import { loadSettings, saveSettings } from './settings.js';
import { GENERA, LOWEST_NOTES, SCALES, frequencies, midiToHz, noteName, scaleRatios } from './tuning.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('strings');
const menu = document.getElementById('menu');
const settingsPanel = document.getElementById('settings');
const settingsForm = document.getElementById('settings-form');
const tuningLocked = document.getElementById('tuning-locked');
const melodiesPanel = document.getElementById('melodies');
const melodyList = document.getElementById('melody-list');
const melodyBar = document.getElementById('melody-bar');
const melodyTitle = document.getElementById('melody-title');
const listenButton = document.getElementById('melody-listen');
const menuButton = document.getElementById('menu-button');
const hint = document.getElementById('hint');
const debug = document.getElementById('debug');

const engine = new AudioEngine();
const tracker = new GestureTracker();
const renderer = new Renderer(canvas);
const settings = loadSettings();

let canvasRect = canvas.getBoundingClientRect();
let lastInputLag = null;
let melodies = [];
let activeMelody = null;
let lesson = null;
let wakeLock = null;

const player = new MelodyPlayer(engine, {
  onNote(i) {
    const notes = activeMelody.notes;
    renderer.pluck(notes[i].string, player.amp, notes[i].position);
    renderer.setMarkers({ current: notes[i], next: notes[i + 1] || null });
  },
  onEnd() {
    restartLesson();
  },
});

// Volume from the finger speed at the crossing (px/ms), with a floor so that
// a slow pull is still clearly audible (4.2).
function speedToAmp(speed) {
  return 0.35 + 0.65 * Math.min(1, Math.pow(speed / 2.5, 0.8));
}

// A tap has no movement to measure, so it plays at a medium volume.
const TAP_AMP = 0.6;

// New tuning applies from the next pluck of each string (5.3).
// A melody brings its own tuning for as long as it is open (9.4).
function applyTuning() {
  const freqs = activeMelody
    ? frequencies(midiToHz(activeMelody.lowestNote), activeMelody.ratios)
    : frequencies(midiToHz(settings.lowestNote), scaleRatios(settings.genus, settings.scale));
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
  if (lesson && !player.playing) advanceLesson(plucks);
  showDebug();
}

// Melodies (9)

function showLessonMarkers() {
  renderer.setMarkers({ current: lesson.current(), next: lesson.next() });
}

// Every pluck of the expected string counts, so one strum can advance several notes.
function advanceLesson(plucks) {
  let moved = false;
  for (const p of plucks) if (lesson.pluck(p.string)) moved = true;
  if (!moved) return;
  if (lesson.finished) {
    renderer.setMarkers(null);
    melodyTitle.textContent = 'Well played!';
  } else {
    showLessonMarkers();
  }
}

function restartLesson() {
  player.stop();
  listenButton.textContent = 'Listen';
  melodyTitle.textContent = activeMelody.title;
  lesson.restart();
  showLessonMarkers();
}

function setTuningLocked(locked) {
  const f = settingsForm.elements;
  f.genus.disabled = f.scale.disabled = f.lowestNote.disabled = locked;
  tuningLocked.hidden = !locked;
}

function startMelody(melody) {
  activeMelody = melody;
  lesson = new Lesson(melody);
  melodyTitle.textContent = melody.title;
  listenButton.textContent = 'Listen';
  melodyBar.hidden = false;
  menuButton.hidden = true;
  menu.hidden = true;
  melodiesPanel.hidden = true;
  setTuningLocked(true);
  applyTuning();
  showLessonMarkers();
  keepAwake(true);
}

function exitMelody() {
  player.stop();
  activeMelody = null;
  lesson = null;
  melodyBar.hidden = true;
  menuButton.hidden = false;
  setTuningLocked(false);
  applyTuning();
  renderer.setMarkers(null);
  keepAwake(false);
}

// The screen stays on during a melody (10.1).
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {
    // Not supported or refused (e.g. battery saver): the screen may dim.
  }
}

function renderMelodyList() {
  melodyList.replaceChildren();
  if (!melodies.length) {
    const li = document.createElement('li');
    li.textContent = 'Melodies could not be loaded.';
    melodyList.append(li);
    return;
  }
  for (const m of melodies) {
    const button = document.createElement('button');
    button.type = 'button';
    const title = document.createElement('strong');
    title.textContent = m.title;
    const description = document.createElement('span');
    description.textContent = m.description;
    button.append(title, description);
    button.addEventListener('click', () => {
      startAudio();
      startMelody(m);
    });
    const li = document.createElement('li');
    li.append(button);
    melodyList.append(li);
  }
}

function loadMelodies() {
  fetch('melodies/melodies.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      melodies = data.melodies.map(normalizeMelody);
    })
    .catch(() => {
      melodies = [];
    })
    .finally(renderMelodyList);
}

document.getElementById('melody-restart').addEventListener('click', restartLesson);

// Listening plays the whole melody; afterwards learning starts over (9.1).
listenButton.addEventListener('click', () => {
  if (player.playing) {
    restartLesson();
    return;
  }
  lesson.restart();
  melodyTitle.textContent = activeMelody.title;
  listenButton.textContent = 'Stop';
  player.start(activeMelody);
});

document.getElementById('melody-exit').addEventListener('click', exitMelody);

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

document.getElementById('open-melodies').addEventListener('click', () => {
  startAudio();
  melodiesPanel.hidden = false;
});

document.getElementById('close-melodies').addEventListener('click', () => {
  melodiesPanel.hidden = true;
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
  if (document.visibilityState !== 'visible') return;
  if (activeMelody) keepAwake(true); // the system drops the lock in the background
  if (engine.running) return;
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
loadMelodies();
applyTuning();
relayout();
showDebug();
