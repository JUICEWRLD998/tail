// Chart series from page rows. Pure; nothing is invented: no rows, no points.
export interface RRow {
  status: string;
  resultR: string | null;
  createdAt: string;
}

/** Running sum of decided results, oldest call first, starting at the origin. Summed in hundredths to avoid drift. */
export function cumulativeR(rows: RRow[]): { i: number; r: number }[] {
  const decided = rows
    .filter((r) => (r.status === "tp_hit" || r.status === "sl_hit") && r.resultR !== null)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const pts = [{ i: 0, r: 0 }];
  let cents = 0;
  decided.forEach((row, k) => {
    cents += Math.round(Number(row.resultR) * 100);
    pts.push({ i: k + 1, r: cents / 100 });
  });
  return pts;
}

export type OutcomeKey = "tp" | "sl" | "open" | "expired";

export function outcomeSegments(r: { tpHit: number; slHit: number; open: number; expired: number }): { key: OutcomeKey; count: number; share: number }[] {
  const total = r.tpHit + r.slHit + r.open + r.expired;
  if (total === 0) return [];
  const parts: [OutcomeKey, number][] = [["tp", r.tpHit], ["sl", r.slHit], ["open", r.open], ["expired", r.expired]];
  return parts.map(([key, count]) => ({ key, count, share: count / total }));
}

/** Vertical positions (0 = top, 1 = bottom) of a call's levels on one price axis, with padding above and below. */
export function ladder(c: { entry: string | null; tp: string; sl: string; side: "long" | "short" }): { tp: number; entry: number; sl: number; entryKnown: boolean } {
  const tp = Number(c.tp);
  const sl = Number(c.sl);
  const entryKnown = c.entry !== null;
  const entry = entryKnown ? Number(c.entry) : (tp + sl) / 2;
  const hi = Math.max(tp, sl, entry);
  const lo = Math.min(tp, sl, entry);
  const pad = (hi - lo) * 0.18 || 1;
  const y = (p: number) => (hi + pad - p) / (hi - lo + 2 * pad);
  return { tp: y(tp), entry: entryKnown ? y(entry) : (y(tp) + y(sl)) / 2, sl: y(sl), entryKnown };
}
