import { describe, expect, it } from "vitest";
import { check, loadFixtures } from "./unseen-support.js";

const fixtures = loadFixtures();

describe("calls the parser was not written against (public examples)", () => {
  it("has at least 20 fixtures, each with a cited source", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
    for (const f of fixtures) expect(f.source.startsWith("#! source:")).toBe(true);
  });

  it.each(fixtures.map((f) => [f.id, f] as const))("%s", (_id, f) => {
    const r = check(f);
    expect(r.got, JSON.stringify(r.got)).toBeDefined();
    expect(r.pass, `expected ${JSON.stringify(f.expected)}\n     got ${JSON.stringify(r.got)}`).toBe(true);
  });
});
