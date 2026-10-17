// Canvas drawing of the strings, bridge and yoke, see docs/Lyre.md 8.

const T60_TO_TAU = 1 / Math.log(1000); // amplitude falls 60 dB after t60
const REST_AMPLITUDE = 0.3; // px; below this a string is drawn straight

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layout = null;
    this.colors = readColors();
    this.strings = [];
    this.frame = 0;
    this.lastTime = 0;
  }

  setLayout(layout) {
    this.layout = layout;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(layout.width * dpr);
    this.canvas.height = Math.round(layout.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  // t60 per string, matching the audio decay.
  setDecays(t60s) {
    this.strings = t60s.map((t60) => ({ t60, amplitude: 0, position: 0.5 }));
  }

  pluck(i, amp, position) {
    const s = this.strings[i];
    if (!s) return;
    const a = amp * this.layout.spacing * 0.16;
    s.amplitude = Math.min(this.layout.spacing * 0.2, Math.hypot(s.amplitude, a));
    s.position = Math.min(0.9, Math.max(0.1, position));
    this.animate();
  }

  animate() {
    if (this.frame) return;
    this.lastTime = performance.now();
    const step = (now) => {
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      let moving = false;
      for (const s of this.strings) {
        s.amplitude *= Math.exp(-dt / (s.t60 * T60_TO_TAU));
        if (s.amplitude < REST_AMPLITUDE) s.amplitude = 0;
        else moving = true;
      }
      this.draw();
      this.frame = moving ? requestAnimationFrame(step) : 0;
    };
    this.frame = requestAnimationFrame(step);
  }

  draw() {
    const { ctx, layout, colors } = this;
    if (!layout) return;
    ctx.clearRect(0, 0, layout.width, layout.height);
    if (layout.tooNarrow) return;

    const xs = layout.strings.map((s) => s.x);
    const left = Math.min(...xs) - layout.spacing * 0.5;
    const right = Math.max(...xs) + layout.spacing * 0.5;
    ctx.fillStyle = colors.frame;
    roundRect(ctx, left, layout.top - 10, right - left, 10, 3);
    roundRect(ctx, left, layout.bottom, right - left, 12, 3);

    const count = layout.strings.length;
    layout.strings.forEach((geom, i) => {
      const s = this.strings[i];
      const width = 3.4 - (2 * i) / (count - 1); // lower strings are thicker
      const a = s ? s.amplitude : 0;
      ctx.strokeStyle = colors.string;
      ctx.fillStyle = colors.string;
      if (a === 0) {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(geom.x, layout.top);
        ctx.lineTo(geom.x, layout.bottom);
        ctx.stroke();
        return;
      }
      // A vibrating string blurs into the shape of its pluck: widest at the pluck point.
      const apexY = layout.bottom - s.position * (layout.bottom - layout.top);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(geom.x, layout.top);
      ctx.lineTo(geom.x + a, apexY);
      ctx.lineTo(geom.x, layout.bottom);
      ctx.lineTo(geom.x - a, apexY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = width * 0.7;
      ctx.beginPath();
      ctx.moveTo(geom.x, layout.top);
      ctx.lineTo(geom.x, layout.bottom);
      ctx.stroke();
    });
  }
}

function readColors() {
  const style = getComputedStyle(document.documentElement);
  const v = (name) => style.getPropertyValue(name).trim();
  return { frame: v('--frame'), string: v('--string'), accent: v('--accent'), ink: v('--ink') };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
