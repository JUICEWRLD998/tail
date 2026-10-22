// Caller earnings. Strike's fill record has no builder-share field (VERIFIED, user-api.yaml), so what a caller earns is
// an estimate: entry-fill notional x the builder fee rate the order carried. Exit fills would add more and are not
// counted. Nothing here is typed in; no fill, no fee.
import { D, type Dec } from "./dec.js";

export interface EarningTail {
  callId: number;
  tgId: number;
  status: "quoted" | "placed" | "filled" | "rejected" | "cancelled" | "closed";
  size: string;
  fillPrice: string | null;
  feeBps: number;
}

export interface TailEstimate {
  notional: string;
  feeBps: number;
  fee: string;
}

export interface Earnings {
  basis: string;
  /** Estimated fee, USD. */
  fee: string;
  filledNotional: string;
  tails: number;
  /** Tails with an entry fill. */
  filled: number;
  /** Filled tails whose order carried a builder rate. */
  paying: number;
  /** Filled tails with no builder rate (a personal API wallet): they earn the caller nothing. */
  withoutRate: number;
  byCall: Map<number, { fee: string; filledNotional: string; filled: number; paying: number }>;
}

const BASIS = "estimate: entry-fill notional x builder fee rate";
const FEE_STEP = D.of("0.00000001");
const BPS = D.of("10000");

const floorTo = (x: Dec): Dec => D.floorToStep(x, FEE_STEP);

export function estimateTail(t: EarningTail): TailEstimate | null {
  if ((t.status !== "filled" && t.status !== "closed") || t.fillPrice === null) return null;
  const notional = D.mul(D.of(t.size), D.of(t.fillPrice));
  const fee = floorTo(D.div(D.mul(notional, D.of(String(t.feeBps))), BPS));
  return { notional: D.str(notional), feeBps: t.feeBps, fee: D.str(fee) };
}

export function earnings(tails: EarningTail[]): Earnings {
  let fee = 0n;
  let notional = 0n;
  let filled = 0;
  let paying = 0;
  const byCall = new Map<number, { fee: Dec; notional: Dec; filled: number; paying: number }>();
  for (const t of tails) {
    const e = estimateTail(t);
    if (!e) continue;
    filled++;
    if (e.feeBps > 0) paying++;
    fee += D.of(e.fee);
    notional += D.of(e.notional);
    const c = byCall.get(t.callId) ?? { fee: 0n, notional: 0n, filled: 0, paying: 0 };
    c.fee += D.of(e.fee);
    c.notional += D.of(e.notional);
    c.filled++;
    if (e.feeBps > 0) c.paying++;
    byCall.set(t.callId, c);
  }
  return {
    basis: BASIS, fee: D.str(fee), filledNotional: D.str(notional), tails: tails.length, filled, paying, withoutRate: filled - paying,
    byCall: new Map([...byCall].map(([id, c]) => [id, { fee: D.str(c.fee), filledNotional: D.str(c.notional), filled: c.filled, paying: c.paying }])),
  };
}
