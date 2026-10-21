import { describe, expect, it } from "vitest";
import { fadeOf, rewardRisk, type CallLevels } from "../src/core/fade.js";

const long: CallLevels = { side: "long", entry: "0.62", tp: "0.70", sl: "0.58" };

describe("rewardRisk", () => {
  it("is |tp-entry| / |entry-sl|", () => {
    expect(rewardRisk(long)).toBe("2");
    expect(rewardRisk({ side: "short", entry: "67000", tp: "64000", sl: "68500" })).toBe("2");
  });

  it("keeps two decimals, rounded down", () => {
    expect(rewardRisk({ side: "long", entry: "100", tp: "110", sl: "97" })).toBe("3.33");
  });

  it("is null when the stop is on the entry", () => {
    expect(rewardRisk({ side: "long", entry: "1", tp: "2", sl: "1" })).toBeNull();
  });
});

describe("fadeOf", () => {
  it("flips the side and swaps tp and sl", () => {
    expect(fadeOf(long)).toEqual({ side: "short", entry: "0.62", tp: "0.58", sl: "0.70" });
  });

  it("flips a short into a long", () => {
    expect(fadeOf({ side: "short", entry: "67000", tp: "64000", sl: "68500" })).toEqual({
      side: "long",
      entry: "67000",
      tp: "68500",
      sl: "64000",
    });
  });

  it("is an involution: fading a fade returns the call", () => {
    expect(fadeOf(fadeOf(long))).toEqual(long);
  });

  it("reports the inverted reward-to-risk honestly", () => {
    // caller R:R 2.0 means the fade risks 2 to make 1.
    expect(rewardRisk(fadeOf(long))).toBe("0.5");
  });

  it("produces a valid ordering for the flipped side (short: tp < entry < sl)", () => {
    const f = fadeOf(long);
    expect(Number(f.tp)).toBeLessThan(Number(f.entry));
    expect(Number(f.entry)).toBeLessThan(Number(f.sl));
  });
});
