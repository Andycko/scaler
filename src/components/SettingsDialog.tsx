import { TUNINGS } from '../theory/fretboard';
import type { LabelMode } from './Fretboard';
import { Modal } from './Modal';

interface Props {
  tuningId: string;
  onTuning: (id: string) => void;
  frets: number;
  onFrets: (n: number) => void;
  labelMode: LabelMode;
  onLabelMode: (m: LabelMode) => void;
  leftHanded: boolean;
  onLeftHanded: (b: boolean) => void;
  bpm: number;
  onBpm: (n: number) => void;
  volume: number;
  onVolume: (n: number) => void;
  onClose: () => void;
}

export function SettingsDialog(p: Props) {
  return (
    <Modal title="Settings" onClose={p.onClose}>
      <div className="settings">
        <label className="field">
          <span>Tuning</span>
          <select value={p.tuningId} onChange={(e) => p.onTuning(e.target.value)}>
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Frets shown</span>
          <select value={p.frets} onChange={(e) => p.onFrets(Number(e.target.value))}>
            {[12, 15, 17, 19, 21, 22, 24].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Note labels</span>
          <div className="seg">
            {(['names', 'degrees', 'none'] as LabelMode[]).map((m) => (
              <button key={m} className={p.labelMode === m ? 'on' : ''} onClick={() => p.onLabelMode(m)}>
                {m === 'names' ? 'Note names' : m === 'degrees' ? 'Intervals' : 'Dots'}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={p.leftHanded} onChange={(e) => p.onLeftHanded(e.target.checked)} />
          Left-handed fretboard
        </label>
        <label className="field">
          <span>
            Tempo: <strong>{p.bpm}</strong> bpm (scale runs play eighth notes)
          </span>
          <input type="range" min={50} max={180} value={p.bpm} onChange={(e) => p.onBpm(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={(e) => p.onVolume(Number(e.target.value))} />
        </label>
      </div>
    </Modal>
  );
}
