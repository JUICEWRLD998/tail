import { describe, expect, it } from "vitest";
import { D } from "../src/core/dec.js";

describe("D (exact decimal)", () => {
  it("round-trips decimal strings without float error", () => {
    expect(D.str(D.of("0.1"))).toBe("0.1");
    expect(D.str(D.of("0.30000000000000004"))).toBe("0.30000000000000004");
    expect(D.str(D.of("12"))).toBe("12");
    expect(D.str(D.of("-0.5"))).toBe("-0.5");
  });

  it("rejects non-decimal input", () => {
    for (const bad of ["", "abc", "1e5", "1.2.3", " 1", "NaN"]) expect(() => D.of(bad)).toThrow(/decimal/);
  });

  it("does exact arithmetic where floats fail", () => {
    expect(D.str(D.add(D.of("0.1"), D.of("0.2")))).toBe("0.3");
    expect(D.str(D.mul(D.of("0.1"), D.of("3")))).toBe("0.3");
    expect(D.str(D.div(D.of("0.3"), D.of("0.1")))).toBe("3");
  });

  it("floors to a step and never rounds up", () => {
    expect(D.str(D.floorToStep(D.of("0.2999"), D.of("0.01")))).toBe("0.29");
    expect(D.str(D.floorToStep(D.of("27.9"), D.of("1")))).toBe("27");
    expect(D.str(D.floorToStep(D.of("0.3"), D.of("0.1")))).toBe("0.3");
  });

  it("rounds to the nearest step for prices", () => {
    expect(D.str(D.roundToStep(D.of("0.62346"), D.of("0.0001")))).toBe("0.6235");
    expect(D.str(D.roundToStep(D.of("0.62344"), D.of("0.0001")))).toBe("0.6234");
  });

  it("compares and takes min", () => {
    expect(D.lt(D.of("1"), D.of("1.0000001"))).toBe(true);
    expect(D.str(D.min(D.of("2"), D.of("1.5"), D.of("3")))).toBe("1.5");
  });

  it("refuses to divide by zero", () => {
    expect(() => D.div(D.of("1"), D.of("0"))).toThrow(/zero/);
  });
});
