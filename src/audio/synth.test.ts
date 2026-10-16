import { describe, expect, it } from 'vitest';
import { midiToFrequency } from '../theory/notes';
import { TONES, fmSamples, pluckSamples } from './synth';

/** Fundamental via normalised autocorrelation with parabolic peak refinement. */
function detectPitch(y: Float32Array, sr: number, expected: number): number {
  const start = Math.floor(sr * 0.25);
  const win = y.subarray(start, start + 8192);
  const minLag = Math.floor(sr / (expected * 1.2));
  const maxLag = Math.ceil(sr / (expected * 0.8));
  const ac = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < win.length; i++) s += win[i] * win[i + lag];
    return s;
  };
  let best = minLag;
  let bestV = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const v = ac(lag);
    if (v > bestV) {
      bestV = v;
      best = lag;
    }
  }
  const a = ac(best - 1);
  const c = ac(best + 1);
  const shift = (0.5 * (a - c)) / (a - 2 * bestV + c);
  return sr / (best + shift);
}

const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

describe('synth tuning', () => {
  const sr = 48000;
  for (const tone of TONES.filter((t) => t.kind === 'pluck')) {
    it(`${tone.name} plucks are in tune across the neck`, () => {
      for (const midi of [40, 45, 52, 57, 64, 71, 76, 84]) {
        const f = detectPitch(pluckSamples(tone, midi, sr, 0), sr, midiToFrequency(midi));
        expect(Math.abs(cents(f, midiToFrequency(midi)))).toBeLessThan(5);
      }
    });
  }
  it('electric piano is in tune', () => {
    for (const midi of [45, 57, 69, 81]) {
      const f = detectPitch(fmSamples(midi, sr, 0), sr, midiToFrequency(midi));
      expect(Math.abs(cents(f, midiToFrequency(midi)))).toBeLessThan(5);
    }
  });
});
