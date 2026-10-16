import { describe, expect, it } from 'vitest';
import { diatonicChords } from './chords';
import { noteName, parseNote } from './notes';
import { buildScale } from './scales';
import { degreeOptions, resolveUserProgression, sanitize, storeChord } from './userProgressions';

const sym = (root: string, fam: string, mode: string, chords: { root: string; q: string }[]) =>
  resolveUserProgression(buildScale(parseNote(root), fam, mode), { id: 'x', name: 'x', chords })
    .map((c) => c.symbol)
    .join(' ');

describe('user progressions', () => {
  const axis = [
    { root: '1', q: 'min' },
    { root: 'b6', q: 'maj' },
    { root: 'b3', q: 'maj' },
    { root: 'b7', q: 'maj' },
  ];

  it('are stored relative to the key and transpose correctly', () => {
    expect(sym('A', 'major', 'aeolian', axis)).toBe('Am F C G');
    expect(sym('E', 'major', 'aeolian', axis)).toBe('Em C G D');
    expect(sym('Bb', 'major', 'aeolian', axis)).toBe('B♭m G♭ D♭ A♭');
    expect(sym('C', 'major', 'ionian', [{ root: '2', q: 'm7' }, { root: '5', q: '7' }, { root: '1', q: 'maj7' }])).toBe('Dm7 G7 Cmaj7');
  });

  it('round-trips the scale chords the builder adds, roman numerals included', () => {
    const s = buildScale(parseNote('G'), 'harmonic-minor', 'harmonic-minor');
    for (const size of [3, 4] as const) {
      const chords = diatonicChords(s, size);
      const back = resolveUserProgression(s, { id: 'x', name: 'x', chords: chords.map(storeChord) });
      expect(back.map((c) => c.symbol)).toEqual(chords.map((c) => c.symbol));
      expect(back.map((c) => c.roman)).toEqual(chords.map((c) => c.roman));
      back.forEach((c) => expect(c.outside).toHaveLength(0));
    }
  });

  it('flags chord tones outside the current scale', () => {
    const s = buildScale(parseNote('A'), 'pentatonic', 'minor-pentatonic');
    const [d7] = resolveUserProgression(s, { id: 'x', name: 'x', chords: [{ root: '4', q: '7' }] });
    expect(d7.symbol).toBe('D7');
    expect(d7.outside.map(noteName)).toEqual(['F♯']);
  });

  it('offers chord roots spelled like the scale', () => {
    expect(degreeOptions(buildScale(parseNote('B'), 'major', 'locrian'))[6]).toBe('b5');
    expect(degreeOptions(buildScale(parseNote('F'), 'major', 'lydian'))[6]).toBe('#4');
    expect(degreeOptions(buildScale(parseNote('C'), 'major', 'ionian'))).toEqual(['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7']);
  });

  it('ignores malformed saved data', () => {
    expect(sanitize('nope')).toEqual([]);
    expect(
      sanitize([
        { id: 'a', name: 'ok', chords: [{ root: 'b7', q: 'maj' }, { root: 'x', q: 'maj' }, { root: '1', q: 'nope' }] },
        { id: 'b', name: 'empty', chords: [] },
        { name: 'no id', chords: [{ root: '1', q: 'maj' }] },
      ]),
    ).toEqual([{ id: 'a', name: 'ok', chords: [{ root: 'b7', q: 'maj' }] }]);
  });
});
