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
