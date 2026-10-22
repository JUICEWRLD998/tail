// Turns real tail timings (ms after the call was posted) into a schedule that can be watched in a few seconds.
// Order and relative spacing survive; a short real gap is never stretched; two tails never land on the same frame.
export function replaySchedule(offsetsMs: number[], o: { windowMs: number; minGapMs: number }): number[] {
  if (offsetsMs.length === 0) return [];
  const sorted = [...offsetsMs].sort((a, b) => a - b);
  const start = sorted[0] as number;
  const span = (sorted.at(-1) as number) - start;
  const scale = span > o.windowMs ? o.windowMs / span : 1;
  const out: number[] = [];
  for (const t of sorted) {
    const at = Math.round((t - start) * scale);
    const prev = out.at(-1);
    out.push(prev === undefined ? 0 : Math.max(at, prev + o.minGapMs));
  }
  return out;
}
