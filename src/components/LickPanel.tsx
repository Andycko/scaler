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
const DIGIT = 7.2; // px per digit of a fret number

/** A compact tab of the lick, in rhythm, with bends drawn as arrows (standard tab notation). */
function TabStrip({ notes, stringNames, current }: { notes: PlacedLickNote[]; stringNames: string[]; current: number }) {
  const n = stringNames.length;
  const left = 22;
  const top = 26; // headroom for bend arrows and their labels
  let x = left + 12;
  const placed = notes.map((note) => {
    const at = x;
    // bent notes need room for their arrow
    x += Math.max(note.dur * UNIT, note.bendTo ? 34 : 18);
    return at;
  });
  const width = x + 8;
  const height = top + (n - 1) * LINE + 22;
  const yOf = (s: number) => top + (n - 1 - s) * LINE;
  return (
    <svg className="tab-strip" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Lick tablature">
      {stringNames.map((name, s) => (
        <g key={s}>
          <text x={6} y={yOf(s) + 3.5} className="tab-name">
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
        const label = String(note.fret);
        const w = label.length * DIGIT;
        const cx = placed[i] + w / 2;
        const bend = note.bendTo ? note.bendTo - note.midi : 0;
        // arrow: from the right of the number, curving up to above the staff
        const ax = placed[i] + w + 3;
        const tipX = ax + 12;
        const tipY = 8;
        return (
          <g key={i} className={i === current ? 'tab-note now' : 'tab-note'}>
            <rect x={placed[i] - 2.5} y={y - 6.5} width={w + 5} height={13} rx={3} />
            <text x={cx} y={y + 4} textAnchor="middle">
              {label}
            </text>
            {bend > 0 && (
              <>
                <path d={`M${ax},${y} Q${tipX},${y} ${tipX},${tipY + 5}`} className="tab-arrow" />
                <path d={`M${tipX - 3},${tipY + 7} L${tipX},${tipY + 2} L${tipX + 3},${tipY + 7} Z`} className="tab-arrowhead" />
                <text x={tipX} y={tipY} textAnchor="middle" className="tab-bend">
                  {bend === 1 ? '½' : bend === 2 ? 'full' : '1½'}
                </text>
              </>
            )}
            <text x={cx} y={height - 4} textAnchor="middle" className="tab-degree">
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
