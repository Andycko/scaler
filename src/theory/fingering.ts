import type { Tuning } from './fretboard';

export interface TabPosition {
  string: number; // 0 = lowest-pitched string
  fret: number;
}

/**
 * Choose a playable string/fret for every pitch of a run (dynamic
 * programming over all candidate positions). The cost model favours small
 * hand movements, moving across strings in the direction of the run and
 * low positions — producing the compact box / 3-notes-per-string shapes
 * guitarists actually use.
 */
export function fingerRun(
  midis: number[],
  tuning: Tuning,
  maxFret: number,
  minFret = 0,
  /** Preferred hand position [lowest, highest fret]; notes outside it cost more. */
  prefer?: [number, number],
): TabPosition[] {
  if (midis.length === 0) return [];
  const cands = midis.map((m) => {
    const list: TabPosition[] = [];
    tuning.strings.forEach((open, s) => {
      const f = m - open;
      if (f >= minFret && f <= maxFret) list.push({ string: s, fret: f });
    });
    if (list.length === 0) {
      // fall back to the full neck if the window can't reach this pitch
      tuning.strings.forEach((open, s) => {
        const f = m - open;
        if (f >= 0 && f <= maxFret) list.push({ string: s, fret: f });
      });
    }
    if (list.length === 0) throw new Error(`MIDI ${m} is not playable on this tuning`);
    return list;
  });

  const outside = (p: TabPosition) => {
    if (!prefer) return 0;
    const [lo, hi] = prefer;
    if (p.fret === 0) return lo <= 2 ? 0 : 4 + lo; // open strings belong to the first position only
    return p.fret < lo ? 4 + (lo - p.fret) * 2 : p.fret > hi ? 4 + (p.fret - hi) * 2 : 0;
  };
  const noteCost = (p: TabPosition) => p.fret * 0.06 + outside(p);
  const move = (a: TabPosition, b: TabPosition, rising: boolean) => {
    let c = 0;
    if (a.fret !== 0 && b.fret !== 0) {
      const d = Math.abs(a.fret - b.fret);
      c += d <= 1 ? d * 0.4 : d <= 3 ? d * 0.9 : d === 4 ? 4.5 : 6 + d * 2;
    } else c += 0.6;
    const ds = b.string - a.string;
    if (rising ? ds < 0 : ds > 0) c += 8; // crossing strings against the run
    if (Math.abs(ds) > 1) c += 3 * (Math.abs(ds) - 1); // skipping strings
    return c;
  };

  // DP state: (candidate position, notes already played on that string in a row, capped)
  const MAXRUN = 4;
  const sameStringPenalty = (count: number) => (count >= 4 ? 2.5 * (count - 3) : 0);
  const n = midis.length;
  const S = MAXRUN + 1;
  const cost: number[][] = cands.map((l) => new Array(l.length * S).fill(Infinity));
  const prev: number[][] = cands.map((l) => new Array(l.length * S).fill(-1));
  cands[0].forEach((p, j) => (cost[0][j * S + 1] = noteCost(p)));
  for (let i = 1; i < n; i++) {
    const rising = midis[i] >= midis[i - 1];
    cands[i].forEach((p, j) => {
      cands[i - 1].forEach((q, k) => {
        for (let c = 1; c <= MAXRUN; c++) {
          const base = cost[i - 1][k * S + c];
          if (base === Infinity) continue;
          const nc = q.string === p.string ? Math.min(c + 1, MAXRUN) : 1;
          const total = base + move(q, p, rising) + noteCost(p) + (q.string === p.string ? sameStringPenalty(c + 1) : 0);
          if (total < cost[i][j * S + nc]) {
            cost[i][j * S + nc] = total;
            prev[i][j * S + nc] = k * S + c;
          }
        }
      });
    });
  }
  let st = cost[n - 1].indexOf(Math.min(...cost[n - 1]));
  const out: TabPosition[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    out[i] = cands[i][Math.floor(st / S)];
    st = prev[i][st];
  }
  return out;
}
