const PATHS: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M6 6h12v12H6z',
  loop: 'M17 2l4 4-4 4V7H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5h10V2zM7 22l-4-4 4-4v3h10a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v3z',
  chords: 'M4 4h2v16H4zM9 4h2v16H9zM14 4h2v16h-2zM19 4h2v16h-2zM2 8h20v1.6H2zM2 14h20v1.6H2z',
  pdf: 'M6 2h8l6 6v14H6zM13 3.5V9h5.5M8.5 13h7v1.6h-7zm0 3.4h7V18h-7z',
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  close: 'M5.6 4.2L12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z',
  rotate: 'M7 3h10a2 2 0 0 1 2 2v6h-2V5H7v14h4v2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 12l3-3 3 3h-2v4h-2v-4z',
  install: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h8V4zm3 3h2v5.2l1.8-1.8 1.4 1.4L12 15.6l-4.2-4.2 1.4-1.4 1.8 1.8z',
  download: 'M11 3h2v10l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13zM4 19h16v2H4z',
};

/** Outline icons drawn with strokes. */
const STROKES: Record<string, string> = {
  // chord-box diagram: 4 strings × 3 frets
  chords: 'M5 4.5h14M5 9.5h14M5 14.5h14M5 19.5h14M5 4.5v15M9.67 4.5v15M14.33 4.5v15M19 4.5v15',
  pdf: 'M6.5 2.5h8l5 5v14h-13zM14.5 2.5v5h5M9.5 12.5h6M9.5 16h6',
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon">
      {STROKES[name] ? (
        <>
          <path d={STROKES[name]} fill="none" stroke="currentColor" strokeWidth={name === 'chords' ? 1.4 : 1.6} strokeLinejoin="round" strokeLinecap="round" />
          {name === 'chords' && (
            <g fill="currentColor">
              <circle cx="9.67" cy="7" r="1.75" />
              <circle cx="14.33" cy="12" r="1.75" />
              <circle cx="9.67" cy="17" r="1.75" />
            </g>
          )}
        </>
      ) : (
        <path d={PATHS[name]} fill="currentColor" fillRule="evenodd" />
      )}
    </svg>
  );
}
