import type { OctaveGroup } from '../theory/fretboard';
import { octaveColor } from './colors';
import type { LabelMode } from './Fretboard';

interface Props {
  groups: OctaveGroup[];
  focus: Set<number>;
  onToggle: (g: number | 'all') => void;
  labelMode: LabelMode;
  onLabelMode: (m: LabelMode) => void;
}

export function OctaveBar({ groups, focus, onToggle, labelMode, onLabelMode }: Props) {
  return (
    <div className="octave-bar">
      <div className="octaves" role="group" aria-label="Octave focus">
        <span className="bar-label">Octaves</span>
        <button className={`oct-chip all ${focus.size === 0 ? 'on' : ''}`} onClick={() => onToggle('all')}>
          All
        </button>
        {groups.map((g) => (
          <button
            key={g.index}
            className={`oct-chip ${focus.has(g.index) ? 'on' : ''} ${focus.size && !focus.has(g.index) ? 'dim' : ''}`}
            style={{ ['--oc' as string]: octaveColor(g.index) }}
            onClick={() => onToggle(g.index)}
            title={g.partial ? 'Partial octave (not every note fits on the neck)' : 'Full octave'}
          >
            <span className="swatch" />
            {g.label}
            {g.partial && <span className="partial">partial</span>}
          </button>
        ))}
        <span className="legend" title="A root note closes one octave and opens the next">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M9,2 A7,7 0 0 0 9,16 Z" fill={octaveColor(0)} />
            <path d="M9,2 A7,7 0 0 1 9,16 Z" fill={octaveColor(1)} />
            <circle cx="9" cy="9" r="7" fill="none" stroke="#3e2c1e" strokeWidth="1.6" />
          </svg>
          shared root
        </span>
      </div>
      <div className="seg" role="group" aria-label="Note labels">
        {(['names', 'degrees', 'none'] as LabelMode[]).map((m) => (
          <button key={m} className={labelMode === m ? 'on' : ''} onClick={() => onLabelMode(m)}>
            {m === 'names' ? 'Notes' : m === 'degrees' ? 'Intervals' : 'Dots'}
          </button>
        ))}
      </div>
    </div>
  );
}
