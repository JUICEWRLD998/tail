import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { callbackData } from "../src/bot/cards.js";
import { createService, type Service, type StrikeLike } from "../src/bot/service.js";
import { decryptSecret } from "../src/db/crypto.js";
import { openStore, type Store } from "../src/db/store.js";
import { StrikeError } from "../src/strike/client.js";

const MARKETS = {
  "ETH-USD": { tickSize: "0.01", stepSize: "0.001", minQty: "0.001", maxQty: "1000", marketMaxQty: "100", minNotional: "10" },
};
const CALLER = 900;
const FOLLOWER = 111;
const CHAT = -1001;
let clock = Date.parse("2026-10-21T12:00:00.000Z");
const advance = (min: number) => (clock += min * 60_000);

interface FakeOpts { equity?: string; mark?: string; order?: any; throwOnPlace?: unknown; accountThrows?: unknown }

function fakeStrike(o: FakeOpts = {}) {
  const placed: any[] = [];
  const api: StrikeLike & { placed: any[] } = {
    placed,
    syncClock: async () => 0,
    markets: async () => MARKETS,
    markPrice: async () => o.mark ?? "2494.62",
    account: async () => {
      if (o.accountThrows) throw o.accountThrows;
      return { margin_balance: o.equity ?? "19.92", blockchain: "ethereum", blockchain_address: "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d", account_id: "acc-1" };
    },
    placeBracket: async (b) => {
      if (o.throwOnPlace) throw o.throwOnPlace;
      placed.push(b);
      return { primary_client_order_id: "pc-1", strategy_id: b.strategyId };
    },
    order: async () => o.order ?? { ID: 243140841, Status: "open", CloseReason: "" },
  };
  return api;
}

let store: Store;
let kek: Buffer;
let strike: ReturnType<typeof fakeStrike>;
let svc: Service;
let n = 0;

function build(o: FakeOpts = {}) {
  strike = fakeStrike(o);
  svc = createService({
    store, kek, botUsername: "tailbot",
    publicStrike: strike, strikeFor: () => strike, clientForKey: () => strike,
    now: () => new Date(clock).toISOString(), uuid: () => `uuid-${++n}`, sleep: async () => {}, pollAttempts: 3,
  });
}

function linkFollower(over: Partial<Parameters<Store["linkUser"]>[0]> = {}) {
  store.linkUser({ tgId: FOLLOWER, chain: "ethereum", address: "0xabc", strikeAccountId: "acc-1", apiPub: "pub", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: new Date(clock).toISOString(), ...over });
  store.setSetting(FOLLOWER, "riskPct", "3");
}

function openCall(over: Record<string, unknown> = {}): number {
  const id = store.createDraftCall({
    chatId: CHAT, messageId: 5, rawText: "ETH long 2480 tp 2560 sl 2420", symbol: "ETH-USD", side: "long", entryKind: "limit",
    entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: 5, createdAt: new Date(clock).toISOString(), ...over,
  } as never);
  store.openCall(id, 77);
  return id;
}

beforeEach(() => {
  store = openStore(":memory:");
  kek = randomBytes(32);
  store.registerChannel({ chatId: CHAT, title: "Test", kind: "channel", callerTgId: CALLER, createdAt: new Date(clock).toISOString() });
  build();
});

describe("caller posts", () => {
  const post = (text: string, chatId = CHAT) => svc.onCallerPost({ chatId, messageId: 9, text });

  it("ignores chats that are not registered", async () => {
    expect(await post("ETH long 2480 tp 2560 sl 2420", -999)).toEqual({ type: "ignore" });
  });

  it("in a group, ignores a call posted by someone who is not the registered caller", async () => {
    expect(await svc.onCallerPost({ chatId: CHAT, messageId: 9, text: "ETH long 2480 tp 2560 sl 2420", senderTgId: 4242 })).toEqual({ type: "ignore" });
    expect(store.getCall(1)).toBeUndefined();
  });

  it("in a group, accepts a call from the registered caller", async () => {
    const r = await svc.onCallerPost({ chatId: CHAT, messageId: 9, text: "ETH long 2480 tp 2560 sl 2420", senderTgId: CALLER });
    expect(r).toMatchObject({ type: "dm", tgId: CALLER });
  });

  it("ignores chatter", async () => {
    expect(await post("gm everyone")).toEqual({ type: "ignore" });
  });

  it("turns a call into a draft and asks the caller to confirm in a DM", async () => {
    const r = await post("ETH long 2480 tp 2560 sl 2420 5x");
    expect(r).toMatchObject({ type: "dm", tgId: CALLER });
    if (r.type !== "dm") throw new Error();
    expect(r.reply.text).toContain("Post this call?");
    const id = store.getCall(1)?.id as number;
    expect(store.getCall(id)).toMatchObject({ status: "draft", symbol: "ETH-USD", chatId: CHAT, messageId: 9 });
    expect(r.reply.buttons?.map((b) => b.callback)).toEqual([callbackData("post", id), callbackData("drop", id)]);
  });

  it("counts a call on an unlisted market and tells the caller", async () => {
    const r = await post("#DOGE/USDT long 0.1 tp 0.2 sl 0.09");
    expect(r).toMatchObject({ type: "dm", tgId: CALLER });
    if (r.type !== "dm") throw new Error();
    expect(r.reply.text).toBe("Not on Strike yet: DOGE.");
    expect(store.missCount("DOGE", CHAT)).toBe(1);
  });

  it("relays a parser question to the caller instead of guessing", async () => {
    const r = await post("ETH 2480 tp 2560 sl 2420");
    if (r.type !== "dm") throw new Error("expected a DM");
    expect(r.reply.text).toBe("Long or short on ETH-USD?");
    expect(store.getCall(1)).toBeUndefined();
  });
});

describe("posting a draft", () => {
  async function draft(): Promise<number> {
    await svc.onCallerPost({ chatId: CHAT, messageId: 9, text: "ETH long 2480 tp 2560 sl 2420" });
    return 1;
  }

  it("builds the channel card with deep-link buttons for the caller only", async () => {
    const id = await draft();
    const r = svc.postDraft(id, CALLER);
    expect(r).toMatchObject({ ok: true, chatId: CHAT });
    if (!r.ok) throw new Error();
    expect(r.text).toBe("<b>ETH-USD · LONG</b>\nEntry 2480.00 · TP 2560.00 · SL 2420.00 · R:R 1.33\nTailed 0 · Faded 0");
    expect(r.buttons.map((b) => b.url)).toEqual(["https://t.me/tailbot?start=t_1", "https://t.me/tailbot?start=f_1"]);
  });

  it("refuses anyone but the registered caller", async () => {
    const id = await draft();
    expect(svc.postDraft(id, 12345)).toMatchObject({ ok: false });
  });

  it("opens the call once the card has a message id, and cannot be posted twice", async () => {
    const id = await draft();
    svc.afterPosted(id, 55);
    expect(store.getCall(id)).toMatchObject({ status: "open", cardMessageId: 55 });
    expect(svc.postDraft(id, CALLER)).toMatchObject({ ok: false });
  });

  it("dropping a draft cancels it", async () => {
    const id = await draft();
    expect(svc.dropDraft(id, CALLER).text).toBe("Dropped.");
    expect(store.getCall(id)?.status).toBe("cancelled");
  });
});

describe("quote", () => {
  it("tells an unlinked user to link first", async () => {
    const id = openCall();
    expect(await svc.quote({ tgId: FOLLOWER, callId: id, mode: "tail" })).toMatchObject({ ok: false, text: expect.stringContaining("/link") });
  });

  it("sizes from the follower's own equity and risk and stores a quote", async () => {
    linkFollower();
    const id = openCall();
    const r = await svc.quote({ tgId: FOLLOWER, callId: id, mode: "tail" });
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) throw new Error();
    expect(r.reply.text).toContain("Size 0.009 · notional 22.32 USD");
    expect(r.reply.text).toContain("Risk 0.54 USD (3% of 19.92 USD)");
    expect(store.getTail(r.tailId)).toMatchObject({ status: "quoted", mode: "tail", size: "0.009", callId: id });
    expect(r.reply.buttons?.map((b) => b.callback)).toEqual([callbackData("confirm", r.tailId), callbackData("cancel", r.tailId)]);
  });

  it("fade trades the other side with swapped levels", async () => {
    linkFollower();
    const id = openCall();
    const r = await svc.quote({ tgId: FOLLOWER, callId: id, mode: "fade" });
    if (!r.ok) throw new Error(r.text);
    expect(r.reply.text).toContain("<b>Fade ETH-USD · SHORT</b>");
    expect(r.reply.text).toContain("TP 2420.00 · SL 2560.00");
    expect(r.reply.text).toContain("R:R 0.75 (the caller's call is 1.33)");
    // fade risk distance is entry to the caller's TP (80), so the size is smaller: 0.597 / 80 = 0.007
    expect(store.getTail(r.tailId)?.size).toBe("0.007");
  });

  it("refuses zero margin with a deposit hint", async () => {
    build({ equity: "0" });
    linkFollower();
    const r = await svc.quote({ tgId: FOLLOWER, callId: openCall(), mode: "tail" });
    expect(r).toEqual({ ok: false, text: "No margin on your Strike account. Deposit first." });
  });

  it("refuses a trade below the market minimum and says why", async () => {
    linkFollower();
    store.setSetting(FOLLOWER, "riskPct", "1");
    const r = await svc.quote({ tgId: FOLLOWER, callId: openCall(), mode: "tail" });
    expect(r).toMatchObject({ ok: false });
    if (r.ok) throw new Error();
    expect(r.text).toMatch(/^Too small for this market\. notional .* is below the market minimum 10/);
  });

  it("sizes a market-entry call from the follower's mark price", async () => {
    linkFollower();
    const id = openCall({ entryKind: "market", entry: null });
    const r = await svc.quote({ tgId: FOLLOWER, callId: id, mode: "tail" });
    if (!r.ok) throw new Error(r.text);
    expect(r.reply.text).toContain("Entry market");
  });

  it("refuses a market-entry call whose stop is already behind the price", async () => {
    build({ mark: "2400.00" });
    linkFollower();
    const id = openCall({ entryKind: "market", entry: null });
    const r = await svc.quote({ tgId: FOLLOWER, callId: id, mode: "tail" });
    expect(r).toEqual({ ok: false, text: "The price has moved past this call's stop or target. Not placing it." });
  });

  it("refuses a second live tail on the same call", async () => {
    linkFollower();
    const id = openCall();
    const first = await svc.quote({ tgId: FOLLOWER, callId: id, mode: "tail" });
    if (!first.ok) throw new Error(first.text);
    store.updateTail(first.tailId, { status: "placed" });
    expect(await svc.quote({ tgId: FOLLOWER, callId: id, mode: "tail" })).toEqual({ ok: false, text: "You already took this call." });
  });

  it("refuses a call that is not open", async () => {
    linkFollower();
    const draft = store.createDraftCall({ chatId: CHAT, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: "t" } as never);
    expect(await svc.quote({ tgId: FOLLOWER, callId: draft, mode: "tail" })).toEqual({ ok: false, text: "This call is closed." });
    expect(await svc.quote({ tgId: FOLLOWER, callId: 999, mode: "tail" })).toEqual({ ok: false, text: "This call is closed." });
  });

  it("HTML-escapes Strike's error text before it reaches Telegram", async () => {
    build({ accountThrows: new StrikeError(400, "GET", "/v2/account", "bad <b>input</b> & more") });
    linkFollower();
    const r = await svc.quote({ tgId: FOLLOWER, callId: openCall(), mode: "tail" });
    expect(r).toEqual({ ok: false, text: "Strike said: bad &lt;b&gt;input&lt;/b&gt; &amp; more." });
  });

  it("surfaces a Strike error from the equity read without leaking internals", async () => {
    build({ accountThrows: new StrikeError(401, "GET", "/v2/account", "authentication failed") });
    linkFollower();
    const r = await svc.quote({ tgId: FOLLOWER, callId: openCall(), mode: "tail" });
    expect(r).toEqual({ ok: false, text: "Strike said: authentication failed. Relink with /link." });
  });
});

describe("confirm", () => {
  async function quoted(mode: "tail" | "fade" = "tail") {
    linkFollower();
    const callId = openCall();
    const q = await svc.quote({ tgId: FOLLOWER, callId, mode });
    if (!q.ok) throw new Error(q.text);
    return { callId, tailId: q.tailId };
  }

  it("places the exact bracket the quote showed and reports the order id", async () => {
    const { tailId } = await quoted();
    const r = await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(r.text).toBe("Placed. Strike order 243140841 is open.");
    expect(strike.placed).toEqual([
      { symbol: "ETH-USD", side: "buy", type: "limit", size: "0.009", price: "2480.00", tp: "2560.00", sl: "2420.00", strategyId: store.getTail(tailId)?.strategyId },
    ]);
    expect(store.getTail(tailId)).toMatchObject({ status: "placed", orderId: "243140841", primaryClientOrderId: "pc-1" });
  });

  it("a fade places a sell with swapped legs", async () => {
    const { tailId } = await quoted("fade");
    await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(strike.placed[0]).toMatchObject({ side: "sell", tp: "2420.00", sl: "2560.00", price: "2480.00" });
  });

  it("edits the channel card with the new counters", async () => {
    const { tailId } = await quoted();
    const r = await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(r.cardEdit).toMatchObject({ chatId: CHAT, messageId: 77 });
    expect(r.cardEdit?.text).toMatch(/Tailed 1 · Faded 0$/);
  });

  it("reads Strike's final status: a rejection after the 201 is reported as a rejection", async () => {
    build({ order: { ID: 5, Status: "rejected", CloseReason: "order_price_out_of_limit" } });
    const { tailId } = await quoted();
    const r = await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(r.text).toBe("Strike rejected the order: order_price_out_of_limit.");
    expect(r.cardEdit).toBeUndefined();
    expect(store.getTail(tailId)).toMatchObject({ status: "rejected", error: "order_price_out_of_limit" });
    expect(store.tailCounts(1)).toEqual({ tailed: 0, faded: 0 });
  });

  it("a rejected try does not block another", async () => {
    build({ order: { ID: 5, Status: "rejected", CloseReason: "order_price_out_of_limit" } });
    const { callId, tailId } = await quoted();
    await svc.confirm({ tgId: FOLLOWER, tailId });
    build();
    const q2 = await svc.quote({ tgId: FOLLOWER, callId, mode: "tail" });
    expect(q2).toMatchObject({ ok: true });
  });

  it("a second tap does not place a second order", async () => {
    const { tailId } = await quoted();
    await svc.confirm({ tgId: FOLLOWER, tailId });
    const again = await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(again.text).toBe("Already placed.");
    expect(strike.placed.length).toBe(1);
  });

  it("two concurrent taps place exactly one order", async () => {
    const { tailId } = await quoted();
    const [a, b] = await Promise.all([svc.confirm({ tgId: FOLLOWER, tailId }), svc.confirm({ tgId: FOLLOWER, tailId })]);
    expect([a.text, b.text].sort()).toEqual(["Already placed.", "Placed. Strike order 243140841 is open."]);
    expect(strike.placed.length).toBe(1);
  });

  it("only the follower who was quoted can confirm", async () => {
    const { tailId } = await quoted();
    const r = await svc.confirm({ tgId: 424242, tailId });
    expect(r.text).toBe("This quote is not yours.");
    expect(strike.placed.length).toBe(0);
  });

  it("an expired quote asks the follower to tap again and sends nothing", async () => {
    const { tailId } = await quoted();
    advance(6);
    const r = await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(r.text).toBe("This quote expired. Tap Tail on the card again.");
    expect(strike.placed.length).toBe(0);
    expect(store.getTail(tailId)?.status).toBe("cancelled");
  });

  it("reports a Strike error and frees the follower to retry", async () => {
    build({ throwOnPlace: new StrikeError(400, "POST", "/v2/order/strategy", "account has not approved builder \"sigma\"") });
    const { tailId } = await quoted();
    const r = await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(r.text).toBe("Strike rejected the order: account has not approved builder \"sigma\".");
    expect(store.getTail(tailId)).toMatchObject({ status: "rejected" });
  });

  it("a network failure after sending is unconfirmed: it is NOT freed for a blind retry", async () => {
    build({ throwOnPlace: new Error("socket hang up") });
    const { callId, tailId } = await quoted();
    const r = await svc.confirm({ tgId: FOLLOWER, tailId });
    expect(r.text).toBe("Could not confirm with Strike. Check your open orders on Strike before trying again.");
    expect(store.getTail(tailId)).toMatchObject({ status: "placed", error: "unconfirmed" });
    build();
    expect(await svc.quote({ tgId: FOLLOWER, callId, mode: "tail" })).toEqual({ ok: false, text: "You already took this call." });
  });

  it("cancel releases the quote", async () => {
    const { tailId } = await quoted();
    expect(svc.cancel({ tgId: FOLLOWER, tailId }).text).toBe("Cancelled.");
    expect(store.getTail(tailId)?.status).toBe("cancelled");
    expect((await svc.confirm({ tgId: FOLLOWER, tailId })).text).toBe("This quote is no longer active.");
  });
});

describe("link", () => {
  const KEY = "ab".repeat(32);

  it("verifies the key with Strike, stores it encrypted, and never echoes it", async () => {
    const r = await svc.link(FOLLOWER, KEY);
    expect(r.ok).toBe(true);
    expect(r.text).not.toContain(KEY);
    const row = store.rawUserRow(FOLLOWER) as { api_priv_enc: string; address: string };
    expect(row.api_priv_enc).not.toContain(KEY);
    expect(decryptSecret(kek, row.api_priv_enc)).toBe(KEY);
    expect(row.address).toBe("0x0C3aD0348879998C97106Feb1d0AE9406A6A741d");
  });

  it("stores nothing when Strike rejects the key", async () => {
    build({ accountThrows: new StrikeError(401, "GET", "/v2/account", "authentication failed") });
    const r = await svc.link(FOLLOWER, KEY);
    expect(r).toEqual({ ok: false, text: "Strike did not accept that key: authentication failed." });
    expect(store.rawUserRow(FOLLOWER)).toBeUndefined();
  });

  it("rejects a malformed key before calling Strike", async () => {
    expect((await svc.link(FOLLOWER, "nothex")).ok).toBe(false);
  });
});

describe("me, settings, revoke", () => {
  it("shows the linked address, equity and caps", async () => {
    linkFollower({ address: "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d" });
    const t = await svc.me(FOLLOWER);
    expect(t).toContain("0x0C3a…741d");
    expect(t).toContain("Equity 19.92 USD");
    expect(t).toContain("Risk 3% · max leverage 5x · max notional 500 USD");
  });

  it("tells an unlinked user how to start", async () => {
    expect(await svc.me(FOLLOWER)).toContain("/link");
  });

  it.each([
    ["riskPct", "2.5", true], ["riskPct", "0", false], ["riskPct", "26", false], ["riskPct", "abc", false],
    ["maxLeverage", "10", true], ["maxLeverage", "0.5", false], ["maxLeverage", "101", false],
    ["maxNotionalUsd", "250", true], ["maxNotionalUsd", "-1", false], ["maxNotionalUsd", "1e9", false],
  ] as const)("%s = %s accepted: %s", (key, raw, ok) => {
    linkFollower();
    expect(svc.set(FOLLOWER, key, raw).ok).toBe(ok);
  });

  it("revoke removes the stored key", () => {
    linkFollower();
    expect(svc.revoke(FOLLOWER)).toContain("Removed");
    expect(store.getUser(FOLLOWER)).toBeUndefined();
  });
});
