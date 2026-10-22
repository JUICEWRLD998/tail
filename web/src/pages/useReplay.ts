import { useInView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { replaySchedule } from "../lib/replay.js";
import type { FeaturedCall } from "../lib/pages-api.js";

const LEAD_MS = 700;
const STAMP_AFTER_MS = 650;

/**
 * Replays a real call's follows on its ticket: each Tail or Fade lands in the order and rough rhythm it really came in,
 * compressed to a few seconds, then the result stamp. Starts when the ticket scrolls into view; reduced motion shows
 * the final state at once.
 */
export function useReplay(call: FeaturedCall | null): { ref: RefObject<HTMLDivElement | null>; shown: number; stamped: boolean; playing: boolean; replay: () => void } {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduce = useReducedMotion();
  const total = call?.tails.length ?? 0;
  const resolved = call !== null && call.status !== "open";
  const [shown, setShown] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  const replay = useCallback(() => {
    clear();
    if (!call) return;
    if (reduce) {
      setShown(total);
      setStamped(resolved);
      return;
    }
    setShown(0);
    setStamped(false);
    setPlaying(true);
    const at = replaySchedule(call.tails.map((t) => t.atMs), { windowMs: 2400, minGapMs: 260 });
    at.forEach((ms, k) => timers.current.push(window.setTimeout(() => setShown(k + 1), LEAD_MS + ms)));
    const end = LEAD_MS + (at.at(-1) ?? 0) + STAMP_AFTER_MS;
    timers.current.push(window.setTimeout(() => { setStamped(resolved); setPlaying(false); }, end));
  }, [call, reduce, resolved, total]);

  useEffect(() => {
    if (inView || reduce) replay();
    return clear;
  }, [inView, reduce, replay]);

  return { ref, shown, stamped, playing, replay };
}
