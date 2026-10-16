import { type Chord, getQuality, isHeptatonic, makeChord, stackedChord } from './chords';
import { parseDegree } from './notes';
import type { Scale } from './scales';

/**
 * Chord progressions for each mode.
 *
 * For 7-note scales a chord is written as a 1-based scale step and is built
 * by stacking thirds from the scale itself, so it is diatonic by
 * construction. Pentatonic / blues / symmetric scales use explicit chords
 * (root degree + quality); any chord tone outside the scale is computed and
 * shown to the player.
 */

type ExplicitChord = { root: string; q: string; roman?: string };
type ProgChord = number | ExplicitChord;

export interface ProgressionDef {
  name: string;
  chords: ProgChord[];
  sevenths?: boolean;
  note?: string;
}

const blues12: ProgChord[] = [
  { root: '1', q: '7' },
  { root: '1', q: '7' },
  { root: '1', q: '7' },
  { root: '1', q: '7' },
  { root: '4', q: '7' },
  { root: '4', q: '7' },
  { root: '1', q: '7' },
  { root: '1', q: '7' },
  { root: '5', q: '7' },
  { root: '4', q: '7' },
  { root: '1', q: '7' },
  { root: '5', q: '7' },
];

const minorBlues12: ProgChord[] = [
  { root: '1', q: 'm7' },
  { root: '1', q: 'm7' },
  { root: '1', q: 'm7' },
  { root: '1', q: 'm7' },
  { root: '4', q: 'm7' },
  { root: '4', q: 'm7' },
  { root: '1', q: 'm7' },
  { root: '1', q: 'm7' },
  { root: 'b6', q: '7' },
  { root: '5', q: '7' },
  { root: '1', q: 'm7' },
  { root: '5', q: '7' },
];

const c = (root: string, q: string, roman?: string): ExplicitChord => ({ root, q, roman });

export const PROGRESSIONS: Record<string, ProgressionDef[]> = {
  // ── Major-scale modes ──────────────────────────────────────────────
  ionian: [
    { name: 'I–IV–V–I', chords: [1, 4, 5, 1], note: 'The fundamental cadence of major-key music.' },
    { name: 'I–V–vi–IV', chords: [1, 5, 6, 4], note: 'The pop “axis” progression.' },
    { name: 'ii7–V7–Imaj7', chords: [2, 5, 1], sevenths: true, note: 'The jazz cadence: m7 → 7 → maj7.' },
    { name: 'I–vi–IV–V', chords: [1, 6, 4, 5], note: '50s doo-wop changes.' },
  ],
  dorian: [
    { name: 'i7–IV7 vamp', chords: [1, 4], sevenths: true, note: 'The major IV (with the scale’s natural 6th) is the Dorian sound.' },
    { name: 'i–♭VII–IV–i', chords: [1, 7, 4, 1] },
    { name: 'i–♭III–♭VII–IV', chords: [1, 3, 7, 4] },
  ],
  phrygian: [
    { name: 'i–♭II–i', chords: [1, 2, 1], note: 'The ♭II resolving down a half step is the Phrygian hallmark.' },
    { name: 'i–♭II–♭III–♭II', chords: [1, 2, 3, 2] },
    { name: 'i–iv–♭II–i', chords: [1, 4, 2, 1] },
  ],
  lydian: [
    { name: 'I–II vamp', chords: [1, 2], note: 'The major II chord contains the ♯4 — the Lydian colour note.' },
    { name: 'Imaj7–II7', chords: [1, 2], sevenths: true },
    { name: 'I–II–vii–I', chords: [1, 2, 7, 1] },
  ],
  mixolydian: [
    { name: 'I–♭VII–IV–I', chords: [1, 7, 4, 1], note: 'Classic rock Mixolydian riff changes.' },
    { name: 'I–v–IV–I', chords: [1, 5, 4, 1] },
    { name: 'I–♭VII–I', chords: [1, 7, 1] },
    { name: 'I7–IVmaj7', chords: [1, 4], sevenths: true },
  ],
  aeolian: [
    { name: 'i–♭VI–♭III–♭VII', chords: [1, 6, 3, 7] },
    { name: 'i–iv–v–i', chords: [1, 4, 5, 1] },
    { name: 'i–♭VII–♭VI–♭VII', chords: [1, 7, 6, 7], note: 'Aeolian rock vamp.' },
    { name: 'iiø7–v7–i7', chords: [2, 5, 1], sevenths: true },
  ],
  locrian: [
    { name: 'i°–♭II–i°', chords: [1, 2, 1], note: 'Locrian’s diminished tonic is unstable; keep the ♭II close.' },
    { name: 'iø7–♭IImaj7', chords: [1, 2], sevenths: true },
    { name: 'i°–♭V–♭II–i°', chords: [1, 5, 2, 1] },
  ],
  // ── Harmonic minor modes ───────────────────────────────────────────
  'harmonic-minor': [
    { name: 'i–iv–V–i', chords: [1, 4, 5, 1], note: 'The raised 7th makes V major — a true dominant in a minor key.' },
    { name: 'i–♭VI–V–i', chords: [1, 6, 5, 1] },
    { name: 'iiø7–V7–i(maj7)', chords: [2, 5, 1], sevenths: true, note: 'Minor ii–V–i.' },
    { name: 'i–iv–♭VI–V', chords: [1, 4, 6, 5] },
  ],
  'locrian-nat6': [
    { name: 'i°–♭II+–i°', chords: [1, 2, 1] },
    { name: 'i°–♭iii–♭II+–i°', chords: [1, 3, 2, 1] },
  ],
  'ionian-sharp5': [
    { name: 'I+–IV–I+', chords: [1, 4, 1] },
    { name: 'I+–III–IV–I+', chords: [1, 3, 4, 1] },
  ],
  'dorian-sharp4': [
    { name: 'i–II–i', chords: [1, 2, 1] },
    { name: 'i–♭VII+–II–i', chords: [1, 7, 2, 1] },
  ],
  'phrygian-dominant': [
    { name: 'I–♭II–I', chords: [1, 2, 1], note: 'Flamenco / Middle-Eastern cadence.' },
    { name: 'I–iv–♭II–I', chords: [1, 4, 2, 1] },
    { name: 'I–♭vii–♭II–I', chords: [1, 7, 2, 1] },
  ],
  'lydian-sharp2': [
    { name: 'I–VII–I', chords: [1, 7, 1] },
    { name: 'I–iii–VII–I', chords: [1, 3, 7, 1] },
  ],
  ultralocrian: [
    { name: 'i°–♭ii–i°', chords: [1, 2, 1] },
    { name: 'i°–♭VI–♭ii–i°', chords: [1, 6, 2, 1] },
  ],
  // ── Melodic minor modes ────────────────────────────────────────────
  'melodic-minor': [
    { name: 'i–IV vamp', chords: [1, 4], note: 'Natural 6th → major IV, raised 7th → major V.' },
    { name: 'ii7–V7–i(maj7)', chords: [2, 5, 1], sevenths: true },
    { name: 'i–IV–V–i', chords: [1, 4, 5, 1] },
  ],
  'dorian-b2': [
    { name: 'i–♭II+–i', chords: [1, 2, 1] },
    { name: 'i–♭vii–i', chords: [1, 7, 1] },
  ],
  'lydian-augmented': [
    { name: 'I+–II–I+', chords: [1, 2, 1] },
    { name: 'I+–II–III–I+', chords: [1, 2, 3, 1] },
  ],
  'lydian-dominant': [
    { name: 'I7–II7 vamp', chords: [1, 2], sevenths: true, note: 'Two dominant chords a whole step apart.' },
    { name: 'I–II–v–I', chords: [1, 2, 5, 1] },
  ],
  'mixolydian-b6': [
    { name: 'I–iv–I', chords: [1, 4, 1] },
    { name: 'I–♭VII–iv–I', chords: [1, 7, 4, 1] },
  ],
  'locrian-nat2': [
    { name: 'i°–♭VI–♭VII–i°', chords: [1, 6, 7, 1] },
    { name: 'iø7–iv7', chords: [1, 4], sevenths: true },
  ],
  altered: [
    {
      name: 'V7alt → i',
      chords: [c('1', '7#5#9', 'V7alt'), c('4', 'min', 'i')],
      note: 'The Altered scale is played over the V7alt chord, which resolves to the minor chord a 4th higher (outside this scale by design).',
    },
    {
      name: 'iiø7 → V7alt → i',
      chords: [c('5', 'm7b5', 'iiø7'), c('1', '7#5#9', 'V7alt'), c('4', 'min', 'i')],
      note: 'Minor ii–V–i in the target key; play Altered only over the V7alt bar.',
    },
    {
      name: 'V7alt → I',
      chords: [c('1', '7#5#9', 'V7alt'), c('4', 'maj', 'I')],
    },
  ],
  // ── Harmonic major modes ───────────────────────────────────────────
  'harmonic-major': [
    { name: 'I–iv–I', chords: [1, 4, 1], note: 'The minor iv chord inside a major key.' },
    { name: 'I–iv–V–I', chords: [1, 4, 5, 1] },
    { name: 'I–♭VI+–V–I', chords: [1, 6, 5, 1] },
  ],
  'dorian-b5': [
    { name: 'i°–IV–i°', chords: [1, 4, 1] },
    { name: 'i°–♭VII–IV–i°', chords: [1, 7, 4, 1] },
  ],
  'phrygian-b4': [
    { name: 'i–♭ii–i', chords: [1, 2, 1] },
    { name: 'i–♭VI–♭ii–i', chords: [1, 6, 2, 1] },
  ],
  'lydian-b3': [
    { name: 'i–II–i', chords: [1, 2, 1] },
    { name: 'i–V–II–i', chords: [1, 5, 2, 1] },
  ],
  'mixolydian-b2': [
    { name: 'I–♭vii–I', chords: [1, 7, 1] },
    { name: 'I–IV–I', chords: [1, 4, 1] },
  ],
  'lydian-aug-sharp2': [
    { name: 'I+–VII–I+', chords: [1, 7, 1] },
    { name: 'I+–vi–VII–I+', chords: [1, 6, 7, 1] },
  ],
  'locrian-bb7': [
    { name: 'i°–♭II–i°', chords: [1, 2, 1] },
    { name: 'i°–iv–♭II–i°', chords: [1, 4, 2, 1] },
  ],
  // ── Pentatonic modes ───────────────────────────────────────────────
  'major-pentatonic': [
    { name: 'I–IV–V–I', chords: [c('1', 'maj'), c('4', 'maj'), c('5', 'maj'), c('1', 'maj')], note: 'Pentatonic skips the 4th and 7th, so it never clashes with these chords.' },
    { name: 'I–V–vi–IV', chords: [c('1', 'maj'), c('5', 'maj'), c('6', 'min'), c('4', 'maj')] },
    { name: 'I–vi–ii–V', chords: [c('1', 'maj'), c('6', 'min'), c('2', 'min'), c('5', 'maj')] },
  ],
  'suspended-pentatonic': [
    { name: 'Isus4–♭VII–Isus4', chords: [c('1', 'sus4'), c('b7', 'maj'), c('1', 'sus4')] },
    { name: 'Isus2–IVsus2–♭VII', chords: [c('1', 'sus2'), c('4', 'sus2'), c('b7', 'maj')] },
  ],
  'man-gong': [
    { name: 'i–iv–i', chords: [c('1', 'min'), c('4', 'min'), c('1', 'min')], note: 'Both chords sit entirely inside the scale.' },
    { name: 'i–♭VI–♭VII–i', chords: [c('1', 'min'), c('b6', 'maj'), c('b7', 'maj'), c('1', 'min')] },
  ],
  ritusen: [
    { name: 'Isus2–IVsus2 vamp', chords: [c('1', 'sus2'), c('4', 'sus2')], note: 'Both chords sit entirely inside the scale.' },
    { name: 'I–IV–I', chords: [c('1', 'maj'), c('4', 'maj'), c('1', 'maj')] },
  ],
  'minor-pentatonic': [
    { name: 'i–iv–v–i', chords: [c('1', 'min'), c('4', 'min'), c('5', 'min'), c('1', 'min')] },
    { name: 'i–♭VI–♭VII–i', chords: [c('1', 'min'), c('b6', 'maj'), c('b7', 'maj'), c('1', 'min')] },
    {
      name: '12-bar blues (dominant)',
      chords: blues12,
      note: 'Minor pentatonic over dominant 7 chords is the core blues sound: the scale’s ♭3 rubs against the chord’s major 3rd — bend it up a little.',
    },
  ],
  // ── Blues ──────────────────────────────────────────────────────────
  'minor-blues': [
    {
      name: '12-bar blues (dominant)',
      chords: blues12,
      note: 'The ♭3 and ♭5 are “blue notes” against the major 3rd and 5th of the chords.',
    },
    { name: '12-bar minor blues', chords: minorBlues12, note: 'Bars 9–10: ♭VI7 → V7 turnaround.' },
  ],
  'major-blues': [
    { name: '12-bar blues (dominant)', chords: blues12, note: 'Slide from ♭3 to 3 over the I7 chord.' },
    { name: 'I–IV–I–V', chords: [c('1', 'maj'), c('4', 'maj'), c('1', 'maj'), c('5', 'maj')] },
  ],
  // ── Symmetric ──────────────────────────────────────────────────────
  'whole-tone': [
    { name: 'I+ vamp', chords: [c('1', 'aug')] },
    { name: 'V7♯5 → I', chords: [c('1', 'aug7', 'V7♯5'), c('4', 'maj', 'I')], note: 'Whole tone (built on the dominant’s root) colours the 7♯5 chord, which then resolves down a 5th.' },
  ],
  'diminished-wh': [
    { name: 'i°7 vamp', chords: [c('1', 'dim7')] },
    { name: 'vii°7 → I (up a half step)', chords: [c('1', 'dim7', 'vii°7'), c('b2', 'maj', 'I')], note: 'A °7 chord is the leading-tone chord of the key a half step up.' },
  ],
  'diminished-hw': [
    { name: 'I7♭9 vamp', chords: [c('1', '7b9')] },
    { name: 'V7♭9 → I', chords: [c('1', '7b9', 'V7♭9'), c('4', 'maj', 'I')] },
    {
      name: 'Dominants a minor 3rd apart',
      chords: [c('1', '7'), c('b3', '7'), c('b5', '7'), c('6', '7')],
      note: 'The same half–whole scale fits all four dominant chords.',
    },
  ],
};

export interface ResolvedProgression {
  name: string;
  note?: string;
  chords: Chord[];
}

export function progressionsFor(scale: Scale): ResolvedProgression[] {
  const defs = PROGRESSIONS[scale.modeId] ?? [];
  return defs.map((def) => ({
    name: def.name,
    note: def.note,
    chords: def.chords.map((pc) => {
      if (typeof pc === 'number') {
        if (!isHeptatonic(scale)) throw new Error(`Numeric chord in non-heptatonic ${scale.modeId}`);
        return stackedChord(scale, pc - 1, def.sevenths ? 4 : 3);
      }
      const chord = makeChord(scale, parseDegree(pc.root), getQuality(pc.q));
      return pc.roman ? { ...chord, roman: pc.roman } : chord;
    }),
  }));
}
