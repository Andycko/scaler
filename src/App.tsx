import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TONE, synth } from './audio/synth';
import { ChordPanel } from './components/ChordPanel';
import { BOTTOM, type ChordHighlight, DEFAULT_SP, Fretboard, type LabelMode, TOP, W, posKey } from './components/Fretboard';
import { Icon } from './components/Icon';
import { InstallDialog } from './components/InstallDialog';
import { type GroupMode, OctaveBar } from './components/OctaveBar';
import { ScaleInfo } from './components/ScaleInfo';
import { SettingsDialog } from './components/SettingsDialog';
import { useInstall } from './install';
import { usePersistent } from './state';
import type { Chord } from './theory/chords';
import { fingerRun } from './theory/fingering';
import { TUNINGS, computeFretboard, groupRuns } from './theory/fretboard';
import { computePositions } from './theory/positions';
import { KEY_CHOICES, mod, noteName, pitchClass } from './theory/notes';
import { FAMILIES, autoRootSpelling, buildScale, getFamily } from './theory/scales';

const ExportDialog = lazy(() => import('./components/ExportDialog').then((m) => ({ default: m.ExportDialog })));

export type Spelling = 'auto' | 'sharp' | 'flat';

export default function App() {
  const [keyPc, setKeyPc] = usePersistent('key', 9);
  const [spelling, setSpelling] = usePersistent<Spelling>('spelling', 'auto');
  const [familyId, setFamilyId] = usePersistent('family', 'pentatonic');
  const [modeId, setModeId] = usePersistent('mode', 'minor-pentatonic');
  const [tuningId, setTuningId] = usePersistent('tuning', 'standard');
  const [frets, setFrets] = usePersistent('frets', typeof window !== 'undefined' && window.innerWidth < 700 ? 15 : 22);
  const [labelMode, setLabelMode] = usePersistent<LabelMode>('labels', 'names');
  const [leftHanded, setLeftHanded] = usePersistent('lefty', false);
  const [bpm, setBpm] = usePersistent('bpm', 96);
  const [volume, setVolume] = usePersistent('volume', 0.8);
  const [tone, setTone] = usePersistent('tone', DEFAULT_TONE);
  const install = useInstall();
  const [focusArr, setFocusArr] = useState<number[]>([]);
  const [groupMode, setGroupMode] = usePersistent<GroupMode>('groupMode', 'octaves');
  const [boxFocusArr, setBoxFocusArr] = useState<number[]>([0]);
  const [chord, setChord] = useState<Chord | null>(null);
  const [playing, setPlaying] = useState<Set<string>>(new Set());
  const [isPlayingRun, setIsPlayingRun] = useState(false);
  // the chords panel and the dialogs are independent: a dialog opens over an open panel
  const [chordsOpen, setChordsOpen] = useState(false);
  const [dialog, setDialog] = useState<null | 'export' | 'settings' | 'install'>(null);
  const [progPlaying, setProgPlaying] = useState<{ name: string; index: number; chords: Chord[] } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, fill: false, desk: false });

  // measure the space available to the fretboard so it can fill landscape screens
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const mq = window.matchMedia('(orientation: landscape), (min-width: 700px)');
    // must match the desktop media query in styles.css (chords panel below the board)
    const desk = window.matchMedia('(min-width: 1024px) and (min-height: 700px)');
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight, fill: mq.matches, desk: desk.matches });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    mq.addEventListener('change', update);
    desk.addEventListener('change', update);
    update();
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', update);
      desk.removeEventListener('change', update);
    };
  }, []);

  // keep mode valid for the family
  const family = FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[0];
  const mode = family.modes.find((m) => m.id === modeId) ?? family.modes[0];
  const tuning = TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0];

  const keyChoice = KEY_CHOICES[mod(keyPc, 12)];
  const root = useMemo(() => {
    if (keyChoice.spellings.length > 1 && spelling !== 'auto')
      return keyChoice.spellings.find((s) => (spelling === 'sharp' ? s.acc > 0 : s.acc < 0)) ?? keyChoice.spellings[0];
    return autoRootSpelling(keyPc, family.id, mode.id);
  }, [keyChoice, spelling, keyPc, family.id, mode.id]);

  const scale = useMemo(() => buildScale(root, family.id, mode.id), [root, family.id, mode.id]);
  const model = useMemo(() => computeFretboard(scale, tuning, frets), [scale, tuning, frets]);
  const focus = useMemo(() => new Set(focusArr.filter((g) => g < model.groups.length)), [focusArr, model.groups.length]);
  const positions = useMemo(() => computePositions(scale, tuning, frets), [scale, tuning, frets]);
  const boxFocus = useMemo(
    () => new Set(boxFocusArr.filter((g) => g < positions.patterns.length)),
    [boxFocusArr, positions.patterns.length],
  );
  const boxes = useMemo(
    () => (groupMode === 'boxes' ? { membership: positions.membership, count: positions.patterns.length, focus: boxFocus } : null),
    [groupMode, positions, boxFocus],
  );

  useEffect(() => synth.setVolume(volume), [volume]);
  useEffect(() => synth.setTone(tone), [tone]);

  const stopAll = useCallback(() => {
    synth.stop();
    setPlaying(new Set());
    setIsPlayingRun(false);
    setProgPlaying(null);
  }, []);

  // changing the scale invalidates playback and chord highlights
  useEffect(() => {
    stopAll();
    setChord(null);
  }, [scale, tuning, frets, stopAll]);

  const playScale = () => {
    if (isPlayingRun) return stopAll();
    stopAll();
    const midis: number[] = [];
    const keys: string[] = [];
    const push = (seq: { m: number; k: string }[]) =>
      seq.forEach((x) => {
        midis.push(x.m);
        keys.push(x.k);
      });
    if (groupMode === 'boxes') {
      // play each selected shape up and down, exactly where it sits on the neck
      const chosen = boxFocus.size ? [...boxFocus].sort((a, b) => a - b) : positions.patterns.map((pt) => pt.index);
      for (const g of chosen) {
        const inst = positions.patterns[g]?.first;
        if (!inst) continue;
        const up = [...inst.notes].sort((a, b) => a.midi - b.midi).map((n) => ({ m: n.midi, k: posKey(n.string, n.fret) }));
        push([...up, ...up.slice(0, -1).reverse()]);
      }
    } else {
      const groups = focus.size ? [...focus] : model.groups.map((g) => g.index);
      for (const run of groupRuns(model, groups)) {
        const pos = fingerRun(run.midis, tuning, frets);
        const up = run.midis.map((m, i) => ({ m, k: posKey(pos[i].string, pos[i].fret) }));
        push([...up, ...up.slice(0, -1).reverse()]);
      }
    }
    setIsPlayingRun(true);
    synth.playRun(midis, bpm * 2, (i) => {
      if (i < 0) {
        setPlaying(new Set());
        setIsPlayingRun(false);
      } else setPlaying(new Set([keys[i]]));
    });
  };

  const highlight: ChordHighlight | null = useMemo(() => {
    const c = progPlaying ? progPlaying.chords[progPlaying.index] : chord;
    if (!c) return null;
    const tones = new Map<number, string>();
    c.tones.forEach((t, i) => tones.set(pitchClass(t), c.formula[i]));
    const outside = new Map(c.outside.map((t) => [pitchClass(t), t]));
    return { tones, outside };
  }, [chord, progPlaying]);

  const onFamily = (id: string) => {
    setFamilyId(id);
    setModeId(getFamily(id).modes[0].id);
    setFocusArr([]);
  };

  const toggleFocus = (g: number | 'all') => {
    const set = groupMode === 'boxes' ? setBoxFocusArr : setFocusArr;
    if (g === 'all') return set([]);
    set((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort((a, b) => a - b)));
  };

  const currentChord = progPlaying ? progPlaying.chords[progPlaying.index] : chord;

  const minBoardWidth = Math.max(600, frets * 30);
  const innerW = Math.max(box.w, minBoardWidth);
  const nStrings = tuning.strings.length;
  // Fill the free height on phones, but cap the on-screen string spacing (~50 px) so wide
  // screens keep a neck-like proportion instead of a tall, stretched board.
  const maxSpacing = Math.max(26, Math.min(64, (50 * W) / innerW));
  // Desktop: the board has a fixed neck-like height and the chords panel sits below it.
  const spacing = box.desk
    ? maxSpacing
    : box.fill && box.h > 0
      ? Math.min(maxSpacing, Math.max(26, (((box.h - 6) * W) / innerW - TOP - BOTTOM) / (nStrings - 1)))
      : DEFAULT_SP;
  const boardHeight = ((TOP + BOTTOM + (nStrings - 1) * maxSpacing) * innerW) / W + 14;

  const chordStrip = currentChord && (
    <div className="chord-strip">
      <span className="chord-strip-label">{progPlaying ? 'Now playing' : 'Chord'}</span>
      <strong>{currentChord.symbol}</strong>
      <span className="roman">{currentChord.roman}</span>
      <span className="tones">
        {currentChord.tones.map((t, i) => (
          <span key={i} className={currentChord.outside.includes(t) ? 'outside' : ''}>
            {noteName(t)}
          </span>
        ))}
      </span>
      {currentChord.outside.length > 0 && <span className="hint">dashed = outside the scale</span>}
      <button
        className="chip-btn"
        onClick={() => {
          stopAll();
          setChord(null);
        }}
      >
        {progPlaying ? 'Stop' : 'Clear'}
      </button>
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" aria-label="Scaler">
          <span className="brand-mark">S</span>
          <span className="brand-name">Scaler</span>
        </div>
        <div className="selectors">
          <label className="field">
            <span>Key</span>
            <div className="key-row">
              <select value={mod(keyPc, 12)} onChange={(e) => setKeyPc(Number(e.target.value))} aria-label="Key">
                {KEY_CHOICES.map((k) => (
                  <option key={k.pc} value={k.pc}>
                    {k.label}
                  </option>
                ))}
              </select>
              {keyChoice.spellings.length > 1 && (
                <button
                  className="chip-btn enh"
                  title="Enharmonic spelling: auto / sharp / flat"
                  onClick={() => setSpelling(spelling === 'auto' ? 'sharp' : spelling === 'sharp' ? 'flat' : 'auto')}
                >
                  {spelling === 'auto' ? 'auto' : spelling === 'sharp' ? '♯' : '♭'}
                </button>
              )}
            </div>
          </label>
          <label className="field">
            <span>Scale</span>
            <select value={family.id} onChange={(e) => onFamily(e.target.value)} aria-label="Scale type">
              {FAMILIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Mode</span>
            <select value={mode.id} onChange={(e) => setModeId(e.target.value)} aria-label="Scale mode">
              {family.modes.map((m, i) => (
                <option key={m.id} value={m.id}>
                  {family.parent ? `${i + 1}. ` : ''}
                  {m.name}
                  {m.aka ? ` (${m.aka})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="actions">
          <button className={`tool ${isPlayingRun ? 'active' : ''}`} onClick={playScale} title="Play the scale (focused octaves)">
            <Icon name={isPlayingRun ? 'stop' : 'play'} />
            <span>{isPlayingRun ? 'Stop' : 'Play'}</span>
          </button>
          <button className={`tool ${chordsOpen ? 'active' : ''}`} onClick={() => setChordsOpen(!chordsOpen)} title="Chords & progressions">
            <Icon name="chords" />
            <span>Chords</span>
          </button>
          <button className="tool" onClick={() => setDialog('export')} title="Export notation / tab as PDF">
            <Icon name="pdf" />
            <span>Export</span>
          </button>
          {install.available && (
            <button
              className="tool install-btn"
              onClick={async () => {
                if (!(await install.install())) setDialog('install');
              }}
              title="Install as an app (full-screen, works offline)"
            >
              <Icon name="install" />
              <span>Install</span>
            </button>
          )}
          <button className="tool icon-only" onClick={() => setDialog('settings')} title="Settings" aria-label="Settings">
            <Icon name="gear" />
          </button>
        </nav>
      </header>

      <main className={`stage ${chordsOpen ? 'with-panel' : ''}`}>
        <div className="board-col">
          <ScaleInfo scale={scale} onPlayNote={(m) => synth.pluck(m)} extra={chordStrip} />
          <div
            className="board-wrap"
            style={box.desk ? { height: `${boardHeight}px` } : box.fill ? { maxHeight: `${boardHeight}px` } : undefined}
          >
            <div className="board-scroll" ref={boardRef}>
              <div className="board-inner" style={{ width: box.w && innerW > box.w ? `${innerW}px` : '100%' }}>
                <Fretboard
                  model={model}
                  tuning={tuning}
                  frets={frets}
                  labelMode={labelMode}
                  leftHanded={leftHanded}
                  focus={focus}
                  chord={highlight}
                  playing={playing}
                  onNote={(n) => synth.pluck(n.midi)}
                  spacing={spacing}
                  boxes={boxes}
                />
              </div>
            </div>
          </div>
          <OctaveBar
            mode={groupMode}
            onMode={setGroupMode}
            groups={model.groups}
            patterns={positions.patterns}
            patternKind={positions.kind}
            focus={groupMode === 'boxes' ? boxFocus : focus}
            onToggle={toggleFocus}
            labelMode={labelMode}
            onLabelMode={setLabelMode}
          />
        </div>
        {chordsOpen && (
          <ChordPanel
            scale={scale}
            selected={chord}
            playing={progPlaying}
            bpm={bpm}
            onBpm={setBpm}
            onClose={() => setChordsOpen(false)}
            onSelectChord={(c) => {
              setProgPlaying(null);
              setChord(c);
            }}
            onPlayProgression={(name, chords, index) => setProgPlaying(index < 0 ? null : { name, chords, index })}
            onStop={stopAll}
          />
        )}
      </main>

      {dialog === 'export' && (
        <Suspense fallback={<div className="modal-backdrop" />}>
          <ExportDialog scale={scale} model={model} tuning={tuning} frets={frets} focus={focus} leftHanded={leftHanded} labelMode={labelMode} onClose={() => setDialog(null)} />
        </Suspense>
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          tuningId={tuning.id}
          onTuning={setTuningId}
          frets={frets}
          onFrets={setFrets}
          labelMode={labelMode}
          onLabelMode={setLabelMode}
          leftHanded={leftHanded}
          onLeftHanded={setLeftHanded}
          bpm={bpm}
          onBpm={setBpm}
          volume={volume}
          onVolume={setVolume}
          tone={tone}
          onTone={setTone}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'install' && <InstallDialog platform={install.platform} onClose={() => setDialog(null)} />}
      <div className="rotate-hint" role="note">
        <Icon name="rotate" /> Turn your phone sideways for the full fretboard.
      </div>
    </div>
  );
}
