import { type ReactNode, useState } from 'react';
import { degreeLabel, noteName, octaveOf, pitchClass } from '../theory/notes';
import { type Scale, keySignatureFor } from '../theory/scales';

export function ScaleInfo({ scale, onPlayNote, extra }: { scale: Scale; onPlayNote: (midi: number) => void; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  // reference octave for audition: tonic between C3 and B3
  const base = 48 + pitchClass(scale.root);
  const sig = keySignatureFor(scale);
  return (
    <section className="scale-info">
      <div className="scale-title">
        <h1>
          {noteName(scale.root)} <em>{scale.mode.name}</em>
        </h1>
        {scale.mode.aka && <span className="aka">{scale.mode.aka}</span>}
      </div>
      <ol className="degrees" aria-label="Scale notes">
        {scale.notes.map((n, i) => {
          let midi = base + ((pitchClass(n) - pitchClass(scale.root) + 12) % 12);
          if (i > 0 && midi <= base) midi += 12;
          return (
            <li key={i}>
              <button onClick={() => onPlayNote(midi)} title={`${noteName(n)}${octaveOf(n, midi)}`}>
                <span className="dn">{noteName(n)}</span>
                <span className="dd">{degreeLabel(scale.degrees[i])}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {extra || (
      <button className={`desc ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} title="Show / hide description">
        {scale.mode.description}
        {open && sig && <span className="sig"> Written with the key signature of {sig.replace('#', '♯').replace('b', '♭')} major.</span>}
      </button>
      )}
    </section>
  );
}
