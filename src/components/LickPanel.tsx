import type { LickDef, PlacedLickNote } from '../theory/licks';
import { degreeLabel } from '../theory/notes';
import { Icon } from './Icon';

interface Props {
  lick: LickDef | null;
  notes: PlacedLickNote[];
  stringNames: string[];
  current: number;
  playing: boolean;
  onPlay: () => void;
}

const UNIT = 13; // px per 16th note
const LINE = 13; // px between tab lines

/** A compact tab of the lick, in rhythm, with bends marked. */
function TabStrip({ notes, stringNames, current }: { notes: PlacedLickNote[]; stringNames: string[]; current: number }) {
  const n = stringNames.length;
  const left = 22;
  let x = left + 8;
  const placed = notes.map((note) => {
    const at = x;
    x += Math.max(note.dur, 1.5) * UNIT;
    return at;
  });
  const width = x + 10;
  const top = 12;
  const height = top + (n - 1) * LINE + 22;
  const yOf = (s: number) => top + (n - 1 - s) * LINE;
  return (
    <svg className="tab-strip" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Lick tablature">
      {stringNames.map((name, s) => (
        <g key={s}>
          <text x={6} y={yOf(s) + 4} className="tab-name">
            {name}
          </text>
          <line x1={left} x2={width - 4} y1={yOf(s)} y2={yOf(s)} className="tab-line" />
        </g>
      ))}
      <line x1={left} x2={left} y1={yOf(n - 1)} y2={yOf(0)} className="tab-bar" />
      <line x1={width - 4} x2={width - 4} y1={yOf(n - 1)} y2={yOf(0)} className="tab-bar" />
      {notes.map((note, i) => {
        if (note.rest) return null;
        const y = yOf(note.string);
        const bend = note.bendTo ? note.bendTo - note.midi : 0;
        const label = `${note.fret}${bend ? '↗' : ''}`;
        const w = label.length * 7 + 6;
        return (
          <g key={i} className={i === current ? 'tab-note now' : 'tab-note'}>
            <rect x={placed[i] - 3} y={y - 7} width={w} height={14} rx={3} />
            <text x={placed[i]} y={y + 4}>
              {label}
            </text>
            {bend > 0 && (
              <text x={placed[i] + w - 2} y={y - 6} className="tab-bend">
                {bend === 1 ? '½' : bend === 2 ? 'full' : '1½'}
              </text>
            )}
            <text x={placed[i] + 1} y={height - 4} className="tab-degree">
              {degreeLabel(note.degree)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LickPanel(p: Props) {
  if (!p.lick) return null;
  return (
    <section className="lick-panel">
      <header>
        <div>
          <h3>{p.lick.name}</h3>
          <p className="lick-style">{p.lick.style}</p>
        </div>
        <button className={`chip-btn ${p.playing ? 'on' : ''}`} onClick={p.onPlay}>
          <Icon name={p.playing ? 'stop' : 'play'} size={14} /> {p.playing ? 'Stop' : 'Play lick'}
        </button>
      </header>
      <div className="tab-scroll">
        <TabStrip notes={p.notes} stringNames={p.stringNames} current={p.current} />
      </div>
      {p.lick.tip && <p className="lick-tip">{p.lick.tip}</p>}
    </section>
  );
}
