import { describe, expect, it } from "vitest";
import { inGamut, luminance, oklchToRgb, parseOklch, ratio } from "../../scripts/contrast.js";

const lum = (s: string) => luminance(oklchToRgb(...parseOklch(s)));

describe("contrast probe (planted controls)", () => {
  it("black on white is 21:1", () => {
    expect(ratio(lum("oklch(0 0 0)"), lum("oklch(1 0 0)"))).toBeCloseTo(21, 0);
  });
  it("a colour on itself is 1:1, so a bad pair does fail", () => {
    expect(ratio(lum("oklch(0.6 0.1 200)"), lum("oklch(0.6 0.1 200)"))).toBe(1);
  });
  it("mid grey L=0.5 on white is close to the known sRGB #636363 value (6.1:1)", () => {
    expect(ratio(lum("oklch(0.5 0 0)"), lum("oklch(1 0 0)"))).toBeGreaterThan(5.8);
    expect(ratio(lum("oklch(0.5 0 0)"), lum("oklch(1 0 0)"))).toBeLessThan(6.5);
  });
  it("flags an out-of-gamut colour", () => {
    expect(inGamut(oklchToRgb(...parseOklch("oklch(0.7 0.4 150)")))).toBe(false);
    expect(inGamut(oklchToRgb(...parseOklch("oklch(0.7 0.05 150)")))).toBe(true);
  });
  it("rejects text that is not an oklch colour", () => {
    expect(() => parseOklch("#fff")).toThrow();
  });
});
