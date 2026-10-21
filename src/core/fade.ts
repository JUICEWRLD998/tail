// Fade = take the other side of a call: side flipped, caller's SL becomes our TP and the caller's TP our SL.
import { D } from "./dec.js";

export type Side = "long" | "short";

export interface CallLevels {
  side: Side;
  entry: string;
  tp: string;
  sl: string;
}

/** Reward-to-risk as a string with at most two decimals (rounded down), or null when risk is zero. */
export function rewardRisk(c: CallLevels): string | null {
  const entry = D.of(c.entry);
  const risk = D.abs(D.sub(entry, D.of(c.sl)));
  if (risk === 0n) return null;
  const reward = D.abs(D.sub(D.of(c.tp), entry));
  const centi = D.floorToStep(D.div(reward, risk), D.of("0.01"));
  return D.str(centi);
}

export function fadeOf(c: CallLevels): CallLevels {
  return { side: c.side === "long" ? "short" : "long", entry: c.entry, tp: c.sl, sl: c.tp };
}
