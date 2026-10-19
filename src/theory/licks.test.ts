import { describe, expect, it } from 'vitest';
import { TUNINGS } from './fretboard';
import { LICKS, parseLick, placeLick } from './licks';
import { KEY_CHOICES, degreeLabelAscii, mod } from './notes';
import { FAMILIES, autoRootSpelling, buildScale, modeFormula } from './scales';

const std = TUNINGS[0];

describe('licks', () => {
  it('every mode has at least one lick', () => {
    for (const f of FAMILIES) for (const m of f.modes) expect(LICKS[m.id]?.length ?? 0, m.id).toBeGreaterThan(0);
  });

  it('every note (and bend target) is a degree of its own scale', () => {
    for (const f of FAMILIES)
      for (const m of f.modes) {
        const formula = modeFormula(f.id, m.id).map(degreeLabelAscii);
        for (const lick of LICKS[m.id] ?? []) {
          const notes = parseLick(lick.notes, 60);
          expect(notes.length, lick.id).toBeGreaterThan(2);
          for (const n of notes) {
            expect(n.dur).toBeGreaterThan(0);
            if (n.rest) continue;
            expect(formula, `${m.id}/${lick.id}`).toContain(degreeLabelAscii(n.degree));
            if (n.bendDegree) {
              expect(formula, `${m.id}/${lick.id} bend`).toContain(degreeLabelAscii(n.bendDegree));
              const up = n.bendTo! - n.midi;
              expect(up, `${m.id}/${lick.id} bend size`).toBeGreaterThanOrEqual(1);
              expect(up, `${m.id}/${lick.id} bend size`).toBeLessThanOrEqual(3);
            }
          }
        }
      }
  });

  it('places every lick on a playable string/fret that sounds the right pitch, in every key', () => {
    for (const f of FAMILIES)
      for (const m of f.modes)
        for (const k of KEY_CHOICES) {
          const scale = buildScale(autoRootSpelling(k.pc, f.id, m.id), f.id, m.id);
          for (const lick of LICKS[m.id] ?? []) {
            const placed = placeLick(lick, scale, std, 22);
            for (const n of placed) {
              if (n.rest) continue;
              expect(n.fret).toBeGreaterThanOrEqual(0);
              expect(n.fret).toBeLessThanOrEqual(22);
              expect(std.strings[n.string] + n.fret).toBe(n.midi);
              expect(scale.pcs).toContain(mod(n.midi, 12));
            }
          }
        }
  });

  it('Ode to Joy is the real melody (in C: E E F G G F E D C C D E E D D)', () => {
    const scale = buildScale(autoRootSpelling(0, 'major', 'ionian'), 'major', 'ionian');
    const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const ode = placeLick(LICKS.ionian[0], scale, std, 22).map((n) => names[mod(n.midi, 12)]);
    expect(ode.join(' ')).toBe('E E F G G F E D C C D E E D D');
  });

  it('A minor pentatonic rock-bend lick sits in the 5th-position box', () => {
    const scale = buildScale(autoRootSpelling(9, 'pentatonic', 'minor-pentatonic'), 'pentatonic', 'minor-pentatonic');
    const placed = placeLick(LICKS['minor-pentatonic'][0], scale, std, 22);
    for (const n of placed) {
      expect(n.fret).toBeGreaterThanOrEqual(4);
      expect(n.fret).toBeLessThanOrEqual(10);
    }
    // the first note: D on the G string, 7th fret, bent a whole step to E
    expect([placed[0].string, placed[0].fret, placed[0].bendTo! - placed[0].midi]).toEqual([3, 7, 2]);
  });
});
