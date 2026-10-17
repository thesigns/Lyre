// Turns pointer movement into plucks and damping, see docs/Lyre.md 7.
// Pure logic without DOM: positions in px, times in ms. Every method returns
// the resulting events in time order:
//   { type: 'pluck', string, t, position, speed }   position: 0 at the bridge, 1 at the yoke
//   { type: 'damp', string, on, t }

const HOLD_MS = 500;
const HOLD_TOLERANCE = 6;
const MIN_SEGMENT_MS = 2;

export class GestureTracker {
  constructor({ holdMs = HOLD_MS, holdTolerance = HOLD_TOLERANCE } = {}) {
    this.holdMs = holdMs;
    this.holdTolerance = holdTolerance;
    this.layout = null;
    this.pointers = new Map();
    this.dampCounts = [];
  }

  setLayout(layout) {
    this.layout = layout;
    if (this.dampCounts.length !== layout.strings.length) {
      this.dampCounts = new Array(layout.strings.length).fill(0);
    }
    // Geometry changed under active fingers: re-read where they are, without plucking.
    for (const p of this.pointers.values()) p.strings = this.initialStates(p.x, p.y);
  }

  has(id) {
    return this.pointers.has(id);
  }

  down(id, x, y, t) {
    this.pointers.set(id, {
      x,
      y,
      t,
      strings: this.initialStates(x, y),
      anchor: { x, y, t, checked: false },
      damping: -1,
    });
    return [];
  }

  move(id, points) {
    const p = this.pointers.get(id);
    const events = [];
    if (!p) return events;
    for (const pt of points) {
      this.updateHold(p, pt, events);
      this.segment(p, pt, events);
      p.x = pt.x;
      p.y = pt.y;
      p.t = pt.t;
    }
    return events;
  }

  up(id, t) {
    const p = this.pointers.get(id);
    const events = [];
    if (!p) return events;
    this.releaseDamp(p, t, events);
    this.pointers.delete(id);
    return events;
  }

  // Starts damping for fingers that have held still long enough.
  tick(t) {
    const events = [];
    for (const p of this.pointers.values()) {
      if (p.damping >= 0 || p.anchor.checked || t - p.anchor.t < this.holdMs) continue;
      p.anchor.checked = true;
      const i = this.dampTarget(p.anchor.x, p.anchor.y);
      if (i < 0) continue;
      p.damping = i;
      if (this.dampCounts[i]++ === 0) events.push({ type: 'damp', string: i, on: true, t });
    }
    return events;
  }

  // Time at which tick() may have something to do, or Infinity.
  nextDeadline() {
    let next = Infinity;
    for (const p of this.pointers.values()) {
      if (p.damping < 0 && !p.anchor.checked) next = Math.min(next, p.anchor.t + this.holdMs);
    }
    return next;
  }

  initialStates(x, y) {
    const { strings, band } = this.layout;
    const inside = this.onStringHeight(y);
    return strings.map((s) => {
      const d = x - s.x;
      if (inside && Math.abs(d) <= band) return { on: true, side: 0, armed: false };
      return { on: false, side: d < 0 ? -1 : 1, armed: true };
    });
  }

  onStringHeight(y) {
    return y >= this.layout.top && y <= this.layout.bottom;
  }

  dampTarget(x, y) {
    if (!this.onStringHeight(y)) return -1;
    const { strings, dampHalf } = this.layout;
    let best = -1;
    let bestDist = Infinity;
    strings.forEach((s, i) => {
      const dist = Math.abs(x - s.x);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    return bestDist <= dampHalf ? best : -1;
  }

  updateHold(p, pt, events) {
    const a = p.anchor;
    if (Math.hypot(pt.x - a.x, pt.y - a.y) <= this.holdTolerance) return;
    p.anchor = { x: pt.x, y: pt.y, t: pt.t, checked: false };
    this.releaseDamp(p, pt.t, events);
  }

  releaseDamp(p, t, events) {
    if (p.damping < 0) return;
    const i = p.damping;
    p.damping = -1;
    if (--this.dampCounts[i] === 0) events.push({ type: 'damp', string: i, on: false, t });
  }

  // Finds every string the segment from the previous position to pt plucks (7.2).
  segment(p, pt, events) {
    const { strings, band, hysteresis, top, bottom } = this.layout;
    const dx = pt.x - p.x;
    const dy = pt.y - p.y;
    const dt = Math.max(pt.t - p.t, MIN_SEGMENT_MS);
    const speed = Math.abs(dx) / dt;
    const found = [];

    strings.forEach((s, i) => {
      const st = p.strings[i];
      const d0 = p.x - s.x;
      const d1 = pt.x - s.x;
      if (st.on) {
        // Started on the string: leaving its band in either direction plucks it.
        if (Math.abs(d1) <= band) return;
        const edge = d1 < 0 ? -band : band;
        found.push({ i, f: clamp01((edge - d0) / (d1 - d0)) });
        st.on = false;
        st.side = d1 < 0 ? -1 : 1;
        st.armed = Math.abs(d1) >= hysteresis;
        return;
      }
      if (d1 * st.side < 0) {
        // Crossed the line. Only an armed string plays; arming needs a clear
        // distance on the new side, so jitter on the line plays once (hysteresis).
        if (st.armed) found.push({ i, f: clamp01(d0 / (d0 - d1)) });
        st.side = -st.side;
        st.armed = Math.abs(d1) >= hysteresis;
      } else if (!st.armed && Math.abs(d1) >= hysteresis) {
        st.armed = true;
      }
    });

    found.sort((a, b) => a.f - b.f);
    for (const { i, f } of found) {
      const y = p.y + f * dy;
      if (y < top || y > bottom) continue; // no string beyond the bridge or the yoke
      if (p.damping === i) this.releaseDamp(p, p.t + f * dt, events);
      events.push({
        type: 'pluck',
        string: i,
        t: p.t + f * (pt.t - p.t),
        position: (bottom - y) / (bottom - top),
        speed,
      });
    }
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
