import { describe, expect, it } from "vitest";
import { bracketFromDraft } from "../src/core/order.js";
import type { CallDraft } from "../src/core/parser.js";

const long: CallDraft = {
  symbol: "ADA-USD", side: "long", entryKind: "limit", entry: "0.6200", tp: "0.7000", sl: "0.5800", leverageHint: 5, extraTargets: [],
};

describe("bracketFromDraft", () => {
  it("maps a long limit call to a buy limit bracket", () => {
    expect(bracketFromDraft({ draft: long, size: "250", strategyId: "s1" })).toEqual({
      symbol: "ADA-USD", side: "buy", type: "limit", size: "250", price: "0.6200", tp: "0.7000", sl: "0.5800", strategyId: "s1",
    });
  });

  it("maps a short call to a sell", () => {
    const r = bracketFromDraft({ draft: { ...long, side: "short", tp: "0.5500", sl: "0.6600" }, size: "10", strategyId: "s" });
    expect(r.side).toBe("sell");
  });

  it("maps a market-entry call to a market bracket with no price", () => {
    const r = bracketFromDraft({ draft: { ...long, entryKind: "market", entry: null }, size: "250", strategyId: "s" });
    expect(r.type).toBe("market");
    expect(r).not.toHaveProperty("price");
  });

  it("fade flips the side and swaps the legs", () => {
    const r = bracketFromDraft({ draft: long, size: "250", strategyId: "s", fade: true });
    expect(r).toMatchObject({ side: "sell", price: "0.6200", tp: "0.5800", sl: "0.7000" });
  });

  it("refuses a limit draft with no entry price", () => {
    expect(() => bracketFromDraft({ draft: { ...long, entry: null }, size: "1", strategyId: "s" })).toThrow(/entry/);
  });
});
