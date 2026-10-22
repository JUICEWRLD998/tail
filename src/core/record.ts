// A caller's record, computed from stored calls only. Nothing here is typed in by hand: no calls, no numbers.
import { D, type Dec } from "./dec.js";
import { resultR, type OutcomeCall } from "./outcome.js";
import { formatToTick } from "./tick.js";

export interface RecordCall extends Pick<OutcomeCall, "symbol" | "side" | "entryKind" | "entry" | "tp" | "sl" | "enteredPrice"> {
  status: "open" | "tp_hit" | "sl_hit" | "expired";
}

export interface Summary {
  calls: number;
  open: number;
  tpHit: number;
  slHit: number;
  expired: number;
  /** Calls that reached a target or a stop. Expired and open calls are not decided. */
  decided: number;
  hitRatePct: string | null;
  avgR: string | null;
  followers: number;
}

const roundHalfUp = (x: Dec, step: Dec): Dec => (x < 0n ? -D.roundToStep(-x, step) : D.roundToStep(x, step));

export function summarize(calls: RecordCall[], followers: number): Summary {
  const count = (s: RecordCall["status"]) => calls.filter((c) => c.status === s).length;
  const tpHit = count("tp_hit");
  const slHit = count("sl_hit");
  const decided = tpHit + slHit;

  let avgR: string | null = null;
  let hitRatePct: string | null = null;
  if (decided > 0) {
    hitRatePct = formatToTick(D.div(D.mul(D.of(String(tpHit)), D.of("100")), D.of(String(decided))), D.of("0.1"), 1);
    const rs = calls.flatMap((c) => (c.status === "tp_hit" || c.status === "sl_hit" ? [resultR(c, c.status)] : []));
    const known = rs.filter((r): r is string => r !== null);
    if (known.length > 0) {
      const mean = D.div(known.map((r) => D.of(r)).reduce(D.add), D.of(String(known.length)));
      avgR = D.str(roundHalfUp(mean, D.of("0.01")));
    }
  }
  return { calls: calls.length, open: count("open"), tpHit, slHit, expired: count("expired"), decided, hitRatePct, avgR, followers };
}

export function recordText(title: string, s: Summary): string {
  if (s.calls === 0) return `${title}\nNo calls with a result yet.\nTestnet.`;
  const parts = [`${s.calls} calls`, `${s.open} open`, `${s.tpHit} target`, `${s.slHit} stop`, ...(s.expired > 0 ? [`${s.expired} expired`] : [])];
  const lines = [title, parts.join(" · ")];
  if (s.hitRatePct !== null) lines.push(`Hit rate ${s.hitRatePct}%${s.avgR !== null ? ` · average ${s.avgR}R` : ""}`);
  lines.push(`Followers in: ${s.followers}`, "Testnet.");
  return lines.join("\n");
}
