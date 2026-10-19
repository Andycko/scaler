import type { OctaveGroup } from '../theory/fretboard';
import type { Pattern } from '../theory/positions';
import { octaveColor } from './colors';
import type { LabelMode } from './Fretboard';

export type GroupMode = 'octaves' | 'boxes' | 'licks';

interface Props {
  mode: GroupMode;
  onMode: (m: GroupMode) => void;
  groups: OctaveGroup[];
  patterns: Pattern[];
  patternKind: 'box' | '3nps';
  licks: { name: string; style: string }[];
  focus: Set<number>;
  onToggle: (g: number | 'all') => void;
  labelMode: LabelMode;
  onLabelMode: (m: LabelMode) => void;
}

export function OctaveBar(p: Props) {
  const { focus } = p;
  const items =
    p.mode === 'octaves'
      ? p.groups.map((g) => ({
          index: g.index,
          label: g.label,
          note: g.partial ? 'partial' : '',
          title: g.partial ? 'Partial octave (not every note fits on the neck)' : 'Full octave',
        }))
      : p.mode === 'boxes'
        ? p.patterns.map((pt) => ({
            index: pt.index,
            label: pt.label,
            note: pt.first ? `fr ${pt.first.minFret}–${pt.first.maxFret}` : '',
            title: p.patternKind === 'box' ? 'Box shape: 2 notes per string' : '3 notes per string',
          }))
        : p.licks.map((l, i) => ({ index: i, label: l.name, note: '', title: l.style }));
  const licks = p.mode === 'licks';
  return (
    <div className="octave-bar">
      <div className="octaves" role="group" aria-label={p.mode === 'octaves' ? 'Octave focus' : 'Box shape focus'}>
        <div className="seg small" role="group" aria-label="Group notes by">
          <button className={p.mode === 'octaves' ? 'on' : ''} onClick={() => p.onMode('octaves')}>
            Octaves
          </button>
          <button className={p.mode === 'boxes' ? 'on' : ''} onClick={() => p.onMode('boxes')}>
            {p.patternKind === 'box' ? 'Boxes' : 'Patterns'}
          </button>
          <button className={licks ? 'on' : ''} onClick={() => p.onMode('licks')}>
            Licks
          </button>
        </div>
        {!licks && (
          <button className={`oct-chip all ${focus.size === 0 ? 'on' : ''}`} onClick={() => p.onToggle('all')}>
            All
          </button>
        )}
        {items.map((it) => (
          <button
            key={it.index}
            className={`oct-chip ${focus.has(it.index) ? 'on' : ''} ${focus.size && !focus.has(it.index) ? 'dim' : ''} ${licks ? 'lick-chip' : ''}`}
            style={{ ['--oc' as string]: octaveColor(licks ? 0 : it.index) }}
            onClick={() => p.onToggle(it.index)}
            title={it.title}
          >
            <span className="swatch" />
            {it.label}
            {it.note && <span className="partial">{it.note}</span>}
          </button>
        ))}
        {!licks && (
        <span
          className="legend"
          title={p.mode === 'octaves' ? 'A root note closes one octave and opens the next' : 'Notes shared by neighbouring shapes are split'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M9,2 A7,7 0 0 0 9,16 Z" fill={octaveColor(0)} />
            <path d="M9,2 A7,7 0 0 1 9,16 Z" fill={octaveColor(1)} />
            <circle cx="9" cy="9" r="7" fill="none" stroke="#3e2c1e" strokeWidth={p.mode === 'octaves' ? 1.6 : 0} />
          </svg>
          {p.mode === 'octaves' ? 'shared root' : 'shared note'}
        </span>
        )}
      </div>
      <div className="seg" role="group" aria-label="Note labels">
        {(['names', 'degrees', 'none'] as LabelMode[]).map((m) => (
          <button key={m} className={p.labelMode === m ? 'on' : ''} onClick={() => p.onLabelMode(m)}>
            {m === 'names' ? 'Notes' : m === 'degrees' ? 'Intervals' : 'Dots'}
          </button>
        ))}
      </div>
    </div>
  );
}
