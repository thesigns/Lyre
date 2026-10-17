// User settings stored in localStorage, see docs/Lyre.md 11.2.

import { GENERA, LOWEST_NOTES, SCALES } from './tuning.js';

const KEY = 'lyre.settings';

export const DEFAULTS = Object.freeze({
  genus: 'diatonic-pythagorean',
  scale: 'heptachord',
  lowestNote: LOWEST_NOTES.default, // MIDI
  leftHanded: false,
  volume: 0.9, // 0..1
  showLatency: false,
});

// Keeps only valid values, so stale or hand-edited storage never breaks the app.
export function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return s;
  if (Object.hasOwn(GENERA, raw.genus)) s.genus = raw.genus;
  if (Object.hasOwn(SCALES, raw.scale)) s.scale = raw.scale;
  if (Number.isInteger(raw.lowestNote) && raw.lowestNote >= LOWEST_NOTES.min && raw.lowestNote <= LOWEST_NOTES.max) {
    s.lowestNote = raw.lowestNote;
  }
  if (typeof raw.leftHanded === 'boolean') s.leftHanded = raw.leftHanded;
  if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1) s.volume = raw.volume;
  if (typeof raw.showLatency === 'boolean') s.showLatency = raw.showLatency;
  return s;
}

export function loadSettings() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY)));
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    // Storage unavailable (private mode, blocked): settings last for this session only.
  }
}
