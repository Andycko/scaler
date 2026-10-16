const PATHS: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M6 6h12v12H6z',
  loop: 'M17 2l4 4-4 4V7H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5h10V2zM7 22l-4-4 4-4v3h10a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v3z',
  chords: 'M4 4h2v16H4zM9 4h2v16H9zM14 4h2v16h-2zM19 4h2v16h-2zM2 8h20v1.6H2zM2 14h20v1.6H2z',
  pdf: 'M6 2h8l6 6v14H6zM13 3.5V9h5.5M8.5 13h7v1.6h-7zm0 3.4h7V18h-7z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.6 4.6l1.9 1.5-2 3.4-2.3-.9a7.7 7.7 0 0 1-1.9 1.1L16 21h-4l-.4-2.4a7.7 7.7 0 0 1-1.9-1.1l-2.3.9-2-3.4 1.9-1.5a7.8 7.8 0 0 1 0-2.2L5.4 9.8l2-3.4 2.3.9a7.7 7.7 0 0 1 1.9-1.1L12 3h4l.4 2.4a7.7 7.7 0 0 1 1.9 1.1l2.3-.9 2 3.4-1.9 1.5a7.8 7.8 0 0 1 0 2.2z',
  close: 'M5.6 4.2L12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z',
  rotate: 'M7 3h10a2 2 0 0 1 2 2v6h-2V5H7v14h4v2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 12l3-3 3 3h-2v4h-2v-4z',
  download: 'M11 3h2v10l3.5-3.5 1.4 1.4L12 16.8l-5.9-5.9 1.4-1.4L11 13zM4 19h16v2H4z',
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const outline = name === 'pdf';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon">
      {outline ? (
        <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      ) : (
        <path d={PATHS[name]} fill="currentColor" fillRule="evenodd" />
      )}
    </svg>
  );
}
