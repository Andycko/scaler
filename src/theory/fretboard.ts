import { type Degree, type SpelledNote, mod, noteName, octaveOf, pitchClass } from './notes';
import type { Scale } from './scales';

export interface Tuning {
  id: string;
  name: string;
  /** Open-string MIDI numbers, lowest-pitched string first. */
  strings: number[];
  /** Open-string names (ASCII accidentals), lowest first. */
  names: string[];
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Standard (E A D G B E)', strings: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'E'] },
  { id: 'eb', name: 'Half step down (E♭ A♭ D♭ G♭ B♭ E♭)', strings: [39, 44, 49, 54, 58, 63], names: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'] },
  { id: 'd-standard', name: 'Whole step down (D G C F A D)', strings: [38, 43, 48, 53, 57, 62], names: ['D', 'G', 'C', 'F', 'A', 'D'] },
  { id: 'drop-d', name: 'Drop D (D A D G B E)', strings: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'E'] },
  { id: 'dadgad', name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62], names: ['D', 'A', 'D', 'G', 'A', 'D'] },
  { id: 'open-g', name: 'Open G (D G D G B D)', strings: [38, 43, 50, 55, 59, 62], names: ['D', 'G', 'D', 'G', 'B', 'D'] },
  { id: 'open-d', name: 'Open D (D A D F♯ A D)', strings: [38, 45, 50, 54, 57, 62], names: ['D', 'A', 'D', 'F#', 'A', 'D'] },
  { id: 'open-e', name: 'Open E (E B E G♯ B E)', strings: [40, 47, 52, 56, 59, 64], names: ['E', 'B', 'E', 'G#', 'B', 'E'] },
  { id: 'bass', name: '4-string bass (E A D G)', strings: [28, 33, 38, 43], names: ['E', 'A', 'D', 'G'] },
  { id: '7-string', name: '7-string (B E A D G B E)', strings: [35, 40, 45, 50, 55, 59, 64], names: ['B', 'E', 'A', 'D', 'G', 'B', 'E'] },
];

export interface FretNote {
  string: number; // 0 = lowest-pitched string
  fret: number;
  midi: number;
  note: SpelledNote;
  degree: Degree;
  scaleIndex: number;
  /** scientific octave number of the spelled note */
  sciOctave: number;
  isRoot: boolean;
  /** Octave group this note belongs to (for roots: the group it STARTS). */
  group: number;
  /** For roots on a boundary: the group it ENDS (shown as a split marker). */
  endsGroup: number | null;
}

export interface OctaveGroup {
  index: number;
  /** MIDI of the root that opens this octave. */
  startMidi: number;
  endMidi: number;
  label: string;
  /** Lowest / highest note of the group actually present on the board. */
  lowMidi: number;
  highMidi: number;
  partial: boolean;
}

export interface FretboardModel {
  notes: FretNote[];
  groups: OctaveGroup[];
}

export function computeFretboard(scale: Scale, tuning: Tuning, frets: number): FretboardModel {
  const rootPc = pitchClass(scale.root);
  const lowest = Math.min(...tuning.strings);
  const base = lowest - mod(lowest - rootPc, 12); // root at or below the lowest note

  type Raw = Omit<FretNote, 'group' | 'endsGroup'> & { raw: number };
  const raw: Raw[] = [];
  tuning.strings.forEach((open, s) => {
    for (let f = 0; f <= frets; f++) {
      const midi = open + f;
      const idx = scale.pcIndex.get(mod(midi, 12));
      if (idx === undefined) continue;
      const note = scale.notes[idx];
      raw.push({
        string: s,
        fret: f,
        midi,
        note,
        degree: scale.degrees[idx],
        scaleIndex: idx,
        sciOctave: octaveOf(note, midi),
        isRoot: idx === 0,
        raw: Math.floor((midi - base) / 12),
      });
    }
  });

  // A group "exists" when it contains at least one non-root note.
  const populated = new Set(raw.filter((n) => !n.isRoot).map((n) => n.raw));
  const order = [...populated].sort((a, b) => a - b);
  const renumber = new Map(order.map((r, i) => [r, i]));

  const notes: FretNote[] = raw.map(({ raw: r, ...n }) => {
    if (!n.isRoot) return { ...n, group: renumber.get(r)!, endsGroup: null };
    const starts = populated.has(r);
    const ends = populated.has(r - 1);
    if (starts && ends) return { ...n, group: renumber.get(r)!, endsGroup: renumber.get(r - 1)! };
    if (starts) return { ...n, group: renumber.get(r)!, endsGroup: null };
    if (ends) return { ...n, group: renumber.get(r - 1)!, endsGroup: null };
    // isolated root (scale with no other notes in reach) – keep it in its own slot
    return { ...n, group: renumber.get(r) ?? 0, endsGroup: null };
  });

  const groups: OctaveGroup[] = order.map((r, i) => {
    const startMidi = base + 12 * r;
    const endMidi = startMidi + 12;
    const members = notes.filter((n) => n.group === i || n.endsGroup === i);
    const lowMidi = Math.min(...members.map((n) => n.midi));
    const highMidi = Math.max(...members.map((n) => n.midi));
    const rootOct = (m: number) => noteName(scale.root) + String(octaveOf(scale.root, m));
    return {
      index: i,
      startMidi,
      endMidi,
      label: `${rootOct(startMidi)}–${rootOct(endMidi)}`,
      lowMidi,
      highMidi,
      partial: lowMidi > startMidi || highMidi < endMidi,
    };
  });

  return { notes, groups };
}

/** Does a fretboard note belong (fully or as a shared root) to `group`? */
export const inGroup = (n: FretNote, group: number) => n.group === group || n.endsGroup === group;

/**
 * Pitches (MIDI, ascending, de-duplicated) of the selected octave groups.
 * Contiguous groups are merged into one run; returns one array per run.
 */
export function groupRuns(model: FretboardModel, selected: number[]): { groups: number[]; midis: number[] }[] {
  const sorted = [...new Set(selected)].sort((a, b) => a - b);
  const runs: number[][] = [];
  let current: number[] = [];
  sorted.forEach((g, i) => {
    if (i > 0 && g !== sorted[i - 1] + 1) {
      runs.push(current);
      current = [];
    }
    current.push(g);
  });
  if (current.length) runs.push(current);
  return runs.map((run) => {
    const pitches = new Set<number>();
    for (const n of model.notes) if (run.some((g) => inGroup(n, g))) pitches.add(n.midi);
    return { groups: run, midis: [...pitches].sort((a, b) => a - b) };
  });
}
