import { type Chord, type ChordQuality, QUALITIES, getQuality, makeChord } from './chords';
import { degreeLabelAscii, degreeSemitones, mod, parseDegree } from './notes';
import type { Scale } from './scales';

/**
 * Progressions the player builds and saves (browser localStorage).
 *
 * Chords are stored relative to the tonic — a root degree such as "b7" plus a
 * chord quality — so a progression saved in one key plays in any other key,
 * exactly like a Roman-numeral chart.
 */

export interface StoredChord {
  root: string;
  q: string;
  /** Only for stacked chords without a named quality (exotic modes). */
  formula?: string[];
}

export interface UserProgression {
  id: string;
  name: string;
  chords: StoredChord[];
}

/** Chord qualities offered in the builder (the common ones, in a sensible order). */
export const PICKER_QUALITIES = ['maj', 'min', '7', 'maj7', 'm7', 'm7b5', 'dim', 'dim7', 'aug', 'sus2', 'sus4', '7sus4', '6', 'm6', 'mMaj7', 'aug7', '7b9'].map(
  getQuality,
);

const DEFAULT_DEGREES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];

/** The 12 possible chord roots, spelled the way this scale spells them where it can. */
export function degreeOptions(scale: Scale): string[] {
  return DEFAULT_DEGREES.map((d, semis) => {
    const own = scale.degrees.find((x) => mod(degreeSemitones(x), 12) === semis);
    return own ? degreeLabelAscii(own) : d;
  });
}

export function storeChord(c: Chord): StoredChord {
  const root = degreeLabelAscii(c.rootDegree);
  return c.quality.id === 'custom' ? { root, q: 'custom', formula: c.quality.formula } : { root, q: c.quality.id };
}

function qualityOf(sc: StoredChord): ChordQuality {
  if (sc.q === 'custom' && sc.formula) {
    const f = sc.formula;
    return { id: 'custom', symbol: `(${f.slice(1).join(' ').replace(/b/g, '♭').replace(/#/g, '♯')})`, roman: `(${f.slice(1).join(' ')})`, name: 'stacked thirds', formula: f };
  }
  return getQuality(sc.q);
}

export function resolveUserProgression(scale: Scale, up: UserProgression): Chord[] {
  return up.chords.map((sc) => makeChord(scale, parseDegree(sc.root), qualityOf(sc)));
}

/** Keep only well-formed progressions (storage can hold anything). */
export function sanitize(raw: unknown): UserProgression[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(QUALITIES.map((q) => q.id));
  const out: UserProgression[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, name, chords } = item as Partial<UserProgression>;
    if (typeof id !== 'string' || typeof name !== 'string' || !Array.isArray(chords)) continue;
    const good = chords.filter((c): c is StoredChord => {
      if (!c || typeof c.root !== 'string' || typeof c.q !== 'string') return false;
      try {
        const d = parseDegree(c.root);
        if (d.num < 1 || d.num > 7) return false;
      } catch {
        return false;
      }
      if (c.q === 'custom') return Array.isArray(c.formula) && c.formula.every((f) => typeof f === 'string' && /^(bb|b|#|##)?\d+$/.test(f));
      return known.has(c.q);
    });
    if (good.length) out.push({ id, name: name.slice(0, 60), chords: good.slice(0, 32) });
  }
  return out;
}

export const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
