/**
 * Core pitch & spelling primitives.
 *
 * A spelled note is a letter (C..B) plus an accidental offset in semitones.
 * Keeping letters explicit is what lets us spell scales correctly
 * (e.g. F♯ major contains E♯, not F; Ultralocrian contains B𝄫, not A).
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
/** Pitch class of each natural letter. */
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const;
/** Semitones of the major-scale degrees 1..7 (index 0..6). */
export const MAJOR_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

export interface SpelledNote {
  /** 0 = C … 6 = B */
  letter: number;
  /** accidental in semitones: -2 = 𝄫, -1 = ♭, 0 = ♮, 1 = ♯, 2 = 𝄪 */
  acc: number;
}

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export function pitchClass(n: SpelledNote): number {
  return mod(LETTER_PC[n.letter] + n.acc, 12);
}

const ACC_UNICODE: Record<string, string> = {
  '-3': '♭𝄫',
  '-2': '𝄫',
  '-1': '♭',
  '0': '',
  '1': '♯',
  '2': '𝄪',
  '3': '♯𝄪',
};
const ACC_ASCII: Record<string, string> = {
  '-3': 'bbb',
  '-2': 'bb',
  '-1': 'b',
  '0': '',
  '1': '#',
  '2': '##',
  '3': '###',
};

export function accidentalSymbol(acc: number): string {
  return ACC_UNICODE[String(acc)] ?? (acc > 0 ? '♯'.repeat(acc) : '♭'.repeat(-acc));
}

export function noteName(n: SpelledNote): string {
  return LETTERS[n.letter] + accidentalSymbol(n.acc);
}

/** ASCII spelling, e.g. "F#", "Bb", "Ebb" (used for VexFlow / file names). */
export function noteNameAscii(n: SpelledNote): string {
  return LETTERS[n.letter] + (ACC_ASCII[String(n.acc)] ?? '');
}

export function parseNote(s: string): SpelledNote {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2}|♯|♭|𝄪|𝄫)?$/.exec(s.trim());
  if (!m) throw new Error(`Cannot parse note "${s}"`);
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]);
  const a = m[2] ?? '';
  const acc =
    a === '#' || a === '♯'
      ? 1
      : a === '##' || a === '𝄪'
        ? 2
        : a === 'b' || a === '♭'
          ? -1
          : a === 'bb' || a === '𝄫'
            ? -2
            : 0;
  return { letter, acc };
}

/**
 * A scale degree / interval in "formula" notation: number 1..7 (9, 11, 13
 * allowed for chord extensions) plus accidental relative to the MAJOR scale.
 * e.g. ♭3 = {num:3, acc:-1}; ♯4 = {num:4, acc:1}; 𝄫7 = {num:7, acc:-2}.
 */
export interface Degree {
  num: number;
  acc: number;
}

export function parseDegree(s: string): Degree {
  const m = /^(bb|b|##|#|♭|♯|𝄫|𝄪)?(\d+)$/.exec(s.trim());
  if (!m) throw new Error(`Cannot parse degree "${s}"`);
  const a = m[1] ?? '';
  const acc =
    a === '#' || a === '♯' ? 1 : a === '##' || a === '𝄪' ? 2 : a === 'b' || a === '♭' ? -1 : a === 'bb' || a === '𝄫' ? -2 : 0;
  return { num: Number(m[2]), acc };
}

export function degreeSemitones(d: Degree): number {
  const simple = ((d.num - 1) % 7) + 1;
  const octaves = Math.floor((d.num - 1) / 7);
  return MAJOR_SEMITONES[simple - 1] + d.acc + 12 * octaves;
}

export function degreeLabel(d: Degree): string {
  return accidentalSymbol(d.acc) + String(d.num);
}

export function degreeLabelAscii(d: Degree): string {
  return (ACC_ASCII[String(d.acc)] ?? '') + String(d.num);
}

/** Spell the note that lies `degree` above `root` (letter-correct). */
export function spellDegree(root: SpelledNote, d: Degree): SpelledNote {
  const letter = mod(root.letter + d.num - 1, 7);
  const targetPc = mod(pitchClass(root) + degreeSemitones(d), 12);
  let acc = mod(targetPc - LETTER_PC[letter], 12);
  if (acc > 6) acc -= 12;
  return { letter, acc };
}

/**
 * Octave number (scientific pitch notation) of a spelled note sounding at
 * `midi`. Handles B♯/C♭ boundaries: B♯3 sounds as MIDI 60, C♭4 as MIDI 59.
 */
export function octaveOf(n: SpelledNote, midi: number): number {
  return Math.floor((midi - n.acc) / 12) - 1;
}

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Generic sharp-based name for a MIDI number (used only where no key context exists, e.g. tunings). */
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function midiNameGeneric(midi: number): string {
  return SHARP_NAMES[mod(midi, 12)] + String(Math.floor(midi / 12) - 1);
}

/** The 12 key choices. Black keys offer both spellings; the app picks the clearer one. */
export interface KeyChoice {
  pc: number;
  label: string;
  spellings: SpelledNote[];
}

export const KEY_CHOICES: KeyChoice[] = [
  { pc: 0, label: 'C', spellings: [parseNote('C')] },
  { pc: 1, label: 'C♯/D♭', spellings: [parseNote('C#'), parseNote('Db')] },
  { pc: 2, label: 'D', spellings: [parseNote('D')] },
  { pc: 3, label: 'D♯/E♭', spellings: [parseNote('D#'), parseNote('Eb')] },
  { pc: 4, label: 'E', spellings: [parseNote('E')] },
  { pc: 5, label: 'F', spellings: [parseNote('F')] },
  { pc: 6, label: 'F♯/G♭', spellings: [parseNote('F#'), parseNote('Gb')] },
  { pc: 7, label: 'G', spellings: [parseNote('G')] },
  { pc: 8, label: 'G♯/A♭', spellings: [parseNote('G#'), parseNote('Ab')] },
  { pc: 9, label: 'A', spellings: [parseNote('A')] },
  { pc: 10, label: 'A♯/B♭', spellings: [parseNote('A#'), parseNote('Bb')] },
  { pc: 11, label: 'B', spellings: [parseNote('B')] },
];

export const sameNote = (a: SpelledNote, b: SpelledNote) => a.letter === b.letter && a.acc === b.acc;
