import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/bot/rate-limit.js";

describe("rate limiter", () => {
  it("allows up to max actions per window, then blocks", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 60_000, nowMs: () => 0 });
    expect([1, 2, 3, 4, 5].map(() => rl.check("u").allowed)).toEqual([true, true, true, false, false]);
  });

  it("asks to notify the user only once per blocked window", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000, nowMs: () => 0 });
    rl.check("u");
    expect(rl.check("u")).toEqual({ allowed: false, notify: true });
    expect(rl.check("u")).toEqual({ allowed: false, notify: false });
    expect(rl.check("u")).toEqual({ allowed: false, notify: false });
  });

  it("starts a fresh window after windowMs, and can notify again", () => {
    let t = 0;
    const rl = createRateLimiter({ max: 1, windowMs: 60_000, nowMs: () => t });
    rl.check("u");
    rl.check("u");
    t = 60_001;
    expect(rl.check("u")).toEqual({ allowed: true, notify: false });
    expect(rl.check("u")).toEqual({ allowed: false, notify: true });
  });

  it("keeps users independent", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000, nowMs: () => 0 });
    rl.check("a");
    expect(rl.check("a").allowed).toBe(false);
    expect(rl.check("b").allowed).toBe(true);
  });

  it("does not grow without bound: expired entries are purged", () => {
    let t = 0;
    const rl = createRateLimiter({ max: 5, windowMs: 1000, nowMs: () => t, purgeAbove: 100 });
    for (let i = 0; i < 500; i++) rl.check(`u${i}`);
    t = 5000;
    for (let i = 0; i < 10; i++) rl.check(`late${i}`);
    expect(rl.size()).toBeLessThan(200);
  });

  it("rejects a non-positive limit or window", () => {
    expect(() => createRateLimiter({ max: 0, windowMs: 1000, nowMs: () => 0 })).toThrow();
    expect(() => createRateLimiter({ max: 1, windowMs: 0, nowMs: () => 0 })).toThrow();
  });
});
