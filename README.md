# Scaler — guitar scales on the fretboard

A web app for learning scales and getting better at soloing. Pick a **key**, **scale type** and **mode**; every note is laid out on the fretboard, coloured by octave.

Designed landscape-first for phones, optimised for tablets, and works on desktop. Vintage cream look.

## Features

- **Scales & modes**: Major (all 7 modes), Harmonic Minor, Melodic Minor and Harmonic Major (7 modes each), Pentatonic (5 modes), Blues (minor/major), Whole Tone and both Diminished scales.
- **Correct spelling**: every scale is spelled letter by letter (F♯ major has E♯; C Ultralocrian has B𝄫). The app picks the usual enharmonic tonic (A♭ major, G♯ minor, C♯ Dorian). You can switch it with the ♯/♭ toggle.
- **Octaves**: each root-to-root octave gets its own colour. A root note ends one octave and starts the next, so it's drawn **half and half** in both colours. Tap octave chips to focus one or more octaves; the others fade.
- **Box shapes**: switch *Octaves → Boxes* to colour the neck by playing position instead: the five classic boxes for pentatonic scales (2 notes per string), the same boxes plus the blue note for blues scales, and 3-notes-per-string patterns for 7-note and symmetric scales. Notes shared by neighbouring shapes are split, and *Play* runs through the selected shape exactly where it sits on the neck.
- **Licks**: a third view (*Octaves | Boxes | Licks*) with licks for every scale and mode. They are signature phrases in the style of the players who made each scale famous (rock bends, Albert King / B.B. King boxes, Santana Dorian, Satriani Lydian, Malmsteen harmonic minor, flamenco Phrygian dominant, jazz altered lines…), plus public-domain melodies such as *Ode to Joy* and *Drunken Sailor*. Copyrighted solos are not transcribed. Each lick is written in scale degrees, so it plays in any key. It is fingered in the scale's first position, lit up on the fretboard, shown as a mini tab, and played with real string bends.
- **All notes**: a fourth view that labels every note on the neck, for learning the fretboard. You can keep the current scale highlighted or show every note plainly. Off-scale notes use the key's sharp or flat spelling.
- **Bass guitar**: switch *Settings → Instrument* to Bass guitar. Tunings: 4-string, 5-string (low B), 6-string, drop D and half step down. Sounds: fingerstyle and picked electric bass. Boxes, licks and All notes adapt to the bass; licks sit in the first-position box; backing loops pair your bass with a clean strummed guitar; PDF exports use bass clef.
- **Labels**: note names, intervals (1, ♭3, ♯4…) or plain dots. Left-handed mode, 9 guitar tunings (including 7-string) and 5 bass tunings, 12–24 frets.
- **Sound**: a built-in synth (no downloads) with six tones — nylon, steel-string, jazz archtop, clean electric, crunch amp and electric piano — each with body resonance, room reverb and humanised playing. Tap any note to hear it, or play the focused octaves up and down while the playing position lights up.
- **Installable app (PWA)**: the *Install* button adds Scaler to your home screen so it runs full-screen in landscape without browser bars, and works offline.
- **Chords & progressions** for every key, scale and mode combination:
  - Diatonic triads and 7th chords with Roman numerals (7-note scales).
  - Progressions chosen for each mode. You can play one or **loop it as a backing track**. The current chord's tones are ringed on the fretboard. Chord tones outside the scale are named and shown as dashed markers.
- **My progressions**: build your own progression from the scale's chords or any chord (12 roots × common qualities), then play or loop it with chord tones ringed on the fretboard. Saved in the browser (localStorage) as Roman numerals, so a progression follows you to any key.
- **PDF export**: one or more octaves (as separate exercises or joined into one run), ascending or up-and-down. Choose standard notation (treble-8vb clef with the right key signature), tab, or both. Optional scale-degree labels and a fretboard diagram. A live preview shows before you download.

## Music-theory verification

`src/theory/theory.test.ts` checks the theory against textbook data:
mode formulas derived by rotation, spelling of all 15 major keys and many modes, letter-per-degree spelling for every scale in every key, enharmonic choice, key signatures, diatonic triads/7ths and Roman numerals, progression labels matching the computed harmony, octave grouping, and that every tab position sounds the intended pitch. `src/audio/synth.test.ts` checks that every synth tone plays within 5 cents of the correct pitch.

## Deployment

`.github/workflows/deploy.yml` tests and builds the app on every push to `main`, then publishes `dist/` to the `gh-pages` branch.
In **Settings → Pages**, set *Source: Deploy from a branch* and pick `gh-pages` / `(root)`. The site will be at `https://andycko.github.io/scaler/`.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # music-theory test-suite
npm run build      # static site in dist/ (relative paths, deploy anywhere)
```

Stack: React + TypeScript + Vite, VexFlow (notation/tab), jsPDF + svg2pdf.js (PDF), Web Audio (Karplus–Strong synth).
