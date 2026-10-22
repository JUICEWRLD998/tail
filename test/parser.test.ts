import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCall, type ParseContext } from "../src/core/parser.js";

// Tick sizes: ADA-USD is from testnet exchangeInfo (2026-10-21). The others are test values, not Strike's.
const ctx: ParseContext = {
  markets: {
    "ADA-USD": { tickSize: "0.0001" },
    "BTC-USD": { tickSize: "0.1" },
    "SOL-USD": { tickSize: "0.01" },
    "ETH-USD": { tickSize: "0.01" },
    "XAU-USD": { tickSize: "0.01" },
  },
};

const FIXTURES = join(import.meta.dirname, "fixtures", "calls");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, `${name}.txt`), "utf8")
    .split("\n")
    .filter((l) => !l.startsWith("#!"))
    .join("\n")
    .trim();
}

describe("fixtures: calls that must become a correct draft", () => {
  const names = readdirSync(FIXTURES)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => f.replace(/\.txt$/, ""));

  it("has fixtures", () => expect(names.length).toBeGreaterThanOrEqual(11));

  it.each(names)("%s", (name) => {
    const expected = JSON.parse(readFileSync(join(FIXTURES, `${name}.expected.json`), "utf8"));
    const r = parseCall(loadFixture(name), ctx);
    expect(r).toEqual({ ok: true, draft: expected });
  });

  it("every fixture file declares its source", () => {
    for (const n of names) {
      expect(readFileSync(join(FIXTURES, `${n}.txt`), "utf8").startsWith("#! source:")).toBe(true);
    }
  });
});

describe("ambiguity becomes a question, never a guess", () => {
  it("asks for the side when none is stated", () => {
    const r = parseCall("ADA 0.62 tp 0.70 sl 0.58", ctx);
    expect(r).toMatchObject({ ok: false, reason: "ambiguous", ask: { field: "side", options: ["Long", "Short"] } });
  });

  it("asks for the side when both are stated", () => {
    const r = parseCall("ADA long or short 0.62 tp 0.70 sl 0.58", ctx);
    expect(r).toMatchObject({ ok: false, reason: "ambiguous", ask: { field: "side" } });
  });

  it("asks for the stop when it is missing", () => {
    const r = parseCall("ADA long 0.62 tp 0.70", ctx);
    expect(r).toMatchObject({ ok: false, reason: "incomplete", ask: { field: "sl" } });
  });

  it("asks for the target when it is missing", () => {
    const r = parseCall("ADA long 0.62 sl 0.58", ctx);
    expect(r).toMatchObject({ ok: false, reason: "incomplete", ask: { field: "tp" } });
  });

  it("asks which entry when two bare numbers are given", () => {
    const r = parseCall("ADA long 0.62 0.63 tp 0.70 sl 0.58", ctx);
    expect(r).toMatchObject({ ok: false, reason: "ambiguous", ask: { field: "entry" } });
  });

  it("asks which market when none is recognisable", () => {
    const r = parseCall("long 0.62 tp 0.70 sl 0.58", ctx);
    expect(r).toMatchObject({ ok: false, reason: "ambiguous", ask: { field: "symbol" } });
  });

  it("flags a long whose stop is above the entry", () => {
    const r = parseCall("ADA long 0.62 tp 0.70 sl 0.65", ctx);
    expect(r).toMatchObject({ ok: false, reason: "inconsistent", ask: { field: "levels" } });
  });

  it("flags a short whose target is above the entry", () => {
    const r = parseCall("ADA short 0.62 tp 0.70 sl 0.66", ctx);
    expect(r).toMatchObject({ ok: false, reason: "inconsistent" });
  });

  it("flags a market-entry long whose stop is above its target", () => {
    const r = parseCall("ADA long now tp 0.58 sl 0.70", ctx);
    expect(r).toMatchObject({ ok: false, reason: "inconsistent" });
  });
});

describe("unlisted markets and chatter", () => {
  it("says the market is not on Strike and names the base", () => {
    expect(parseCall("#DOGE/USDT long 0.1 tp 0.2 sl 0.09", ctx)).toEqual({
      ok: false,
      reason: "not_listed",
      base: "DOGE",
    });
  });

  it("ignores messages that are not calls", () => {
    for (const t of ["gm everyone, big week ahead", "ADA is looking strong today", "", "   ", "👍👍"]) {
      expect(parseCall(t, ctx)).toEqual({ ok: false, reason: "not_a_call" });
    }
  });
});

describe("properties", () => {
  it("is deterministic", () => {
    const t = "ADA long 0.62 tp 0.70 sl 0.58 5x";
    expect(parseCall(t, ctx)).toEqual(parseCall(t, ctx));
  });

  it("never throws, whatever the text", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const words = ["ADA", "long", "short", "tp", "sl", "0.62", "0.7", "5x", "entry", ":", "-", "#", "$", "now", "🟢", "1e9", "..", "0", "-3"];
    for (let i = 0; i < 2000; i++) {
      const n = 1 + Math.floor(rnd() * 12);
      const text = Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)]).join(rnd() < 0.5 ? " " : "\n");
      expect(() => parseCall(text, ctx)).not.toThrow();
    }
  });

  it("an accepted draft always has a valid level order for its side", () => {
    let seed = 99;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    let accepted = 0;
    for (let i = 0; i < 1500; i++) {
      const side = rnd() < 0.5 ? "long" : "short";
      const n = () => (0.3 + rnd() * 0.8).toFixed(3);
      const r = parseCall(`ADA ${side} ${n()} tp ${n()} sl ${n()}`, ctx);
      if (!r.ok) continue;
      accepted++;
      const { entry, tp, sl, side: s } = r.draft;
      const [e, t, l] = [Number(entry), Number(tp), Number(sl)];
      if (s === "long") expect(l < e && e < t).toBe(true);
      else expect(t < e && e < l).toBe(true);
    }
    expect(accepted).toBeGreaterThan(100); // the property is not vacuous
  });
});

describe("formats found in public examples (P6)", () => {
  const ok = (t: string) => {
    const r = parseCall(t, { markets: { ...ctx.markets, "XAU-USD": { tickSize: "0.01" } } });
    if (!r.ok) throw new Error(`not a draft: ${JSON.stringify(r)}`);
    return r.draft;
  };

  it("a target label with an index and a colon is not a price: 'TP 1: 4350'", () => {
    const d = ok("XAU long 4345\nTP 1: 4350\nTP 2: 4354\nStop Loss: 4342");
    expect(d).toMatchObject({ tp: "4350.00", sl: "4342.00", extraTargets: ["4354.00"] });
  });

  it("'Target 1 : 1.43$' style labels work too", () => {
    const d = ok("ADA long 0.62\nTARGET 1  : 0.70$\nTARGET 2  : 0.75$\nSTOP : 0.58$");
    expect(d).toMatchObject({ tp: "0.7000", sl: "0.5800", extraTargets: ["0.7500"] });
  });

  it("a target label with nothing after it ('TP4: Hold') adds no phantom target", () => {
    const d = ok("XAU long 4345\nSL 4330\nTP1 4350\nTP2 4355\nTP3 4360\nTP4: Hold");
    expect(d.extraTargets).toEqual(["4355.00", "4360.00"]);
  });

  it("a bare 'Target :' header line before numbered targets is ignored", () => {
    const d = ok("ADA long 0.62\nTarget :\nTARGET 1 : 0.70\nSTOP : 0.58");
    expect(d.tp).toBe("0.7000");
  });

  it.each(["Stop Lose 4330", "stop los 4330", "STOPLOSS 4330", "Stop-Loss: 4330", "SL: 4330"])("understands the stop spelled %j", (stop) => {
    expect(ok(`XAU long 4345\n${stop}\nTP 4350`).sl).toBe("4330.00");
  });

  it.each(["4438/4433", "4438 / 4433", "4438-4433", "4438 to 4433"])("reads the entry zone %j as its midpoint", (zone) => {
    expect(ok(`GOLD BUY ${zone}\nSL 4428\nTP1 4443`).entry).toBe("4435.50");
  });

  it("reads a direction glued to the symbol: 'XAUUSDSELL 4626'", () => {
    expect(ok("XAUUSDSELL 4626\nSL 4632\nTP 4620")).toMatchObject({ symbol: "XAU-USD", side: "short", entry: "4626.00" });
  });

  it("does not split ordinary words that contain a direction word", () => {
    expect(parseCall("selling pressure is strong on ADA, shortly", ctx)).toEqual({ ok: false, reason: "not_a_call" });
  });

  it("'Leverage X10 X25' consumes both multipliers, so they are not mistaken for an entry", () => {
    const d = ok("ADA long : 0.62\nLeverage X10 X25\nTP 0.70\nSTOP 0.58");
    expect(d).toMatchObject({ entry: "0.6200", leverageHint: 10 });
  });

  describe("an alert with no levels yet (the caller is asked for the rest)", () => {
    it("'GOLD BUY NOW' asks for the stop", () => {
      expect(parseCall("GOLD BUY NOW", { markets: { "XAU-USD": { tickSize: "0.01" } } })).toMatchObject({ ok: false, reason: "incomplete", ask: { field: "sl" } });
    });
    it("'Sell gold now' asks for the stop", () => {
      expect(parseCall("Sell gold now", { markets: { "XAU-USD": { tickSize: "0.01" } } })).toMatchObject({ ok: false, ask: { field: "sl" } });
    });
    it("chatter with a direction and 'now' but no listed market is ignored, not asked about", () => {
      expect(parseCall("should I buy now or wait", ctx)).toEqual({ ok: false, reason: "not_a_call" });
      expect(parseCall("sell now", ctx)).toEqual({ ok: false, reason: "not_a_call" });
    });
    it("a plain sentence with 'now' and a market but no direction is still ignored", () => {
      expect(parseCall("ADA is pumping now", ctx)).toEqual({ ok: false, reason: "not_a_call" });
    });
  });
});

describe("Cornix-style blocks and misspelt labels (fragments reported by a public parser project; messages composed from them)", () => {
  const ctx2 = { markets: { "ETH-USD": { tickSize: "0.01" }, "ADA-USD": { tickSize: "0.0001" }, "BTC-USD": { tickSize: "0.1" } } };
  const draft = (t: string) => {
    const r = parseCall(t, ctx2);
    if (!r.ok) throw new Error(`not a draft: ${JSON.stringify(r)}`);
    return r.draft;
  };

  it("'Entry Targets' is the entry, not a take-profit list", () => {
    const d = draft("#ETH/USDT\nLong\nEntry Targets:\n1) 2480\nTake-Profit Targets:\n1) 2560\n2) 2600\nStop Targets:\n1) 2420\nLeverage: Cross (10x)");
    expect(d).toMatchObject({ symbol: "ETH-USD", side: "long", entry: "2480.00", tp: "2560.00", sl: "2420.00", extraTargets: ["2600.00"], leverageHint: 10 });
  });

  it("a numbered entry list is a question, not a guess", () => {
    const r = parseCall("#ETH/USDT\nLong\nEntry Targets:\n1) 2480\n2) 2470\nTake-Profit Targets:\n1) 2560\nStop Targets:\n1) 2420", ctx2);
    expect(r).toMatchObject({ ok: false, reason: "ambiguous", ask: { field: "entry", options: ["2480", "2470"] } });
  });

  it("an explicit entry range with numbered markers is its midpoint", () => {
    const d = draft("ETH long\nEntries: 2470 - 2490\nTP 2560\nSL 2420");
    expect(d.entry).toBe("2480.00");
  });

  it.each(["ENTERY PRICE: 2480", "Entry price: 2480", "ENTRY ZONE 2480"])("reads the entry label %j", (label) => {
    expect(draft(`ETH long\n${label}\nTP 2560\nSL 2420`).entry).toBe("2480.00");
  });

  it("reads 'STOPP LOSS'", () => {
    expect(draft("ETH long 2480\nSTOPP LOSS: 2420\nTP 2560").sl).toBe("2420.00");
  });

  it("a list marker such as '1) ' is not a price", () => {
    const d = draft("ETH long 2480\nSL 2420\nTake-Profit Targets:\n1) 2560\n2) 2580\n3) 2600");
    expect(d).toMatchObject({ tp: "2560.00", extraTargets: ["2580.00", "2600.00"] });
  });

  it("a hashtag direction with an emoji still works: '#SHORT 🔴'", () => {
    const d = draft("#SHORT 🔴\nETH/USDT\nEntry: 2480\nTP 2400\nSL 2540");
    expect(d).toMatchObject({ side: "short", entry: "2480.00" });
  });
});
