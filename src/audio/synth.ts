import { midiToFrequency } from '../theory/notes';

/**
 * Local guitar synth — no samples to download.
 *
 * Plucked tones use Karplus–Strong with a fractional delay line (so every
 * note is in tune), a pick-position comb on the excitation and an adjustable
 * loss filter. Several variants of each note are rendered and picked at
 * random, velocities and strums are humanised, and the voice runs through a
 * guitar-body EQ, optional amp drive, a tone filter and a generated room
 * reverb. The "keys" tone is a small FM electric piano.
 */

type Listener = (index: number) => void;

export interface TonePreset {
  id: string;
  name: string;
  description: string;
  kind: 'pluck' | 'fm';
  /** Excitation low-pass (0..1, higher = brighter pick). */
  pick: number;
  /** Pick position as a fraction of the string (comb filter on the excitation). */
  pickPos: number;
  /** Loop filter: 0.5 = darkest classic KS, lower = brighter, longer-ringing highs. */
  damping: number;
  /** Multiplier on the decay time. */
  sustain: number;
  /** Final low-pass cutoff (Hz). */
  tone: number;
  /** Guitar-body resonance amount (0..1). */
  body: number;
  /** Amp drive (0 = clean). */
  drive: number;
  /** Reverb send (0..1). */
  reverb: number;
  /** Output trim. */
  level: number;
}

export const TONES: TonePreset[] = [
  {
    id: 'nylon',
    name: 'Nylon classical',
    description: 'Soft, round and warm — a classical guitar played with the fingers.',
    kind: 'pluck',
    pick: 0.22,
    pickPos: 0.2,
    damping: 0.5,
    sustain: 0.9,
    tone: 3000,
    body: 0.9,
    drive: 0,
    reverb: 0.28,
    level: 1,
  },
  {
    id: 'steel',
    name: 'Steel-string acoustic',
    description: 'Bright and ringing, picked near the bridge.',
    kind: 'pluck',
    pick: 0.65,
    pickPos: 0.12,
    damping: 0.32,
    sustain: 1.15,
    tone: 7000,
    body: 0.7,
    drive: 0,
    reverb: 0.22,
    level: 0.85,
  },
  {
    id: 'jazz',
    name: 'Jazz archtop',
    description: 'Dark, mellow neck-pickup sound with a short sustain.',
    kind: 'pluck',
    pick: 0.3,
    pickPos: 0.28,
    damping: 0.5,
    sustain: 0.75,
    tone: 1700,
    body: 0.35,
    drive: 0,
    reverb: 0.18,
    level: 1.25,
  },
  {
    id: 'clean',
    name: 'Clean electric',
    description: 'Glassy single-coil clean with a little room.',
    kind: 'pluck',
    pick: 0.55,
    pickPos: 0.16,
    damping: 0.38,
    sustain: 1.4,
    tone: 4800,
    body: 0.1,
    drive: 0.12,
    reverb: 0.26,
    level: 0.9,
  },
  {
    id: 'crunch',
    name: 'Crunch / blues amp',
    description: 'Overdriven valve-amp tone for bluesy soloing.',
    kind: 'pluck',
    pick: 0.6,
    pickPos: 0.14,
    damping: 0.36,
    sustain: 1.6,
    tone: 3400,
    body: 0.05,
    drive: 0.75,
    reverb: 0.2,
    level: 0.55,
  },
  {
    id: 'keys',
    name: 'Electric piano',
    description: 'Bell-like FM electric piano — a smooth alternative to guitar.',
    kind: 'fm',
    pick: 0,
    pickPos: 0,
    damping: 0,
    sustain: 1,
    tone: 5000,
    body: 0,
    drive: 0,
    reverb: 0.25,
    level: 0.9,
  },
];

export const DEFAULT_TONE = 'nylon';
const VARIANTS = 3;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private input!: GainNode;
  private shaper!: WaveShaperNode;
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
      this.shaper = ctx.createWaveShaper();
      this.shaper.oversample = '4x';
      // guitar body: air resonance (~110 Hz) and top-plate resonance (~220 Hz), slight scoop at 1.2 kHz
      this.bodyLow = ctx.createBiquadFilter();
      this.bodyLow.type = 'peaking';
      this.bodyLow.frequency.value = 110;
      this.bodyLow.Q.value = 1.4;
      this.bodyMid = ctx.createBiquadFilter();
      this.bodyMid.type = 'peaking';
      this.bodyMid.frequency.value = 230;
      this.bodyMid.Q.value = 1.6;
      const scoop = ctx.createBiquadFilter();
      scoop.type = 'peaking';
      scoop.frequency.value = 1200;
      scoop.Q.value = 0.8;
      scoop.gain.value = -2;
      this.toneFilter = ctx.createBiquadFilter();
      this.toneFilter.type = 'lowpass';
      this.toneFilter.Q.value = 0.6;
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

      this.input.connect(this.shaper).connect(this.bodyLow).connect(this.bodyMid).connect(scoop).connect(this.toneFilter).connect(this.trim);
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

  private driveCurve(amount: number): Float32Array<ArrayBuffer> | null {
    if (amount <= 0) return null;
    const n = 2048;
    const curve = new Float32Array(n);
    const k = 1 + amount * 18;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      // asymmetric soft clip – a touch of even harmonics like a valve stage
      curve[i] = (Math.tanh(k * x + 0.15 * amount) - Math.tanh(0.15 * amount)) / Math.tanh(k);
    }
    return curve;
  }

  private applyPreset() {
    if (!this.ctx) return;
    const p = this.preset;
    const t = this.ctx.currentTime;
    this.shaper.curve = this.driveCurve(p.drive);
    this.bodyLow.gain.setTargetAtTime(9 * p.body, t, 0.02);
    this.bodyMid.gain.setTargetAtTime(5 * p.body, t, 0.02);
    this.toneFilter.frequency.setTargetAtTime(p.tone, t, 0.02);
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

  /** Pluck one note `delay` seconds from now. */
  pluck(midi: number, delay = 0, gain = 1, duration?: number) {
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(midi);
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const t = ctx.currentTime + delay + 0.01 + rand(0, 0.006);
    const v = gain * rand(0.86, 1.06);
    g.gain.setValueAtTime(v, t);
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

/**
 * Karplus–Strong pluck. The loop filter is a 2-tap weighted average whose
 * phase delay is `damping` samples, so the delay line is shortened by that
 * amount to keep the loop exactly one period long (in tune). `detuneCents`
 * defaults to a tiny random humanisation.
 */
export function pluckSamples(p: TonePreset, midi: number, sr: number, detuneCents = rand(-3, 3)): Float32Array<ArrayBuffer> {
  const freq = midiToFrequency(midi) * Math.pow(2, detuneCents / 1200);
  const len = Math.floor(sr * 3.2);
  const y = new Float32Array(len);
  const period = sr / freq;
  const b = p.damping;
  const D = period - b;
  const t60 = Math.max(0.7, 3.8 - (midi - 40) * 0.05) * p.sustain;
  const loss = Math.pow(10, -3 / (t60 * freq));

  // excitation: low-passed noise burst shaped by the pick position (comb filter)
  const exLen = Math.ceil(period) + 2;
  const ex = new Float32Array(exLen);
  let lp = 0;
  const k = Math.min(0.98, p.pick * rand(0.85, 1.15));
  for (let n = 0; n < exLen; n++) {
    lp += k * (Math.random() * 2 - 1 - lp);
    ex[n] = lp;
  }
  const comb = Math.max(1, Math.round(p.pickPos * period));
  for (let n = 0; n < exLen; n++) y[n] = ex[n] - (n >= comb ? ex[n - comb] : 0) * 0.9;

  for (let n = exLen; n < len; n++) {
    const idx = n - D;
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const a = y[i0] * (1 - frac) + y[i0 + 1] * frac;
    const c = y[i0 - 1] * (1 - frac) + y[i0] * frac;
    y[n] = loss * ((1 - b) * a + b * c);
  }
  // soft attack edge (removes the click of a perfectly square start)
  const atk = Math.floor(sr * 0.0015);
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
