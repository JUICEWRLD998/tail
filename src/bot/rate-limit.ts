// Fixed-window rate limiter keyed by user. `notify` is true only for the first blocked action in a window, so a
// flooding user gets one "slow down" message instead of an echo of every message they send.
export interface RateLimiterOptions {
  max: number;
  windowMs: number;
  nowMs: () => number;
  /** Purge expired entries when the map grows past this many keys, so it cannot grow without bound. */
  purgeAbove?: number;
}

interface Entry {
  windowStart: number;
  count: number;
  notified: boolean;
}

export function createRateLimiter(o: RateLimiterOptions) {
  if (!(o.max > 0) || !(o.windowMs > 0)) throw new Error("max and windowMs must be positive");
  const entries = new Map<string, Entry>();
  const purgeAbove = o.purgeAbove ?? 10_000;

  return {
    check(key: string): { allowed: boolean; notify: boolean } {
      const now = o.nowMs();
      if (entries.size > purgeAbove) {
        for (const [k, e] of entries) if (now - e.windowStart >= o.windowMs) entries.delete(k);
      }
      let e = entries.get(key);
      if (!e || now - e.windowStart >= o.windowMs) {
        e = { windowStart: now, count: 0, notified: false };
        entries.set(key, e);
      }
      e.count += 1;
      if (e.count <= o.max) return { allowed: true, notify: false };
      const notify = !e.notified;
      e.notified = true;
      return { allowed: false, notify };
    },
    size: () => entries.size,
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
