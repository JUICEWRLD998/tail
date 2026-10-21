import { describe, expect, it } from "vitest";
import { normalizeSymbol } from "../src/core/symbols.js";

const LISTED = ["ADA-USD", "SOL-USD", "BTC-USD", "ETH-USD", "XAU-USD"];

describe("normalizeSymbol", () => {
  it.each([
    ["ADA", "ADA-USD"],
    ["ada", "ADA-USD"],
    ["$ADA", "ADA-USD"],
    ["#ADA", "ADA-USD"],
    ["#ADA/USDT", "ADA-USD"],
    ["ADA/USDT", "ADA-USD"],
    ["ADAUSDT", "ADA-USD"],
    ["ADA-PERP", "ADA-USD"],
    ["ADAPERP", "ADA-USD"],
    ["ADA-USD", "ADA-USD"],
    ["ADA/USD", "ADA-USD"],
    ["ADA_USDT", "ADA-USD"],
    ["BTCUSDT.P", "BTC-USD"],
    ["XBT", "BTC-USD"],
    ["XBT/USD", "BTC-USD"],
    ["GOLD", "XAU-USD"],
  ])("maps %s to %s", (raw, symbol) => {
    expect(normalizeSymbol(raw, LISTED)).toEqual({ ok: true, symbol });
  });

  it("reports a well-formed but unlisted market with its base asset", () => {
    expect(normalizeSymbol("#DOGE/USDT", LISTED)).toEqual({ ok: false, reason: "not_listed", base: "DOGE" });
  });

  it("does not eat the end of a real ticker that merely looks like a suffix", () => {
    // base "USDC"-like or "PERP"-like tickers must not collapse to an empty base
    expect(normalizeSymbol("USDT", LISTED)).toEqual({ ok: false, reason: "not_listed", base: "USDT" });
  });

  it("rejects text that is not a ticker", () => {
    expect(normalizeSymbol("", LISTED)).toEqual({ ok: false, reason: "malformed" });
    expect(normalizeSymbol("hello world", LISTED)).toEqual({ ok: false, reason: "malformed" });
    expect(normalizeSymbol("12", LISTED)).toEqual({ ok: false, reason: "malformed" });
  });

  it("is deterministic and never mutates the listed set", () => {
    const listed = [...LISTED];
    const a = normalizeSymbol("$sol", listed);
    expect(normalizeSymbol("$sol", listed)).toEqual(a);
    expect(listed).toEqual(LISTED);
  });
});
