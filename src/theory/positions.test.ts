import { describe, expect, it } from 'vitest';
import { TUNINGS } from './fretboard';
import { mod, parseNote } from './notes';
import { computePositions } from './positions';
import { buildScale } from './scales';

const std = TUNINGS[0];
/** frets per string (low E first) of the lowest complete instance of a pattern */
const shape = (root: string, fam: string, mode: string, pattern: number) => {
  const pos = computePositions(buildScale(parseNote(root), fam, mode), std, 22);
  const inst = pos.patterns[pattern].first!;
  return std.strings.map((_, s) =>
    inst.notes
      .filter((n) => n.string === s)
      .map((n) => n.fret)
      .sort((a, b) => a - b),
  );
};

describe('box shapes', () => {
  it('A minor pentatonic: the five classic boxes', () => {
    const pos = computePositions(buildScale(parseNote('A'), 'pentatonic', 'minor-pentatonic'), std, 22);
    expect(pos.kind).toBe('box');
    expect(pos.patterns.map((p) => p.label)).toEqual(['Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5']);
    // lowest complete instance of each box (box 5 also fits in open position at frets 0–3)
    expect(shape('A', 'pentatonic', 'minor-pentatonic', 0)).toEqual([[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]]);
    expect(shape('A', 'pentatonic', 'minor-pentatonic', 1)).toEqual([[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]]);
    expect(shape('A', 'pentatonic', 'minor-pentatonic', 2)).toEqual([[10, 12], [10, 12], [10, 12], [9, 12], [10, 13], [10, 12]]);
    expect(shape('A', 'pentatonic', 'minor-pentatonic', 3)).toEqual([[0, 3], [0, 3], [0, 2], [0, 2], [1, 3], [0, 3]]);
    expect(shape('A', 'pentatonic', 'minor-pentatonic', 4)).toEqual([[3, 5], [3, 5], [2, 5], [2, 5], [3, 5], [3, 5]]);
  });

  it('G major: 3-notes-per-string pattern 1', () => {
    expect(shape('G', 'major', 'ionian', 0)).toEqual([[3, 5, 7], [3, 5, 7], [4, 5, 7], [4, 5, 7], [5, 7, 8], [5, 7, 8]]);
  });

  it('A minor blues box 1 = pentatonic box 1 plus the ♭5 inside the box', () => {
    expect(shape('A', 'blues', 'minor-blues', 0)).toEqual([[5, 8], [5, 6, 7], [5, 7], [5, 7, 8], [5, 8], [5, 8]]);
  });

  it('every pattern note is in the scale; neighbouring boxes share notes', () => {
    for (const [root, fam, mode, perNote] of [
      ['A', 'pentatonic', 'minor-pentatonic', 2],
      ['E', 'major', 'dorian', 3],
      ['C', 'harmonic-minor', 'harmonic-minor', 3],
      ['F#', 'melodic-minor', 'melodic-minor', 3],
    ] as const) {
      const scale = buildScale(parseNote(root), fam, mode);
      const pos = computePositions(scale, std, 24);
      for (const inst of pos.instances) for (const n of inst.notes) expect(scale.pcs).toContain(mod(n.midi, 12));
      // away from the nut and the last frets, each note sits in exactly `perNote` patterns
      for (const [k, list] of pos.membership) {
        const fret = Number(k.split('-')[1]);
        if (fret >= 7 && fret <= 14) expect(list.length).toBe(perNote);
      }
      // each pattern instance covers every scale note
      for (const inst of pos.instances.filter((i) => i.notes.length === std.strings.length * pos.notesPerString))
        expect(new Set(inst.notes.map((n) => mod(n.midi, 12))).size).toBe(scale.notes.length);
    }
  });
});
