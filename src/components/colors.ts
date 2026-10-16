/** Vintage octave palette — all dark enough for cream labels. */
export const OCTAVE_COLORS = ['#b14f36', '#a87512', '#5f7d3a', '#2f7479', '#4f5e98', '#85507d', '#9a3f3f', '#5d6b5a'];

export const octaveColor = (i: number) => OCTAVE_COLORS[((i % OCTAVE_COLORS.length) + OCTAVE_COLORS.length) % OCTAVE_COLORS.length];

export const INK = '#3e2c1e';
export const CREAM = '#fffaf0';
