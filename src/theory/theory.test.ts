import { describe, expect, it } from 'vitest';
import { diatonicChords, isHeptatonic } from './chords';
import { fingerRun } from './fingering';
import { TUNINGS, computeFretboard, groupRuns, inGroup } from './fretboard';
import {
  KEY_CHOICES,
  degreeLabelAscii,
  degreeSemitones,
  mod,
  noteName,
  noteNameAscii,
  octaveOf,
  parseNote,
  pitchClass,
} from './notes';
import { PROGRESSIONS, progressionsFor } from './progressions';
import { FAMILIES, autoRootSpelling, buildScale, keySignatureFor, modeFormula } from './scales';

const standard = TUNINGS[0];
const formulaStr = (fam: string, mode: string) => modeFormula(fam, mode).map(degreeLabelAscii).join(' ');
const spelled = (root: string, fam: string, mode: string) =>
  buildScale(parseNote(root), fam, mode).notes.map(noteNameAscii).join(' ');

describe('mode formulas (derived by rotation) match the textbook formulas', () => {
  const expected: Record<string, Record<string, string>> = {
    major: {
      ionian: '1 2 3 4 5 6 7',
      dorian: '1 2 b3 4 5 6 b7',
      phrygian: '1 b2 b3 4 5 b6 b7',
      lydian: '1 2 3 #4 5 6 7',
      mixolydian: '1 2 3 4 5 6 b7',
      aeolian: '1 2 b3 4 5 b6 b7',
      locrian: '1 b2 b3 4 b5 b6 b7',
    },
    'harmonic-minor': {
      'harmonic-minor': '1 2 b3 4 5 b6 7',
      'locrian-nat6': '1 b2 b3 4 b5 6 b7',
      'ionian-sharp5': '1 2 3 4 #5 6 7',
      'dorian-sharp4': '1 2 b3 #4 5 6 b7',
      'phrygian-dominant': '1 b2 3 4 5 b6 b7',
      'lydian-sharp2': '1 #2 3 #4 5 6 7',
      ultralocrian: '1 b2 b3 b4 b5 b6 bb7',
    },
    'melodic-minor': {
      'melodic-minor': '1 2 b3 4 5 6 7',
      'dorian-b2': '1 b2 b3 4 5 6 b7',
      'lydian-augmented': '1 2 3 #4 #5 6 7',
      'lydian-dominant': '1 2 3 #4 5 6 b7',
      'mixolydian-b6': '1 2 3 4 5 b6 b7',
      'locrian-nat2': '1 2 b3 4 b5 b6 b7',
      altered: '1 b2 b3 b4 b5 b6 b7',
    },
    'harmonic-major': {
      'harmonic-major': '1 2 3 4 5 b6 7',
      'dorian-b5': '1 2 b3 4 b5 6 b7',
      'phrygian-b4': '1 b2 b3 b4 5 b6 b7',
      'lydian-b3': '1 2 b3 #4 5 6 7',
      'mixolydian-b2': '1 b2 3 4 5 6 b7',
      'lydian-aug-sharp2': '1 #2 3 #4 #5 6 7',
      'locrian-bb7': '1 b2 b3 4 b5 b6 bb7',
    },
    pentatonic: {
      'major-pentatonic': '1 2 3 5 6',
      'suspended-pentatonic': '1 2 4 5 b7',
      'man-gong': '1 b3 4 b6 b7',
      ritusen: '1 2 4 5 6',
      'minor-pentatonic': '1 b3 4 5 b7',
    },
    blues: {
      'minor-blues': '1 b3 4 b5 5 b7',
      'major-blues': '1 2 b3 3 5 6',
    },
    symmetric: {
      'whole-tone': '1 2 3 #4 #5 b7',
      'diminished-wh': '1 2 b3 4 b5 #5 6 7',
      'diminished-hw': '1 b2 #2 3 #4 5 6 b7',
    },
  };
  for (const fam of FAMILIES) {
    for (const mode of fam.modes) {
      it(`${fam.name} / ${mode.name}`, () => {
        expect(formulaStr(fam.id, mode.id)).toBe(expected[fam.id][mode.id]);
      });
    }
  }

  it('symmetric scales have the right step patterns', () => {
    const steps = (fam: string, mode: string) => {
      const s = modeFormula(fam, mode).map(degreeSemitones);
      return s.map((v, i) => mod((s[(i + 1) % s.length] ?? 12) - v, 12)).join('');
    };
    expect(steps('symmetric', 'whole-tone')).toBe('222222');
    expect(steps('symmetric', 'diminished-wh')).toBe('21212121');
    expect(steps('symmetric', 'diminished-hw')).toBe('12121212');
  });
});

describe('scale spelling', () => {
  it('spells all major scales correctly', () => {
    const majors: Record<string, string> = {
      C: 'C D E F G A B',
      G: 'G A B C D E F#',
      D: 'D E F# G A B C#',
      A: 'A B C# D E F# G#',
      E: 'E F# G# A B C# D#',
      B: 'B C# D# E F# G# A#',
      'F#': 'F# G# A# B C# D# E#',
      'C#': 'C# D# E# F# G# A# B#',
      F: 'F G A Bb C D E',
      Bb: 'Bb C D Eb F G A',
      Eb: 'Eb F G Ab Bb C D',
      Ab: 'Ab Bb C Db Eb F G',
      Db: 'Db Eb F Gb Ab Bb C',
      Gb: 'Gb Ab Bb Cb Db Eb F',
    };
    for (const [root, notes] of Object.entries(majors)) expect(spelled(root, 'major', 'ionian')).toBe(notes);
  });

  it('spells modes, minors and exotic scales with correct letters', () => {
    expect(spelled('D', 'major', 'dorian')).toBe('D E F G A B C');
    expect(spelled('E', 'major', 'phrygian')).toBe('E F G A B C D');
    expect(spelled('F', 'major', 'lydian')).toBe('F G A B C D E');
    expect(spelled('G', 'major', 'mixolydian')).toBe('G A B C D E F');
    expect(spelled('A', 'major', 'aeolian')).toBe('A B C D E F G');
    expect(spelled('B', 'major', 'locrian')).toBe('B C D E F G A');
    expect(spelled('A', 'harmonic-minor', 'harmonic-minor')).toBe('A B C D E F G#');
    expect(spelled('E', 'harmonic-minor', 'phrygian-dominant')).toBe('E F G# A B C D');
    expect(spelled('G#', 'harmonic-minor', 'ultralocrian')).toBe('G# A B C D E F');
    expect(spelled('C', 'harmonic-minor', 'ultralocrian')).toBe('C Db Eb Fb Gb Ab Bbb');
    expect(spelled('C', 'melodic-minor', 'melodic-minor')).toBe('C D Eb F G A B');
    expect(spelled('G', 'melodic-minor', 'altered')).toBe('G Ab Bb Cb Db Eb F');
    expect(spelled('F', 'melodic-minor', 'lydian-dominant')).toBe('F G A B C D Eb');
    expect(spelled('A', 'pentatonic', 'minor-pentatonic')).toBe('A C D E G');
    expect(spelled('C', 'pentatonic', 'major-pentatonic')).toBe('C D E G A');
    expect(spelled('E', 'blues', 'minor-blues')).toBe('E G A Bb B D');
    expect(spelled('A', 'blues', 'major-blues')).toBe('A B C C# E F#');
    expect(spelled('C', 'symmetric', 'whole-tone')).toBe('C D E F# G# Bb');
    expect(spelled('C', 'symmetric', 'diminished-hw')).toBe('C Db D# E F# G A Bb');
    expect(spelled('C', 'symmetric', 'diminished-wh')).toBe('C D Eb F Gb G# A B');
  });

  it('every heptatonic scale uses each letter exactly once, for every key', () => {
    for (const fam of FAMILIES)
      for (const mode of fam.modes)
        for (const key of KEY_CHOICES)
          for (const root of key.spellings) {
            const s = buildScale(root, fam.id, mode.id);
            // pitch content always matches the formula
            s.notes.forEach((n, i) => expect(mod(pitchClass(n) - pitchClass(root), 12)).toBe(mod(degreeSemitones(s.degrees[i]), 12)));
            // pitch classes are distinct
            expect(new Set(s.pcs).size).toBe(s.notes.length);
            if (s.notes.length === 7) expect(isHeptatonic(s)).toBe(true);
          }
  });

  it('auto-picks the conventional enharmonic tonic', () => {
    const pick = (pc: number, fam: string, mode: string) => noteName(autoRootSpelling(pc, fam, mode));
    expect(pick(8, 'major', 'ionian')).toBe('A♭');
    expect(pick(1, 'major', 'ionian')).toBe('D♭');
    expect(pick(1, 'major', 'dorian')).toBe('C♯');
    expect(pick(10, 'major', 'aeolian')).toBe('B♭');
    expect(pick(3, 'major', 'ionian')).toBe('E♭');
    expect(pick(1, 'pentatonic', 'minor-pentatonic')).toBe('C♯');
    expect(pick(8, 'harmonic-minor', 'harmonic-minor')).toBe('G♯');
    // no generated scale for an auto-picked tonic contains triple accidentals
    for (const fam of FAMILIES)
      for (const mode of fam.modes)
        for (let pc = 0; pc < 12; pc++) {
          const s = buildScale(autoRootSpelling(pc, fam.id, mode.id), fam.id, mode.id);
          s.notes.forEach((n) => expect(Math.abs(n.acc)).toBeLessThanOrEqual(2));
        }
  });

  it('octave numbers respect B♯/C♭ boundaries', () => {
    expect(octaveOf(parseNote('B#'), 60)).toBe(3);
    expect(octaveOf(parseNote('Cb'), 59)).toBe(4);
    expect(octaveOf(parseNote('C'), 60)).toBe(4);
    expect(octaveOf(parseNote('E'), 40)).toBe(2);
  });
});

describe('key signatures', () => {
  const sig = (root: string, fam: string, mode: string) => keySignatureFor(buildScale(parseNote(root), fam, mode));
  it('uses the parent major key', () => {
    expect(sig('D', 'major', 'dorian')).toBe('C');
    expect(sig('E', 'major', 'phrygian')).toBe('C');
    expect(sig('Bb', 'major', 'mixolydian')).toBe('Eb');
    expect(sig('F#', 'pentatonic', 'minor-pentatonic')).toBe('A');
    expect(sig('C', 'harmonic-minor', 'harmonic-minor')).toBe('Eb');
    expect(sig('A', 'blues', 'major-blues')).toBe('A');
    expect(sig('C', 'symmetric', 'whole-tone')).toBeNull();
    expect(sig('G#', 'major', 'ionian')).toBeNull(); // would need F𝄪
  });
});

describe('chords', () => {
  const syms = (root: string, fam: string, mode: string, size: 3 | 4) =>
    diatonicChords(buildScale(parseNote(root), fam, mode), size).map((c) => c.symbol).join(' ');
  const romans = (root: string, fam: string, mode: string, size: 3 | 4) =>
    diatonicChords(buildScale(parseNote(root), fam, mode), size).map((c) => c.roman).join(' ');

  it('builds diatonic triads and sevenths', () => {
    expect(syms('C', 'major', 'ionian', 3)).toBe('C Dm Em F G Am B°');
    expect(romans('C', 'major', 'ionian', 3)).toBe('I ii iii IV V vi vii°');
    expect(syms('C', 'major', 'ionian', 4)).toBe('Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5');
    expect(romans('C', 'major', 'ionian', 4)).toBe('Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7');
    expect(romans('D', 'major', 'dorian', 3)).toBe('i ii ♭III IV v vi° ♭VII');
    expect(romans('E', 'major', 'phrygian', 3)).toBe('i ♭II ♭III iv v° ♭VI ♭vii');
    expect(romans('F', 'major', 'lydian', 3)).toBe('I II iii ♯iv° V vi vii');
    expect(romans('G', 'major', 'mixolydian', 3)).toBe('I ii iii° IV v vi ♭VII');
    expect(romans('A', 'major', 'aeolian', 3)).toBe('i ii° ♭III iv v ♭VI ♭VII');
    expect(romans('B', 'major', 'locrian', 3)).toBe('i° ♭II ♭iii iv ♭V ♭VI ♭vii');
    expect(syms('A', 'harmonic-minor', 'harmonic-minor', 3)).toBe('Am B° C+ Dm E F G♯°');
    expect(syms('A', 'harmonic-minor', 'harmonic-minor', 4)).toBe('Am(maj7) Bm7♭5 Cmaj7♯5 Dm7 E7 Fmaj7 G♯°7');
    expect(syms('C', 'melodic-minor', 'melodic-minor', 3)).toBe('Cm Dm E♭+ F G A° B°');
    expect(syms('C', 'melodic-minor', 'melodic-minor', 4)).toBe('Cm(maj7) Dm7 E♭maj7♯5 F7 G7 Am7♭5 Bm7♭5');
    expect(syms('C', 'harmonic-major', 'harmonic-major', 4)).toBe('Cmaj7 Dm7♭5 Em7 Fm(maj7) G7 A♭maj7♯5 B°7');
  });

  it('chord tones are spelled in thirds', () => {
    for (const fam of FAMILIES)
      for (const mode of fam.modes)
        for (const key of KEY_CHOICES) {
          const s = buildScale(key.spellings[0], fam.id, mode.id);
          for (const ch of diatonicChords(s, 4)) {
            ch.tones.forEach((t, i) => expect(mod(t.letter - ch.root.letter, 7)).toBe((2 * i) % 7));
            expect(ch.outside).toHaveLength(0); // diatonic chords never leave the scale
          }
        }
  });
});

describe('progressions', () => {
  it('every mode has progressions', () => {
    for (const fam of FAMILIES) for (const mode of fam.modes) expect(PROGRESSIONS[mode.id]?.length ?? 0).toBeGreaterThan(0);
  });

  it('progression names match the computed roman numerals', () => {
    for (const fam of FAMILIES)
      for (const mode of fam.modes)
        for (const key of KEY_CHOICES) {
          const s = buildScale(key.spellings[0], fam.id, mode.id);
          for (const p of progressionsFor(s)) {
            if (!/^[♭♯ivIV°ø+]/.test(p.name)) continue; // descriptive names (e.g. "12-bar blues")
            const tokens = p.name
              .replace(/ \(.*\)$/, '')
              .replace(/ vamp$/, '')
              .split(/–| → /);
            expect(tokens).toEqual(p.chords.map((c) => c.roman));
          }
        }
  });

  it('diatonic progressions stay in the scale; named examples are right', () => {
    const p = (root: string, fam: string, mode: string, i: number) =>
      progressionsFor(buildScale(parseNote(root), fam, mode))[i].chords.map((c) => c.symbol).join(' ');
    expect(p('C', 'major', 'ionian', 2)).toBe('Dm7 G7 Cmaj7');
    expect(p('A', 'major', 'dorian', 0)).toBe('Am7 D7');
    expect(p('E', 'harmonic-minor', 'phrygian-dominant', 1)).toBe('E Am F E');
    expect(p('A', 'pentatonic', 'minor-pentatonic', 2)).toBe('A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7');
    expect(p('B', 'melodic-minor', 'altered', 0)).toBe('B7♯5♯9 Em');
    const alt = progressionsFor(buildScale(parseNote('B'), 'melodic-minor', 'altered'))[0].chords[0];
    expect(alt.outside).toHaveLength(0); // every altered tension is in the scale
    const blues = progressionsFor(buildScale(parseNote('A'), 'blues', 'minor-blues'))[0].chords[0];
    expect(blues.outside.map(noteName)).toEqual(['C♯']); // the major 3rd against the ♭3
  });
});

describe('fretboard & octaves', () => {
  const s = buildScale(parseNote('A'), 'pentatonic', 'minor-pentatonic');
  const fb = computeFretboard(s, standard, 22);

  it('finds every scale note on every string', () => {
    for (const n of fb.notes) expect(s.pcs).toContain(mod(n.midi, 12));
    // A minor pentatonic: 5 notes per octave, low E string frets 0..22
    expect(fb.notes.filter((n) => n.string === 0).map((n) => n.fret)).toEqual([0, 3, 5, 8, 10, 12, 15, 17, 20, 22]);
  });

  it('groups notes into root-to-root octaves; boundary roots are shared', () => {
    expect(fb.groups.map((g) => g.label)).toEqual(['A1–A2', 'A2–A3', 'A3–A4', 'A4–A5', 'A5–A6']);
    expect(fb.groups[0].partial).toBe(true);
    for (const n of fb.notes) {
      const g = fb.groups[n.group];
      expect(n.midi).toBeGreaterThanOrEqual(g.startMidi);
      expect(n.midi).toBeLessThanOrEqual(g.endMidi);
      if (n.endsGroup !== null) {
        expect(n.isRoot).toBe(true);
        expect(fb.groups[n.endsGroup].endMidi).toBe(n.midi);
        expect(g.startMidi).toBe(n.midi);
      }
    }
    const a2 = fb.notes.find((n) => n.string === 1 && n.fret === 0)!; // open A string = A2
    expect(a2.isRoot).toBe(true);
    expect([a2.endsGroup, a2.group]).toEqual([0, 1]);
    // highest A on board (A5, 1st string fret 17) ends group 3 and starts group 4
    const top = fb.notes.find((n) => n.string === 5 && n.fret === 17)!;
    expect(top.midi).toBe(81);
    expect([top.endsGroup, top.group]).toEqual([3, 4]);
  });

  it('runs merge contiguous octaves', () => {
    const runs = groupRuns(fb, [1, 2]).map((r) => r.midis);
    expect(runs).toHaveLength(1);
    expect(runs[0][0]).toBe(45);
    expect(runs[0].at(-1)).toBe(69);
    expect(runs[0]).toEqual([45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69]);
    expect(groupRuns(fb, [0, 2])).toHaveLength(2);
    expect(fb.notes.filter((n) => inGroup(n, 1)).every((n) => n.midi >= 45 && n.midi <= 57)).toBe(true);
  });
});

describe('fingering', () => {
  it('produces playable, correct positions that move across strings with the run', () => {
    const s = buildScale(parseNote('G'), 'major', 'ionian');
    const fb = computeFretboard(s, standard, 15);
    const runs = groupRuns(fb, [1, 2]).map((r) => r.midis);
    for (const run of runs) {
      const pos = fingerRun(run, standard, 15);
      pos.forEach((p, i) => expect(standard.strings[p.string] + p.fret).toBe(run[i]));
      for (let i = 1; i < pos.length; i++) expect(pos[i].string).toBeGreaterThanOrEqual(pos[i - 1].string);
      const fretted = pos.filter((p) => p.fret > 0).map((p) => p.fret);
      expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(7);
    }
  });
});

describe('tunings', () => {
  it('string names match the open-string pitches', () => {
    for (const t of TUNINGS) {
      expect(t.names).toHaveLength(t.strings.length);
      t.names.forEach((n, i) => expect(pitchClass(parseNote(n))).toBe(mod(t.strings[i], 12)));
      for (let i = 1; i < t.strings.length; i++) expect(t.strings[i]).toBeGreaterThan(t.strings[i - 1]);
    }
  });
});
