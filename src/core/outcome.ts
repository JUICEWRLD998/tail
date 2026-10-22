// What happened to a call, decided from price samples. Pure: no I/O, no clock, exact decimals.
// Limits, stated plainly: samples are polled marks, so a wick between two samples is missed, and R is the ideal value
// from the call's own levels (a target is +reward/risk, a stop is -1R), not a fill-level slippage measurement.
import { D } from "./dec.js";
import { rewardRisk, type Side } from "./fade.js";

export const CALL_TTL_MS = 72 * 3_600_000;

export interface OutcomeCall {
  symbol: string;
  side: Side;
  entryKind: "limit" | "market";
  entry: string | null;
  tp: string;
  sl: string;
  createdAt: string;
  enteredAt: string | null;
  enteredPrice: string | null;
}

export type Evaluation =
  | { state: "waiting" }
  | { state: "live"; enter?: { price: string } }
  | { state: "tp_hit" | "sl_hit"; resultPrice: string; enter?: { price: string } }
  | { state: "expired"; entered: boolean };

export function evaluateCall(call: OutcomeCall, mark: string, nowMs: number, ttlMs: number = CALL_TTL_MS): Evaluation {
  const m = D.of(mark);
  const tp = D.of(call.tp);
  const sl = D.of(call.sl);
  const long = call.side === "long";

  let enter: { price: string } | undefined;
  let entryPrice: string | null = call.enteredPrice;

  if (call.enteredAt === null) {
    if (call.entryKind === "market") {
      enter = { price: mark };
      entryPrice = mark;
    } else {
      const e = D.of(call.entry as string);
      // A buy limit fills when the price falls to it; a sell limit when the price rises to it.
      if (long ? m <= e : m >= e) {
        enter = { price: call.entry as string };
        entryPrice = call.entry;
      }
    }
  }

  const live = entryPrice !== null;
  if (live) {
    const hitTp = long ? m >= tp : m <= tp;
    const hitSl = long ? m <= sl : m >= sl;
    if (hitTp) return { state: "tp_hit", resultPrice: mark, ...(enter ? { enter } : {}) };
    if (hitSl) return { state: "sl_hit", resultPrice: mark, ...(enter ? { enter } : {}) };
  }

  if (nowMs - Date.parse(call.createdAt) > ttlMs) return { state: "expired", entered: live };
  return live ? { state: "live", ...(enter ? { enter } : {}) } : { state: "waiting" };
}

/** Ideal R for a finished call: the call's reward-to-risk on a target, -1 on a stop. Null if undefined (expired, no entry). */
export function resultR(call: Pick<OutcomeCall, "side" | "entry" | "enteredPrice" | "tp" | "sl">, state: "tp_hit" | "sl_hit"): string | null {
  if (state === "sl_hit") return "-1";
  const entry = call.entry ?? call.enteredPrice;
  return entry === null ? null : rewardRisk({ side: call.side, entry, tp: call.tp, sl: call.sl });
}

const head = (c: OutcomeCall, what: string) => `<b>${c.symbol} · ${c.side.toUpperCase()} · ${what}</b>`;

export function receiptText(call: OutcomeCall, e: Extract<Evaluation, { state: "tp_hit" | "sl_hit" | "expired" }>): string {
  if (e.state === "expired") {
    return e.entered
      ? `${head(call, "expired")}\nNo target or stop in 72 hours.`
      : `${head(call, "never entered")}\nThe price did not reach ${call.entry ?? "the entry"} in 72 hours.`;
  }
  const entry = call.entry ?? call.enteredPrice ?? "market";
  if (e.state === "tp_hit") {
    const r = resultR(call, "tp_hit");
    return `${head(call, "take profit hit")}\n${r === null ? "" : `+${r}R · `}entry ${entry} · TP ${call.tp} · mark ${e.resultPrice}`;
  }
  return `${head(call, "stopped out")}\n-1R · entry ${entry} · SL ${call.sl} · mark ${e.resultPrice}`;
}

/** The line appended to the channel card once the call has a result. */
export function resultLine(call: OutcomeCall, state: "tp_hit" | "sl_hit" | "expired"): string {
  if (state === "expired") return "Result: expired";
  if (state === "sl_hit") return "Result: stopped out (-1R)";
  const r = resultR(call, "tp_hit");
  return `Result: take profit hit${r === null ? "" : ` (+${r}R)`}`;
}
