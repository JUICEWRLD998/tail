import { beforeEach, describe, expect, it } from "vitest";
import { runReconcile, type ReconcileDeps, type ReconcileStrike } from "../src/jobs/reconcile.js";
import { openStore, type Store } from "../src/db/store.js";

const T0 = Date.parse("2026-10-21T12:00:00.000Z");
const MIN = 60_000;
let clock = T0 + MIN;
let store: Store;
let dms: { tgId: number; text: string }[];
let edits: { chatId: number; messageId: number; text: string }[];

interface Script {
  primary?: Record<string, any>; // by client order id
  fills?: any[];
  open?: any[];
  history?: any[];
  throwFor?: string;
}
let script: Script;
let asked: string[];
let failDm: boolean;

const strike = (): ReconcileStrike => ({
  order: async ({ clientOrderId }) => {
    asked.push(clientOrderId as string);
    if (script.throwFor === clientOrderId) throw new Error("boom");
    const o = script.primary?.[clientOrderId as string];
    if (!o) throw Object.assign(new Error("not found"), { status: 404, strikeError: "order not found" });
    return o;
  },
  fills: async () => ({ count: (script.fills ?? []).length, fills: script.fills ?? [] }),
  openOrders: async () => ({ count: (script.open ?? []).length, orders: script.open ?? [] }),
  orderHistory: async () => ({ count: (script.history ?? []).length, orders: script.history ?? [] }),
});

const deps = (over: Partial<ReconcileDeps> = {}): ReconcileDeps => ({
  store,
  now: () => clock,
  botUsername: "tailbot",
  strikeFor: () => strike(),
  dm: async (tgId, text) => {
    if (failDm) throw new Error("blocked");
    dms.push({ tgId, text });
  },
  editCard: async (chatId, messageId, text) => void edits.push({ chatId, messageId, text }),
  log: () => {},
  ...over,
});

function seed(tg = 5, over: { callStatus?: "open" | "tp_hit" } = {}) {
  store.linkUser({ tgId: tg, chain: "ethereum", address: "0xabc", strikeAccountId: "a", apiPub: "p", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: "t" });
  const callId = store.createDraftCall({ chatId: -1001, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: new Date(T0).toISOString() });
  store.openCall(callId, 70);
  if (over.callStatus === "tp_hit") store.finishCall(callId, { status: "tp_hit", resultPrice: "2561", closedAt: "t" });
  return callId;
}

function tailFor(callId: number, tg = 5, o: Record<string, string> = {}) {
  const id = store.createTail({ callId, tgId: tg, mode: "tail", strategyId: `strat-${tg}-${callId}`, size: "0.009", notionalUsd: "22.32", feeBps: 0, createdAt: new Date(T0).toISOString() });
  store.updateTail(id, { status: "placed", orderId: "100", primaryClientOrderId: `p-${id}`, tpClientOrderId: `tp-${id}`, slClientOrderId: `sl-${id}`, ...o });
  return id;
}

beforeEach(() => {
  clock = T0 + MIN;
  store = openStore(":memory:");
  dms = [];
  edits = [];
  script = {};
  asked = [];
  failDm = false;
});

describe("runReconcile", () => {
  it("leaves an open order alone and sends nothing", async () => {
    const t = tailFor(seed());
    script.primary = { [`p-${t}`]: { ID: 100, Status: "open" } };
    expect(await runReconcile(deps())).toEqual({ checked: 1, changed: 0 });
    expect(store.getTail(t)?.status).toBe("placed");
    expect(dms.length + edits.length).toBe(0);
  });

  it("a filled primary becomes filled with Strike's fill price, and the follower is told once", async () => {
    const t = tailFor(seed());
    script.primary = { [`p-${t}`]: { ID: 100, Status: "filled" } };
    script.fills = [{ client_order_id: `p-${t}`, price: "2479.50", size: "0.009", fee: "0.0111", realized_pnl: "0" }];
    await runReconcile(deps());
    expect(store.getTail(t)).toMatchObject({ status: "filled", fillPrice: "2479.50", filledAt: new Date(clock).toISOString() });
    expect(dms).toEqual([{ tgId: 5, text: "Filled: ETH-USD LONG 0.009 at 2479.50." }]);
    await runReconcile(deps());
    expect(dms.length).toBe(1);
  });

  it("a rejected primary becomes rejected, the follower is told why, and the card counters drop", async () => {
    const callId = seed();
    const t = tailFor(callId);
    script.primary = { [`p-${t}`]: { ID: 100, Status: "rejected", CloseReason: "order_price_out_of_limit" } };
    await runReconcile(deps());
    expect(store.getTail(t)).toMatchObject({ status: "rejected", error: "order_price_out_of_limit" });
    expect(dms[0]?.text).toBe("Strike rejected your ETH-USD order: the entry price is too far from the market price.");
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ chatId: -1001, messageId: 70 });
    expect(edits[0]?.text).toContain("Tailed 0 · Faded 0");
  });

  it.each(["canceled", "cancelled", "expired"])("a %s primary becomes cancelled", async (status) => {
    const t = tailFor(seed());
    script.primary = { [`p-${t}`]: { ID: 100, Status: status } };
    await runReconcile(deps());
    expect(store.getTail(t)?.status).toBe("cancelled");
    expect(dms[0]?.text).toBe("Your ETH-USD order was cancelled on Strike.");
  });

  it("a take-profit leg that filled closes the tail with the realized PnL", async () => {
    const t = tailFor(seed(), 5, { status: "filled" });
    script.primary = { [`p-${t}`]: { ID: 100, Status: "filled" }, [`tp-${t}`]: { ID: 101, Status: "filled" }, [`sl-${t}`]: { ID: 102, Status: "expired" } };
    script.fills = [
      { client_order_id: `p-${t}`, price: "2480", realized_pnl: "0", size: "0.009" },
      { client_order_id: `tp-${t}`, price: "2561", realized_pnl: "0.7290", size: "0.009" },
    ];
    await runReconcile(deps());
    expect(store.getTail(t)).toMatchObject({ status: "closed", closeReason: "tp", realizedPnl: "0.729", closedAt: new Date(clock).toISOString() });
    expect(dms.map((d) => d.text)).toEqual(["Closed at take profit. Realized PnL +0.729 USD."]);
  });

  it("a stop leg that filled closes the tail as a stop-out", async () => {
    const t = tailFor(seed(), 5, { status: "filled" });
    script.primary = { [`p-${t}`]: { ID: 100, Status: "filled" }, [`tp-${t}`]: { ID: 101, Status: "expired" }, [`sl-${t}`]: { ID: 102, Status: "filled" } };
    script.fills = [{ client_order_id: `sl-${t}`, price: "2419", realized_pnl: "-0.549", size: "0.009" }];
    await runReconcile(deps());
    expect(store.getTail(t)).toMatchObject({ status: "closed", closeReason: "sl", realizedPnl: "-0.549" });
    expect(dms[0]?.text).toBe("Stopped out. Realized PnL -0.549 USD.");
  });

  it("a position that fills and closes between two runs reports both, in order", async () => {
    const t = tailFor(seed());
    script.primary = { [`p-${t}`]: { ID: 100, Status: "filled" }, [`tp-${t}`]: { ID: 101, Status: "filled" } };
    script.fills = [{ client_order_id: `p-${t}`, price: "2480", realized_pnl: "0" }, { client_order_id: `tp-${t}`, price: "2561", realized_pnl: "0.729" }];
    await runReconcile(deps());
    expect(store.getTail(t)?.status).toBe("closed");
    expect(dms.map((d) => d.text)).toEqual(["Filled: ETH-USD LONG 0.009 at 2480.", "Closed at take profit. Realized PnL +0.729 USD."]);
  });

  it("recovers an unconfirmed order by its strategy id from open orders", async () => {
    const callId = seed();
    const t = tailFor(callId, 5, { error: "unconfirmed" });
    store.updateTail(t, { primaryClientOrderId: "" });
    script.open = [
      { ID: 200, ClientOrderID: "found-primary", Status: "open", Strategy: { ID: `strat-5-${callId}`, IsPrimary: true } },
      { ID: 201, ClientOrderID: "found-tp", Status: "pending", Type: "take_profit", Strategy: { ID: `strat-5-${callId}`, IsPrimary: false } },
      { ID: 202, ClientOrderID: "found-sl", Status: "pending", Type: "stop", Strategy: { ID: `strat-5-${callId}`, IsPrimary: false } },
    ];
    script.primary = { "found-primary": { ID: 200, Status: "open" } };
    await runReconcile(deps());
    expect(store.getTail(t)).toMatchObject({ primaryClientOrderId: "found-primary", tpClientOrderId: "found-tp", slClientOrderId: "found-sl", orderId: "200", error: null, status: "placed" });
  });

  it("recovers an unconfirmed order that was already rejected from order history", async () => {
    const callId = seed();
    const t = tailFor(callId, 5, { error: "unconfirmed" });
    store.updateTail(t, { primaryClientOrderId: "" });
    script.history = [{ ID: 300, client_order_id: "hist-primary", strategy_id: `strat-5-${callId}`, is_primary: true, status: "rejected", close_reason: "order_price_out_of_limit" }];
    await runReconcile(deps());
    expect(store.getTail(t)).toMatchObject({ status: "rejected", error: "order_price_out_of_limit" });
  });

  it("an unconfirmed order Strike has never heard of is left alone at first, then written off after 10 minutes", async () => {
    const callId = seed();
    const t = tailFor(callId, 5, { error: "unconfirmed" });
    store.updateTail(t, { primaryClientOrderId: "" });
    await runReconcile(deps());
    expect(store.getTail(t)?.status).toBe("placed");
    clock = T0 + 11 * MIN;
    await runReconcile(deps());
    expect(store.getTail(t)).toMatchObject({ status: "rejected", error: "not_found" });
    expect(dms[0]?.text).toBe("Your ETH-USD order never reached Strike. Tap Tail again to retry.");
  });

  it("one tail failing does not stop the others, and never throws", async () => {
    const callId = seed();
    seed(6);
    const bad = tailFor(callId, 5);
    const good = tailFor(callId, 6);
    script.throwFor = `p-${bad}`;
    script.primary = { [`p-${good}`]: { ID: 1, Status: "filled" } };
    script.fills = [{ client_order_id: `p-${good}`, price: "2480", realized_pnl: "0" }];
    await expect(runReconcile(deps())).resolves.toMatchObject({ checked: 2 });
    expect(store.getTail(good)?.status).toBe("filled");
    expect(store.getTail(bad)?.status).toBe("placed");
  });

  it("a failed DM does not undo the status change, and the follower is not re-notified forever", async () => {
    const t = tailFor(seed());
    script.primary = { [`p-${t}`]: { ID: 100, Status: "rejected", CloseReason: "x" } };
    failDm = true;
    await runReconcile(deps());
    expect(store.getTail(t)?.status).toBe("rejected");
    failDm = false;
    await runReconcile(deps());
    expect(dms.length).toBe(0); // rejected tails are not revisited
  });

  it("skips a tail whose user has revoked their key", async () => {
    const callId = seed();
    const t = tailFor(callId);
    store.revokeUser(5, "t");
    await runReconcile(deps());
    expect(asked.length).toBe(0);
    expect(store.getTail(t)?.status).toBe("placed");
  });

  it("edits a card once per run, however many of its tails changed", async () => {
    const callId = seed();
    seed(6);
    const a = tailFor(callId, 5);
    const b = tailFor(callId, 6);
    script.primary = { [`p-${a}`]: { ID: 1, Status: "rejected", CloseReason: "x" }, [`p-${b}`]: { ID: 2, Status: "rejected", CloseReason: "x" } };
    await runReconcile(deps());
    expect(edits.length).toBe(1);
  });

  it("does not touch the card of a call that already has a result", async () => {
    const callId = seed(5, { callStatus: "tp_hit" });
    const t = tailFor(callId);
    script.primary = { [`p-${t}`]: { ID: 1, Status: "rejected", CloseReason: "x" } };
    await runReconcile(deps());
    expect(edits.length).toBe(0);
  });

  it("checks at most maxPerTick tails, oldest first, so the request weight stays bounded", async () => {
    const callId = seed();
    for (let tg = 10; tg < 15; tg++) {
      seed(tg);
      tailFor(callId, tg);
    }
    script.primary = {};
    const r = await runReconcile(deps({ maxPerTick: 2 }));
    expect(r.checked).toBe(2);
    expect(asked.length).toBe(2);
  });

  it("never revisits closed, rejected or cancelled tails", async () => {
    const callId = seed();
    let tg = 20;
    for (const status of ["closed", "rejected", "cancelled"] as const) {
      seed(tg);
      store.updateTail(tailFor(callId, tg), { status });
      tg++;
    }
    expect(await runReconcile(deps())).toEqual({ checked: 0, changed: 0 });
  });
});
