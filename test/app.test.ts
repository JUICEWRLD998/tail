import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { StrikeLike } from "../src/bot/service.js";

const MARKETS = { "ETH-USD": { tickSize: "0.01", stepSize: "0.001", minQty: "0.001", maxQty: "1000", marketMaxQty: "100", minNotional: "10" } };
const botInfo = { id: 1, is_bot: true, first_name: "Tail", username: "tailbot", can_join_groups: true, can_read_all_group_messages: true, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as never;

const strike = {
  syncClock: async () => 0,
  markets: async () => MARKETS,
  markPrice: async () => markResult,
  account: async () => ({ margin_balance: "19.92", blockchain: "ethereum", blockchain_address: "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d", account_id: "acc-1" }),
  placeBracket: async () => ({ primary_client_order_id: "pc-1" }),
  order: async () => orderResult,
  fills: async () => ({ fills: [{ client_order_id: "pc-live", price: "2480.00", realized_pnl: "0" }] }),
  openOrders: async () => ({ orders: [] }),
  orderHistory: async () => ({ orders: [] }),
  builderRequestSignature: async (i: { publicKey: string }) => ((lastPub = i.publicKey), { nonce: "n1", message_to_sign: `sign for ${i.publicKey.slice(0, 8)}` }),
  builderVerifySignature: async () => ({ account_id: "acc-9", api_wallet_public_key: lastPub, fee_share_bps: 10, builder_code: "sigma" }),
} as unknown as StrikeLike & Record<string, unknown>;
let lastPub = "";
let orderResult: Record<string, unknown> = { ID: 1, Status: "open", CloseReason: "" };
let markResult = "2494.62";

const env = (over: Record<string, string> = {}) => ({
  TELEGRAM_BOT_TOKEN: "123:abc", TAIL_KEK: randomBytes(32).toString("base64"), TAIL_DB: ":memory:",
  BUILDER_CODE: "sigma", BUILDER_FEE_BPS: "10", ...over,
});
const prodEnv = () => env({ TAIL_MODE: "prod", PUBLIC_URL: "https://tail.example.test", WEBHOOK_SECRET: "s".repeat(40) });

async function make(e: Record<string, string>) {
  const app = await createApp(loadConfig(e), { publicStrike: strike as never, strikeFor: () => strike as never, clientForKey: () => strike, botInfo });
  const api: { method: string; payload: any }[] = [];
  app.bot.api.config.use(async (_p, method, payload) => {
    api.push({ method, payload });
    return { ok: true, result: method === "sendMessage" ? { message_id: 1, date: 0, chat: { id: (payload as any).chat_id, type: "private" }, text: "" } : true } as never;
  });
  return { app, api };
}

const privateMsg = (text: string, id = 4444) => ({
  update_id: 1,
  message: { message_id: 1, date: 0, chat: { id, type: "private", first_name: "x" }, from: { id, is_bot: false, first_name: "x" }, text, entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]!.length }] },
});

describe("prod mode wiring", () => {
  it("registers the webhook with the secret token and only the update types Tail uses", async () => {
    const { app, api } = await make(prodEnv());
    await app.registerWebhook();
    const call = api.find((c) => c.method === "setWebhook")!;
    expect(call.payload.url).toBe(`https://tail.example.test${loadConfig(prodEnv()).webhookPath}`);
    expect(call.payload.secret_token).toBe("s".repeat(40));
    expect(call.payload.allowed_updates).toEqual(["message", "channel_post", "callback_query", "my_chat_member"]);
  });

  it("a Telegram update posted to the webhook path reaches the bot; a wrong secret does not", async () => {
    const cfg = loadConfig(prodEnv());
    const { app, api } = await make(prodEnv());
    const bad = await app.server.inject({ method: "POST", url: cfg.webhookPath!, headers: { "x-telegram-bot-api-secret-token": "x".repeat(40) }, payload: privateMsg("/help") });
    expect(bad.statusCode).toBe(401);
    expect(api.length).toBe(0);
    const ok = await app.server.inject({ method: "POST", url: cfg.webhookPath!, headers: { "x-telegram-bot-api-secret-token": "s".repeat(40) }, payload: privateMsg("/help") });
    expect(ok.statusCode).toBe(200);
    expect(api.find((c) => c.method === "sendMessage")?.payload.text).toContain("/addchannel");
  });

  it("answers /health", async () => {
    const { app } = await make(prodEnv());
    expect((await app.server.inject({ method: "GET", url: "/health" })).json()).toEqual({ ok: true });
  });
});

describe("dev mode wiring", () => {
  it("has no webhook route and registers no webhook", async () => {
    const { app } = await make(env());
    expect((await app.server.inject({ method: "POST", url: "/telegram/anything", payload: {} })).statusCode).toBe(404);
  });

  it("offers wallet connect only when a public URL and a builder code exist", async () => {
    const a = await make(env());
    await a.app.bot.handleUpdate(privateMsg("/connect") as never);
    expect(a.api.find((c) => c.method === "sendMessage")?.payload.text).toBe("Wallet connect is not set up on this server. Use /link.");

    const b = await make(env({ PUBLIC_URL: "http://localhost:3000" }));
    await b.app.bot.handleUpdate(privateMsg("/connect") as never);
    expect(b.api.find((c) => c.method === "sendMessage")?.payload.reply_markup.inline_keyboard[0][0].url).toMatch(/^http:\/\/localhost:3000\/connect\?t=/);
  });
});

describe("connect, end to end through the server", () => {
  it("a token from the bot drives challenge and complete over HTTP, links the user as a builder wallet, and DMs them", async () => {
    const { app, api } = await make(prodEnv());
    await app.bot.handleUpdate(privateMsg("/connect") as never);
    const url = new URL(api.find((c) => c.method === "sendMessage")!.payload.reply_markup.inline_keyboard[0][0].url);
    const token = url.searchParams.get("t")!;

    const info = await app.server.inject({ method: "GET", url: `/api/connect/${token}` });
    expect(info.json()).toMatchObject({ ok: true, builderCode: "sigma", feeCapBps: 10 });

    const ch = await app.server.inject({ method: "POST", url: `/api/connect/${token}/challenge`, payload: { address: "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d", chain: "ethereum" } });
    expect(ch.json()).toMatchObject({ ok: true, nonce: "n1" });

    const done = await app.server.inject({ method: "POST", url: `/api/connect/${token}/complete`, payload: { nonce: "n1", signature: "0xsig" } });
    expect(done.json()).toEqual({ ok: true, address: "0x0C3a…741d" });
    expect(app.store.getUser(4444)).toMatchObject({ builderCode: "sigma", chain: "ethereum", strikeAccountId: "acc-9" });
    expect(api.filter((c) => c.method === "sendMessage").at(-1)?.payload).toMatchObject({ chat_id: 4444, text: "Linked 0x0C3a…741d. Tap Tail on a call card to trade." });
    expect(JSON.stringify(done.json())).not.toMatch(/[0-9a-f]{64}/);
  });
});


describe("live-state jobs through the app", () => {
  const seedOpenCall = (app: Awaited<ReturnType<typeof make>>["app"], over: Record<string, unknown> = {}) => {
    app.store.registerChannel({ chatId: -1001, title: "Test", kind: "channel", callerTgId: 900, createdAt: new Date().toISOString() });
    const id = app.store.createDraftCall({
      chatId: -1001, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00",
      leverageHint: null, createdAt: new Date().toISOString(), ...over,
    } as never);
    app.store.openCall(id, 55);
    return id;
  };

  it("posts the receipt as a reply to the card and edits the card without the Tail and Fade buttons", async () => {
    const { app, api } = await make(env());
    const id = seedOpenCall(app);
    markResult = "2479.00";
    await app.runJobsOnce(); // enters
    markResult = "2561.10";
    await app.runJobsOnce(); // target
    const receipt = api.find((c) => c.method === "sendMessage")!;
    expect(receipt.payload).toMatchObject({ chat_id: -1001, parse_mode: "HTML", reply_parameters: { message_id: 55, allow_sending_without_reply: true } });
    expect(receipt.payload.text).toContain("take profit hit");
    const edit = api.find((c) => c.method === "editMessageText")!;
    expect(edit.payload).toMatchObject({ chat_id: -1001, message_id: 55 });
    expect(edit.payload.text).toContain("Result: take profit hit");
    expect(edit.payload.reply_markup).toBeUndefined();
    expect(app.store.getCall(id)?.status).toBe("tp_hit");
    markResult = "2494.62";
  });

  it("reconciliation tells a follower their order filled, using the real bot API", async () => {
    const { app, api } = await make(env());
    const callId = seedOpenCall(app);
    app.store.linkUser({ tgId: 4444, chain: "ethereum", address: "0xabc", strikeAccountId: "a", apiPub: "p", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: "t" });
    const tail = app.store.createTail({ callId, tgId: 4444, mode: "tail", strategyId: "s1", size: "0.009", notionalUsd: "22", feeBps: 0, createdAt: new Date().toISOString() });
    app.store.updateTail(tail, { status: "placed", primaryClientOrderId: "pc-live", orderId: "1" });
    orderResult = { ID: 1, Status: "filled" };
    await app.runJobsOnce();
    expect(api.find((c) => c.method === "sendMessage" && c.payload.chat_id === 4444)?.payload.text).toBe("Filled: ETH-USD LONG 0.009 at 2480.00.");
    expect(app.store.getTail(tail)?.status).toBe("filled");
    orderResult = { ID: 1, Status: "open", CloseReason: "" };
  });

  it("a rejection edits the card counters and keeps the Tail and Fade buttons", async () => {
    const { app, api } = await make(env());
    const callId = seedOpenCall(app);
    app.store.linkUser({ tgId: 4444, chain: "ethereum", address: "0xabc", strikeAccountId: "a", apiPub: "p", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: "t" });
    const tail = app.store.createTail({ callId, tgId: 4444, mode: "tail", strategyId: "s1", size: "0.009", notionalUsd: "22", feeBps: 0, createdAt: new Date().toISOString() });
    app.store.updateTail(tail, { status: "placed", primaryClientOrderId: "pc-live", orderId: "1" });
    orderResult = { ID: 1, Status: "rejected", CloseReason: "order_price_out_of_limit" };
    await app.runJobsOnce();
    const edit = api.find((c) => c.method === "editMessageText")!;
    expect(edit.payload.text).toContain("Tailed 0 · Faded 0");
    expect(edit.payload.reply_markup.inline_keyboard[0].map((b: { url: string }) => b.url)).toEqual(["https://t.me/tailbot?start=t_1", "https://t.me/tailbot?start=f_1"]);
    orderResult = { ID: 1, Status: "open", CloseReason: "" };
  });

  it("one job failing does not stop the other from running", async () => {
    const { app } = await make(env());
    seedOpenCall(app);
    const real = strike.markPrice;
    (strike as any).markPrice = async () => { throw new Error("price feed down"); };
    await expect(app.runJobsOnce()).resolves.toBeDefined();
    (strike as any).markPrice = real;
  });
});


describe("the job schedule", () => {
  afterEach(() => vi.useRealTimers());

  it("startJobs runs reconcile every 15 s and outcomes every 30 s, and stop() ends them", async () => {
    vi.useFakeTimers();
    const { app, api } = await make(env());
    app.store.registerChannel({ chatId: -1001, title: "T", kind: "channel", callerTgId: 900, createdAt: new Date().toISOString() });
    const callId = app.store.createDraftCall({ chatId: -1001, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: new Date().toISOString() });
    app.store.openCall(callId, 55);
    app.store.linkUser({ tgId: 4444, chain: "ethereum", address: "0xabc", strikeAccountId: "a", apiPub: "p", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: "t" });
    const tail = app.store.createTail({ callId, tgId: 4444, mode: "tail", strategyId: "s1", size: "0.009", notionalUsd: "22", feeBps: 0, createdAt: new Date().toISOString() });
    app.store.updateTail(tail, { status: "placed", primaryClientOrderId: "pc-live", orderId: "1" });
    orderResult = { ID: 1, Status: "filled" };

    app.startJobs();
    await vi.advanceTimersByTimeAsync(14_000);
    expect(app.store.getTail(tail)?.status).toBe("placed"); // nothing before the first interval
    await vi.advanceTimersByTimeAsync(2_000);
    expect(app.store.getTail(tail)?.status).toBe("filled"); // reconcile ran at 15 s

    markResult = "2479.00";
    await vi.advanceTimersByTimeAsync(15_000); // t = 31 s: outcomes ran once, entered
    expect(app.store.getCall(callId)?.enteredPrice).toBe("2480.00");

    await app.stop();
    const before = api.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.length).toBe(before);
    orderResult = { ID: 1, Status: "open", CloseReason: "" };
    markResult = "2494.62";
  });
});

describe("card edits are batched across confirm, reconcile and outcomes", () => {
  afterEach(() => vi.useRealTimers());

  const tapMsg = (data: string, id: number) => ({
    update_id: 9,
    callback_query: { id: `c${id}`, from: { id, is_bot: false, first_name: "x" }, chat_instance: "ci", data, message: { message_id: 3, date: 0, chat: { id, type: "private", first_name: "x" }, text: "card" } },
  });

  async function setupCard() {
    const { app, api } = await make(env());
    app.store.registerChannel({ chatId: -1001, title: "T", kind: "channel", callerTgId: 900, createdAt: new Date().toISOString() });
    const callId = app.store.createDraftCall({ chatId: -1001, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: new Date().toISOString() });
    app.store.openCall(callId, 55);
    for (const tg of [4001, 4002, 4003]) {
      app.store.linkUser({ tgId: tg, chain: "ethereum", address: "0xabc", strikeAccountId: "a", apiPub: "p", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: "t" });
      app.store.setSetting(tg, "riskPct", "3");
    }
    return { app, api, callId };
  }

  it("three quick confirms edit the channel card twice (first at once, one trailing), not three times", async () => {
    vi.useFakeTimers();
    const { app, api, callId } = await setupCard();
    let tailIds: number[] = [];
    for (const tg of [4001, 4002, 4003]) {
      await app.bot.handleUpdate(privateMsg(`/start t_${callId}`, tg) as never);
      tailIds.push(Number(api.filter((c) => c.method === "sendMessage" && c.payload.chat_id === tg).at(-1)?.payload.reply_markup.inline_keyboard[0][0].callback_data.split(":")[1]));
    }
    for (let i = 0; i < 3; i++) await app.bot.handleUpdate(tapMsg(`y:${tailIds[i]}`, [4001, 4002, 4003][i] as number) as never);
    const cardEdits = () => api.filter((c) => c.method === "editMessageText" && c.payload.chat_id === -1001);
    expect(cardEdits().length).toBe(1);
    expect(cardEdits()[0]!.payload.text).toContain("Tailed 1 · Faded 0");
    await vi.advanceTimersByTimeAsync(3500);
    expect(cardEdits().length).toBe(2);
    expect(cardEdits()[1]!.payload.text).toContain("Tailed 3 · Faded 0");
  });

  it("a pending counter edit never overwrites the call's result", async () => {
    vi.useFakeTimers();
    const { app, api, callId } = await setupCard();
    const ids: number[] = [];
    for (const tg of [4001, 4002]) {
      await app.bot.handleUpdate(privateMsg(`/start t_${callId}`, tg) as never);
      ids.push(Number(api.filter((c) => c.method === "sendMessage" && c.payload.chat_id === tg).at(-1)?.payload.reply_markup.inline_keyboard[0][0].callback_data.split(":")[1]));
    }
    await app.bot.handleUpdate(tapMsg(`y:${ids[0]}`, 4001) as never); // immediate card edit
    await app.bot.handleUpdate(tapMsg(`y:${ids[1]}`, 4002) as never); // pending (inside the window)
    markResult = "2479.00";
    await app.runJobsOnce(); // enters
    markResult = "2561.10";
    await app.runJobsOnce(); // target: final edit
    await vi.advanceTimersByTimeAsync(10_000);
    const cardEdits = api.filter((c) => c.method === "editMessageText" && c.payload.chat_id === -1001);
    expect(cardEdits.at(-1)!.payload.text).toContain("Result: take profit hit");
    expect(cardEdits.some((c) => c.payload.text.includes("Tailed 2") && !c.payload.text.includes("Result"))).toBe(false);
    markResult = "2494.62";
  });
});
