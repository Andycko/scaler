import {
  type Degree,
  type SpelledNote,
  accidentalSymbol,
  degreeLabelAscii,
  degreeSemitones,
  mod,
  noteName,
  parseDegree,
  pitchClass,
  spellDegree,
} from './notes';
import type { Scale } from './scales';

export interface ChordQuality {
  id: string;
  /** Chord-symbol suffix, e.g. "m7♭5". */
  symbol: string;
  /** Suffix appended to the roman numeral. */
  roman: string;
  name: string;
  formula: string[];
}

export const QUALITIES: ChordQuality[] = [
  { id: 'maj', symbol: '', roman: '', name: 'major', formula: ['1', '3', '5'] },
  { id: 'min', symbol: 'm', roman: '', name: 'minor', formula: ['1', 'b3', '5'] },
  { id: 'dim', symbol: '°', roman: '°', name: 'diminished', formula: ['1', 'b3', 'b5'] },
  { id: 'aug', symbol: '+', roman: '+', name: 'augmented', formula: ['1', '3', '#5'] },
  { id: 'majb5', symbol: '(♭5)', roman: '(♭5)', name: 'major ♭5', formula: ['1', '3', 'b5'] },
  { id: 'dimb3', symbol: '(𝄫3)', roman: '(𝄫3)', name: 'diminished-third triad', formula: ['1', 'bb3', 'b5'] },
  { id: 'sus2', symbol: 'sus2', roman: 'sus2', name: 'suspended 2nd', formula: ['1', '2', '5'] },
  { id: 'sus4', symbol: 'sus4', roman: 'sus4', name: 'suspended 4th', formula: ['1', '4', '5'] },
  { id: 'maj7', symbol: 'maj7', roman: 'maj7', name: 'major 7th', formula: ['1', '3', '5', '7'] },
  { id: '7', symbol: '7', roman: '7', name: 'dominant 7th', formula: ['1', '3', '5', 'b7'] },
  { id: 'm7', symbol: 'm7', roman: '7', name: 'minor 7th', formula: ['1', 'b3', '5', 'b7'] },
  { id: 'm7b5', symbol: 'm7♭5', roman: 'ø7', name: 'half-diminished 7th', formula: ['1', 'b3', 'b5', 'b7'] },
  { id: 'dim7', symbol: '°7', roman: '°7', name: 'diminished 7th', formula: ['1', 'b3', 'b5', 'bb7'] },
  { id: 'mMaj7', symbol: 'm(maj7)', roman: '(maj7)', name: 'minor-major 7th', formula: ['1', 'b3', '5', '7'] },
  { id: 'augMaj7', symbol: 'maj7♯5', roman: '+maj7', name: 'augmented major 7th', formula: ['1', '3', '#5', '7'] },
  { id: 'aug7', symbol: '7♯5', roman: '+7', name: 'augmented 7th', formula: ['1', '3', '#5', 'b7'] },
  { id: 'dimMaj7', symbol: '°(maj7)', roman: '°(maj7)', name: 'diminished major 7th', formula: ['1', 'b3', 'b5', '7'] },
  { id: '7b5', symbol: '7♭5', roman: '7♭5', name: 'dominant 7th ♭5', formula: ['1', '3', 'b5', 'b7'] },
  { id: 'maj7b5', symbol: 'maj7♭5', roman: 'maj7♭5', name: 'major 7th ♭5', formula: ['1', '3', 'b5', '7'] },
  { id: 'dim-bb3-7', symbol: '(𝄫3)°7', roman: '(𝄫3)°7', name: 'diminished-third 7th', formula: ['1', 'bb3', 'b5', 'bb7'] },
  { id: '7sus4', symbol: '7sus4', roman: '7sus4', name: 'dominant 7th sus4', formula: ['1', '4', '5', 'b7'] },
  { id: '6', symbol: '6', roman: '6', name: 'major 6th', formula: ['1', '3', '5', '6'] },
  { id: 'm6', symbol: 'm6', roman: '6', name: 'minor 6th', formula: ['1', 'b3', '5', '6'] },
  { id: '7b9', symbol: '7♭9', roman: '7♭9', name: 'dominant 7th ♭9', formula: ['1', '3', '5', 'b7', 'b9'] },
  { id: '7#5#9', symbol: '7♯5♯9', roman: '7alt', name: 'altered dominant (7♯5♯9)', formula: ['1', '3', '#5', 'b7', '#9'] },
];

const QUALITY_BY_FORMULA = new Map(QUALITIES.map((q) => [q.formula.join(' '), q]));

export function getQuality(id: string): ChordQuality {
  const q = QUALITIES.find((x) => x.id === id);
  if (!q) throw new Error(`Unknown chord quality ${id}`);
  return q;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface Chord {
  root: SpelledNote;
  /** Root's degree relative to the scale tonic (e.g. ♭VII → {num:7, acc:-1}). */
  rootDegree: Degree;
  quality: ChordQuality;
  /** e.g. "Bbmaj7" style name with unicode accidentals: "B♭maj7" */
  symbol: string;
  roman: string;
  tones: SpelledNote[];
  /** Chord formula relative to its own root, e.g. ["1","b3","5"]. */
  formula: string[];
  /** Chord tones whose pitch class is not in the scale. */
  outside: SpelledNote[];
}

/** Roman numeral: case from the chord's 3rd (minor/diminished → lower case). */
export function romanNumeral(rootDegree: Degree, q: ChordQuality): string {
  const third = q.formula.find((f) => /^(bb|b|#)?3$/.test(f));
  const minor = third !== undefined && parseDegree(third).acc < 0;
  const base = ROMAN[(rootDegree.num - 1) % 7];
  return accidentalSymbol(rootDegree.acc) + (minor ? base.toLowerCase() : base) + q.roman;
}

export function makeChord(scale: Scale, rootDegree: Degree, quality: ChordQuality): Chord {
  const root = spellDegree(scale.root, rootDegree);
  const tones = quality.formula.map((f) => spellDegree(root, parseDegree(f)));
  const scalePcs = new Set(scale.pcs);
  return {
    root,
    rootDegree,
    quality,
    symbol: noteName(root) + quality.symbol,
    roman: romanNumeral(rootDegree, quality),
    tones,
    formula: quality.formula,
    outside: tones.filter((t) => !scalePcs.has(pitchClass(t))),
  };
}

/**
 * Build the chord on scale step `index` (0-based) by stacking scale-thirds.
 * Only meaningful for 7-note (heptatonic) scales.
 */
export function stackedChord(scale: Scale, index: number, size: 3 | 4): Chord {
  const n = scale.notes.length;
  const root = scale.notes[index];
  const formula: string[] = [];
  for (let k = 0; k < size; k++) {
    const i = index + 2 * k;
    const tone = scale.notes[i % n];
    // interval measured with letters (always a 3rd/5th/7th because scale letters are consecutive)
    const num = mod(tone.letter - root.letter, 7) + 1;
    const semis = mod(pitchClass(tone) - pitchClass(root), 12);
    let acc = semis - degreeSemitones({ num, acc: 0 });
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    formula.push(degreeLabelAscii({ num, acc }));
  }
  const quality: ChordQuality = QUALITY_BY_FORMULA.get(formula.join(' ')) ?? {
    id: 'custom',
    symbol: `(${formula.slice(1).join(' ').replace(/b/g, '♭').replace(/#/g, '♯')})`,
    roman: `(${formula.slice(1).join(' ')})`,
    name: 'stacked thirds',
    formula,
  };
  return makeChord(scale, scale.degrees[index], quality);
}

export function isHeptatonic(scale: Scale): boolean {
  if (scale.notes.length !== 7) return false;
  const letters = new Set(scale.notes.map((n) => n.letter));
  return letters.size === 7;
}

export function diatonicChords(scale: Scale, size: 3 | 4): Chord[] {
  if (!isHeptatonic(scale)) return [];
  return scale.notes.map((_, i) => stackedChord(scale, i, size));
}
