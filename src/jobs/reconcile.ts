// Reconciliation: Strike is the source of truth for an order's state, not our row. Each run reads the real status of
// every live tail, records fills, rejections and cancellations, notices a closed position, recovers an order whose
// creation was never confirmed, then edits each affected card once. One bad tail never stops the others.
import { callCard, escapeHtml, tailButtons } from "../bot/cards.js";
import { reasonClause } from "../core/reasons.js";
import { D } from "../core/dec.js";
import type { Call, Store, Tail, User } from "../db/store.js";
import type { StrikeClient } from "../strike/client.js";

export type ReconcileStrike = Pick<StrikeClient, "order" | "fills" | "openOrders" | "orderHistory">;

export interface ReconcileDeps {
  store: Store;
  now: () => number;
  botUsername: string;
  strikeFor: (user: User) => ReconcileStrike;
  dm: (tgId: number, text: string) => Promise<void>;
  editCard: (chatId: number, messageId: number, text: string, buttons: { text: string; url: string }[]) => Promise<void>;
  log?: (message: string) => void;
  /** Upper bound on tails checked per run, oldest first, so request weight stays bounded (2,400/min on Strike). */
  maxPerTick?: number;
}

const NOT_FOUND_AFTER_MS = 10 * 60_000;
const CANCELLED = new Set(["canceled", "cancelled", "expired"]);

const sideOf = (call: Call, tail: Tail) => ((call.side === "long") === (tail.mode === "tail") ? "LONG" : "SHORT");

const signed = (pnl: string) => (pnl.startsWith("-") ? pnl : `+${pnl}`);

function sumPnl(fills: any[], clientOrderId: string): string | null {
  const mine = fills.filter((f) => f.client_order_id === clientOrderId && typeof f.realized_pnl === "string");
  return mine.length === 0 ? null : D.str(mine.map((f) => D.of(f.realized_pnl as string)).reduce(D.add));
}

export async function runReconcile(d: ReconcileDeps): Promise<{ checked: number; changed: number }> {
  const tails = d.store.activeTails().slice(0, d.maxPerTick ?? 30);
  const countersChanged = new Set<number>();
  let checked = 0;
  let changed = 0;

  const tell = async (tgId: number, text: string) => {
    try {
      await d.dm(tgId, text);
    } catch (e) {
      d.log?.(`could not DM ${tgId}: ${(e as Error).message}`); // best effort; the status change stands
    }
  };

  async function reconcileTail(tail: Tail): Promise<boolean> {
    const user = d.store.getUser(tail.tgId);
    const call = d.store.getCall(tail.callId);
    if (!user || !call) return false;
    const strike = d.strikeFor(user);
    const nowIso = new Date(d.now()).toISOString();
    let did = false;

    // 1. An order whose creation was never confirmed has no primary id yet: find it on Strike by its strategy id.
    if (!tail.primaryClientOrderId) {
      const open = ((await strike.openOrders(call.symbol)).orders ?? []) as any[];
      const mine = open.filter((o) => o.Strategy?.ID === tail.strategyId);
      const primary = mine.find((o) => o.Strategy?.IsPrimary);
      if (primary) {
        d.store.updateTail(tail.id, {
          primaryClientOrderId: primary.ClientOrderID, orderId: String(primary.ID), error: null,
          tpClientOrderId: mine.find((o) => !o.Strategy?.IsPrimary && o.Type === "take_profit")?.ClientOrderID,
          slClientOrderId: mine.find((o) => !o.Strategy?.IsPrimary && o.Type === "stop")?.ClientOrderID,
        });
        did = true;
      } else {
        const history = (((await strike.orderHistory(call.symbol)).orders ?? []) as any[]).find((o) => o.strategy_id === tail.strategyId && o.is_primary);
        if (history) {
          const hs = String(history.status ?? "").toLowerCase();
          if (hs === "rejected") {
            const code = (history.close_reason as string) || "rejected";
            d.store.updateTail(tail.id, { status: "rejected", error: code, primaryClientOrderId: history.client_order_id, orderId: String(history.ID) });
            countersChanged.add(tail.callId);
            await tell(tail.tgId, `Strike rejected your ${call.symbol} order: ${reasonClause(code, escapeHtml)}`);
            return true;
          }
          if (CANCELLED.has(hs)) {
            d.store.updateTail(tail.id, { status: "cancelled", primaryClientOrderId: history.client_order_id, orderId: String(history.ID) });
            countersChanged.add(tail.callId);
            await tell(tail.tgId, `Your ${call.symbol} order was cancelled on Strike.`);
            return true;
          }
          d.store.updateTail(tail.id, { primaryClientOrderId: history.client_order_id, orderId: String(history.ID), error: null });
          did = true;
        } else if (d.now() - Date.parse(tail.createdAt) > NOT_FOUND_AFTER_MS) {
          d.store.updateTail(tail.id, { status: "rejected", error: "not_found" });
          countersChanged.add(tail.callId);
          await tell(tail.tgId, `Your ${call.symbol} order never reached Strike. Tap Tail again to retry.`);
          return true;
        } else {
          return false;
        }
      }
    }

    const fresh = d.store.getTail(tail.id) as Tail;
    const primaryId = fresh.primaryClientOrderId as string;
    const primary = await strike.order({ symbol: call.symbol, clientOrderId: primaryId });
    const status = String(primary.Status ?? "").toLowerCase();
    let fillsCache: any[] | undefined;
    const fills = async () => (fillsCache ??= (((await strike.fills({ symbol: call.symbol })).fills ?? []) as any[]));
    let current = fresh.status;

    if (current === "placed") {
      if (status === "filled") {
        const f = (await fills()).find((x) => x.client_order_id === primaryId);
        d.store.updateTail(tail.id, { status: "filled", filledAt: nowIso, ...(f?.price ? { fillPrice: String(f.price) } : {}), error: null });
        await tell(tail.tgId, `Filled: ${call.symbol} ${sideOf(call, fresh)} ${fresh.size}${f?.price ? ` at ${f.price}` : ""}.`);
        current = "filled";
        did = true;
      } else if (status === "rejected") {
        const code = (primary.CloseReason as string) || "rejected";
        d.store.updateTail(tail.id, { status: "rejected", error: code });
        countersChanged.add(tail.callId);
        await tell(tail.tgId, `Strike rejected your ${call.symbol} order: ${reasonClause(code, escapeHtml)}`);
        return true;
      } else if (CANCELLED.has(status)) {
        d.store.updateTail(tail.id, { status: "cancelled" });
        countersChanged.add(tail.callId);
        await tell(tail.tgId, `Your ${call.symbol} order was cancelled on Strike.`);
        return true;
      } else {
        return did;
      }
    }

    // A market order can fill while Confirm is still waiting, so the placed -> filled step above never ran and no price was
    // recorded. Fill it in from Strike's own fills, silently: size-weighted over this order's fills, never a guess.
    if (current === "filled" && (d.store.getTail(tail.id) as Tail).fillPrice === null) {
      const mine = (await fills()).filter((x) => x.client_order_id === primaryId && x.price && x.size);
      if (mine.length > 0) {
        const qty = mine.map((x) => D.of(String(x.size))).reduce(D.add);
        const cost = mine.map((x) => D.mul(D.of(String(x.price)), D.of(String(x.size)))).reduce(D.add);
        if (qty > 0n) d.store.updateTail(tail.id, { fillPrice: D.str(D.roundToStep(D.div(cost, qty), D.of("0.00000001"))) });
      }
    }

    // 2. A filled position closes when its take-profit or stop leg fills.
    if (current === "filled") {
      const legs: [string | null, "tp" | "sl"][] = [[fresh.tpClientOrderId, "tp"], [fresh.slClientOrderId, "sl"]];
      for (const [legId, reason] of legs) {
        if (!legId) continue;
        const leg = await strike.order({ symbol: call.symbol, clientOrderId: legId });
        if (String(leg.Status ?? "").toLowerCase() !== "filled") continue;
        const pnl = sumPnl(await fills(), legId);
        d.store.updateTail(tail.id, { status: "closed", closeReason: reason, closedAt: nowIso, ...(pnl !== null ? { realizedPnl: pnl } : {}) });
        const head = reason === "tp" ? "Closed at take profit." : "Stopped out.";
        await tell(tail.tgId, `${head}${pnl !== null ? ` Realized PnL ${signed(pnl)} USD.` : ""}`);
        return true;
      }
    }
    return did;
  }

  for (const tail of tails) {
    checked++;
    try {
      if (await reconcileTail(tail)) changed++;
    } catch (e) {
      d.log?.(`reconcile tail ${tail.id} failed: ${(e as Error).message}`);
    }
  }

  // One edit per card per run, and only for calls that are still open (a finished call's card shows its result).
  for (const callId of countersChanged) {
    const call = d.store.getCall(callId);
    if (!call || call.status !== "open" || call.cardMessageId === null) continue;
    try {
      await d.editCard(call.chatId, call.cardMessageId, callCard(call, d.store.tailCounts(callId)), tailButtons(d.botUsername, callId));
    } catch (e) {
      d.log?.(`card edit for call ${callId} failed: ${(e as Error).message}`);
    }
  }
  return { checked, changed };
}
