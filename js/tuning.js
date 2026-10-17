// Greek tunings as ratios relative to the lowest string, see docs/Lyre.md 5.

export const STRING_COUNT = 7;

// Tetrachord intervals listed from the bottom up (the design doc lists them top-down,
// as Greek theory does). Each set multiplies to 4/3.
export const GENERA = {
  'diatonic-pythagorean': { name: 'Diatonic (Pythagorean)', intervals: ['256/243', '9/8', '9/8'] },
  'diatonic-archytas': { name: 'Diatonic (Archytas)', intervals: ['28/27', '8/7', '9/8'] },
  'chromatic-archytas': { name: 'Chromatic (Archytas)', intervals: ['28/27', '243/224', '32/27'] },
  'enharmonic-archytas': { name: 'Enharmonic (Archytas)', intervals: ['28/27', '36/35', '5/4'] },
};

const TONE = '9/8';

// Each scale is a sequence of six steps between seven strings, built from one tetrachord.
export const SCALES = {
  // Two conjunct tetrachords sharing the middle note: a seventh in total.
  heptachord: { name: 'Heptachord', steps: (t) => [...t, ...t] },
  // Octave species: tetrachord, disjunctive tone, tetrachord; Phrygian and Lydian are
  // rotations of the Dorian sequence. The strings take the seven lowest notes.
  dorian: { name: 'Dorian', steps: (t) => octaveSpecies(t, 0) },
  phrygian: { name: 'Phrygian', steps: (t) => octaveSpecies(t, 1) },
  lydian: { name: 'Lydian', steps: (t) => octaveSpecies(t, 2) },
};

function octaveSpecies(tetrachord, rotation) {
  const dorian = [...tetrachord, TONE, ...tetrachord];
  const rotated = [...dorian.slice(dorian.length - rotation), ...dorian.slice(0, dorian.length - rotation)];
  return rotated.slice(0, STRING_COUNT - 1);
}

export function parseRatio(text) {
  const [num, den = '1'] = String(text).split('/');
  return Number(num) / Number(den);
}

export function scaleRatios(genusId, scaleId) {
  const tetrachord = GENERA[genusId].intervals;
  const steps = SCALES[scaleId].steps(tetrachord).map(parseRatio);
  const ratios = [1];
  for (const step of steps) ratios.push(ratios[ratios.length - 1] * step);
  return ratios;
}

export function frequencies(lowestHz, ratios) {
  return ratios.map((r) => lowestHz * r);
}

// The lowest string is chosen by note name; only this one pitch uses the modern
// reference (A4 = 440 Hz, equal temperament), the other strings follow the ratios.
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const LOWEST_NOTES = { min: 45, max: 60, default: 52 }; // MIDI: A2 to C4, default E3

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteName(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
