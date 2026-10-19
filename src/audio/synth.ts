import { midiToFrequency } from '../theory/notes';

/**
 * Local guitar synth — no samples to download.
 *
 * Plucked tones use commuted Karplus–Strong synthesis: a pick/finger pulse,
 * shaped by the pick position and (for acoustic tones) a modelled guitar
 * body, drives a tuned fractional-delay string. Electric tones add a pickup
 * comb filter and run through a preamp gain stage, a valve-style clipper and
 * a speaker-cabinet filter. Several variants of each note are rendered and
 * picked at random, playing is humanised, and everything goes through a
 * generated room reverb. The "keys" tone is a small FM electric piano.
 */

type Listener = (index: number) => void;

export interface TonePreset {
  id: string;
  name: string;
  description: string;
  kind: 'pluck' | 'fm';
  /** Pick brightness (0..1): how sharp and noisy the pluck is. */
  pick: number;
  /** Pick position as a fraction of the string length (comb filter on the excitation). */
  pickPos: number;
  /** Loop filter: 0.5 = darkest, lower = brighter, longer-ringing highs. */
  damping: number;
  /** Multiplier on the decay time. */
  sustain: number;
  /** Final low-pass cutoff (Hz) — for amp tones this is the speaker cabinet. */
  tone: number;
  /** Acoustic guitar-body resonance (0..1), synthesised into every pluck. */
  body: number;
  /** Magnetic pickup position as a fraction of the string (0 = acoustic, no pickup). */
  pickup: number;
  /** Amp drive (0 = clean). */
  drive: number;
  /** Reverb send (0..1). */
  reverb: number;
  /** Output trim. */
  level: number;
}

const tone = (t: Omit<TonePreset, 'kind'> & { kind?: TonePreset['kind'] }): TonePreset => ({ kind: 'pluck', ...t });

export const TONES: TonePreset[] = [
  tone({
    id: 'nylon',
    name: 'Nylon classical',
    description: 'Soft, round and warm — a classical guitar played with the fingers.',
    pick: 0.25,
    pickPos: 0.17,
    damping: 0.5,
    sustain: 0.95,
    tone: 4200,
    body: 1,
    pickup: 0,
    drive: 0,
    reverb: 0.26,
    level: 2.6,
  }),
  tone({
    id: 'steel',
    name: 'Steel-string acoustic',
    description: 'Bright and ringing, picked near the bridge.',
    pick: 0.7,
    pickPos: 0.12,
    damping: 0.3,
    sustain: 1.25,
    tone: 9000,
    body: 0.85,
    pickup: 0,
    drive: 0,
    reverb: 0.22,
    level: 2.7,
  }),
  tone({
    id: 'jazz',
    name: 'Jazz archtop',
    description: 'Dark, mellow neck-pickup sound with a short sustain.',
    pick: 0.3,
    pickPos: 0.25,
    damping: 0.5,
    sustain: 0.8,
    tone: 2200,
    body: 0.35,
    pickup: 0.3,
    drive: 0.04,
    reverb: 0.18,
    level: 2.5,
  }),
  tone({
    id: 'clean',
    name: 'Clean electric',
    description: 'Glassy single-coil clean through a valve amp, with a little room.',
    pick: 0.6,
    pickPos: 0.15,
    damping: 0.34,
    sustain: 1.6,
    tone: 5200,
    body: 0,
    pickup: 0.2,
    drive: 0.12,
    reverb: 0.26,
    level: 2.2,
  }),
  tone({
    id: 'crunch',
    name: 'Crunch / blues amp',
    description: 'Overdriven valve amp through a 4×12 cab — singing sustain for blues and rock.',
    pick: 0.65,
    pickPos: 0.14,
    damping: 0.3,
    sustain: 2.4,
    tone: 4300,
    body: 0,
    pickup: 0.18,
    drive: 0.85,
    reverb: 0.2,
    level: 0.36,
  }),
  tone({
    id: 'keys',
    name: 'Electric piano',
    description: 'Bell-like FM electric piano — a smooth alternative to guitar.',
    kind: 'fm',
    pick: 0,
    pickPos: 0,
    damping: 0,
    sustain: 1,
    tone: 6000,
    body: 0,
    pickup: 0,
    drive: 0,
    reverb: 0.25,
    level: 0.9,
  }),
];

export const DEFAULT_TONE = 'nylon';
const VARIANTS = 3;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private input!: GainNode;
  private pre!: GainNode;
  private shaper!: WaveShaperNode;
  private post!: GainNode;
  private cabLow!: BiquadFilterNode;
  private toneFilter2!: BiquadFilterNode;
  private bodyLow!: BiquadFilterNode;
  private bodyMid!: BiquadFilterNode;
  private toneFilter!: BiquadFilterNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private trim!: GainNode;
  private cache = new Map<string, AudioBuffer[]>();
  private timers: number[] = [];
  private loopTimer: number | null = null;
  private active: AudioBufferSourceNode[] = [];
  private preset: TonePreset = TONES[0];
  volume = 0.8;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.input = ctx.createGain();
      // amp: preamp gain → valve-style saturation → speaker cabinet
      this.pre = ctx.createGain();
      this.shaper = ctx.createWaveShaper();
      this.shaper.oversample = '4x';
      this.post = ctx.createGain();
      this.cabLow = ctx.createBiquadFilter();
      this.cabLow.type = 'highpass';
      this.cabLow.frequency.value = 70;
      this.cabLow.Q.value = 0.7;
      // light body warmth (the real body resonance is synthesised into each pluck)
      this.bodyLow = ctx.createBiquadFilter();
      this.bodyLow.type = 'peaking';
      this.bodyLow.frequency.value = 120;
      this.bodyLow.Q.value = 0.9;
      this.bodyMid = ctx.createBiquadFilter();
      this.bodyMid.type = 'peaking';
      this.bodyMid.frequency.value = 1800;
      this.bodyMid.Q.value = 0.9;
      const scoop = ctx.createBiquadFilter();
      scoop.type = 'peaking';
      scoop.frequency.value = 500;
      scoop.Q.value = 0.8;
      scoop.gain.value = -1.5;
      this.toneFilter = ctx.createBiquadFilter();
      this.toneFilter.type = 'lowpass';
      this.toneFilter.Q.value = 0.7;
      this.toneFilter2 = ctx.createBiquadFilter();
      this.toneFilter2.type = 'lowpass';
      this.toneFilter2.Q.value = 0.5;
      this.trim = ctx.createGain();
      this.dry = ctx.createGain();
      this.wet = ctx.createGain();
      const reverb = ctx.createConvolver();
      reverb.buffer = this.impulse(ctx, 2.2);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 3;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;

      this.input
        .connect(this.pre)
        .connect(this.shaper)
        .connect(this.post)
        .connect(this.cabLow)
        .connect(this.bodyLow)
        .connect(this.bodyMid)
        .connect(scoop)
        .connect(this.toneFilter)
        .connect(this.toneFilter2)
        .connect(this.trim);
      this.trim.connect(this.dry).connect(comp);
      this.trim.connect(reverb).connect(this.wet).connect(comp);
      comp.connect(this.master).connect(ctx.destination);
      this.applyPreset();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Stereo room impulse: decaying noise with a darker tail. */
  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.6 - 0.5 * t; // tail gets darker
        lp += k * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.pow(1 - t, 3.2) * (i < ctx.sampleRate * 0.012 ? 0 : 1);
      }
    }
    return buf;
  }

  /** Valve-style soft clipper (slightly asymmetric for even harmonics). */
  private driveCurve(amount: number): Float32Array<ArrayBuffer> | null {
    if (amount <= 0) return null;
    const n = 4096;
    const curve = new Float32Array(n);
    const bias = 0.12 * amount;
    const norm = Math.tanh(1 + bias) - Math.tanh(bias);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = (Math.tanh(x + bias) - Math.tanh(bias)) / norm;
    }
    return curve;
  }

  private applyPreset() {
    if (!this.ctx) return;
    const p = this.preset;
    const t = this.ctx.currentTime;
    const amp = p.drive > 0;
    this.shaper.curve = this.driveCurve(p.drive);
    // preamp gain drives the clipper hard for crunch; makeup gain keeps the level steady
    const gain = amp ? 1 + p.drive * p.drive * 40 : 1;
    this.pre.gain.setTargetAtTime(gain, t, 0.02);
    this.post.gain.setTargetAtTime(amp ? 0.5 / Math.min(1, 0.5 + p.drive) : 1, t, 0.02);
    this.cabLow.frequency.setTargetAtTime(amp ? 85 : 40, t, 0.02);
    this.bodyLow.gain.setTargetAtTime(amp ? 3 + p.drive * 2 : 2 * p.body, t, 0.02);
    this.bodyMid.gain.setTargetAtTime(amp ? 2.5 : p.body ? 1.5 : 0, t, 0.02);
    // cabinet = two stacked low-passes (steep roll-off removes fizz); acoustic tones use one gentle one
    this.toneFilter.frequency.setTargetAtTime(p.tone, t, 0.02);
    this.toneFilter2.frequency.setTargetAtTime(amp ? p.tone * 1.25 : 20000, t, 0.02);
    this.trim.gain.setTargetAtTime(p.level, t, 0.02);
    this.dry.gain.setTargetAtTime(1 - p.reverb * 0.5, t, 0.02);
    this.wet.gain.setTargetAtTime(p.reverb * 1.6, t, 0.02);
  }

  setTone(id: string) {
    this.preset = TONES.find((p) => p.id === id) ?? TONES[0];
    this.applyPreset();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private buffer(midi: number): AudioBuffer {
    const ctx = this.ensure();
    const key = `${this.preset.id}:${midi}`;
    let set = this.cache.get(key);
    if (!set) {
      set = Array.from({ length: VARIANTS }, () => (this.preset.kind === 'fm' ? this.renderFm(ctx, midi) : this.renderPluck(ctx, midi)));
      this.cache.set(key, set);
    }
    return set[Math.floor(Math.random() * set.length)];
  }

  private finish(ctx: AudioContext, y: Float32Array<ArrayBuffer>, peakTarget: number): AudioBuffer {
    let peak = 0;
    for (let n = 0; n < y.length; n++) peak = Math.max(peak, Math.abs(y[n]));
    const norm = peak > 0 ? peakTarget / peak : 1;
    const fade = Math.floor(ctx.sampleRate * 0.3);
    for (let n = 0; n < y.length; n++) y[n] *= norm * (n > y.length - fade ? (y.length - n) / fade : 1);
    const buf = ctx.createBuffer(1, y.length, ctx.sampleRate);
    buf.copyToChannel(y, 0);
    return buf;
  }

  private renderPluck(ctx: AudioContext, midi: number): AudioBuffer {
    return this.finish(ctx, pluckSamples(this.preset, midi, ctx.sampleRate), 0.6);
  }

  private renderFm(ctx: AudioContext, midi: number): AudioBuffer {
    return this.finish(ctx, fmSamples(midi, ctx.sampleRate), 0.5);
  }

  /** Pluck one note `delay` seconds from now; `bend` raises the pitch by that many semitones (a string bend). */
  pluck(midi: number, delay = 0, gain = 1, duration?: number, bend = 0) {
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(midi);
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const t = ctx.currentTime + delay + 0.01 + rand(0, 0.006);
    const v = gain * rand(0.86, 1.06);
    g.gain.setValueAtTime(v, t);
    if (bend) {
      // pick the note, then push the string up: a quick but audible rise to the target pitch
      const rise = Math.min(0.22, (duration ?? 0.5) * 0.45);
      src.playbackRate.setValueAtTime(1, t + 0.06);
      src.playbackRate.linearRampToValueAtTime(Math.pow(2, bend / 12), t + 0.06 + rise);
    }
    if (duration) {
      g.gain.setValueAtTime(v, t + duration);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration + 0.3);
    }
    if (pan) {
      // low notes slightly left, high notes slightly right, like a mic in front of the guitar
      pan.pan.value = Math.max(-0.35, Math.min(0.35, (midi - 60) / 60 + rand(-0.05, 0.05)));
      src.connect(g).connect(pan).connect(this.input);
    } else src.connect(g).connect(this.input);
    src.start(t);
    src.stop(t + (duration ? duration + 0.35 : 3.2));
    this.active.push(src);
    src.onended = () => {
      this.active = this.active.filter((s) => s !== src);
    };
  }

  /** Strum a chord voicing (low → high), with a humanised strum speed. */
  strum(midis: number[], delay = 0, gain = 0.7, spread = 0.028, duration?: number) {
    const s = spread * rand(0.8, 1.25);
    midis.forEach((m, i) => this.pluck(m, delay + i * s, gain * (i === 0 ? 1 : 0.8), duration));
  }

  /** A short phrase to audition a tone. */
  preview() {
    this.stop();
    [57, 60, 62, 64, 67, 69].forEach((m, i) => this.pluck(m, i * 0.18, 0.9, 0.3));
    this.strum([45, 52, 57, 60, 64], 1.25, 0.7, 0.03);
  }

  private at(delayS: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, Math.max(0, delayS * 1000)));
  }

  stop() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.loopTimer !== null) clearTimeout(this.loopTimer);
    this.loopTimer = null;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      for (const s of this.active) {
        try {
          s.stop(now + 0.05);
        } catch {
          /* already stopped */
        }
      }
    }
    this.active = [];
  }

  /**
   * Play a lick: durations in 16th notes at `bpm`, bends rendered as pitch
   * glides. `onNote(i)` fires as note i sounds, `onNote(-1)` at the end.
   */
  playLick(notes: { midi: number; dur: number; bendTo?: number; rest?: boolean }[], bpm: number, onNote: Listener) {
    this.stop();
    this.ensure();
    const sixteenth = 60 / bpm / 4;
    let t = 0.05;
    notes.forEach((n, i) => {
      const len = n.dur * sixteenth;
      if (!n.rest) {
        this.pluck(n.midi, t, 0.95, len * 1.05 + 0.05, n.bendTo ? n.bendTo - n.midi : 0);
        const at = t;
        this.at(at + 0.01, () => onNote(i));
      }
      t += len;
    });
    this.at(t + 0.3, () => onNote(-1));
  }

  /** Play a melodic run; `onNote(i)` fires as each note sounds, `onNote(-1)` at the end. */
  playRun(midis: number[], bpm: number, onNote: Listener) {
    this.stop();
    this.ensure();
    const step = 60 / bpm;
    midis.forEach((m, i) => {
      // gentle accent on each beat (every 2nd eighth note)
      this.pluck(m, i * step, i % 2 === 0 ? 0.95 : 0.78, step * 1.6);
      this.at(i * step + 0.01, () => onNote(i));
    });
    this.at(midis.length * step + 0.2, () => onNote(-1));
  }

  /**
   * Loop a chord progression as a backing track: one bar (4 beats) per
   * chord, bass root on 1 & 3, strums on every beat (accent on 1).
   */
  playProgression(voicings: number[][], bpm: number, loop: boolean, onChord: Listener) {
    this.stop();
    const ctx = this.ensure();
    const beat = 60 / bpm;
    const bar = beat * 4;
    const cycle = voicings.length * bar;
    const start = ctx.currentTime + 0.08;
    const scheduleCycle = (absStart: number) => {
      const offset = absStart - ctx.currentTime;
      voicings.forEach((v, i) => {
        const t0 = offset + i * bar;
        const [bass, ...upper] = v;
        const low = bass - 12 >= 28 ? bass - 12 : bass;
        this.pluck(low, t0, 0.9, beat * 1.9);
        this.pluck(low, t0 + beat * 2, 0.7, beat * 1.9);
        for (let b = 0; b < 4; b++) this.strum(upper, t0 + b * beat, b === 0 ? 0.55 : b === 2 ? 0.42 : 0.3, 0.022, beat * 0.95);
        this.at(t0 + 0.01, () => onChord(i));
      });
    };
    scheduleCycle(start);
    if (loop) {
      let k = 1;
      const next = () => {
        scheduleCycle(start + k * cycle);
        k++;
        this.loopTimer = window.setTimeout(next, (start + k * cycle - ctx.currentTime - 0.6) * 1000);
      };
      this.loopTimer = window.setTimeout(next, (start + cycle - ctx.currentTime - 0.6) * 1000);
    } else this.at(cycle + 0.2, () => onChord(-1));
  }
}

export const synth = new Synth();

/** Small seeded PRNG so the synthesised guitar body is the same on every load. */
function seeded(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const bodyCache = new Map<number, Float32Array>();

/**
 * Impulse response of an acoustic guitar body, built from its resonant
 * modes: the Helmholtz air resonance (~100 Hz), the main top-plate modes
 * (~200–550 Hz) and a dense cloud of short, quieter high modes.
 */
export function guitarBodyIR(sr: number): Float32Array {
  const hit = bodyCache.get(sr);
  if (hit) return hit;
  const len = Math.floor(sr * 0.12);
  const ir = new Float32Array(len);
  const modes: [number, number, number][] = [
    [102, 0.09, 1],
    [195, 0.06, 0.8],
    [235, 0.05, 0.55],
    [390, 0.035, 0.45],
    [470, 0.03, 0.35],
    [540, 0.025, 0.3],
  ];
  const r = seeded(7);
  for (let i = 0; i < 48; i++) {
    const f = 600 * Math.pow(9, r()); // 600 Hz – 5.4 kHz, log-spaced at random
    modes.push([f, 0.004 + r() * 0.014, (0.25 + 0.3 * r()) * Math.pow(600 / f, 0.35)]);
  }
  for (const [f, tau, amp] of modes) {
    const ph = r() * Math.PI * 2;
    const w = (2 * Math.PI * f) / sr;
    for (let n = 0; n < len; n++) ir[n] += amp * Math.exp(-n / (tau * sr)) * Math.sin(w * n + ph);
  }
  ir[0] += 1.2; // direct sound
  let e = 0;
  for (let n = 0; n < len; n++) e += ir[n] * ir[n];
  const g = 1 / Math.sqrt(e);
  for (let n = 0; n < len; n++) ir[n] *= g;
  bodyCache.set(sr, ir);
  return ir;
}

/**
 * Plucked string (extended Karplus–Strong, "commuted" synthesis).
 *
 * The excitation is a short pick/finger pulse, shaped by the pick position
 * and — for acoustic tones — convolved with the guitar-body response, then
 * fed into a tuned delay-line string. The loop filter is a 2-tap weighted
 * average whose phase delay is `damping` samples, so the delay line is
 * shortened by that amount to keep every note exactly in tune. Electric
 * tones take the output through a pickup comb filter instead of a body.
 * `detuneCents` defaults to a tiny random humanisation.
 */
export function pluckSamples(p: TonePreset, midi: number, sr: number, detuneCents = rand(-3, 3)): Float32Array<ArrayBuffer> {
  const freq = midiToFrequency(midi) * Math.pow(2, detuneCents / 1200);
  const len = Math.floor(sr * 3.2);
  const period = sr / freq;
  const b = p.damping;
  const D = period - b;
  const t60 = Math.max(0.8, 4.2 - (midi - 40) * 0.055) * p.sustain;
  const loss = Math.pow(10, -3 / (t60 * freq));

  // pick / finger pulse: a smooth bump (finger flesh) blended with filtered noise (pick edge)
  const pulseLen = Math.max(4, Math.round(sr * (0.0003 + (1 - p.pick) * 0.0011)));
  const pulse = new Float32Array(pulseLen);
  let lp = 0;
  const k = 0.15 + 0.8 * p.pick * rand(0.9, 1.1);
  for (let n = 0; n < pulseLen; n++) {
    lp += k * (Math.random() * 2 - 1 - lp);
    const bump = 0.5 - 0.5 * Math.cos((2 * Math.PI * (n + 0.5)) / pulseLen); // raised cosine: smooth, no hollow spectral notches
    pulse[n] = (1 - p.pick) * bump + p.pick * lp * 1.6 * bump;
  }
  // pick position: a plucked point leaves out harmonics with nodes there
  const comb = Math.max(1, Math.round(p.pickPos * period));
  const shaped = new Float32Array(pulseLen + comb);
  for (let n = 0; n < shaped.length; n++) shaped[n] = (n < pulseLen ? pulse[n] : 0) - (n >= comb && n - comb < pulseLen ? pulse[n - comb] : 0);

  // acoustic body: convolve the excitation with the body response
  let ex: Float32Array = shaped;
  if (p.body > 0) {
    const ir = guitarBodyIR(sr);
    const out = new Float32Array(shaped.length + ir.length);
    for (let i = 0; i < shaped.length; i++) {
      const v = shaped[i];
      if (v === 0) continue;
      for (let j = 0; j < ir.length; j++) out[i + j] += v * ir[j];
    }
    ex = new Float32Array(out.length);
    for (let n = 0; n < out.length; n++) ex[n] = p.body * out[n] + (1 - p.body) * (n < shaped.length ? shaped[n] : 0);
  }

  // the string: tuned delay line with fractional (linearly interpolated) read-out
  const y = new Float32Array(len);
  const at = (i: number) => (i >= 0 ? y[i] : 0);
  for (let n = 0; n < len; n++) {
    const idx = n - D;
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const a = at(i0) * (1 - frac) + at(i0 + 1) * frac;
    const c = at(i0 - 1) * (1 - frac) + at(i0) * frac;
    y[n] = (n < ex.length ? ex[n] : 0) + loss * ((1 - b) * a + b * c);
  }

  if (p.pickup > 0) {
    // magnetic pickup: senses string velocity at one point → comb filter on the output
    const d = Math.max(1, Math.round(p.pickup * period));
    for (let n = len - 1; n >= d; n--) y[n] = y[n] - y[n - d];
  }
  // soft attack edge (removes the click of a perfectly square start)
  const atk = Math.floor(sr * 0.001);
  for (let n = 0; n < atk; n++) y[n] *= n / atk;
  return y;
}

/** Two-operator FM electric piano (Rhodes-style). */
export function fmSamples(midi: number, sr: number, detuneCents = rand(-2, 2)): Float32Array<ArrayBuffer> {
  const f = midiToFrequency(midi) * Math.pow(2, detuneCents / 1200);
  const len = Math.floor(sr * 3.2);
  const y = new Float32Array(len);
  const decay = 0.9 + Math.max(0, (72 - midi) * 0.03);
  const tine = rand(2.2, 2.8);
  for (let n = 0; n < len; n++) {
    const t = n / sr;
    const index = tine * Math.exp(-t * 7) + 0.35;
    const mod = Math.sin(2 * Math.PI * f * t) * index;
    const bell = 0.12 * Math.exp(-t * 9) * Math.sin(2 * Math.PI * f * 14 * t);
    const env = Math.min(1, t / 0.004) * Math.exp(-t / decay);
    y[n] = (Math.sin(2 * Math.PI * f * t + mod) + bell) * env;
  }
  return y;
}

/** A playable close voicing: root in the bass (E2–D♯3), upper tones stacked above. */
export function chordVoicing(pcs: number[]): number[] {
  const rootPc = pcs[0];
  const bass = 40 + ((rootPc - 4 + 12) % 12); // E2..D#3
  const out = [bass];
  let last = bass + 7;
  for (const pc of [pcs[0], ...pcs.slice(1)]) {
    let m = last + 1;
    while (m % 12 !== pc) m++;
    out.push(m);
    last = m;
  }
  return out;
}
