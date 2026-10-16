import { describe, expect, it } from 'vitest';
import { midiToFrequency } from '../theory/notes';
import { TONES, fmSamples, pluckSamples } from './synth';

/** Phase of the component at `f` in a Hann window centred on sample `c`. */
function phaseAt(y: Float32Array, f: number, sr: number, c: number, N = 4096): number {
  let re = 0;
  let im = 0;
  for (let i = 0; i < N; i++) {
    const n = c - N / 2 + i;
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    re += y[n] * w * Math.cos((2 * Math.PI * f * n) / sr);
    im -= y[n] * w * Math.sin((2 * Math.PI * f * n) / sr);
  }
  return Math.atan2(im, re);
}

const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

/**
 * Measure the fundamental from how fast its phase advances (relative to the
 * expected frequency). A short gap gives an unambiguous coarse estimate
 * (±50 Hz), a long gap then refines it to a small fraction of a cent.
 */
function detectPitch(y: Float32Array, sr: number, expected: number): number {
  const c0 = Math.floor(sr * 0.2);
  const p0 = phaseAt(y, expected, sr, c0);
  const short = Math.floor(sr * 0.01);
  const coarse = expected + wrap(phaseAt(y, expected, sr, c0 + short) - p0) / ((2 * Math.PI * short) / sr);
  const long = Math.floor(sr * 0.25);
  const predicted = ((2 * Math.PI * (coarse - expected) * long) / sr);
  const d = predicted + wrap(phaseAt(y, expected, sr, c0 + long) - p0 - predicted);
  return expected + d / ((2 * Math.PI * long) / sr);
}

const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

describe('synth tuning', () => {
  const sr = 48000;
  for (const tone of TONES.filter((t) => t.kind === 'pluck')) {
    it(`${tone.name} plucks are in tune across the neck`, () => {
      for (const midi of [40, 45, 52, 57, 64, 71, 76, 84]) {
        const f = detectPitch(pluckSamples(tone, midi, sr, 0), sr, midiToFrequency(midi));
        expect(Math.abs(cents(f, midiToFrequency(midi)))).toBeLessThan(1);
      }
    });
  }
  it('electric piano is in tune', () => {
    for (const midi of [45, 57, 69, 81]) {
      const f = detectPitch(fmSamples(midi, sr, 0), sr, midiToFrequency(midi));
      expect(Math.abs(cents(f, midiToFrequency(midi)))).toBeLessThan(1);
    }
  });
});
