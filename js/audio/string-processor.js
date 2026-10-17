// AudioWorklet with seven plucked strings (Karplus-Strong), see docs/Lyre.md 4.1.
//
// Messages from the main thread:
//   { type: 'tune', strings: [{ freq, t60 }], dampT60, fadeT60 }
//   { type: 'pluck', string, when, amp, position }   when: AudioContext time in seconds
//   { type: 'damp', string, on }

const MIN_FREQ = 40;
const GAIN_SMOOTHING = 0.002; // per-sample approach to the target loop gain (~10 ms)
const SILENCE_LEVEL = 1e-4;
const SILENCE_SECONDS = 0.1;
const EXCITATION_RMS = 0.35;

class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    const size = Math.ceil(sampleRate / MIN_FREQ) + 2;
    this.buffer = new Float32Array(size);
    this.scratch = new Float32Array(size);
    this.shaped = new Float32Array(size);
    this.length = 2;
    this.index = 0;
    this.freq = 0;
    this.lastIn = 0;
    this.apCoef = 0;
    this.apIn = 0;
    this.apOut = 0;
    this.gain = 0;
    this.targetGain = 0;
    this.active = false;
    this.quietSamples = 0;
  }

  setFrequency(freq) {
    const period = this.sampleRate / freq;
    // Loop delay = buffer length + 0.5 (averaging filter) + allpass delay kept in [0.1, 1.1).
    const length = Math.floor(period - 0.6);
    const frac = period - 0.5 - length;
    this.length = length;
    this.apCoef = (1 - frac) / (1 + frac);
    this.freq = freq;
    this.clear();
  }

  clear() {
    this.buffer.fill(0);
    this.index = 0;
    this.lastIn = 0;
    this.apIn = 0;
    this.apOut = 0;
    this.active = false;
    this.quietSamples = 0;
  }

  loopGain(t60) {
    return Math.pow(10, -3 / (this.freq * t60));
  }

  // Adds a new excitation to whatever is already in the loop, so re-plucking never clicks.
  excite(amp, position) {
    const n = this.length;
    const noise = this.scratch;
    // Softer plucks are darker: one-pole lowpass on the noise burst.
    const coef = 0.25 + 0.6 * amp;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += coef * (Math.random() * 2 - 1 - lp);
      noise[i] = lp;
    }
    // Pluck position comb: notches at harmonics that have a node at the plucking point.
    // The mean cancels in the difference, so the result has no DC.
    const offset = Math.max(1, Math.round(position * n));
    const shaped = this.shaped;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const v = noise[i] - noise[(i - offset + n) % n];
      shaped[i] = v;
      energy += v * v;
    }
    const scale = (amp * EXCITATION_RMS) / Math.max(Math.sqrt(energy / n), 1e-6);
    for (let i = 0; i < n; i++) {
      const j = (this.index + i) % n;
      this.buffer[j] += shaped[i] * scale;
    }
    this.active = true;
    this.quietSamples = 0;
  }

  // Renders frames into out[start, end) additively.
  render(out, start, end) {
    const buf = this.buffer;
    const n = this.length;
    const c = this.apCoef;
    let i = this.index;
    let lastIn = this.lastIn;
    let apIn = this.apIn;
    let apOut = this.apOut;
    let gain = this.gain;
    const target = this.targetGain;
    let peak = 0;
    for (let s = start; s < end; s++) {
      const x = buf[i];
      const lp = 0.5 * (x + lastIn);
      lastIn = x;
      gain += (target - gain) * GAIN_SMOOTHING;
      const y = gain * lp;
      const v = c * y + apIn - c * apOut;
      apIn = y;
      apOut = v;
      buf[i] = v;
      i = i + 1 === n ? 0 : i + 1;
      out[s] += x;
      const a = x < 0 ? -x : x;
      if (a > peak) peak = a;
    }
    this.index = i;
    this.lastIn = lastIn;
    this.apIn = apIn;
    this.apOut = apOut;
    this.gain = gain;
    if (peak < SILENCE_LEVEL) {
      this.quietSamples += end - start;
      if (this.quietSamples > this.sampleRate * SILENCE_SECONDS) this.clear();
    } else {
      this.quietSamples = 0;
    }
  }
}

// Each string has two voices so a pluck after retuning can start fresh
// while the old pitch fades out (tuning changes apply from the next pluck, 5.3).
class LyreString {
  constructor(sampleRate) {
    this.voices = [new Voice(sampleRate), new Voice(sampleRate)];
    this.current = 0;
    this.freq = 0;
    this.t60 = 3;
    this.damped = false;
  }

  ringGain(voice, params) {
    return voice.loopGain(this.damped ? params.dampT60 : this.t60);
  }

  retune(freq, t60) {
    this.freq = freq;
    this.t60 = t60;
    const voice = this.voices[this.current];
    if (!voice.active) voice.setFrequency(freq);
  }

  pluck(amp, position, params) {
    if (!this.freq) return;
    let voice = this.voices[this.current];
    if (voice.freq !== this.freq) {
      if (voice.active) {
        voice.targetGain = voice.loopGain(params.fadeT60);
        this.current ^= 1;
        voice = this.voices[this.current];
      }
      voice.setFrequency(this.freq);
    }
    voice.targetGain = this.ringGain(voice, params);
    if (!voice.active) voice.gain = voice.targetGain;
    voice.excite(amp, position);
  }

  damp(on, params) {
    this.damped = on;
    const voice = this.voices[this.current];
    if (voice.freq) voice.targetGain = this.ringGain(voice, params);
  }
}

class LyreStringsProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.strings = Array.from({ length: 7 }, () => new LyreString(sampleRate));
    this.params = { dampT60: 0.1, fadeT60: 0.08 };
    this.queue = [];
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(msg) {
    switch (msg.type) {
      case 'tune':
        this.params.dampT60 = msg.dampT60;
        this.params.fadeT60 = msg.fadeT60;
        msg.strings.forEach((s, i) => this.strings[i].retune(s.freq, s.t60));
        break;
      case 'pluck': {
        // Keep the queue sorted by time; it is short, so insertion is cheap.
        let i = this.queue.length;
        while (i > 0 && this.queue[i - 1].when > msg.when) i--;
        this.queue.splice(i, 0, msg);
        break;
      }
      case 'damp':
        this.strings[msg.string].damp(msg.on, this.params);
        break;
    }
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const out = output[0];
    const frames = out.length;
    out.fill(0);
    let start = 0;
    while (start < frames) {
      let end = frames;
      if (this.queue.length) {
        const at = Math.round((this.queue[0].when - currentTime) * sampleRate);
        if (at <= start) {
          const ev = this.queue.shift();
          this.strings[ev.string].pluck(ev.amp, ev.position, this.params);
          continue;
        }
        if (at < frames) end = at;
      }
      for (const string of this.strings) {
        for (const voice of string.voices) {
          if (voice.active) voice.render(out, start, end);
        }
      }
      start = end;
    }
    for (let ch = 1; ch < output.length; ch++) output[ch].set(out);
    return true;
  }
}

registerProcessor('lyre-strings', LyreStringsProcessor);
