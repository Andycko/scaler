import { memo } from 'react';
import { type FretNote, type FretboardModel, type Tuning } from '../theory/fretboard';
import { degreeLabel, degreeLabelAscii, mod, noteName, noteNameAscii, type SpelledNote } from '../theory/notes';
import { CREAM, INK, octaveColor } from './colors';

export type LabelMode = 'names' | 'degrees' | 'none';

export interface ChordHighlight {
  /** pitch class → label (chord-tone formula, e.g. "3") */
  tones: Map<number, string>;
  /** chord tones that are NOT in the scale: pc → spelled note */
  outside: Map<number, SpelledNote>;
}

export interface FretboardProps {
  model: FretboardModel;
  tuning: Tuning;
  frets: number;
  labelMode: LabelMode;
  leftHanded: boolean;
  /** Empty = everything in focus. */
  focus: Set<number>;
  chord?: ChordHighlight | null;
  playing?: Set<string>;
  onNote?: (n: FretNote) => void;
  /** Static rendering for PDF export (ASCII text, no interactivity). */
  print?: boolean;
  /** Restrict printed diagram to these groups. */
  onlyGroups?: Set<number> | null;
  /** String spacing in viewBox units (board height follows from it). */
  spacing?: number;
}

export const W = 1000;
const LABEL_X = 12;
const OPEN_X = 34;
const NUT_X = 54;
const RIGHT_PAD = 10;
export const DEFAULT_SP = 34; // string spacing
export const TOP = 22;
export const BOTTOM = 38;

export function fretX(f: number, frets: number) {
  const real = (1 - Math.pow(2, -f / 12)) / (1 - Math.pow(2, -frets / 12));
  const lin = f / frets;
  return NUT_X + (W - NUT_X - RIGHT_PAD) * (0.5 * lin + 0.5 * real);
}

export const posKey = (s: number, f: number) => `${s}-${f}`;

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

function FretboardImpl(p: FretboardProps) {
  const n = p.tuning.strings.length;
  const SP = p.spacing ?? DEFAULT_SP;
  const H = TOP + (n - 1) * SP + BOTTOM;
  const mx = (x: number) => (p.leftHanded ? W - x : x);
  const yOf = (s: number) => TOP + (n - 1 - s) * SP; // low string at the bottom
  const noteX = (f: number) => (f === 0 ? OPEN_X : (fretX(f - 1, p.frets) + fretX(f, p.frets)) / 2);
  const minWidth = (f: number) => fretX(f, p.frets) - fretX(f - 1, p.frets);
  const r = Math.min(SP * 0.42, minWidth(p.frets) * 0.44, 17);
  const inFocus = (g: number | null) => g !== null && (p.focus.size === 0 || p.focus.has(g));
  const shown = (fn: FretNote) => !p.onlyGroups || p.onlyGroups.has(fn.group) || (fn.endsGroup !== null && p.onlyGroups.has(fn.endsGroup));
  const label = (fn: FretNote) =>
    p.labelMode === 'none' ? '' : p.labelMode === 'names' ? (p.print ? noteNameAscii(fn.note) : noteName(fn.note)) : p.print ? degreeLabelAscii(fn.degree) : degreeLabel(fn.degree);
  const font = "'Karla', Helvetica, Arial, sans-serif";

  // chord tones outside the scale, shown as hollow markers
  const outsideMarks: { s: number; f: number; label: string }[] = [];
  if (p.chord && p.chord.outside.size) {
    p.tuning.strings.forEach((open, s) => {
      for (let f = 0; f <= p.frets; f++) {
        const sp = p.chord!.outside.get(mod(open + f, 12));
        if (sp) outsideMarks.push({ s, f, label: p.print ? noteNameAscii(sp) : noteName(sp) });
      }
    });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      className="fretboard-svg"
      role="img"
      aria-label="Guitar fretboard"
      fontFamily={font}
    >
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8b37f" />
          <stop offset="0.5" stopColor="#cfa46b" />
          <stop offset="1" stopColor="#c29561" />
        </linearGradient>
      </defs>
      {/* board */}
      <rect
        x={p.leftHanded ? RIGHT_PAD : NUT_X}
        y={TOP - SP * 0.5}
        width={W - NUT_X - RIGHT_PAD}
        height={(n - 1) * SP + SP}
        fill="url(#wood)"
        rx={3}
      />
      {/* inlays */}
      {Array.from({ length: p.frets }, (_, i) => i + 1).map((f) => {
        const cx = mx(noteX(f));
        const midY = TOP + ((n - 1) * SP) / 2;
        const even = n % 2 === 0;
        const single = even ? midY : midY - SP / 2;
        const pair = even ? SP : SP * 1.5;
        if (f % 12 === 0)
          return (
            <g key={`in${f}`} fill="#f3e6c8" opacity={0.85}>
              <circle cx={cx} cy={single - pair + (even ? 0 : SP / 2)} r={5.5} />
              <circle cx={cx} cy={single + pair - (even ? 0 : SP / 2)} r={5.5} />
            </g>
          );
        if (INLAYS.includes(f)) return <circle key={`in${f}`} cx={cx} cy={single} r={5.5} fill="#f3e6c8" opacity={0.85} />;
        return null;
      })}
      {/* frets */}
      {Array.from({ length: p.frets + 1 }, (_, f) => (
        <line
          key={`f${f}`}
          x1={mx(fretX(f, p.frets))}
          x2={mx(fretX(f, p.frets))}
          y1={TOP - SP * 0.5}
          y2={TOP + (n - 1) * SP + SP * 0.5}
          stroke={f === 0 ? '#efe4cb' : '#9c8f7c'}
          strokeWidth={f === 0 ? 7 : 2.4}
        />
      ))}
      {/* strings */}
      {p.tuning.strings.map((open, s) => {
        const wound = open < 52;
        return (
          <g key={`s${s}`}>
            <line
              x1={mx(NUT_X - 3)}
              x2={mx(W - RIGHT_PAD)}
              y1={yOf(s)}
              y2={yOf(s)}
              stroke={wound ? '#8a6a3e' : '#9a9a92'}
              strokeWidth={0.9 + (n - 1 - s) * 0.32}
            />
            <text x={mx(LABEL_X)} y={yOf(s) + 4} fontSize={11} textAnchor="middle" fill="#7d6650">
              {p.print ? p.tuning.names[s] : p.tuning.names[s].replace('#', '♯').replace('b', '♭')}
            </text>
          </g>
        );
      })}
      {/* fret numbers */}
      {Array.from({ length: p.frets + 1 }, (_, f) => f)
        .filter((f) => f === 0 || f % 12 === 0 || INLAYS.includes(f) || f === 1)
        .map((f) => (
          <text key={`n${f}`} x={mx(noteX(f))} y={H - 8} fontSize={11} textAnchor="middle" fill="#7d6650">
            {f}
          </text>
        ))}
      {/* outside chord tones */}
      {outsideMarks.map((m) => (
        <g key={`o${m.s}-${m.f}`}>
          <circle cx={mx(noteX(m.f))} cy={yOf(m.s)} r={r - 1} fill={CREAM} fillOpacity={0.75} stroke={INK} strokeWidth={1.4} strokeDasharray="3 2" />
          <text x={mx(noteX(m.f))} y={yOf(m.s) + 4} fontSize={10} textAnchor="middle" fill={INK} fontWeight={700}>
            {m.label}
          </text>
        </g>
      ))}
      {/* scale notes */}
      {p.model.notes.filter(shown).map((fn) => {
        const cx = mx(noteX(fn.fret));
        const cy = yOf(fn.string);
        const key = posKey(fn.string, fn.fret);
        const isPlaying = p.playing?.has(key);
        const upperFocus = inFocus(fn.group);
        const lowerFocus = fn.endsGroup !== null && inFocus(fn.endsGroup);
        const anyFocus = upperFocus || lowerFocus;
        const dim = 0.17;
        const chordTone = p.chord?.tones.get(mod(fn.midi, 12));
        const chordDim = p.chord && chordTone === undefined;
        const opacity = (anyFocus ? 1 : dim) * (chordDim ? 0.45 : 1);
        const lab = label(fn);
        // left half = lower octave (which this root ends), right half = upper octave (which it starts)
        const leftColor = octaveColor(fn.endsGroup ?? fn.group);
        const rightColor = octaveColor(fn.group);
        const split = fn.endsGroup !== null;
        const [lc, rc] = p.leftHanded ? [rightColor, leftColor] : [leftColor, rightColor];
        const [lo, ro] = p.leftHanded ? [upperFocus, lowerFocus] : [lowerFocus, upperFocus];
        return (
          <g
            key={key}
            opacity={opacity}
            className={p.print ? undefined : 'fb-note'}
            onClick={p.onNote ? () => p.onNote!(fn) : undefined}
            style={p.onNote ? { cursor: 'pointer' } : undefined}
          >
            {isPlaying && <circle cx={cx} cy={cy} r={r + 7} fill="#fff3c4" opacity={0.9} />}
            {chordTone !== undefined && <circle cx={cx} cy={cy} r={r + 3.6} fill="none" stroke={INK} strokeWidth={2.2} />}
            {split ? (
              <>
                <path d={`M${cx},${cy - r} A${r},${r} 0 0 0 ${cx},${cy + r} Z`} fill={lc} opacity={lo || !anyFocus ? 1 : 0.28} />
                <path d={`M${cx},${cy - r} A${r},${r} 0 0 1 ${cx},${cy + r} Z`} fill={rc} opacity={ro || !anyFocus ? 1 : 0.28} />
                <line x1={cx} x2={cx} y1={cy - r} y2={cy + r} stroke={CREAM} strokeWidth={1} opacity={0.7} />
              </>
            ) : (
              <circle cx={cx} cy={cy} r={r} fill={rightColor} />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={fn.isRoot ? r - 0.2 : r - 0.5}
              fill="none"
              stroke={fn.isRoot ? INK : CREAM}
              strokeWidth={fn.isRoot ? 2.4 : 1}
              opacity={fn.isRoot ? 1 : 0.55}
            />
            {lab && (
              <text
                x={cx}
                y={cy + 4.2}
                fontSize={lab.length > 2 ? 10.5 : 12.5}
                textAnchor="middle"
                fill={CREAM}
                fontWeight={700}
                pointerEvents="none"
              >
                {lab}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const Fretboard = memo(FretboardImpl);
