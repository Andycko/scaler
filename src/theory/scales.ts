import {
  type Degree,
  type SpelledNote,
  KEY_CHOICES,
  LETTER_PC,
  MAJOR_SEMITONES,
  degreeSemitones,
  mod,
  noteName,
  parseDegree,
  pitchClass,
  spellDegree,
} from './notes';

/**
 * Scale catalogue.
 *
 * "Rotational" families are defined by one parent formula; every mode is
 * derived by rotating it (re-measuring every note from a new tonic, keeping
 * letter steps), so mode formulas are computed rather than hand-typed. The
 * test-suite checks the derived formulas against the textbook ones.
 */

export interface ModeDef {
  id: string;
  name: string;
  aka?: string;
  description: string;
  /** Which diatonic (major-scale) mode supplies a conventional key signature. */
  keySigMode?: number;
  /** Explicit formula (non-rotational families). */
  formula?: string[];
}

export interface FamilyDef {
  id: string;
  name: string;
  /** Parent formula; mode i is the rotation starting on the i-th note. */
  parent?: string[];
  modes: ModeDef[];
}

export const FAMILIES: FamilyDef[] = [
  {
    id: 'major',
    name: 'Major (Diatonic)',
    parent: ['1', '2', '3', '4', '5', '6', '7'],
    modes: [
      {
        id: 'ionian',
        name: 'Ionian',
        aka: 'Major',
        keySigMode: 0,
        description: 'The major scale. Bright and resolved; the reference every other mode is measured against.',
      },
      {
        id: 'dorian',
        name: 'Dorian',
        keySigMode: 1,
        description:
          'Minor with a major 6th. Soulful, jazzy minor — e.g. Miles Davis “So What” (D Dorian). Great over m7 chords and i–IV vamps.',
      },
      {
        id: 'phrygian',
        name: 'Phrygian',
        keySigMode: 2,
        description: 'Minor with a ♭2. Dark, Spanish / metal flavour; the ♭2 pulling down to the root is its signature.',
      },
      {
        id: 'lydian',
        name: 'Lydian',
        keySigMode: 3,
        description: 'Major with a ♯4. Dreamy and floating; the ♯4 avoids the major scale’s “pull” to the IV chord.',
      },
      {
        id: 'mixolydian',
        name: 'Mixolydian',
        keySigMode: 4,
        description: 'Major with a ♭7. Bluesy rock & roll major — the natural sound of a dominant 7 chord and I–♭VII–IV riffs.',
      },
      {
        id: 'aeolian',
        name: 'Aeolian',
        aka: 'Natural minor',
        keySigMode: 5,
        description: 'The natural minor scale. Melancholic, the default minor key in rock and pop (i–♭VI–♭VII progressions).',
      },
      {
        id: 'locrian',
        name: 'Locrian',
        keySigMode: 6,
        description: 'Diminished tonic (♭2 and ♭5). Unstable and tense; mostly used over m7♭5 chords.',
      },
    ],
  },
  {
    id: 'harmonic-minor',
    name: 'Harmonic Minor',
    parent: ['1', '2', 'b3', '4', '5', 'b6', '7'],
    modes: [
      {
        id: 'harmonic-minor',
        name: 'Harmonic Minor',
        keySigMode: 5,
        description:
          'Natural minor with a raised 7th, giving a major V chord and a strong leading tone. The augmented 2nd (♭6–7) sounds exotic / neoclassical.',
      },
      {
        id: 'locrian-nat6',
        name: 'Locrian ♮6',
        description: 'Locrian with a natural 6th. Dark and tense; fits a m7♭5 chord.',
      },
      {
        id: 'ionian-sharp5',
        name: 'Ionian ♯5',
        aka: 'Ionian augmented',
        description: 'Major scale with a raised 5th; fits a maj7♯5 chord.',
      },
      {
        id: 'dorian-sharp4',
        name: 'Dorian ♯4',
        aka: 'Ukrainian Dorian',
        description: 'Dorian with a ♯4. Eastern-European / klezmer colour over a minor chord.',
      },
      {
        id: 'phrygian-dominant',
        name: 'Phrygian Dominant',
        aka: 'Spanish Phrygian',
        description:
          'Phrygian with a major 3rd — the 5th mode of harmonic minor. Flamenco and Middle-Eastern sound; the scale for the V7 chord in a minor key.',
      },
      {
        id: 'lydian-sharp2',
        name: 'Lydian ♯2',
        description: 'Lydian with a ♯2. Bright but exotic; fits maj7♯11 chords.',
      },
      {
        id: 'ultralocrian',
        name: 'Super Locrian 𝄫7',
        aka: 'Ultralocrian',
        description: 'Every degree lowered except the root; the tonic chord is a fully diminished 7th.',
      },
    ],
  },
  {
    id: 'melodic-minor',
    name: 'Melodic Minor',
    parent: ['1', '2', 'b3', '4', '5', '6', '7'],
    modes: [
      {
        id: 'melodic-minor',
        name: 'Melodic Minor',
        aka: 'Jazz minor',
        keySigMode: 5,
        description:
          'Minor with a major 6th and 7th (the classical ascending form; classically it descends as natural minor). A staple of jazz over m(maj7) and m6 chords.',
      },
      { id: 'dorian-b2', name: 'Dorian ♭2', aka: 'Phrygian ♮6', description: 'Dorian with a ♭2; fits sus4(♭9) chords.' },
      { id: 'lydian-augmented', name: 'Lydian Augmented', description: 'Lydian with a ♯5; fits maj7♯5 chords.' },
      {
        id: 'lydian-dominant',
        name: 'Lydian Dominant',
        aka: 'Overtone / Acoustic',
        description: 'Mixolydian with a ♯4. The classic sound for a non-resolving 7♯11 dominant chord.',
      },
      {
        id: 'mixolydian-b6',
        name: 'Mixolydian ♭6',
        aka: 'Aeolian dominant',
        description: 'Major 3rd with a minor 6th and 7th — bittersweet; fits a dominant 7♭13 chord.',
      },
      {
        id: 'locrian-nat2',
        name: 'Locrian ♮2',
        aka: 'Half-diminished',
        description: 'Locrian with a natural 2nd. The go-to jazz scale for m7♭5 (half-diminished) chords.',
      },
      {
        id: 'altered',
        name: 'Altered',
        aka: 'Super Locrian',
        description:
          'Contains every altered dominant tension (♭9, ♯9, ♯11, ♭13) around the root, 3rd (spelled ♭4) and ♭7. Used over V7alt chords resolving to I or i.',
      },
    ],
  },
  {
    id: 'harmonic-major',
    name: 'Harmonic Major',
    parent: ['1', '2', '3', '4', '5', 'b6', '7'],
    modes: [
      {
        id: 'harmonic-major',
        name: 'Harmonic Major',
        keySigMode: 0,
        description: 'Major with a ♭6 — major tonic with a minor iv chord. Cinematic, bittersweet.',
      },
      { id: 'dorian-b5', name: 'Dorian ♭5', description: 'Dorian with a ♭5; fits m7♭5 chords with a natural 6th.' },
      { id: 'phrygian-b4', name: 'Phrygian ♭4', description: 'Phrygian with a ♭4 (an enharmonic major 3rd).' },
      { id: 'lydian-b3', name: 'Lydian ♭3', aka: 'Melodic minor ♯4', description: 'Minor with a ♯4 and major 7th.' },
      { id: 'mixolydian-b2', name: 'Mixolydian ♭2', description: 'Mixolydian with a ♭2; dominant 7♭9 colour.' },
      { id: 'lydian-aug-sharp2', name: 'Lydian Augmented ♯2', description: 'Lydian augmented with a ♯2.' },
      { id: 'locrian-bb7', name: 'Locrian 𝄫7', description: 'Locrian with a diminished 7th; tonic chord is °7.' },
    ],
  },
  {
    id: 'pentatonic',
    name: 'Pentatonic',
    parent: ['1', '2', '3', '5', '6'],
    modes: [
      {
        id: 'major-pentatonic',
        name: 'Major Pentatonic',
        keySigMode: 0,
        description:
          'The major scale without its 4th and 7th — no half steps, so nothing clashes. Country, pop and major-key blues soloing.',
      },
      {
        id: 'suspended-pentatonic',
        name: 'Suspended Pentatonic',
        aka: 'Egyptian',
        keySigMode: 4,
        description: 'No 3rd at all (1 2 4 5 ♭7), so it fits both sus chords and many modal vamps.',
      },
      {
        id: 'man-gong',
        name: 'Blues Minor',
        aka: 'Man Gong',
        keySigMode: 5,
        description: 'Minor pentatonic variant with a ♭6 instead of a 5th (1 ♭3 4 ♭6 ♭7).',
      },
      {
        id: 'ritusen',
        name: 'Blues Major',
        aka: 'Ritsusen / Yo',
        keySigMode: 0,
        description: 'Major-ish pentatonic without a 3rd (1 2 4 5 6).',
      },
      {
        id: 'minor-pentatonic',
        name: 'Minor Pentatonic',
        keySigMode: 5,
        description:
          'The essential rock & blues soloing scale: natural minor without its 2nd and 6th. Same notes as the relative major pentatonic.',
      },
    ],
  },
  {
    id: 'blues',
    name: 'Blues',
    parent: ['1', 'b3', '4', 'b5', '5', 'b7'],
    modes: [
      {
        id: 'minor-blues',
        name: 'Minor Blues',
        aka: 'Blues scale',
        keySigMode: 5,
        description: 'Minor pentatonic plus the ♭5 “blue note”. Use the ♭5 as a passing tone between 4 and 5.',
      },
      {
        id: 'major-blues',
        name: 'Major Blues',
        keySigMode: 0,
        description: 'Major pentatonic plus the ♭3 (a 2nd-mode rotation of the minor blues scale). Slide ♭3 → 3 for the classic sound.',
      },
    ],
  },
  {
    id: 'symmetric',
    name: 'Symmetric',
    modes: [
      {
        id: 'whole-tone',
        name: 'Whole Tone',
        formula: ['1', '2', '3', '#4', '#5', 'b7'],
        description: 'Six whole steps. Dreamy / unresolved; fits augmented triads and 7♯5 / 9♯5 dominant chords.',
      },
      {
        id: 'diminished-wh',
        name: 'Diminished (Whole–Half)',
        formula: ['1', '2', 'b3', '4', 'b5', '#5', '6', '7'],
        description: 'Alternating whole and half steps from the root. Fits diminished 7th chords.',
      },
      {
        id: 'diminished-hw',
        name: 'Diminished (Half–Whole)',
        aka: 'Dominant diminished',
        formula: ['1', 'b2', '#2', '3', '#4', '5', '6', 'b7'],
        description: 'Alternating half and whole steps. Fits 7♭9 (13♭9) dominant chords.',
      },
    ],
  },
];

/** Rotate a parent formula so that its `index`-th note becomes the tonic. */
export function rotateFormula(parent: Degree[], index: number): Degree[] {
  const base = parent[index];
  const baseSemis = degreeSemitones(base);
  const out: Degree[] = [];
  for (let i = 0; i < parent.length; i++) {
    const d = parent[(index + i) % parent.length];
    const num = mod(d.num - base.num, 7) + 1;
    const semis = mod(degreeSemitones(d) - baseSemis, 12);
    let acc = semis - MAJOR_SEMITONES[num - 1];
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    out.push({ num, acc });
  }
  return out;
}

export function modeFormula(familyId: string, modeId: string): Degree[] {
  const fam = getFamily(familyId);
  const idx = fam.modes.findIndex((m) => m.id === modeId);
  if (idx < 0) throw new Error(`Unknown mode ${modeId} in ${familyId}`);
  const mode = fam.modes[idx];
  if (mode.formula) return mode.formula.map(parseDegree);
  if (!fam.parent) throw new Error(`Family ${familyId} has no parent formula`);
  return rotateFormula(fam.parent.map(parseDegree), idx);
}

export function getFamily(id: string): FamilyDef {
  const f = FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown family ${id}`);
  return f;
}

export function getMode(familyId: string, modeId: string): ModeDef {
  const m = getFamily(familyId).modes.find((x) => x.id === modeId);
  if (!m) throw new Error(`Unknown mode ${modeId}`);
  return m;
}

export interface Scale {
  familyId: string;
  modeId: string;
  family: FamilyDef;
  mode: ModeDef;
  root: SpelledNote;
  degrees: Degree[];
  notes: SpelledNote[];
  /** Pitch classes in scale order. */
  pcs: number[];
  /** pitch class → index in `notes` */
  pcIndex: Map<number, number>;
}

export function buildScale(root: SpelledNote, familyId: string, modeId: string): Scale {
  const family = getFamily(familyId);
  const mode = getMode(familyId, modeId);
  const degrees = modeFormula(familyId, modeId);
  const notes = degrees.map((d) => spellDegree(root, d));
  const pcs = notes.map(pitchClass);
  const pcIndex = new Map<number, number>();
  pcs.forEach((pc, i) => pcIndex.set(pc, i));
  return { familyId, modeId, family, mode, root, degrees, notes, pcs, pcIndex };
}

/** Accidental "cost" of a spelling: double accidentals are heavily penalised. */
function spellingCost(notes: SpelledNote[]): number {
  return notes.reduce((s, n) => s + Math.abs(n.acc) + (Math.abs(n.acc) >= 2 ? 10 : 0), 0);
}

/**
 * Pick the most readable enharmonic spelling of the tonic for a scale:
 * fewest accidentals, avoiding double sharps/flats (e.g. A♭ major rather than
 * G♯ major, but C♯ Dorian rather than D♭ Dorian).
 */
export function autoRootSpelling(pc: number, familyId: string, modeId: string): SpelledNote {
  const choice = KEY_CHOICES.find((k) => k.pc === mod(pc, 12))!;
  if (choice.spellings.length === 1) return choice.spellings[0];
  let best = choice.spellings[0];
  let bestCost = Infinity;
  for (const s of choice.spellings) {
    const scale = buildScale(s, familyId, modeId);
    const noteCost = spellingCost(scale.notes);
    let cost: number;
    if (scale.mode.keySigMode !== undefined) {
      // Conventional keys are chosen by key signature (G♯ minor, not A♭ minor,
      // even though its raised 7th is F𝄪); tie-break on the notes themselves.
      const sig = keySignatureFor(scale);
      cost = (sig ? Math.abs(MAJOR_KEY_SIGNATURES[sig]) : 100) + noteCost / 1000;
    } else cost = noteCost;
    if (cost < bestCost) {
      best = s;
      bestCost = cost;
    }
  }
  return best;
}

/** Standard major key signatures (≤ 7 accidentals). Value = sharps (+) / flats (−). */
export const MAJOR_KEY_SIGNATURES: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
};

/**
 * The conventional key signature for writing this scale, expressed as the
 * name of the parent MAJOR key (VexFlow format, e.g. "Bb"), or null when the
 * scale is better written with accidentals only.
 */
export function keySignatureFor(scale: Scale): string | null {
  const m = scale.mode.keySigMode;
  if (m === undefined) return null;
  // parent major tonic: the note of which `root` is degree (m+1) of the major scale
  const letter = mod(scale.root.letter - m, 7);
  const pc = mod(pitchClass(scale.root) - MAJOR_SEMITONES[m], 12);
  let acc = mod(pc - LETTER_PC[letter], 12);
  if (acc > 6) acc -= 12;
  const name = 'CDEFGAB'[letter] + (acc === 1 ? '#' : acc === -1 ? 'b' : acc === 0 ? '' : '?');
  return name in MAJOR_KEY_SIGNATURES ? name : null;
}

export function scaleTitle(scale: Scale): string {
  return `${noteName(scale.root)} ${scale.mode.name}`;
}
