// Decides what happened to each open call from the current mark price, then tells the channel once.
// A call finishes at most once (the store's first-caller-wins update), so overlapping or repeated runs are harmless.
import { callCard } from "../bot/cards.js";
import { evaluateCall, receiptText, resultLine, type Evaluation, type OutcomeCall } from "../core/outcome.js";
import type { Call, Store } from "../db/store.js";

export interface OutcomeDeps {
  store: Store;
  now: () => number;
  markPrice: (symbol: string) => Promise<string>;
  /** Posts a message as a reply to the card; returns the new message id. */
  reply: (chatId: number, text: string, replyToMessageId: number | null) => Promise<number>;
  /** Edits the card text; the Tail and Fade buttons are removed because the call is over. */
  editCard: (chatId: number, messageId: number, text: string) => Promise<void>;
  log?: (message: string) => void;
}

type Terminal = Extract<Evaluation, { state: "tp_hit" | "sl_hit" | "expired" }>;

const RECEIPT_RETRY_WINDOW_MS = 24 * 3_600_000;
/** A receipt is only "lost" after this long, so a second instance that finished the call can post it first. */
const RECEIPT_GRACE_MS = 30_000;

// Calls whose receipt is being posted right now. A concurrent run must not mistake "no receipt id yet" for "lost".
const receiptsInFlight = new Set<number>();

const asOutcome = (c: Call, enteredPrice: string | null): OutcomeCall => ({
  symbol: c.symbol, side: c.side, entryKind: c.entryKind, entry: c.entry, tp: c.tp, sl: c.sl, createdAt: c.createdAt,
  enteredAt: enteredPrice === null ? null : (c.enteredAt ?? ""), enteredPrice,
});

async function postReceipt(d: OutcomeDeps, call: Call, ev: Terminal, enteredPrice: string | null): Promise<void> {
  if (receiptsInFlight.has(call.id)) return;
  receiptsInFlight.add(call.id);
  try {
    const oc = asOutcome(call, enteredPrice);
    const messageId = await d.reply(call.chatId, receiptText(oc, ev), call.cardMessageId);
    d.store.setReceipt(call.id, messageId);
    if (call.cardMessageId !== null) {
      try {
        const card = callCard(call, d.store.tailCounts(call.id));
        await d.editCard(call.chatId, call.cardMessageId, `${card}\n${resultLine(oc, ev.state)}`);
      } catch (e) {
        d.log?.(`card edit failed for call ${call.id}: ${(e as Error).message}`); // the receipt is already posted
      }
    }
  } finally {
    receiptsInFlight.delete(call.id);
  }
}

export async function runOutcomes(d: OutcomeDeps): Promise<{ evaluated: number; finished: number }> {
  const calls = d.store.openCalls();
  const marks = new Map<string, string>();
  for (const symbol of new Set(calls.map((c) => c.symbol))) {
    try {
      marks.set(symbol, await d.markPrice(symbol));
    } catch (e) {
      d.log?.(`mark price for ${symbol} failed: ${(e as Error).message}`);
    }
  }

  let evaluated = 0;
  let finished = 0;
  const nowIso = new Date(d.now()).toISOString();

  for (const call of calls) {
    const mark = marks.get(call.symbol);
    if (mark === undefined) continue;
    let ev: Evaluation;
    try {
      ev = evaluateCall(asOutcome(call, call.enteredPrice), mark, d.now());
    } catch (e) {
      d.log?.(`call ${call.id}: could not evaluate (${(e as Error).message})`);
      continue;
    }
    evaluated++;

    const entered = "enter" in ev && ev.enter ? ev.enter.price : null;
    if (entered !== null) d.store.markEntered(call.id, entered, nowIso);
    if (ev.state !== "tp_hit" && ev.state !== "sl_hit" && ev.state !== "expired") continue;

    const resultPrice = ev.state === "expired" ? null : ev.resultPrice;
    if (!d.store.finishCall(call.id, { status: ev.state, resultPrice, closedAt: nowIso })) continue; // someone else finished it
    finished++;
    try {
      await postReceipt(d, call, ev, entered ?? call.enteredPrice);
    } catch (e) {
      d.log?.(`receipt for call ${call.id} not posted, will retry: ${(e as Error).message}`);
    }
  }

  // A receipt that failed above (Telegram down, rate limit) is retried until it posts.
  for (const call of d.store.callsMissingReceipt(nowIso, RECEIPT_RETRY_WINDOW_MS, RECEIPT_GRACE_MS)) {
    const ev: Terminal = call.status === "expired"
      ? { state: "expired", entered: call.enteredAt !== null }
      : { state: call.status as "tp_hit" | "sl_hit", resultPrice: call.resultPrice as string };
    try {
      await postReceipt(d, call, ev, call.enteredPrice);
    } catch (e) {
      d.log?.(`receipt retry for call ${call.id} failed: ${(e as Error).message}`);
    }
  }
  return { evaluated, finished };
}
