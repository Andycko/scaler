import type { Tuning } from './fretboard';
import { mod } from './notes';
import type { Scale } from './scales';

/**
 * Scale positions ("box shapes").
 *
 * A pattern starts on one scale note on the lowest string and then walks up
 * the scale, putting a fixed number of consecutive scale notes on each
 * string:
 *  - pentatonic scales → 2 notes per string (the classic five boxes),
 *  - blues scales      → the boxes of their pentatonic core, plus the added
 *                        blue note wherever it falls inside the box's frets,
 *  - everything else   → 3 notes per string (3NPS patterns).
 * Pattern n is the one that starts on scale degree n, so "Box 1" / "Pattern 1"
 * starts on the root — the usual numbering.
 */

export interface PositionNote {
  string: number;
  fret: number;
  midi: number;
}

export interface PatternInstance {
  pattern: number;
  notes: PositionNote[];
  minFret: number;
  maxFret: number;
}

export interface Pattern {
  index: number;
  /** Scale index of the starting note. */
  start: number;
  label: string;
  /** First complete instance on the board (for labels & playback). */
  first: PatternInstance | null;
}

export interface PositionModel {
  kind: 'box' | '3nps';
  notesPerString: number;
  patterns: Pattern[];
  instances: PatternInstance[];
  /** "string-fret" → pattern indexes containing that position. */
  membership: Map<string, number[]>;
}

const key = (s: number, f: number) => `${s}-${f}`;

/** For blues scales: the pentatonic core (scale indexes) and the added notes. */
function bluesCore(scale: Scale): { core: number[]; extra: number[] } | null {
  if (scale.familyId !== 'blues') return null;
  // the blue note is the chromatic passing tone: the one whose removal leaves no half steps
  for (let drop = 0; drop < scale.notes.length; drop++) {
    const rest = scale.pcs.map((pc, i) => ({ pc, i })).filter((x) => x.i !== drop);
    const sorted = [...rest].sort((a, b) => a.pc - b.pc);
    const steps = sorted.map((x, j) => mod(sorted[(j + 1) % sorted.length].pc - x.pc, 12));
    if (steps.every((s) => s >= 2)) return { core: rest.map((x) => x.i), extra: [drop] };
  }
  return null;
}

export function computePositions(scale: Scale, tuning: Tuning, frets: number): PositionModel {
  const blues = bluesCore(scale);
  const coreIdx = blues ? blues.core : scale.notes.map((_, i) => i);
  const nps = coreIdx.length <= 5 ? 2 : 3;
  const corePcs = coreIdx.map((i) => scale.pcs[i]);
  const open = tuning.strings;
  const strings = open.length;

  // all core-scale pitches in playable range, ascending
  const lo = Math.min(...open);
  const hi = Math.max(...open) + frets + 24;
  const corePitches: number[] = [];
  for (let m = lo - 12; m <= hi; m++) if (corePcs.includes(mod(m, 12))) corePitches.push(m);

  const instances: PatternInstance[] = [];
  for (let f = 0; f <= frets; f++) {
    const startMidi = open[0] + f;
    const coreSlot = corePcs.indexOf(mod(startMidi, 12));
    if (coreSlot < 0) continue;
    let p = corePitches.indexOf(startMidi);
    const notes: PositionNote[] = [];
    let valid = true;
    for (let s = 0; s < strings && valid; s++) {
      for (let k = 0; k < nps; k++, p++) {
        const midi = corePitches[p];
        const fret = midi - open[s];
        if (fret < 0) {
          valid = false; // the pattern would need a fret below the nut
          break;
        }
        notes.push({ string: s, fret, midi });
      }
    }
    if (!valid) continue;
    const onBoard = notes.filter((n) => n.fret <= frets);
    if (onBoard.length < notes.length / 2) continue;
    const minFret = Math.min(...onBoard.map((n) => n.fret));
    const maxFret = Math.max(...onBoard.map((n) => n.fret));
    if (blues) {
      // add the blue note wherever it falls within the box's fret span
      for (let s = 0; s < strings; s++)
        for (const e of blues.extra)
          for (let fr = minFret; fr <= maxFret; fr++)
            if (mod(open[s] + fr, 12) === scale.pcs[e]) onBoard.push({ string: s, fret: fr, midi: open[s] + fr });
      onBoard.sort((a, b) => a.midi - b.midi || a.string - b.string);
    }
    instances.push({ pattern: coreIdx[coreSlot], notes: onBoard, minFret, maxFret });
  }

  // patterns numbered by the scale degree they start on (1 = root)
  const used = [...new Set(instances.map((i) => i.pattern))].sort((a, b) => a - b);
  const renumber = new Map(used.map((p, i) => [p, i]));
  for (const inst of instances) inst.pattern = renumber.get(inst.pattern)!;

  const word = nps === 2 ? 'Box' : 'Pattern';
  const patterns: Pattern[] = used.map((start, i) => {
    const mine = instances.filter((x) => x.pattern === i);
    const complete = mine.filter((x) => x.notes.every((n) => n.fret <= frets));
    return { index: i, start, label: `${word} ${i + 1}`, first: complete[0] ?? mine[0] ?? null };
  });

  const membership = new Map<string, number[]>();
  for (const inst of instances)
    for (const n of inst.notes) {
      const k = key(n.string, n.fret);
      const list = membership.get(k) ?? [];
      if (!list.includes(inst.pattern)) list.push(inst.pattern);
      membership.set(k, list);
    }
  for (const list of membership.values()) list.sort((a, b) => a - b);

  return { kind: nps === 2 ? 'box' : '3nps', notesPerString: nps, patterns, instances, membership };
}

/** Sanity helper for tests: pitch classes covered by one instance. */
export function instancePcs(inst: PatternInstance): Set<number> {
  return new Set(inst.notes.map((n) => mod(n.midi, 12)));
}
