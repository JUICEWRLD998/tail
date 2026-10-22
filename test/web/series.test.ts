import { describe, expect, it } from "vitest";
import { replaySchedule } from "../../web/src/lib/replay.js";
import { cumulativeR, outcomeSegments, ladder } from "../../web/src/lib/series.js";

describe("replaySchedule: real tail timings, compressed to watch", () => {
  it("keeps the real order and relative spacing, inside the window", () => {
    const s = replaySchedule([0, 1000, 9000], { windowMs: 3000, minGapMs: 100 });
    expect(s).toHaveLength(3);
    expect(s[0]).toBe(0);
    expect(s[2]).toBeLessThanOrEqual(3000);
    expect(s[1]! - s[0]!).toBeLessThan(s[2]! - s[1]!); // 1 s then 8 s stays short-then-long
  });

  it("never stacks two tails on the same instant", () => {
    const s = replaySchedule([500, 500, 500, 500], { windowMs: 2000, minGapMs: 150 });
    for (let i = 1; i < s.length; i++) expect(s[i]! - s[i - 1]!).toBeGreaterThanOrEqual(150);
  });

  it("does not stretch a short real gap into a slow replay", () => {
    expect(replaySchedule([0, 200], { windowMs: 3000, minGapMs: 100 })).toEqual([0, 200]);
  });

  it("sorts input it receives out of order, and handles empty and single", () => {
    expect(replaySchedule([], { windowMs: 3000, minGapMs: 100 })).toEqual([]);
    expect(replaySchedule([5000], { windowMs: 3000, minGapMs: 100 })).toEqual([0]);
    const s = replaySchedule([3000, 1000], { windowMs: 3000, minGapMs: 100 });
    expect(s[0]).toBe(0);
  });
});

const c = (status: string, resultR: string | null, createdAt: string) => ({ status, resultR, createdAt });

describe("cumulativeR", () => {
  it("adds up decided results oldest first, starting from zero", () => {
    const pts = cumulativeR([c("sl_hit", "-1", "2026-10-22T03:00:00Z"), c("open", null, "2026-10-22T02:00:00Z"), c("tp_hit", "1.33", "2026-10-22T01:00:00Z")]);
    expect(pts).toEqual([{ i: 0, r: 0 }, { i: 1, r: 1.33 }, { i: 2, r: 0.33 }]);
  });

  it("is just the origin when nothing is decided", () => {
    expect(cumulativeR([c("open", null, "2026-10-22T01:00:00Z")])).toEqual([{ i: 0, r: 0 }]);
  });

  it("does not drift with floating point", () => {
    const pts = cumulativeR(Array.from({ length: 10 }, (_, k) => c("tp_hit", "0.1", `2026-10-22T0${k}:00:00Z`)));
    expect(pts.at(-1)!.r).toBe(1);
  });
});

describe("outcomeSegments", () => {
  it("splits calls into target, stop, open and expired shares that sum to one", () => {
    const seg = outcomeSegments({ tpHit: 3, slHit: 1, open: 0, expired: 1 });
    expect(seg.map((s) => s.key)).toEqual(["tp", "sl", "open", "expired"]);
    expect(seg.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 10);
    expect(seg[0]).toMatchObject({ count: 3, share: 0.6 });
  });

  it("is empty when there are no calls: nothing to draw, not a fake bar", () => {
    expect(outcomeSegments({ tpHit: 0, slHit: 0, open: 0, expired: 0 })).toEqual([]);
  });
});

describe("ladder: where entry, target and stop sit on one price axis", () => {
  it("places a long's target above and stop below the entry, as 0..1 positions", () => {
    const l = ladder({ entry: "2480", tp: "2560", sl: "2420", side: "long" });
    expect(l.tp).toBeLessThan(l.entry); // y grows downward
    expect(l.sl).toBeGreaterThan(l.entry);
    for (const v of [l.tp, l.entry, l.sl]) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
  });

  it("uses the midpoint for a market entry and says so", () => {
    const l = ladder({ entry: null, tp: "2404", sl: "2390", side: "long" });
    expect(l.entryKnown).toBe(false);
    expect(l.entry).toBeCloseTo((l.tp + l.sl) / 2, 10);
  });
});
