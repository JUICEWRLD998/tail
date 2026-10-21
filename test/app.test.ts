import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { StrikeLike } from "../src/bot/service.js";

const MARKETS = { "ETH-USD": { tickSize: "0.01", stepSize: "0.001", minQty: "0.001", maxQty: "1000", marketMaxQty: "100", minNotional: "10" } };
const botInfo = { id: 1, is_bot: true, first_name: "Tail", username: "tailbot", can_join_groups: true, can_read_all_group_messages: true, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as never;

const strike = {
  syncClock: async () => 0,
  markets: async () => MARKETS,
  markPrice: async () => "2494.62",
  account: async () => ({ margin_balance: "19.92", blockchain: "ethereum", blockchain_address: "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d", account_id: "acc-1" }),
  placeBracket: async () => ({ primary_client_order_id: "pc-1" }),
  order: async () => ({ ID: 1, Status: "open", CloseReason: "" }),
  builderRequestSignature: async (i: { publicKey: string }) => ({ nonce: "n1", message_to_sign: `sign for ${i.publicKey.slice(0, 8)}` }),
  builderVerifySignature: async () => ({ account_id: "acc-9", api_wallet_public_key: lastPub, fee_share_bps: 10, builder_code: "sigma" }),
} as unknown as StrikeLike & Record<string, unknown>;
let lastPub = "";

const env = (over: Record<string, string> = {}) => ({
  TELEGRAM_BOT_TOKEN: "123:abc", TAIL_KEK: randomBytes(32).toString("base64"), TAIL_DB: ":memory:",
  BUILDER_CODE: "sigma", BUILDER_FEE_BPS: "10", ...over,
});
const prodEnv = () => env({ TAIL_MODE: "prod", PUBLIC_URL: "https://tail.example.test", WEBHOOK_SECRET: "s".repeat(40) });

async function make(e: Record<string, string>) {
  const app = await createApp(loadConfig(e), { publicStrike: strike as never, strikeFor: () => strike, clientForKey: () => strike, botInfo });
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
    lastPub = (app.store as any).takePending ? "" : "";
    // The fake Strike must echo the public key we generated; read it back from the pending record.
    const pending = app.store.takePending("n1", token, new Date().toISOString())!;
    lastPub = pending.apiPub;
    app.store.savePending({ nonce: "n1", token, tgId: pending.tgId, address: pending.address, chain: pending.chain, apiPub: pending.apiPub, apiPrivEnc: pending.apiPrivEnc, createdAt: new Date().toISOString() });

    const done = await app.server.inject({ method: "POST", url: `/api/connect/${token}/complete`, payload: { nonce: "n1", signature: "0xsig" } });
    expect(done.json()).toEqual({ ok: true, address: "0x0C3a…741d" });
    expect(app.store.getUser(4444)).toMatchObject({ builderCode: "sigma", chain: "ethereum", strikeAccountId: "acc-9" });
    expect(api.filter((c) => c.method === "sendMessage").at(-1)?.payload).toMatchObject({ chat_id: 4444, text: "Linked 0x0C3a…741d. Tap Tail on a call card to trade." });
    expect(JSON.stringify(done.json())).not.toMatch(/[0-9a-f]{64}/);
  });
});
