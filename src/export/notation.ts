import {
  Accidental,
  Annotation,
  BarlineType,
  Beam,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TabNote,
  TabStave,
  Voice,
} from 'vexflow/bravura';
import type { TabPosition } from '../theory/fingering';
import { type Degree, LETTERS, type SpelledNote, degreeLabelAscii, octaveOf } from '../theory/notes';

export interface ExerciseNote {
  midi: number;
  note: SpelledNote;
  degree: Degree;
  pos: TabPosition;
}

export interface NotationOptions {
  notation: boolean;
  tab: boolean;
  /** VexFlow major key name for the key signature, or null for none. */
  keySig: string | null;
  stringCount: number;
  /** Bass guitar is written in bass clef; both sound an octave below the written notes. */
  clef?: 'treble' | 'bass';
  /** Annotate scale degrees under the notes. */
  degrees: boolean;
  notesPerMeasure?: number;
  measuresPerSystem?: number;
  width?: number;
}

/** VexFlow key, written one octave above sounding pitch (guitar: treble-8vb clef, bass guitar: bass-8vb clef). */
export function vexKey(n: SpelledNote, midi: number): string {
  const acc = n.acc === 0 ? '' : n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc);
  return `${LETTERS[n.letter].toLowerCase()}${acc}/${octaveOf(n, midi + 12)}`;
}

/**
 * Render an exercise into `host` as a series of SVG systems (one SVG per
 * line of music so a PDF can paginate between them). Returns the SVGs.
 */
export function renderExercise(host: HTMLElement, notes: ExerciseNote[], o: NotationOptions): SVGSVGElement[] {
  const perMeasure = o.notesPerMeasure ?? 8;
  const perSystem = o.measuresPerSystem ?? 2;
  const width = o.width ?? 980;
  const measures: ExerciseNote[][] = [];
  for (let i = 0; i < notes.length; i += perMeasure) measures.push(notes.slice(i, i + perMeasure));
  const systems: ExerciseNote[][][] = [];
  for (let i = 0; i < measures.length; i += perSystem) systems.push(measures.slice(i, i + perSystem));
  // don't leave a lonely note or two on a line of their own: fold them into the previous line
  const last = systems[systems.length - 1];
  if (systems.length > 1 && last.reduce((n, m) => n + m.length, 0) < 4) systems[systems.length - 2].push(...systems.pop()!);

  const out: SVGSVGElement[] = [];
  systems.forEach((sys, si) => {
    const div = document.createElement('div');
    host.appendChild(div);
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    const notationH = o.notation ? 150 : 0;
    const tabH = o.tab ? 30 + o.stringCount * 13 : 0;
    const totalH = 40 + notationH + tabH + 40;
    renderer.resize(width, totalH);
    const ctx = renderer.getContext();

    const left = 10;
    const usable = width - left - 10;
    const isFirstMeasureOfSystem = (mi: number) => mi === 0;
    // first measure carries clef / key / tab glyph: give it extra room
    const headerExtra = 80 + (o.keySig ? Math.abs(keyAccidentalCount(o.keySig)) * 11 : 0);
    const totalNotes = sys.reduce((s, m) => s + m.length, 0);
    const fullLine = perMeasure * perSystem;
    // short final lines are drawn proportionally narrower
    const lineWidth = si === systems.length - 1 && totalNotes < fullLine ? Math.max(usable * (totalNotes / fullLine), 260) + headerExtra * 0.4 : usable;
    const unit = (lineWidth - headerExtra) / totalNotes;

    let x = left;
    sys.forEach((m, mi) => {
      const w = m.length * unit + (isFirstMeasureOfSystem(mi) ? headerExtra : 0);
      const isLast = si === systems.length - 1 && mi === sys.length - 1;
      let stave: Stave | null = null;
      let tab: TabStave | null = null;
      if (o.notation) {
        stave = new Stave(x, 40, w);
        if (mi === 0) {
          stave.addClef(o.clef ?? 'treble', 'default', '8vb');
          if (o.keySig) stave.addKeySignature(o.keySig);
        }
        if (isLast) stave.setEndBarType(BarlineType.END);
        stave.setContext(ctx).draw();
      }
      if (o.tab) {
        tab = new TabStave(x, 40 + notationH, w, { num_lines: o.stringCount });
        if (mi === 0) tab.addTabGlyph();
        if (isLast) tab.setEndBarType(BarlineType.END);
        tab.setContext(ctx).draw();
      }
      if (mi === 0 && stave && tab) {
        new StaveConnector(stave, tab).setType('singleLeft').setContext(ctx).draw();
        new StaveConnector(stave, tab).setType('bracket').setContext(ctx).draw();
      }
      if (stave && tab) {
        new StaveConnector(stave, tab).setType(isLast ? 'boldDoubleRight' : 'singleRight').setContext(ctx).draw();
      }

      const voices: Voice[] = [];
      let staveNotes: StaveNote[] = [];
      if (stave) {
        staveNotes = m.map((n) => {
          const sn = new StaveNote({ keys: [vexKey(n.note, n.midi)], duration: '8', auto_stem: true, clef: o.clef ?? 'treble' });
          if (o.degrees)
            sn.addModifier(
              new Annotation(degreeLabelAscii(n.degree)).setFont('Helvetica', 9).setVerticalJustification(Annotation.VerticalJustify.BOTTOM),
            );
          return sn;
        });
        const v = new Voice({ num_beats: m.length, beat_value: 8 }).setMode(Voice.Mode.SOFT).addTickables(staveNotes);
        Accidental.applyAccidentals([v], o.keySig ?? 'C');
        voices.push(v);
      }
      let tabVoice: Voice | null = null;
      if (tab) {
        const tabNotes = m.map(
          (n) => new TabNote({ positions: [{ str: o.stringCount - n.pos.string, fret: n.pos.fret }], duration: '8' }, false),
        );
        tabVoice = new Voice({ num_beats: m.length, beat_value: 8 }).setMode(Voice.Mode.SOFT).addTickables(tabNotes);
      }
      const all = [...voices, ...(tabVoice ? [tabVoice] : [])];
      const fmt = new Formatter();
      voices.forEach((v) => fmt.joinVoices([v]));
      if (tabVoice) fmt.joinVoices([tabVoice]);
      const reference = stave ?? tab!;
      fmt.format(all, reference.getNoteEndX() - reference.getNoteStartX() - 10);
      const beams = stave ? Beam.generateBeams(staveNotes, { groups: [new Fraction(4, 8)] }) : [];
      if (stave) voices.forEach((v) => v.draw(ctx, stave!));
      if (tabVoice && tab) tabVoice.draw(ctx, tab);
      beams.forEach((b) => b.setContext(ctx).draw());
      x += w;
    });

    const svg = div.querySelector('svg') as SVGSVGElement;
    // tighten to the drawn content
    try {
      const bb = svg.getBBox();
      const pad = 6;
      svg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
      svg.setAttribute('width', String(bb.width + pad * 2));
      svg.setAttribute('height', String(bb.height + pad * 2));
    } catch {
      /* not attached (tests) – keep renderer size */
    }
    out.push(svg);
  });
  return out;
}

function keyAccidentalCount(key: string): number {
  const sigs: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6, Cb: 7 };
  return sigs[key] ?? 0;
}
