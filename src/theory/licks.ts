import { fingerRun } from './fingering';
import type { Tuning } from './fretboard';
import { type Degree, degreeSemitones, mod, parseDegree, pitchClass } from './notes';
import type { Scale } from './scales';

/**
 * Licks for each scale / mode.
 *
 * Every lick is written in scale degrees (so it plays in any key) using a
 * compact token syntax, separated by spaces:
 *
 *   5        degree 5 in the lick's home octave
 *   1'  b7,  ' = an octave up, , = an octave down (repeatable)
 *   4~5      play degree 4 and bend it up to the pitch of degree 5
 *   :4       duration in 16th notes (default :2 = an eighth note)
 *   r:2      rest
 *
 * The licks are either idiomatic vocabulary in the style of the players who
 * made that scale famous (written for this app — not transcriptions of
 * copyrighted recordings) or well-known public-domain melodies.
 */

export interface LickDef {
  id: string;
  name: string;
  /** Style / source line shown under the name. */
  style: string;
  notes: string;
  tip?: string;
}

const L = (id: string, name: string, style: string, notes: string, tip?: string): LickDef => ({ id, name, style, notes, tip });

export const LICKS: Record<string, LickDef[]> = {
  // ── Major-scale modes ──────────────────────────────────────────────
  ionian: [
    L('ode', 'Ode to Joy', 'Beethoven, Symphony No. 9 (public domain)', '3:4 3:4 4:4 5:4 5:4 4:4 3:4 2:4 1:4 1:4 2:4 3:4 3:6 2:2 2:8'),
    L('country', 'Country major-pentatonic run', 'In the style of Albert Lee / Brad Paisley', '5,:1 6,:1 1:2 2:1 3:1 5:2 6:2 5:1 3:1 2:2 1:2 6,:2 1:6', 'Uses only the major pentatonic notes of the scale — the sound of country lead.'),
    L('thirds', 'Diatonic thirds sequence', 'Classic major-scale exercise heard in pop & rock solos', '1 3 2 4 3 5 4 6 5 7 6 1\' 7 2\' 1\':6'),
  ],
  dorian: [
    L('sailor', 'What Shall We Do with the Drunken Sailor', 'Traditional sea shanty (public domain)', '5 5 5 5 5 5 5 1 b3 5:4 4 4 4 4 4 4 4 b7, 2 4:4 5 5 5 5 5 5 5 6 b7 1\' b7 5 4 2 1:4 1:4', 'The B♮-type major 6th in bar 3 is what makes it Dorian rather than natural minor.'),
    L('scarborough', 'Scarborough Fair (opening)', 'Traditional English ballad (public domain)', '1:4 1:2 5:4 5:2 5:3 2:1 b3:2 2:4 1:6 r:2 5:2 b7:2 1\':4 b7:2 5:2 6:2 4:2 5:6', 'The major 6th (on “-ry” of rosemary) is the classic Dorian colour.'),
    L('santana', 'Singing Dorian phrase', 'In the style of Carlos Santana', '1 b3 4 5 6:4 5 4~5:6 4 b3 1:2 b3~4:4 1:6', 'Lean on the natural 6th over a minor chord, and bend slowly.'),
  ],
  phrygian: [
    L('gallop', 'Galloping ♭2 riff', 'In the style of thrash metal (Metallica, Megadeth)', '1,:2 1,:1 1,:1 b2,:4 1,:2 1,:1 1,:1 b3,:4 1,:2 1,:1 1,:1 b2,:4 1,:4', 'Palm-mute the open low notes; the half step to ♭2 is the whole point.'),
    L('spanish', 'Spanish Phrygian descent', 'Flamenco-flavoured cadence', "1' b7 b6 5:4 b6 5 4 b3 b2:4 1:6"),
  ],
  lydian: [
    L('shimmer', '♯4 shimmer', 'In the style of Joe Satriani / Steve Vai', '1 2 3 #4 5:4 #4 3:4 2 3 #4:4 5:6', 'Let the ♯4 ring against the major chord — it never wants to resolve.'),
    L('arp', 'Maj7♯11 arpeggio', 'Fusion / film-score Lydian colour', "1 3 5 7 2' #4':4 5':6"),
  ],
  mixolydian: [
    L('southern', 'Southern-rock Mixolydian lick', 'In the style of the Allman Brothers / Lynyrd Skynyrd', "5, b7, 1 2 3:4 2 1 b7,~1:4 5,:6"),
    L('rnr', '♭7 rock & roll lick', 'In the style of Chuck Berry', '3 5 b7:4 6 5 3 2~3:4 1:6', 'Bend the 2 up to the major 3rd, then land on the root.'),
  ],
  aeolian: [
    L('gilmour', 'Melodic minor-key bend phrase', 'In the style of David Gilmour', '5 b6 5 4 b3:4 4~5:6 4 b3 1:6', 'Slow, vocal bends that land exactly on pitch.'),
    L('gallop-melody', 'Galloping natural-minor melody', 'In the style of NWOBHM twin-guitar lines (Iron Maiden)', '1:2 1:1 1:1 2:2 2:1 2:1 b3:2 b3:1 b3:1 4:2 5:2 b6:4 5:4 4:2 b3:2 2:2 1:6'),
    L('seq', 'Descending sequence of four', 'Neoclassical / metal practice pattern', "1' b7 b6 5 b7 b6 5 4 b6 5 4 b3 5 4 b3 2 1:6"),
  ],
  locrian: [
    L('riff', '♭5 metal riff', 'Modern metal (Locrian is the darkest mode)', '1,:2 b2,:2 1,:2 b5,:4 1,:2 b2,:2 b3,:4 b2,:4 1,:4'),
    L('arp', 'Half-diminished arpeggio', 'm7♭5 sound', "1 b3 b5 b7 1':4 b7 b5 b3 1:6"),
  ],
  // ── Harmonic minor modes ───────────────────────────────────────────
  'harmonic-minor': [
    L('neo', 'Neoclassical dim7 arpeggio', 'In the style of Yngwie Malmsteen', "7, 2 4 b6 7 b6 4 2 7,:2 1:6", 'The vii°7 arpeggio (from the raised 7th) pulling back to the root.'),
    L('aug2', 'The augmented-2nd run', 'Classical / neoclassical colour', "1 2 b3 4 5 b6 7 1':4 7 b6 5:4 b6 7 1':6", 'Listen for the 1½-step jump from ♭6 to 7.'),
    L('v-arp', 'Dominant arpeggio resolving to i', 'Bach-style minor cadence', "5, 7, 2 4 5:4 4 2 7, 1:6"),
  ],
  'locrian-nat6': [L('char', 'Locrian ♮6 colour phrase', 'Characteristic phrase', "1 b2 b3 4 b5 6:4 b7 6 b5 b3 1:6")],
  'ionian-sharp5': [L('char', 'Augmented-major phrase', 'Characteristic phrase', "1 3 #5 7 1':4 7 #5 3 1:6")],
  'dorian-sharp4': [L('klezmer', 'Klezmer-style phrase', 'Eastern-European / klezmer colour', '1 2 b3 #4 5:4 6 5 #4 b3:4 2 1:6')],
  'phrygian-dominant': [
    L('flamenco', 'Flamenco cadence lick', 'Flamenco / Middle-Eastern', '5 b6 5 4 3 b2:4 1:6', 'Half-step ♭2 → 1 with the major 3rd: the Phrygian-dominant signature.'),
    L('surf', 'Surf / Middle-Eastern tremolo melody', 'In the style of 60s surf guitar (Dick Dale)', '1 b2 3 4 5:4 b6 5 4 3:4 b2 1:6', 'Pick each note fast (tremolo picking) for the surf sound.'),
  ],
  'lydian-sharp2': [L('char', 'Lydian ♯2 phrase', 'Characteristic phrase', "1 #2 3 #4 5:4 7 5 3 1:6")],
  ultralocrian: [L('char', 'Diminished-7th arpeggio', 'Characteristic phrase (1 ♭3 ♭5 𝄫7)', "1 b3 b5 bb7 1':4 bb7 b5 b3 1:6")],
  // ── Melodic minor modes ────────────────────────────────────────────
  'melodic-minor': [
    L('jazz', 'Jazz-minor line', 'Modern jazz (minor-major 7th sound)', "1 2 b3 4 5 6 7 1':4 7 6 5 b3 1:6"),
    L('mmaj7', 'm(maj7) arpeggio', 'Film-noir / jazz colour', "1 b3 5 7:6 5 b3 1:6"),
  ],
  'dorian-b2': [L('char', 'Dorian ♭2 phrase', 'Characteristic phrase (sus4♭9 sound)', '1 b2 b3 4 5 6:4 b7 6 4 b2 1:6')],
  'lydian-augmented': [L('char', 'Lydian augmented run', 'Characteristic phrase', "1 2 3 #4 #5 6 7 1':6")],
  'lydian-dominant': [L('fusion', '7♯11 fusion line', 'Jazz-fusion dominant colour', "1 3 5 b7 2' #4':4 5':6")],
  'mixolydian-b6': [L('char', 'Bittersweet dominant phrase', 'Characteristic phrase (7♭13 sound)', '5 b6 5 3 1:4 b7, 1:6')],
  'locrian-nat2': [
    L('jazz', 'Half-diminished jazz line', 'Bebop / modern jazz over m7♭5', "1 2 b3 4 b5 b6 b7 1':6"),
    L('arp', 'm9♭5 arpeggio', 'Jazz', "1 b3 b5 b7 2':6"),
  ],
  altered: [
    L('alt', 'Altered tensions arpeggio', 'Jazz V7alt vocabulary', "b4 b7 b3' b6':4 b3' b7 b4 1:6", 'Plays the 3rd (spelled ♭4), ♭7, ♯9 (spelled ♭3) and ♭13 (♭6) of the altered dominant.'),
    L('run', 'Altered scale run', 'Bebop-style descending line', "b7 b6 b5 b4 b3 b2 1:4 b2 b4:6"),
  ],
  // ── Harmonic major modes ───────────────────────────────────────────
  'harmonic-major': [
    L('iv', 'Major key with a minor iv', 'Cinematic / film-score colour', '1 3 5 b6 5:4 4 3 1:6'),
    L('desc', 'Harmonic-major descent', 'Characteristic phrase', "1' 7 b6 5 4 3 2 1:6"),
  ],
  'dorian-b5': [L('char', 'Dorian ♭5 phrase', 'Characteristic phrase', '1 b3 b5 6 b7:4 6 b5 b3 1:6')],
  'phrygian-b4': [L('char', 'Phrygian ♭4 phrase', 'Characteristic phrase', '1 b2 b3 b4 5:4 b6 5 b4 b2 1:6')],
  'lydian-b3': [L('char', 'Lydian ♭3 phrase', 'Characteristic phrase', "1 2 b3 #4 5 7 1':6")],
  'mixolydian-b2': [L('char', 'Mixolydian ♭2 phrase', 'Characteristic phrase (7♭9 sound)', '1 b2 3 4 5:4 6 b7 5 3 1:6')],
  'lydian-aug-sharp2': [L('char', 'Lydian augmented ♯2 run', 'Characteristic phrase', "1 #2 3 #4 #5 6 7 1':6")],
  'locrian-bb7': [L('char', 'Diminished-7th arpeggio', 'Characteristic phrase', "1 b3 b5 bb7 1':6")],
  // ── Pentatonic modes ───────────────────────────────────────────────
  'major-pentatonic': [
    L('country', 'Country major-pentatonic lick', 'In the style of country / Southern rock', '5,:1 6,:1 1:2 2:1 3:1 5:2 3:2 2:2 1:2 6,:2 1:6'),
    L('bbking', 'B.B. King “box” phrase', 'In the style of B.B. King', "1' 2'~3':4 2' 1':4 6 1':6", 'The “B.B. box”: bend the 2 up to the major 3rd, then sing the root with vibrato.'),
  ],
  'suspended-pentatonic': [L('char', 'Suspended pentatonic phrase', 'Modal / Celtic flavour', '1 2 4 5 b7:4 5 4 2 1:6')],
  'man-gong': [L('char', 'Blues-minor (Man Gong) phrase', 'East-Asian / modal flavour', '1 b3 4 b6 b7:4 b6 4 b3 1:6')],
  ritusen: [L('char', 'Ritsusen phrase', 'Japanese / folk flavour', '1 2 4 5 6:4 5 4 2 1:6')],
  'minor-pentatonic': [
    L('rock-bend', 'The rock bend lick', 'In the style of Jimmy Page / Eric Clapton', "4~5:4 b7 1':2 b3':2 1':2 b7 1':6", 'Bend the 4 a whole step to the 5 — the most-played move in rock.'),
    L('albert', 'Albert King box bend', 'In the style of Albert King', "b3'~4':4 b3' 1' b7 1':4 b7~1':4 5:6", 'Bend the ♭3 up a whole step, then the ♭7 up to the root.'),
    L('run', 'Descending pentatonic run', 'In the style of 70s rock solos (Blackmore / Gilmour)', "b3':1 1':1 b7:1 1':1 b7:1 5:1 b7:1 5:1 4:1 5:1 4:1 b3:1 1:6"),
  ],
  // ── Blues ──────────────────────────────────────────────────────────
  'minor-blues': [
    L('bluenote', 'Blue-note lick', 'Classic blues vocabulary', '1 b3 4 b5 5:4 b3 1:6', 'Slide through the ♭5 into the 5th — don’t sit on it.'),
    L('albert', 'Albert King box bend', 'In the style of Albert King', "b3'~4':4 b3' 1' b7 1':4 b7~1':4 5:6"),
    L('turn', 'Chicago descending blues line', 'In the style of Chicago blues', "1' b7 5 b5 4 b3:4 1:6"),
  ],
  'major-blues': [
    L('bb', '♭3 → 3 major blues lick', 'In the style of B.B. King / T-Bone Walker', '1 2 b3 3 5:4 6 5 b3 3 1:6', 'Hammer from ♭3 to 3: minor to major, the essence of major blues.'),
    L('box', 'B.B. King “box” phrase', 'In the style of B.B. King', "1' 2'~3':4 2' 1':4 6 1':6"),
  ],
  // ── Symmetric ──────────────────────────────────────────────────────
  'whole-tone': [L('dream', 'Whole-tone dream run', 'Debussy / Thelonious Monk colour', "1 2 3 #4 #5 b7 1':4 b7 #5 #4 3 2 1:6")],
  'diminished-wh': [L('dim7', 'Diminished-7th arpeggio', 'Classical / metal tension', "1 b3 b5 6 1':4 6 b5 b3 1:6")],
  'diminished-hw': [
    L('b9', 'Dominant 7♭9 line', 'Jazz / bebop', "1 b2 #2 3 #4 5 6 b7 1':6"),
    L('arp', '7♭9 arpeggio', 'Jazz', "3 5 b7 b2':4 b7 5 3:6"),
  ],
};

export interface LickNote {
  /** Sounding pitch of the fretted note. */
  midi: number;
  degree: Degree;
  /** Bend target pitch (if bent). */
  bendTo?: number;
  bendDegree?: Degree;
  /** Duration in 16th notes. */
  dur: number;
  /** null for rests. */
  rest?: boolean;
}

const TOKEN = /^((?:bb|b|##|#)?\d|r)([',]*)(?:~((?:bb|b|##|#)?\d)([',]*))?(?::(\d+))?$/;

const octaves = (marks: string) => [...marks].reduce((n, c) => n + (c === "'" ? 1 : -1), 0);

/** Parse a lick into notes relative to a tonic at MIDI `base`. */
export function parseLick(notes: string, base: number): LickNote[] {
  return notes
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const m = TOKEN.exec(tok);
      if (!m) throw new Error(`Bad lick token "${tok}"`);
      const dur = m[5] ? Number(m[5]) : 2;
      if (m[1] === 'r') return { midi: 0, degree: { num: 1, acc: 0 }, dur, rest: true };
      const degree = parseDegree(m[1]);
      const midi = base + degreeSemitones(degree) + 12 * octaves(m[2]);
      if (!m[3]) return { midi, degree, dur };
      const bendDegree = parseDegree(m[3]);
      return { midi, degree, dur, bendDegree, bendTo: base + degreeSemitones(bendDegree) + 12 * octaves(m[4]) };
    });
}

export interface PlacedLickNote extends LickNote {
  string: number;
  fret: number;
}

export function licksFor(modeId: string): LickDef[] {
  return LICKS[modeId] ?? [];
}

/**
 * Place a lick on the neck: tonic in the octave starting at C3, shifted by
 * whole octaves to fit the instrument, then fingered near the scale's first
 * position (tonic on the lowest string).
 */
export function placeLick(lick: LickDef, scale: Scale, tuning: Tuning, frets: number): PlacedLickNote[] {
  const rootPc = pitchClass(scale.root);
  const lowest = Math.min(...tuning.strings);
  // guitar: tonic between C3 and B3 (the classic lead register);
  // bass: the lowest octave that fits, so the lick sits in the first-position box
  let base = 48 + rootPc;
  if (tuning.instrument === 'bass') {
    const minOff = Math.min(...parseLick(lick.notes, 0).filter((n) => !n.rest).map((n) => n.midi));
    base = lowest - minOff + mod(rootPc - (lowest - minOff), 12);
  }
  const highest = Math.max(...tuning.strings) + frets;
  let notes = parseLick(lick.notes, base);
  const sounding = () => notes.filter((n) => !n.rest).flatMap((n) => [n.midi, n.bendTo ?? n.midi]);
  for (let guard = 0; guard < 4 && Math.min(...sounding()) < lowest; guard++) notes = parseLick(lick.notes, (base += 12));
  for (let guard = 0; guard < 4 && Math.max(...sounding()) > highest; guard++) notes = parseLick(lick.notes, (base -= 12));

  // first position: tonic on the lowest string
  const r = mod(rootPc - tuning.strings[0], 12);
  const prefer: [number, number] = [Math.max(0, r - 1), r + 4];
  const played = notes.filter((n) => !n.rest);
  const pos = fingerRun(
    played.map((n) => n.midi),
    tuning,
    frets,
    0,
    prefer,
  );
  let k = 0;
  return notes.map((n) => (n.rest ? { ...n, string: -1, fret: -1 } : { ...n, ...pos[k++] }));
}
