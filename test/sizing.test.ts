import { describe, expect, it } from "vitest";
import { sizeTail, type Market, type SizingInput } from "../src/core/sizing.js";

// ADA-USD filters as served by testnet exchangeInfo on 2026-10-21 (docs/proof, DECISIONS.md).
const ADA: Market = { tickSize: "0.0001", stepSize: "1", minQty: "1", maxQty: "2000000", minNotional: "5" };

const base: SizingInput = {
  equity: "1000",
  riskPct: "1",
  maxLeverage: "5",
  maxNotionalUsd: "500",
  entry: "0.62",
  sl: "0.58",
  market: ADA,
};

describe("sizeTail", () => {
  it("sizes so that a stop-out loses the risk budget, capped by notional", () => {
    // risk 10 USD / 0.04 = 250 ADA = 155 USD notional: no cap binds.
    const r = sizeTail(base);
    expect(r).toMatchObject({ ok: true, size: "250", notional: "155", binding: "risk" });
    if (r.ok) expect(r.riskUsd).toBe("10");
  });

  it("caps by max notional", () => {
    const r = sizeTail({ ...base, maxNotionalUsd: "50" });
    // 50 / 0.62 = 80.6 -> 80
    expect(r).toMatchObject({ ok: true, size: "80", binding: "max_notional" });
  });

  it("caps by the follower's leverage limit on equity", () => {
    // equity 1000 * 1x / 0.62 = 1612.9 -> but risk gives 250 so shrink equity-risk: widen risk pct
    const r = sizeTail({ ...base, riskPct: "50", maxLeverage: "1", maxNotionalUsd: "100000" });
    expect(r).toMatchObject({ ok: true, size: "1612", binding: "user_leverage" });
  });

  it("caps by the market's own max leverage when given", () => {
    const r = sizeTail({
      ...base,
      riskPct: "50",
      maxLeverage: "20",
      maxNotionalUsd: "100000",
      market: { ...ADA, maxLeverage: "2" },
    });
    expect(r).toMatchObject({ ok: true, size: "3225", binding: "market_leverage" });
  });

  it("caps by the market max quantity", () => {
    const r = sizeTail({
      ...base,
      equity: "100000000",
      maxLeverage: "100",
      maxNotionalUsd: "999999999",
      riskPct: "100",
    });
    expect(r).toMatchObject({ ok: true, size: "2000000", binding: "max_qty" });
  });

  it("works for shorts (stop above entry)", () => {
    const r = sizeTail({ ...base, entry: "0.62", sl: "0.66" });
    expect(r).toMatchObject({ ok: true, size: "250" });
  });

  it("floors to the lot step", () => {
    const r = sizeTail({ ...base, market: { ...ADA, stepSize: "10" } });
    expect(r).toMatchObject({ ok: true, size: "250" });
    const r2 = sizeTail({ ...base, entry: "0.62", sl: "0.5700", market: { ...ADA, stepSize: "10" } });
    // 10 / 0.05 = 200
    expect(r2).toMatchObject({ ok: true, size: "200" });
    const r3 = sizeTail({ ...base, equity: "1001", market: { ...ADA, stepSize: "10" } });
    // 10.01 / 0.04 = 250.25 -> 250
    expect(r3).toMatchObject({ ok: true, size: "250" });
  });

  it("refuses below the minimum quantity, with the reason", () => {
    const r = sizeTail({ ...base, equity: "1", market: { ...ADA, minQty: "100" } });
    expect(r).toMatchObject({ ok: false, reason: "below_min_qty" });
  });

  it("refuses below the minimum notional, with the reason", () => {
    const r = sizeTail({ ...base, equity: "10" }); // 0.1 USD risk / 0.04 = 2 ADA = 1.24 USD < 5
    expect(r).toMatchObject({ ok: false, reason: "below_min_notional" });
  });

  it("refuses zero or negative equity", () => {
    expect(sizeTail({ ...base, equity: "0" })).toMatchObject({ ok: false, reason: "no_equity" });
    expect(sizeTail({ ...base, equity: "-5" })).toMatchObject({ ok: false, reason: "no_equity" });
  });

  it("refuses when entry equals the stop", () => {
    expect(sizeTail({ ...base, sl: "0.62" })).toMatchObject({ ok: false, reason: "invalid_prices" });
  });

  it("refuses non-positive prices", () => {
    expect(sizeTail({ ...base, entry: "0" })).toMatchObject({ ok: false, reason: "invalid_prices" });
    expect(sizeTail({ ...base, sl: "0" })).toMatchObject({ ok: false, reason: "invalid_prices" });
  });

  it("refuses risk percentages outside (0, 100]", () => {
    expect(sizeTail({ ...base, riskPct: "0" })).toMatchObject({ ok: false, reason: "invalid_settings" });
    expect(sizeTail({ ...base, riskPct: "101" })).toMatchObject({ ok: false, reason: "invalid_settings" });
  });

  describe("properties", () => {
    // Deterministic pseudo-random sweep: no cap is ever exceeded and rounding never goes up.
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

    it("never exceeds any cap, never exceeds the risk budget, is a multiple of the step", () => {
      for (let i = 0; i < 500; i++) {
        const entry = (0.05 + rnd() * 100).toFixed(4);
        const dist = (Number(entry) * (0.005 + rnd() * 0.3)).toFixed(4);
        const long = rnd() < 0.5;
        const slNum = long ? Number(entry) - Number(dist) : Number(entry) + Number(dist);
        if (slNum <= 0 || Number(dist) === 0) continue;
        const input: SizingInput = {
          equity: (rnd() * 50000).toFixed(2),
          riskPct: (0.1 + rnd() * 10).toFixed(2),
          maxLeverage: String(1 + Math.floor(rnd() * 20)),
          maxNotionalUsd: String(50 + Math.floor(rnd() * 5000)),
          entry,
          sl: slNum.toFixed(4),
          market: { ...ADA, stepSize: rnd() < 0.5 ? "1" : "0.01", minQty: "0.01", minNotional: "0.01" },
        };
        const r = sizeTail(input);
        if (!r.ok) continue;
        const size = Number(r.size);
        const e = Number(entry);
        const equity = Number(input.equity);
        expect(size * e).toBeLessThanOrEqual(Number(input.maxNotionalUsd) + 1e-6);
        expect(size * e).toBeLessThanOrEqual(equity * Number(input.maxLeverage) + 1e-6);
        expect(size * Math.abs(e - Number(input.sl))).toBeLessThanOrEqual(
          (equity * Number(input.riskPct)) / 100 + 1e-6,
        );
        expect(size).toBeLessThanOrEqual(Number(ADA.maxQty));
        expect(size).toBeGreaterThan(0);
      }
    });

    it("is deterministic", () => {
      expect(sizeTail(base)).toEqual(sizeTail(base));
    });
  });
});
