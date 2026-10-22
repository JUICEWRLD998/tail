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
  /** Entry notional of the paying tails, and the lowest and highest rate among them. */
  payingNotional: string;
  minBps: number | null;
  maxBps: number | null;
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
  let payingNotional = 0n;
  let minBps: number | null = null;
  let maxBps: number | null = null;
  const byCall = new Map<number, { fee: Dec; notional: Dec; filled: number; paying: number }>();
  for (const t of tails) {
    const e = estimateTail(t);
    if (!e) continue;
    filled++;
    if (e.feeBps > 0) {
      paying++;
      payingNotional += D.of(e.notional);
      minBps = minBps === null ? e.feeBps : Math.min(minBps, e.feeBps);
      maxBps = maxBps === null ? e.feeBps : Math.max(maxBps, e.feeBps);
    }
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
    payingNotional: D.str(payingNotional), minBps, maxBps,
    byCall: new Map([...byCall].map(([id, c]) => [id, { fee: D.str(c.fee), filledNotional: D.str(c.notional), filled: c.filled, paying: c.paying }])),
  };
}

/** The caller-facing summary of one channel's earnings. Plain: what is counted, what is left out, and that payout is not live. */
export function earningsText(title: string, e: Earnings): string {
  const out = [`💰 <b>${title}</b>`];
  if (e.filled === 0) {
    out.push("No filled tails yet, so no builder fee.");
  } else {
    out.push(`Estimated builder fee: <b>${e.fee} USD</b>`);
    const rate = e.minBps === null ? "" : e.minBps === e.maxBps ? ` at ${e.minBps} bps` : ` at ${e.minBps} to ${e.maxBps} bps`;
    const tails = (n: number) => `${n} ${n === 1 ? "tail" : "tails"}`;
    const left = e.withoutRate > 0 ? ` ${tails(e.withoutRate)} used a personal wallet and ${e.withoutRate === 1 ? "earns" : "earn"} nothing.` : "";
    out.push(`Entry fills only: ${e.payingNotional} USD${rate}, ${tails(e.paying)}.${left}`);
  }
  out.push("ℹ️ Payout to callers is not live.");
  return out.join("\n");
}
