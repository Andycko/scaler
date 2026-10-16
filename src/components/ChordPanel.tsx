import { useMemo, useState } from 'react';
import { chordVoicing, synth } from '../audio/synth';
import { type Chord, diatonicChords, isHeptatonic } from '../theory/chords';
import { noteName, pitchClass } from '../theory/notes';
import { progressionsFor } from '../theory/progressions';
import type { Scale } from '../theory/scales';
import { Icon } from './Icon';
import { MyProgressions } from './MyProgressions';

interface Props {
  scale: Scale;
  selected: Chord | null;
  playing: { name: string; index: number } | null;
  bpm: number;
  onBpm: (n: number) => void;
  onClose: () => void;
  onSelectChord: (c: Chord | null) => void;
  onPlayProgression: (name: string, chords: Chord[], index: number) => void;
  onStop: () => void;
}

const voicing = (c: Chord) => chordVoicing(c.tones.map(pitchClass));

export function ChordPanel(p: Props) {
  const hept = isHeptatonic(p.scale);
  const [tab, setTab] = useState<'progressions' | 'diatonic'>('progressions');
  const [sevenths, setSevenths] = useState(false);
  const progs = useMemo(() => progressionsFor(p.scale), [p.scale]);
  const chords = useMemo(() => diatonicChords(p.scale, sevenths ? 4 : 3), [p.scale, sevenths]);

  const select = (c: Chord) => {
    p.onStop();
    p.onSelectChord(c);
    synth.strum(voicing(c), 0, 0.7, 0.03);
  };

  const play = (name: string, cs: Chord[], loop: boolean) => {
    if (p.playing?.name === name) return p.onStop();
    p.onStop();
    p.onSelectChord(null);
    synth.playProgression(cs.map(voicing), p.bpm, loop, (i) => p.onPlayProgression(name, cs, i));
    p.onPlayProgression(name, cs, 0);
  };

  return (
    <aside className="panel" aria-label="Chords and progressions">
      <div className="panel-head">
        <div className="seg">
          <button className={tab === 'progressions' ? 'on' : ''} onClick={() => setTab('progressions')}>
            Progressions
          </button>
          <button className={tab === 'diatonic' ? 'on' : ''} onClick={() => setTab('diatonic')}>
            {hept ? 'Scale chords' : 'About'}
          </button>
        </div>
        <button className="icon-btn" onClick={p.onClose} aria-label="Close panel">
          <Icon name="close" />
        </button>
      </div>

      {tab === 'progressions' && (
        <div className="panel-body">
          <div className="tempo">
            <label>
              Tempo <strong>{p.bpm}</strong> bpm
              <input type="range" min={50} max={180} value={p.bpm} onChange={(e) => p.onBpm(Number(e.target.value))} />
            </label>
          </div>
          <p className="panel-tip">Loop a progression and improvise over it — chord tones are ringed on the fretboard as each chord plays.</p>
          <MyProgressions
            scale={p.scale}
            playingName={p.playing?.name ?? null}
            playingIndex={p.playing?.index ?? -1}
            onPlay={play}
            onSelect={select}
          />
          <h3 className="section-title">Suggested for this mode</h3>
          {progs.map((pr) => {
            const active = p.playing?.name === pr.name;
            const outside = [...new Set(pr.chords.flatMap((c) => c.outside.map(noteName)))];
            return (
              <article key={pr.name} className={`prog ${active ? 'active' : ''}`}>
                <header>
                  <h3>{pr.name}</h3>
                  <div className="prog-btns">
                    <button className="chip-btn" onClick={() => play(pr.name, pr.chords, false)} title="Play once">
                      <Icon name={active ? 'stop' : 'play'} size={14} />
                    </button>
                    <button className={`chip-btn ${active ? 'on' : ''}`} onClick={() => play(pr.name, pr.chords, true)} title="Loop as backing track">
                      <Icon name={active ? 'stop' : 'loop'} size={14} /> Loop
                    </button>
                  </div>
                </header>
                <ol className="prog-chords">
                  {pr.chords.map((c, i) => (
                    <li key={i}>
                      <button
                        className={`pc ${active && p.playing?.index === i ? 'now' : ''} ${c.outside.length ? 'has-out' : ''}`}
                        onClick={() => select(c)}
                        title={`${c.symbol}: ${c.tones.map(noteName).join(' ')}`}
                      >
                        <span className="sym">{c.symbol}</span>
                        <span className="rn">{c.roman}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {pr.note && <p className="prog-note">{pr.note}</p>}
                {outside.length > 0 && (
                  <p className="prog-out">
                    Chord tones outside the scale: <strong>{outside.join(', ')}</strong>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === 'diatonic' && (
        <div className="panel-body">
          {hept ? (
            <>
              <div className="seg small">
                <button className={!sevenths ? 'on' : ''} onClick={() => setSevenths(false)}>
                  Triads
                </button>
                <button className={sevenths ? 'on' : ''} onClick={() => setSevenths(true)}>
                  7th chords
                </button>
              </div>
              <p className="panel-tip">Chords built by stacking thirds from the scale. Tap one to hear it and see its tones.</p>
              <div className="chord-grid">
                {chords.map((c, i) => (
                  <button key={i} className={`chord-card ${p.selected?.symbol === c.symbol ? 'on' : ''}`} onClick={() => select(c)}>
                    <span className="rn">{c.roman}</span>
                    <span className="sym">{c.symbol}</span>
                    <span className="tn">{c.tones.map(noteName).join(' ')}</span>
                    <span className="qn">{c.quality.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="panel-tip">
              This scale has {p.scale.notes.length} notes, so its chords aren’t built by stacking scale thirds. The progressions tab lists the chords it is
              normally played over; any chord tone that falls outside the scale is pointed out and shown as a dashed marker on the fretboard.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
