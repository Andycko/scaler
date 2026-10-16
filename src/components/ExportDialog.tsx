import { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { type Content, type Direction, buildExercises, exportPdf } from '../export/pdf';
import { renderExercise } from '../export/notation';
import type { FretboardModel, Tuning } from '../theory/fretboard';
import { type Scale, keySignatureFor, scaleTitle } from '../theory/scales';
import { octaveColor } from './colors';
import { Fretboard, type LabelMode } from './Fretboard';
import { Icon } from './Icon';
import { Modal } from './Modal';

interface Props {
  scale: Scale;
  model: FretboardModel;
  tuning: Tuning;
  frets: number;
  focus: Set<number>;
  leftHanded: boolean;
  labelMode: LabelMode;
  onClose: () => void;
}

export function ExportDialog(p: Props) {
  const [groups, setGroups] = useState<number[]>(() => (p.focus.size ? [...p.focus] : p.model.groups.map((g) => g.index)));
  const [combine, setCombine] = useState(true);
  const [direction, setDirection] = useState<Direction>('updown');
  const [content, setContent] = useState<Content>('both');
  const [degrees, setDegrees] = useState(true);
  const [diagram, setDiagram] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => [...groups].sort((a, b) => a - b), [groups]);
  const exercises = useMemo(
    () => (sorted.length ? buildExercises({ scale: p.scale, model: p.model, tuning: p.tuning, frets: p.frets, groups: sorted, combine, direction }) : []),
    [p.scale, p.model, p.tuning, p.frets, sorted, combine, direction],
  );

  // live preview of the first exercise
  useEffect(() => {
    const host = previewRef.current;
    if (!host) return;
    host.innerHTML = '';
    if (!exercises.length) return;
    try {
      renderExercise(host, exercises[0].notes, {
        notation: content !== 'tab',
        tab: content !== 'notation',
        keySig: keySignatureFor(p.scale),
        stringCount: p.tuning.strings.length,
        degrees,
      });
      host.querySelectorAll('svg').forEach((s) => {
        s.removeAttribute('width');
        s.removeAttribute('height');
        s.style.width = '100%';
        s.style.height = 'auto';
      });
    } catch (e) {
      host.textContent = `Preview unavailable: ${(e as Error).message}`;
    }
  }, [exercises, content, degrees, p.scale, p.tuning]);

  const toggle = (g: number) => setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      let fretboardSvg: SVGSVGElement | null = null;
      if (diagram) {
        const markup = renderToStaticMarkup(
          <Fretboard
            model={p.model}
            tuning={p.tuning}
            frets={p.frets}
            labelMode={p.labelMode === 'none' ? 'names' : p.labelMode}
            leftHanded={p.leftHanded}
            focus={new Set()}
            onlyGroups={new Set(sorted)}
            print
          />,
        );
        fretboardSvg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
      }
      await exportPdf({ scale: p.scale, model: p.model, tuning: p.tuning, frets: p.frets, groups: sorted, combine, direction, content, degrees, fretboardSvg });
    } catch (e) {
      console.error(e);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Export ${scaleTitle(p.scale)}`} onClose={p.onClose} wide>
      <div className="export-grid">
        <div className="export-opts">
          <fieldset>
            <legend>Octaves</legend>
            <div className="oct-checks">
              {p.model.groups.map((g) => (
                <label key={g.index} className={`oct-check ${groups.includes(g.index) ? 'on' : ''}`} style={{ ['--oc' as string]: octaveColor(g.index) }}>
                  <input type="checkbox" checked={groups.includes(g.index)} onChange={() => toggle(g.index)} />
                  <span className="swatch" />
                  {g.label}
                  {g.partial && <span className="partial">partial</span>}
                </label>
              ))}
            </div>
            <div className="row-btns">
              <button className="chip-btn" onClick={() => setGroups(p.model.groups.map((g) => g.index))}>
                All
              </button>
              <button className="chip-btn" onClick={() => setGroups([])}>
                None
              </button>
            </div>
            <label className="check">
              <input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} />
              Join neighbouring octaves into one continuous run
            </label>
          </fieldset>
          <fieldset>
            <legend>Format</legend>
            <div className="seg">
              {(['both', 'notation', 'tab'] as Content[]).map((c) => (
                <button key={c} className={content === c ? 'on' : ''} onClick={() => setContent(c)}>
                  {c === 'both' ? 'Notation + Tab' : c === 'notation' ? 'Notation' : 'Tab'}
                </button>
              ))}
            </div>
            <div className="seg">
              <button className={direction === 'updown' ? 'on' : ''} onClick={() => setDirection('updown')}>
                Up &amp; down
              </button>
              <button className={direction === 'up' ? 'on' : ''} onClick={() => setDirection('up')}>
                Ascending
              </button>
            </div>
            <label className="check">
              <input type="checkbox" checked={degrees} onChange={(e) => setDegrees(e.target.checked)} />
              Scale degrees under the notes
            </label>
            <label className="check">
              <input type="checkbox" checked={diagram} onChange={(e) => setDiagram(e.target.checked)} />
              Include fretboard diagram
            </label>
          </fieldset>
          <button className="primary" disabled={busy || !exercises.length} onClick={download}>
            <Icon name="download" /> {busy ? 'Building PDF…' : 'Download PDF'}
          </button>
          {error && <p className="error">Export failed: {error}</p>}
        </div>
        <div className="export-preview">
          <div className="preview-head">
            Preview{exercises.length ? ` — ${exercises[0].title}` : ''}
            {exercises.length > 1 && <span className="more"> (+{exercises.length - 1} more)</span>}
          </div>
          {!exercises.length && <p className="panel-tip">Select at least one octave.</p>}
          <div className="preview-paper" ref={previewRef} />
        </div>
      </div>
    </Modal>
  );
}
