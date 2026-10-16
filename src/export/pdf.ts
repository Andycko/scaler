import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { fingerRun } from '../theory/fingering';
import { type FretboardModel, type Tuning, groupRuns } from '../theory/fretboard';
import { degreeLabelAscii, mod, noteNameAscii, octaveOf } from '../theory/notes';
import { type Scale, keySignatureFor } from '../theory/scales';
import { type ExerciseNote, renderExercise } from './notation';

const PAPER = '#f6efe0';

export type Direction = 'up' | 'updown';
export type Content = 'both' | 'notation' | 'tab';

export interface ExportOptions {
  scale: Scale;
  model: FretboardModel;
  tuning: Tuning;
  frets: number;
  groups: number[];
  combine: boolean;
  direction: Direction;
  content: Content;
  degrees: boolean;
  fretboardSvg?: SVGSVGElement | null;
}

export interface Exercise {
  title: string;
  notes: ExerciseNote[];
}

/** PDF standard fonts are WinAnsi only: map music symbols to ASCII. */
export function ascii(s: string): string {
  return s
    .replace(/𝄫/g, 'bb')
    .replace(/𝄪/g, 'x')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/♮/g, 'nat')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/→/g, '->');
}

/** svg2pdf can't read "pt" font sizes (VexFlow emits them) – convert to user units. */
function normalizeSvgText(svg: SVGSVGElement) {
  svg.querySelectorAll('text').forEach((t) => {
    const cs = getComputedStyle(t);
    const fs = t.getAttribute('font-size');
    const m = fs && /^([\d.]+)pt$/.exec(fs);
    if (m) t.setAttribute('font-size', String((parseFloat(m[1]) * 4) / 3));
    else if (!fs) t.setAttribute('font-size', String(parseFloat(cs.fontSize) || 13));
    const ff = t.getAttribute('font-family');
    if (!ff || !/helvetica|times|courier/i.test(ff)) t.setAttribute('font-family', 'Helvetica');
    if (!t.getAttribute('fill')) t.setAttribute('fill', '#000000');
  });
  // tab numbers sit on white knock-out boxes; match the PDF's paper colour
  svg.querySelectorAll('rect[fill="white"]').forEach((r) => r.setAttribute('fill', PAPER));
}

export function buildExercises(o: Omit<ExportOptions, 'fretboardSvg' | 'content' | 'degrees'>): Exercise[] {
  const { scale, model, tuning, frets } = o;
  const sets = o.combine ? [o.groups] : o.groups.map((g) => [g]);
  const exercises: Exercise[] = [];
  for (const set of sets) {
    for (const { groups, midis: run } of groupRuns(model, set)) {
      if (run.length === 0) continue;
      const positions = fingerRun(run, tuning, frets);
      const up: ExerciseNote[] = run.map((midi, i) => {
        const idx = scale.pcIndex.get(mod(midi, 12))!;
        return { midi, note: scale.notes[idx], degree: scale.degrees[idx], pos: positions[i] };
      });
      const notes = o.direction === 'updown' ? [...up, ...up.slice(0, -1).reverse()] : up;
      const first = noteNameAscii(up[0].note) + octaveOf(up[0].note, up[0].midi);
      const lastN = up[up.length - 1];
      const last = noteNameAscii(lastN.note) + octaveOf(lastN.note, lastN.midi);
      const gl = (g: number) => ascii(model.groups[g].label);
      const label = groups.length > 1 ? `Octaves ${gl(groups[0])} to ${gl(groups[groups.length - 1])}` : `Octave ${gl(groups[0])}`;
      exercises.push({ title: `${label}  (${first} - ${last}, ${o.direction === 'updown' ? 'ascending & descending' : 'ascending'})`, notes });
    }
  }
  return exercises;
}

export async function exportPdf(o: ExportOptions): Promise<void> {
  const doc = await buildPdf(o);
  const name = `${noteNameAscii(o.scale.root)}-${o.scale.mode.name}`.replace(/[^A-Za-z0-9#-]+/g, '-').replace(/#/g, 's');
  doc.save(`${name}.pdf`);
}

export async function buildPdf(o: ExportOptions): Promise<jsPDF> {
  const { scale } = o;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 42;
  const ink: [number, number, number] = [62, 44, 30];
  const soft: [number, number, number] = [130, 108, 86];
  let y = M;

  const header = () => {
    doc.setFillColor(PAPER);
    doc.rect(0, 0, W, H, 'F');
  };
  header();

  doc.setTextColor(...soft);
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.text('Scaler  -  scale study', M, y);
  y += 26;
  doc.setTextColor(...ink);
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.text(ascii(`${noteNameAscii(scale.root)} ${scale.mode.name}`) + (scale.mode.aka ? `  (${ascii(scale.mode.aka)})` : ''), M, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...soft);
  doc.text(ascii(`${scale.family.name}`), M, y);
  y += 20;

  doc.setTextColor(...ink);
  const row = (k: string, v: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(k, M, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, M + 62, y);
    y += 14;
  };
  row('Notes', scale.notes.map(noteNameAscii).join('   '));
  row('Formula', scale.degrees.map(degreeLabelAscii).join('   '));
  const sig = keySignatureFor(scale);
  row('Tuning', ascii(o.tuning.name));
  row('Notation', sig ? `Treble clef 8vb (guitar sounds an octave lower); key signature of ${sig} major` : 'Treble clef 8vb (guitar sounds an octave lower); accidentals written out');
  y += 2;
  doc.setFont('times', 'italic');
  doc.setFontSize(10.5);
  const desc = doc.splitTextToSize(ascii(scale.mode.description), W - 2 * M);
  doc.text(desc, M, y);
  y += desc.length * 13 + 8;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;visibility:hidden;';
  document.body.appendChild(host);
  try {
    if (o.fretboardSvg) {
      const svg = o.fretboardSvg.cloneNode(true) as SVGSVGElement;
      host.appendChild(svg);
      const vb = svg.viewBox.baseVal;
      const w = W - 2 * M;
      const h = (vb.height / vb.width) * w;
      await svg2pdf(svg, doc, { x: M, y, width: w, height: h });
      y += h + 14;
    }

    const exercises = buildExercises(o);
    for (const ex of exercises) {
      if (y > H - M - 120) {
        doc.addPage();
        header();
        y = M;
      }
      doc.setDrawColor(...soft);
      doc.setLineWidth(0.5);
      doc.line(M, y, W - M, y);
      y += 16;
      doc.setFont('times', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...ink);
      doc.text(ex.title, M, y);
      y += 8;
      const systems = renderExercise(host, ex.notes, {
        notation: o.content !== 'tab',
        tab: o.content !== 'notation',
        keySig: sig,
        stringCount: o.tuning.strings.length,
        degrees: o.degrees,
      });
      for (const svg of systems) {
        normalizeSvgText(svg);
        const vb = svg.viewBox.baseVal;
        const vbw = vb && vb.width ? vb.width : Number(svg.getAttribute('width'));
        const vbh = vb && vb.height ? vb.height : Number(svg.getAttribute('height'));
        const scaleF = (W - 2 * M) / 980;
        const w = vbw * scaleF;
        const h = vbh * scaleF;
        if (y + h > H - M) {
          doc.addPage();
          header();
          y = M;
        }
        await svg2pdf(svg, doc, { x: M, y, width: w, height: h });
        y += h + 6;
      }
      y += 10;
    }
  } finally {
    host.remove();
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...soft);
    doc.text(`${p} / ${pages}`, W - M, H - 22, { align: 'right' });
    doc.text(ascii(`${noteNameAscii(scale.root)} ${scale.mode.name}`), M, H - 22);
  }
  return doc;
}
