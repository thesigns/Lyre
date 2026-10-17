// Turns pointer movement into plucks, see docs/Lyre.md 7.
// Pure logic without DOM: positions in px, times in ms. move() returns the
// resulting plucks in time order:
//   { string, t, position, speed }   position: 0 at the bridge, 1 at the yoke

const MIN_SEGMENT_MS = 2;

export class GestureTracker {
  constructor() {
    this.layout = null;
    this.pointers = new Map();
  }

  setLayout(layout) {
    this.layout = layout;
    // Geometry changed under active fingers: re-read where they are, without plucking.
    for (const p of this.pointers.values()) p.strings = this.initialStates(p.x, p.y);
  }

  has(id) {
    return this.pointers.has(id);
  }

  down(id, x, y, t) {
    this.pointers.set(id, { x, y, t, strings: this.initialStates(x, y) });
  }

  move(id, points) {
    const p = this.pointers.get(id);
    const plucks = [];
    if (!p) return plucks;
    for (const pt of points) {
      this.segment(p, pt, plucks);
      p.x = pt.x;
      p.y = pt.y;
      p.t = pt.t;
    }
    return plucks;
  }

  up(id) {
    this.pointers.delete(id);
  }

  initialStates(x, y) {
    const { strings, band, top, bottom } = this.layout;
    const inside = y >= top && y <= bottom;
    return strings.map((s) => {
      const d = x - s.x;
      if (inside && Math.abs(d) <= band) return { on: true, side: 0, armed: false };
      return { on: false, side: d < 0 ? -1 : 1, armed: true };
    });
  }

  // Finds every string the segment from the previous position to pt plucks (7.2).
  segment(p, pt, plucks) {
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
      plucks.push({
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
