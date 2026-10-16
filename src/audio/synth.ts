import { midiToFrequency } from '../theory/notes';

/**
 * Tiny plucked-string synth (Karplus–Strong with fractional delay so every
 * note is in tune) plus a look-ahead scheduler for scale runs and backing
 * chord loops. Everything is rendered locally — no samples to download.
 */

type Listener = (index: number) => void;

class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private cache = new Map<number, AudioBuffer>();
  private timers: number[] = [];
  private loopTimer: number | null = null;
  private active: AudioBufferSourceNode[] = [];
  volume = 0.8;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      const tone = this.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 3800; // mellow, warm top end
      tone.Q.value = 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(tone).connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private buffer(midi: number): AudioBuffer {
    const ctx = this.ensure();
    const hit = this.cache.get(midi);
    if (hit) return hit;
    const sr = ctx.sampleRate;
    const freq = midiToFrequency(midi);
    const seconds = 3;
    const len = Math.floor(sr * seconds);
    const y = new Float32Array(len);
    const period = sr / freq;
    // The 2-point averaging filter adds half a sample of delay.
    const D = period - 0.5;
    const t60 = Math.max(0.9, 3.6 - (midi - 40) * 0.055);
    const loss = Math.pow(10, -3 / (t60 * freq));
    // excitation: low-passed noise burst (softer pick attack)
    const exLen = Math.ceil(period) + 2;
    let lp = 0;
    for (let n = 0; n < exLen && n < len; n++) {
      lp += 0.45 * (Math.random() * 2 - 1 - lp);
      y[n] = lp;
    }
    for (let n = exLen; n < len; n++) {
      const idx = n - D;
      const i0 = Math.floor(idx);
      const frac = idx - i0;
      const a = y[i0] * (1 - frac) + y[i0 + 1] * frac;
      const b = y[i0 - 1] * (1 - frac) + y[i0] * frac;
      y[n] = loss * 0.5 * (a + b);
    }
    let peak = 0;
    for (let n = 0; n < len; n++) peak = Math.max(peak, Math.abs(y[n]));
    const norm = peak > 0 ? 0.6 / peak : 1;
    const fade = Math.floor(sr * 0.25);
    for (let n = 0; n < len; n++) y[n] *= norm * (n > len - fade ? (len - n) / fade : 1);
    const buf = ctx.createBuffer(1, len, sr);
    buf.copyToChannel(y, 0);
    this.cache.set(midi, buf);
    return buf;
  }

  /** Pluck one note `delay` seconds from now. */
  pluck(midi: number, delay = 0, gain = 1, duration?: number) {
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(midi);
    const g = ctx.createGain();
    const t = ctx.currentTime + delay + 0.01;
    g.gain.setValueAtTime(gain, t);
    if (duration) {
      g.gain.setValueAtTime(gain, t + duration);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration + 0.25);
    }
    src.connect(g).connect(this.master);
    src.start(t);
    src.stop(t + (duration ? duration + 0.3 : 3));
    this.active.push(src);
    src.onended = () => {
      this.active = this.active.filter((s) => s !== src);
    };
  }

  /** Strum a chord voicing (low → high). */
  strum(midis: number[], delay = 0, gain = 0.7, spread = 0.028, duration?: number) {
    midis.forEach((m, i) => this.pluck(m, delay + i * spread, gain * (i === 0 ? 1 : 0.8), duration));
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
      this.pluck(m, i * step, 0.9, step * 1.6);
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
        for (let b = 0; b < 4; b++) this.strum(upper, t0 + b * beat, b === 0 ? 0.55 : 0.32, 0.022, beat * 0.95);
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
