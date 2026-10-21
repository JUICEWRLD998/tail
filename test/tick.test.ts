import { describe, expect, it } from "vitest";
import { roundToTick } from "../src/core/tick.js";

describe("roundToTick", () => {
  it.each([
    ["2494.617930", "0.01", "2494.62"],
    ["0.62345", "0.00010", "0.6235"],
    ["0.62344", "0.0001", "0.6234"],
    ["27.4", "1", "27"],
    ["27.5", "1", "28"],
    ["2284.366984604261868", "0.01", "2284.37"],
    ["67000", "0.1", "67000.0"],
    ["2655", "0.01", "2655.00"],
  ])("rounds %s to tick %s as %s", (v, tick, want) => {
    expect(roundToTick(v, tick)).toBe(want);
  });

  it("rejects a non-positive tick", () => {
    expect(() => roundToTick("1", "0")).toThrow();
  });
});
