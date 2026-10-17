// String geometry computed from the available area, see docs/Lyre.md 6.

import { STRING_COUNT } from './tuning.js';

const MIN_SPACING = 44;
const MAX_SPACING = 110;
// Distance kept from the screen edges, where the system catches gestures.
const EDGE_GUTTER = 24;
// Room at the top for the menu button.
const TOP_MARGIN = 56;

export function computeLayout(width, height, { leftHanded = false } = {}) {
  const spacing = Math.min(MAX_SPACING, (width - 2 * EDGE_GUTTER) / STRING_COUNT);
  const top = Math.max(TOP_MARGIN, height * 0.06);
  const bottom = height - Math.max(32, height * 0.08);
  const center = width / 2;
  const strings = [];
  for (let i = 0; i < STRING_COUNT; i++) {
    const slot = leftHanded ? STRING_COUNT - 1 - i : i;
    strings.push({ x: center + (slot - (STRING_COUNT - 1) / 2) * spacing });
  }
  return {
    width,
    height,
    spacing,
    top,
    bottom,
    strings, // logical order: index 0 is the lowest string
    tooNarrow: spacing < MIN_SPACING,
    // Touch parameters in px (to be tuned on devices, 14).
    // Half-width of the zone around a string where a touch plays it; the rest
    // between strings is silent, so strums can start there.
    tapHalf: spacing * 0.4,
    hysteresis: Math.min(6, Math.max(3, spacing * 0.08)),
  };
}
