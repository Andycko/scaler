import { useMemo, useState } from 'react';
import { usePersistent } from '../state';
import { type Chord, diatonicChords, getQuality, isHeptatonic, makeChord } from '../theory/chords';
import { noteName, parseDegree } from '../theory/notes';
import type { Scale } from '../theory/scales';
import {
  PICKER_QUALITIES,
  type StoredChord,
  type UserProgression,
  degreeOptions,
  newId,
  resolveUserProgression,
  sanitize,
  storeChord,
} from '../theory/userProgressions';
import { Icon } from './Icon';

interface Props {
  scale: Scale;
  playingName: string | null;
  playingIndex: number;
  onPlay: (name: string, chords: Chord[], loop: boolean) => void;
  onSelect: (c: Chord) => void;
}

interface Draft {
  id: string | null;
  name: string;
  chords: StoredChord[];
}

const keyOf = (id: string) => `my:${id}`;

export function MyProgressions(p: Props) {
  const [raw, setRaw] = usePersistent<unknown>('myProgressions', []);
  const saved = useMemo(() => sanitize(raw), [raw]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sevenths, setSevenths] = useState(false);
  const [root, setRoot] = useState('1');
  const [quality, setQuality] = useState('maj');

  const hept = isHeptatonic(p.scale);
  const quick = useMemo(() => (hept ? diatonicChords(p.scale, sevenths ? 4 : 3) : []), [p.scale, sevenths, hept]);
  const roots = useMemo(
    () =>
      degreeOptions(p.scale).map((d) => {
        const c = makeChord(p.scale, parseDegree(d), getQuality('maj'));
        return { d, label: `${c.roman} · ${noteName(c.root)}` };
      }),
    [p.scale],
  );
  const draftChords = useMemo(() => (draft ? resolveUserProgression(p.scale, { id: '', name: '', chords: draft.chords }) : []), [draft, p.scale]);

  const save = () => {
    if (!draft || !draft.chords.length) return;
    const entry: UserProgression = { id: draft.id ?? newId(), name: draft.name.trim() || 'My progression', chords: draft.chords };
    setRaw(draft.id ? saved.map((s) => (s.id === draft.id ? entry : s)) : [...saved, entry]);
    setDraft(null);
  };

  const add = (sc: StoredChord, preview: Chord) => {
    setDraft((d) => (d ? { ...d, chords: [...d.chords, sc].slice(0, 32) } : d));
    p.onSelect(preview);
  };

  return (
    <section className="mine">
      <header className="mine-head">
        <h3>My progressions</h3>
        {!draft && (
          <button className="chip-btn" onClick={() => setDraft({ id: null, name: `My progression ${saved.length + 1}`, chords: [] })}>
            + New
          </button>
        )}
      </header>
      {!draft && saved.length === 0 && (
        <p className="panel-tip">Build your own chord progression and loop it while you solo. It’s saved in this browser and follows you to any key.</p>
      )}

      {!draft &&
        saved.map((up) => {
          const chords = resolveUserProgression(p.scale, up);
          const k = keyOf(up.id);
          const active = p.playingName === k;
          const outside = [...new Set(chords.flatMap((c) => c.outside.map(noteName)))];
          return (
            <article key={up.id} className={`prog ${active ? 'active' : ''}`}>
              <header>
                <h3>{up.name}</h3>
                <div className="prog-btns">
                  <button className="chip-btn" onClick={() => p.onPlay(k, chords, false)} title="Play once">
                    <Icon name={active ? 'stop' : 'play'} size={14} />
                  </button>
                  <button className={`chip-btn ${active ? 'on' : ''}`} onClick={() => p.onPlay(k, chords, true)} title="Loop as backing track">
                    <Icon name={active ? 'stop' : 'loop'} size={14} /> Loop
                  </button>
                </div>
              </header>
              <ol className="prog-chords">
                {chords.map((c, i) => (
                  <li key={i}>
                    <button
                      className={`pc ${active && p.playingIndex === i ? 'now' : ''} ${c.outside.length ? 'has-out' : ''}`}
                      onClick={() => p.onSelect(c)}
                      title={`${c.symbol}: ${c.tones.map(noteName).join(' ')}`}
                    >
                      <span className="sym">{c.symbol}</span>
                      <span className="rn">{c.roman}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {outside.length > 0 && (
                <p className="prog-out">
                  Chord tones outside the scale: <strong>{outside.join(', ')}</strong>
                </p>
              )}
              <div className="mine-actions">
                <button className="link-btn" onClick={() => setDraft({ id: up.id, name: up.name, chords: up.chords })}>
                  Edit
                </button>
                <button
                  className="link-btn danger"
                  onClick={() => {
                    if (window.confirm(`Delete “${up.name}”?`)) setRaw(saved.filter((s) => s.id !== up.id));
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}

      {draft && (
        <div className="editor">
          <input
            className="name-input"
            value={draft.name}
            maxLength={60}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-label="Progression name"
          />
          <ol className="prog-chords draft">
            {draftChords.length === 0 && <li className="empty">Tap chords below to add them…</li>}
            {draftChords.map((c, i) => (
              <li key={i}>
                <span className={`pc ${c.outside.length ? 'has-out' : ''}`}>
                  <button className="pc-main" onClick={() => p.onSelect(c)} title={c.tones.map(noteName).join(' ')}>
                    <span className="sym">{c.symbol}</span>
                    <span className="rn">{c.roman}</span>
                  </button>
                  <button className="pc-x" aria-label={`Remove ${c.symbol}`} onClick={() => setDraft({ ...draft, chords: draft.chords.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>

          {hept && (
            <div className="quick">
              <div className="quick-head">
                <span>Scale chords</span>
                <div className="seg small">
                  <button className={!sevenths ? 'on' : ''} onClick={() => setSevenths(false)}>
                    Triads
                  </button>
                  <button className={sevenths ? 'on' : ''} onClick={() => setSevenths(true)}>
                    7ths
                  </button>
                </div>
              </div>
              <div className="quick-chords">
                {quick.map((c, i) => (
                  <button key={i} className="pc" onClick={() => add(storeChord(c), c)}>
                    <span className="sym">{c.symbol}</span>
                    <span className="rn">{c.roman}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="any-chord">
            <span>Any chord</span>
            <select value={root} onChange={(e) => setRoot(e.target.value)} aria-label="Chord root">
              {roots.map((r) => (
                <option key={r.d} value={r.d}>
                  {r.label}
                </option>
              ))}
            </select>
            <select value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Chord quality">
              {PICKER_QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.symbol || 'major'} — {q.name}
                </option>
              ))}
            </select>
            <button
              className="chip-btn"
              onClick={() => {
                const c = makeChord(p.scale, parseDegree(root), getQuality(quality));
                add({ root, q: quality }, c);
              }}
            >
              Add
            </button>
          </div>

          <div className="editor-actions">
            <button className="chip-btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
            {draftChords.length > 0 && (
              <button className="chip-btn" onClick={() => p.onPlay('my:draft', draftChords, false)}>
                <Icon name="play" size={14} /> Try it
              </button>
            )}
            <button className="chip-btn on" disabled={!draft.chords.length} onClick={save}>
              Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
