// Audio graph: strings worklet -> body resonances -> limiter -> master volume.

// Fade-out (60 dB, seconds) of the old pitch when a string is plucked after retuning.
const FADE_T60 = 0.08;

// Decay time of a string; the renderer uses the same value for the visual decay.
// Lower strings ring longer.
export function stringT60(freq) {
  return Math.min(6, Math.max(1.2, 5 * Math.pow(110 / freq, 0.6)));
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.pendingTuning = null;
    this.ready = null;
  }

  // Creates the context suspended, before any user gesture, so that the
  // Play button only has to resume it (10.1).
  init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'interactive' });
    try {
      // Safari 17+: play even when the iPhone mute switch is on.
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) {
      // Not supported; the mute switch may silence the app.
    }
    this.ready = this.ctx.audioWorklet
      .addModule(new URL('./string-processor.js', import.meta.url))
      .then(() => this.buildGraph());
    return this.ready;
  }

  buildGraph() {
    const ctx = this.ctx;
    this.node = new AudioWorkletNode(ctx, 'lyre-strings', {
      numberOfInputs: 0,
      outputChannelCount: [1],
    });

    // Body: a few broad resonances instead of a convolver for now (open question, 14).
    const resonances = [
      { freq: 230, q: 1.2, gain: 4 },
      { freq: 480, q: 1.5, gain: 3 },
      { freq: 1300, q: 2, gain: 2 },
    ];
    let last = this.node;
    for (const r of resonances) {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = r.freq;
      f.Q.value = r.q;
      f.gain.value = r.gain;
      last.connect(f);
      last = f;
    }
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 5000;
    shelf.gain.value = -3;
    last.connect(shelf);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    shelf.connect(limiter);

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    limiter.connect(this.master);
    this.master.connect(ctx.destination);

    if (this.pendingTuning) this.setTuning(this.pendingTuning);
  }

  // Must be called synchronously from a click handler.
  resume() {
    return this.ctx.resume();
  }

  get running() {
    return this.ctx && this.ctx.state === 'running';
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  setTuning(freqs) {
    if (!this.node) {
      this.pendingTuning = freqs;
      return;
    }
    this.node.port.postMessage({
      type: 'tune',
      strings: freqs.map((freq) => ({ freq, t60: stringT60(freq) })),
      fadeT60: FADE_T60,
    });
  }

  pluck(string, when, amp, position) {
    if (!this.node) return;
    this.node.port.postMessage({ type: 'pluck', string, when, amp, position });
  }

  latencyInfo() {
    const ctx = this.ctx;
    return {
      state: ctx.state,
      sampleRate: ctx.sampleRate,
      baseLatency: ctx.baseLatency,
      outputLatency: ctx.outputLatency,
    };
  }
}
