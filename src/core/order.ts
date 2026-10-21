// Pure mapping from a parsed call (and a computed size) to a Strike bracket request. No model involved.
import type { BracketInput } from "../strike/client.js";
import { fadeOf } from "./fade.js";
import type { CallDraft } from "./parser.js";

export interface BracketFromDraft {
  draft: CallDraft;
  /** Already sized by core/sizing, a decimal string. */
  size: string;
  strategyId: string;
  fade?: boolean;
}

export function bracketFromDraft(i: BracketFromDraft): BracketInput {
  const { draft } = i;
  if (draft.entryKind === "limit" && draft.entry === null) throw new Error("limit call has no entry price");
  const levels = i.fade
    ? fadeOf({ side: draft.side, entry: draft.entry ?? "0", tp: draft.tp, sl: draft.sl })
    : { side: draft.side, tp: draft.tp, sl: draft.sl };
  const base = {
    symbol: draft.symbol,
    side: levels.side === "long" ? ("buy" as const) : ("sell" as const),
    size: i.size,
    tp: levels.tp,
    sl: levels.sl,
    strategyId: i.strategyId,
  };
  return draft.entryKind === "market"
    ? { ...base, type: "market" }
    : { ...base, type: "limit", price: draft.entry as string };
}
