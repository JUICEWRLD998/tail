import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduler } from "../src/jobs/scheduler.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("scheduler", () => {
  it("runs each task on its own interval", async () => {
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    const s = createScheduler([{ name: "a", everyMs: 1000, run: a }, { name: "b", everyMs: 2500, run: b }]);
    s.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(a).toHaveBeenCalledTimes(5);
    expect(b).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it("does not run a task before the first interval elapses (no thundering herd at boot)", async () => {
    const a = vi.fn(async () => {});
    const s = createScheduler([{ name: "a", everyMs: 1000, run: a }]);
    s.start();
    expect(a).not.toHaveBeenCalled();
    s.stop();
  });

  it("skips a tick while the previous run of the same task is still going", async () => {
    let release!: () => void;
    const slow = vi.fn(() => new Promise<void>((r) => (release = r)));
    const s = createScheduler([{ name: "slow", everyMs: 1000, run: slow }]);
    s.start();
    await vi.advanceTimersByTimeAsync(4500);
    expect(slow).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(slow).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it("a task that throws is logged, keeps its schedule, and does not stop the others", async () => {
    const log: string[] = [];
    const bad = vi.fn(async () => { throw new Error("boom"); });
    const good = vi.fn(async () => {});
    const s = createScheduler([{ name: "bad", everyMs: 1000, run: bad }, { name: "good", everyMs: 1000, run: good }], (m) => log.push(m));
    s.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(bad).toHaveBeenCalledTimes(3);
    expect(good).toHaveBeenCalledTimes(3);
    expect(log.filter((l) => l.includes("bad") && l.includes("boom")).length).toBe(3);
    s.stop();
  });

  it("stop() cancels future runs and start() twice does not double them", async () => {
    const a = vi.fn(async () => {});
    const s = createScheduler([{ name: "a", everyMs: 1000, run: a }]);
    s.start();
    s.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(a).toHaveBeenCalledTimes(2);
    s.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(a).toHaveBeenCalledTimes(2);
  });

  it("stop() waits for a run that is already in flight", async () => {
    let finished = false;
    const s = createScheduler([{ name: "a", everyMs: 1000, run: async () => { await new Promise((r) => setTimeout(r, 500)); finished = true; } }]);
    s.start();
    await vi.advanceTimersByTimeAsync(1100);
    const stopped = s.stop();
    await vi.advanceTimersByTimeAsync(600);
    await stopped;
    expect(finished).toBe(true);
  });

  it("rejects a non-positive interval", () => {
    expect(() => createScheduler([{ name: "a", everyMs: 0, run: async () => {} }])).toThrow(/everyMs/);
  });
});
