import { describe, expect, it } from "vitest";
import { evaluateCall, receiptText, resultLine, resultR, type OutcomeCall } from "../src/core/outcome.js";

const H = 3_600_000;
const T0 = Date.parse("2026-10-21T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

const long: OutcomeCall = { symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", createdAt: iso(T0), enteredAt: null, enteredPrice: null };
const short: OutcomeCall = { ...long, side: "short", tp: "2400.00", sl: "2540.00" };
const entered = (c: OutcomeCall, price = c.entry as string): OutcomeCall => ({ ...c, enteredAt: iso(T0 + H), enteredPrice: price });
const at = (c: OutcomeCall, mark: string, hours = 2) => evaluateCall(c, mark, T0 + hours * H);

describe("a long limit call", () => {
  it("waits while the price is above the entry", () => {
    expect(at(long, "2500.00")).toEqual({ state: "waiting" });
  });
  it("enters when the price touches the entry, at the entry price", () => {
    expect(at(long, "2480.00")).toEqual({ state: "live", enter: { price: "2480.00" } });
    expect(at(long, "2475.50")).toEqual({ state: "live", enter: { price: "2480.00" } });
  });
  it("stays live between stop and target once entered, without re-entering", () => {
    expect(at(entered(long), "2500.00")).toEqual({ state: "live" });
  });
  it("hits the target at or above TP", () => {
    expect(at(entered(long), "2560.00")).toEqual({ state: "tp_hit", resultPrice: "2560.00" });
    expect(at(entered(long), "2561.10")).toEqual({ state: "tp_hit", resultPrice: "2561.10" });
  });
  it("hits the stop at or below SL", () => {
    expect(at(entered(long), "2420.00")).toEqual({ state: "sl_hit", resultPrice: "2420.00" });
    expect(at(entered(long), "2400.00")).toEqual({ state: "sl_hit", resultPrice: "2400.00" });
  });
  it("a gap through the entry straight to the stop enters and stops in one sample", () => {
    expect(at(long, "2410.00")).toEqual({ state: "sl_hit", enter: { price: "2480.00" }, resultPrice: "2410.00" });
  });
  it("a target reached without ever touching the entry is not a hit", () => {
    expect(at(long, "2570.00")).toEqual({ state: "waiting" });
  });
});

describe("a short limit call", () => {
  it("enters when the price rises to the entry, and not before", () => {
    expect(at(short, "2470.00")).toEqual({ state: "waiting" });
    expect(at(short, "2480.00")).toEqual({ state: "live", enter: { price: "2480.00" } });
  });
  it("hits the target below and the stop above", () => {
    expect(at(entered(short), "2399.00")).toEqual({ state: "tp_hit", resultPrice: "2399.00" });
    expect(at(entered(short), "2540.00")).toEqual({ state: "sl_hit", resultPrice: "2540.00" });
  });
});

describe("a market call", () => {
  const market: OutcomeCall = { ...long, entryKind: "market", entry: null };
  it("enters at the first sample's price", () => {
    expect(at(market, "2495.00")).toEqual({ state: "live", enter: { price: "2495.00" } });
  });
  it("then uses that entry price", () => {
    expect(at(entered(market, "2495.00"), "2561.00")).toEqual({ state: "tp_hit", resultPrice: "2561.00" });
  });
});

describe("expiry", () => {
  it("expires after 72 hours without a result, remembering whether it ever entered", () => {
    expect(at(entered(long), "2500.00", 73)).toEqual({ state: "expired", entered: true });
    expect(at(long, "2500.00", 73)).toEqual({ state: "expired", entered: false });
  });
  it("does not expire at exactly 72 hours", () => {
    expect(at(long, "2500.00", 72)).toEqual({ state: "waiting" });
  });
  it("a result in the same sample beats expiry", () => {
    expect(at(entered(long), "2561.00", 80)).toMatchObject({ state: "tp_hit" });
  });
  it("honours a custom lifetime", () => {
    expect(evaluateCall(long, "2500.00", T0 + 3 * H, 2 * H)).toEqual({ state: "expired", entered: false });
  });
});

describe("resultR (ideal R from the call's own levels, not slippage)", () => {
  it("a target hit is the call's reward-to-risk, a stop is -1R", () => {
    expect(resultR(entered(long), "tp_hit")).toBe("1.33");
    expect(resultR(entered(long), "sl_hit")).toBe("-1");
    expect(resultR(entered(short), "tp_hit")).toBe("1.33"); // reward 2480-2400 = 80, risk 2540-2480 = 60
  });
});

describe("text", () => {
  it("target receipt", () => {
    expect(receiptText(entered(long), { state: "tp_hit", resultPrice: "2561.10" })).toBe([
      "✅ <b>ETH-USD · LONG · Target hit</b>", "+1.33R", "",
      "📍 Entry  <code>2480.00</code>", "🎯 Target  <code>2560.00</code>", "🏁 Mark  <code>2561.10</code>",
    ].join("\n"));
  });
  it("stop receipt", () => {
    expect(receiptText(entered(long), { state: "sl_hit", resultPrice: "2419.00" })).toBe([
      "🛑 <b>ETH-USD · LONG · Stopped out</b>", "-1R", "",
      "📍 Entry  <code>2480.00</code>", "🛑 Stop  <code>2420.00</code>", "🏁 Mark  <code>2419.00</code>",
    ].join("\n"));
  });
  it("a market call's receipt uses the price it entered at", () => {
    const m: OutcomeCall = { ...long, entryKind: "market", entry: null, enteredAt: iso(T0), enteredPrice: "2400.69" };
    expect(receiptText(m, { state: "tp_hit", resultPrice: "2404.27" })).toContain("📍 Entry  <code>2400.69</code>");
  });
  it("expiry receipts say whether it ever entered", () => {
    expect(receiptText(entered(long), { state: "expired", entered: true })).toBe("⌛ <b>ETH-USD · LONG · Expired</b>\nNo target or stop in 72 hours.");
    expect(receiptText(long, { state: "expired", entered: false })).toBe("⌛ <b>ETH-USD · LONG · Never entered</b>\nThe price did not reach 2480.00 in 72 hours.");
  });
  it("the card result line", () => {
    expect(resultLine(entered(long), "tp_hit")).toBe("✅ <b>Target hit</b> · +1.33R");
    expect(resultLine(entered(long), "sl_hit")).toBe("🛑 <b>Stopped out</b> · -1R");
    expect(resultLine(entered(long), "expired")).toBe("⌛ <b>Expired</b>");
  });
});

describe("properties", () => {
  it("is deterministic and a terminal state is never produced from a non-entered call without entry first", () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 2000; i++) {
      const call = rnd() < 0.5 ? long : short;
      const mark = (2300 + rnd() * 400).toFixed(2);
      const a = at(call, mark, rnd() * 60);
      expect(at(call, mark, 0)).toEqual(at(call, mark, 0));
      if (a.state === "tp_hit" || a.state === "sl_hit") expect("enter" in a).toBe(true);
    }
  });
});
