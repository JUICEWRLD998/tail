import { describe, expect, it } from "vitest";
import { earnings, estimateTail, type EarningTail } from "../src/core/earnings.js";

const t = (over: Partial<EarningTail> = {}): EarningTail => ({ callId: 1, tgId: 10, status: "filled", size: "0.009", fillPrice: "2480", feeBps: 10, ...over });

describe("estimateTail: entry-fill notional times the builder rate", () => {
  it("is size x fill price x bps / 10000", () => {
    expect(estimateTail(t())).toEqual({ notional: "22.32", feeBps: 10, fee: "0.02232" });
  });

  it("counts a closed tail the same way", () => {
    expect(estimateTail(t({ status: "closed" }))?.fee).toBe("0.02232");
  });

  it.each(["quoted", "placed", "rejected", "cancelled"] as const)("a %s tail earns nothing: it has no fill", (status) => {
    expect(estimateTail(t({ status }))).toBeNull();
  });

  it("a filled tail with no recorded fill price is not guessed at", () => {
    expect(estimateTail(t({ fillPrice: null }))).toBeNull();
  });

  it("a personal wallet carries no builder rate: zero fee, not an error", () => {
    expect(estimateTail(t({ feeBps: 0 }))).toEqual({ notional: "22.32", feeBps: 0, fee: "0" });
  });

  it("never rounds up: the fee is floored at 8 decimals", () => {
    const e = estimateTail(t({ size: "0.0033333", fillPrice: "2499.99", feeBps: 7 })) as { fee: string };
    // exact: 0.0033333 * 2499.99 * 7 / 10000 = 0.005833...
    expect(Number(e.fee)).toBeLessThanOrEqual(0.0033333 * 2499.99 * 7 / 10000);
    expect(e.fee.split(".")[1]!.length).toBeLessThanOrEqual(8);
  });

  it("sweep: the estimate never exceeds the exact value and never goes negative", () => {
    let seen = 0;
    for (let i = 1; i <= 400; i++) {
      const size = (i * 0.0013).toFixed(4);
      const price = (1000 + i * 3.17).toFixed(2);
      const bps = (i % 100) + 1;
      const e = estimateTail(t({ size, fillPrice: price, feeBps: bps }));
      expect(e).not.toBeNull();
      const exact = (Number(size) * Number(price) * bps) / 10000;
      expect(Number(e!.fee)).toBeLessThanOrEqual(exact + 1e-9);
      expect(Number(e!.fee)).toBeGreaterThanOrEqual(0);
      seen++;
    }
    expect(seen).toBe(400);
  });
});

describe("earnings: totals that match their parts", () => {
  it("sums fee and notional over tails with a fill, and reports what was left out", () => {
    const e = earnings([
      t(),
      t({ tgId: 11, size: "0.01", fillPrice: "2500" }),
      t({ tgId: 12, status: "placed" }),
      t({ tgId: 13, feeBps: 0 }),
      t({ tgId: 14, status: "rejected" }),
    ]);
    expect(e).toMatchObject({ fee: "0.04732", filledNotional: "69.64", tails: 5, filled: 3, paying: 2, withoutRate: 1 });
  });

  it("is zero, not unavailable, when nothing has filled", () => {
    expect(earnings([])).toMatchObject({ fee: "0", filledNotional: "0", filled: 0, paying: 0 });
    expect(earnings([t({ status: "placed" })])).toMatchObject({ fee: "0", filled: 0, tails: 1 });
  });

  it("groups by call", () => {
    const e = earnings([t(), t({ callId: 2, tgId: 11 }), t({ callId: 2, tgId: 12 })]);
    expect(e.byCall.get(1)).toMatchObject({ fee: "0.02232", filled: 1 });
    expect(e.byCall.get(2)).toMatchObject({ fee: "0.04464", filled: 2 });
  });

  it("the total equals the sum of the per-call fees", () => {
    const e = earnings([t(), t({ callId: 2, size: "0.0071" }), t({ callId: 3, fillPrice: "2399.37", feeBps: 25 })]);
    const parts = [...e.byCall.values()].reduce((a, c) => a + Number(c.fee), 0);
    expect(Number(e.fee)).toBeCloseTo(parts, 10);
  });

  it("is labelled an estimate and says what it covers", () => {
    const e = earnings([t()]);
    expect(e.basis).toBe("estimate: entry-fill notional x builder fee rate");
  });
});
