import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createBot } from "../src/bot/bot.js";
import { createService, type StrikeLike } from "../src/bot/service.js";
import { openStore, type Store } from "../src/db/store.js";

const MARKETS = { "ETH-USD": { tickSize: "0.01", stepSize: "0.001", minQty: "0.001", maxQty: "1000", marketMaxQty: "100", minNotional: "10" } };
const CALLER = 900;
const FOLLOWER = 111;
const CHAT = -1001;
const OWNER = 111;
const KEY = "ab".repeat(32);
const T = "2026-10-21T12:00:00.000Z";

interface ApiCall { method: string; payload: any }

let store: Store;
let calls: ApiCall[];
let placed: any[];
let bot: ReturnType<typeof createBot>;
let uid = 0;

let nowMsForBot = Date.parse("2026-10-21T12:00:00.000Z");
function setup(opts: { ownerTgId?: number | undefined; linkKey?: string | undefined; equity?: string; publicUrl?: string | undefined; rateLimit?: { max: number; windowMs: number } } = {}) {
  store = openStore(":memory:");
  placed = [];
  calls = [];
  const strike: StrikeLike = {
    syncClock: async () => 0,
    markets: async () => MARKETS,
    markPrice: async () => "2494.62",
    account: async () => ({ margin_balance: opts.equity ?? "19.92", blockchain: "ethereum", blockchain_address: "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d", account_id: "acc-1" }),
    placeBracket: async (b) => (placed.push(b), { primary_client_order_id: "pc-1" }),
    order: async () => ({ ID: 243140841, Status: "open", CloseReason: "" }),
  };
  const service = createService({
    store, kek: randomBytes(32), botUsername: "tailbot", publicStrike: strike, strikeFor: () => strike, clientForKey: () => strike,
    now: () => T, uuid: () => `u${++uid}`, sleep: async () => {}, pollAttempts: 2,
  });
  bot = createBot({
    token: "123:abc", service, store, ownerTgId: opts.ownerTgId, linkKey: opts.linkKey, publicUrl: opts.publicUrl, now: () => T, ...(opts.rateLimit ? { rateLimit: opts.rateLimit, nowMs: () => nowMsForBot } : {}),
    botInfo: { id: 1, is_bot: true, first_name: "Tail", username: "tailbot", can_join_groups: true, can_read_all_group_messages: true, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as never,
  });
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    const result = method === "sendMessage" ? { message_id: 600 + calls.length, date: 0, chat: { id: (payload as any).chat_id, type: "private" }, text: (payload as any).text } : true;
    return { ok: true, result } as never;
  });
  store.registerChannel({ chatId: CHAT, title: "Test", kind: "channel", callerTgId: CALLER, createdAt: T });
}

let updateId = 0;
const channelPost = (text: string, chatId = CHAT) => ({ update_id: ++updateId, channel_post: { message_id: 9, date: 0, chat: { id: chatId, type: "channel", title: "Test" }, text } });
const groupMsg = (text: string, fromId: number, chatId = CHAT) => ({ update_id: ++updateId, message: { message_id: 9, date: 0, chat: { id: chatId, type: "supergroup", title: "G" }, from: { id: fromId, is_bot: false, first_name: "x" }, text } });
const dm = (text: string, fromId: number) => {
  const cmd = text.startsWith("/") ? [{ type: "bot_command", offset: 0, length: text.split(" ")[0]!.length }] : undefined;
  return { update_id: ++updateId, message: { message_id: 3, date: 0, chat: { id: fromId, type: "private", first_name: "x" }, from: { id: fromId, is_bot: false, first_name: "x" }, text, ...(cmd ? { entities: cmd } : {}) } };
};
const tap = (data: string, fromId: number, text = "card text") => ({
  update_id: ++updateId,
  callback_query: { id: `cb${updateId}`, from: { id: fromId, is_bot: false, first_name: "x" }, chat_instance: "ci", data, message: { message_id: 321, date: 0, chat: { id: fromId, type: "private", first_name: "x" }, text } },
});
const sent = (method = "sendMessage") => calls.filter((c) => c.method === method);
const lastText = () => (sent().at(-1)?.payload.text ?? "") as string;
const kbButtons = (c: ApiCall | undefined) => (c?.payload.reply_markup?.inline_keyboard ?? []).flat() as any[];

function linkFollower(tg = FOLLOWER) {
  store.linkUser({ tgId: tg, chain: "ethereum", address: "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d", strikeAccountId: "acc-1", apiPub: "p", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: T });
  store.setSetting(tg, "riskPct", "3");
}

beforeEach(() => setup({ ownerTgId: OWNER, linkKey: KEY }));

describe("registering a channel", () => {
  it("/addchannel gives a code; posting it in the channel binds the channel, removes the code and confirms by DM", async () => {
    store.registerChannel({ chatId: -555, title: "x", kind: "channel", callerTgId: 1, createdAt: T }); // unrelated
    await bot.handleUpdate(dm("/addchannel", 777) as never);
    const code = /TAIL-[A-Z2-9]{6}/.exec(lastText())?.[0] as string;
    expect(code).toBeTruthy();

    await bot.handleUpdate({ update_id: ++updateId, channel_post: { message_id: 40, date: 0, chat: { id: -2002, type: "channel", title: "New Channel" }, text: code } } as never);
    expect(store.getChannel(-2002)).toMatchObject({ callerTgId: 777, title: "New Channel", kind: "channel" });
    expect(sent("deleteMessage")[0]?.payload).toMatchObject({ chat_id: -2002, message_id: 40 });
    expect(sent().at(-1)?.payload).toMatchObject({ chat_id: 777 });
    expect(lastText()).toContain("Registered New Channel");
  });

  it("a wrong or reused code does nothing and says nothing", async () => {
    await bot.handleUpdate(channelPost("TAIL-AAAAAA", -3003) as never);
    expect(store.getChannel(-3003)).toBeUndefined();
    expect(calls.length).toBe(0);
  });
});

describe("caller flow", () => {
  it("a call in the channel is DMed to the caller with Post and Drop buttons; nothing is posted yet", async () => {
    await bot.handleUpdate(channelPost("ETH long 2480 tp 2560 sl 2420 5x") as never);
    expect(sent().length).toBe(1);
    expect(sent()[0]?.payload).toMatchObject({ chat_id: CALLER, parse_mode: "HTML" });
    expect(lastText()).toContain("Post this call?");
    expect(kbButtons(sent()[0]).map((b) => b.callback_data)).toEqual(["p:1", "x:1"]);
  });

  it("chatter in the channel is ignored", async () => {
    await bot.handleUpdate(channelPost("gm everyone") as never);
    expect(calls.length).toBe(0);
  });

  it("in a group, a call from another member is ignored", async () => {
    await bot.handleUpdate(groupMsg("ETH long 2480 tp 2560 sl 2420", 5555) as never);
    expect(calls.length).toBe(0);
  });

  it("in a group, commands are not treated as calls", async () => {
    await bot.handleUpdate(groupMsg("/start", CALLER) as never);
    expect(store.getCall(1)).toBeUndefined();
  });

  it("in a group, an unregistered /command that contains a call is still not a call", async () => {
    await bot.handleUpdate(groupMsg("/signal ETH long 2480 tp 2560 sl 2420", CALLER) as never);
    expect(store.getCall(1)).toBeUndefined();
    expect(calls.length).toBe(0);
  });

  it("Post publishes the card with Tail and Fade URL buttons, records the card id, and updates the DM", async () => {
    await bot.handleUpdate(channelPost("ETH long 2480 tp 2560 sl 2420") as never);
    calls.length = 0;
    await bot.handleUpdate(tap("p:1", CALLER) as never);
    const card = sent()[0] as ApiCall;
    expect(card.payload).toMatchObject({ chat_id: CHAT, parse_mode: "HTML" });
    expect(card.payload.text).toBe(["🟢 <b>ETH-USD · LONG</b>","","📍 Entry  <code>2480.00</code>","🎯 Target  <code>2560.00</code>","🛑 Stop  <code>2420.00</code>","⚖️ R:R 1.33","","👥 Tailed 0 · Faded 0"].join("\n"));
    expect(kbButtons(card).map((b) => b.url)).toEqual(["https://t.me/tailbot?start=t_1", "https://t.me/tailbot?start=f_1"]);
    expect(store.getCall(1)?.status).toBe("open");
    expect(sent("editMessageText")[0]?.payload.text).toBe("Posted.");
    expect(sent("answerCallbackQuery").length).toBe(1);
  });

  it("someone else tapping Post cannot publish", async () => {
    await bot.handleUpdate(channelPost("ETH long 2480 tp 2560 sl 2420") as never);
    calls.length = 0;
    await bot.handleUpdate(tap("p:1", 31337) as never);
    expect(sent().length).toBe(0);
    expect(sent("answerCallbackQuery")[0]?.payload.text).toBe("Only the caller can post this.");
  });

  it("Drop cancels the draft", async () => {
    await bot.handleUpdate(channelPost("ETH long 2480 tp 2560 sl 2420") as never);
    await bot.handleUpdate(tap("x:1", CALLER) as never);
    expect(store.getCall(1)?.status).toBe("cancelled");
  });

  it("/call in a DM works for a caller with one channel", async () => {
    await bot.handleUpdate(dm("/call ETH long 2480 tp 2560 sl 2420", CALLER) as never);
    expect(lastText()).toContain("Post this call?");
    expect(store.getCall(1)).toMatchObject({ chatId: CHAT, status: "draft" });
  });

  it("/call without a channel points to /addchannel", async () => {
    await bot.handleUpdate(dm("/call ETH long 2480 tp 2560 sl 2420", 4444) as never);
    expect(lastText()).toBe("No channel yet. Use /addchannel.");
  });
});

describe("follower flow", () => {
  async function openCard() {
    await bot.handleUpdate(channelPost("ETH long 2480 tp 2560 sl 2420") as never);
    await bot.handleUpdate(tap("p:1", CALLER) as never);
    calls.length = 0;
  }

  it("/start t_1 from a linked follower shows a sized confirm card", async () => {
    await openCard();
    linkFollower();
    await bot.handleUpdate(dm("/start t_1", FOLLOWER) as never);
    expect(lastText()).toContain("📏 Size <code>0.009</code> · <code>22.32</code> USD notional");
    expect(kbButtons(sent()[0]).map((b) => b.callback_data)).toEqual(["y:1", "n:1"]);
    expect(placed.length).toBe(0);
  });

  it("an unlinked follower is told to link", async () => {
    await openCard();
    await bot.handleUpdate(dm("/start t_1", 4444) as never);
    expect(lastText()).toBe("Link your Strike account first with /link.");
  });

  it("an unknown start payload shows the welcome text and quotes nothing", async () => {
    await openCard();
    linkFollower();
    await bot.handleUpdate(dm("/start whatever", FOLLOWER) as never);
    expect(lastText()).toContain("Tap Tail or Fade");
    expect(store.getTail(1)).toBeUndefined();
  });

  it("Confirm places the bracket, shows the order id, and edits the channel card counters", async () => {
    await openCard();
    linkFollower();
    await bot.handleUpdate(dm("/start t_1", FOLLOWER) as never);
    calls.length = 0;
    await bot.handleUpdate(tap("y:1", FOLLOWER, "Tail ETH-USD") as never);
    expect(placed).toHaveLength(1);
    const edits = sent("editMessageText");
    expect(edits[0]?.payload.text).toContain("Placed. Strike order 243140841 is open.");
    const cardEdit = edits.find((e) => e.payload.chat_id === CHAT);
    expect(cardEdit?.payload).toMatchObject({ message_id: store.getCall(1)!.cardMessageId });
    expect(cardEdit?.payload.text).toMatch(/Tailed 1 · Faded 0$/);
    expect(kbButtons(cardEdit).map((b) => b.url)).toEqual(["https://t.me/tailbot?start=t_1", "https://t.me/tailbot?start=f_1"]);
  });

  it("Fade from a second follower updates the counters to Faded 1", async () => {
    await openCard();
    linkFollower(111);
    linkFollower(222);
    await bot.handleUpdate(dm("/start t_1", 111) as never);
    await bot.handleUpdate(tap("y:1", 111) as never);
    await bot.handleUpdate(dm("/start f_1", 222) as never);
    calls.length = 0;
    await bot.handleUpdate(tap("y:2", 222) as never);
    expect(sent("editMessageText").find((e) => e.payload.chat_id === CHAT)?.payload.text).toMatch(/Tailed 1 · Faded 1$/);
  });

  it("a double tap on Confirm places one order", async () => {
    await openCard();
    linkFollower();
    await bot.handleUpdate(dm("/start t_1", FOLLOWER) as never);
    await Promise.all([bot.handleUpdate(tap("y:1", FOLLOWER) as never), bot.handleUpdate(tap("y:1", FOLLOWER) as never)]);
    expect(placed).toHaveLength(1);
  });

  it("Cancel releases the quote", async () => {
    await openCard();
    linkFollower();
    await bot.handleUpdate(dm("/start t_1", FOLLOWER) as never);
    await bot.handleUpdate(tap("n:1", FOLLOWER) as never);
    expect(store.getTail(1)?.status).toBe("cancelled");
    expect(placed).toHaveLength(0);
  });

  it("junk callback data is ignored", async () => {
    await bot.handleUpdate(tap("zzz", FOLLOWER) as never);
    expect(sent("answerCallbackQuery").length).toBe(1);
    expect(placed).toHaveLength(0);
  });
});

describe("connecting a wallet (when the service has a public URL)", () => {
  const URL_BASE = "https://tail.example.test";
  const tokenFrom = (c: ApiCall | undefined) => new URL(kbButtons(c)[0].url).searchParams.get("t") as string;

  async function openCard() {
    await bot.handleUpdate(channelPost("ETH long 2480 tp 2560 sl 2420") as never);
    await bot.handleUpdate(tap("p:1", CALLER) as never);
    calls.length = 0;
  }

  it("an unlinked follower who taps Tail gets a single-use connect button instead of /link", async () => {
    setup({ publicUrl: URL_BASE });
    await openCard();
    await bot.handleUpdate(dm("/start t_1", 4444) as never);
    expect(lastText()).toBe("Connect your wallet once to trade. It signs one message and cannot withdraw funds.");
    const url = new URL(kbButtons(sent()[0])[0].url);
    expect(url.origin + url.pathname).toBe(`${URL_BASE}/connect`);
    expect(store.peekConnectToken(tokenFrom(sent()[0]), T)).toBe(4444);
  });

  it("without a public URL the old /link text is shown and no token is made", async () => {
    await openCard();
    await bot.handleUpdate(dm("/start t_1", 4444) as never);
    expect(lastText()).toBe("Link your Strike account first with /link.");
    expect(kbButtons(sent()[0])).toEqual([]);
  });

  it("/connect gives a fresh link, retiring the previous one", async () => {
    setup({ publicUrl: URL_BASE });
    await bot.handleUpdate(dm("/connect", 4444) as never);
    const first = tokenFrom(sent()[0]);
    await bot.handleUpdate(dm("/connect", 4444) as never);
    const second = tokenFrom(sent()[1]);
    expect(first).not.toBe(second);
    expect(store.peekConnectToken(first, T)).toBeUndefined();
    expect(store.peekConnectToken(second, T)).toBe(4444);
  });

  it("/connect without a public URL explains how to link", async () => {
    await bot.handleUpdate(dm("/connect", 4444) as never);
    expect(lastText()).toBe("Wallet connect is not set up on this server. Use /link.");
  });

  it("an already linked follower is not asked to connect", async () => {
    setup({ publicUrl: URL_BASE });
    await openCard();
    linkFollower();
    await bot.handleUpdate(dm("/start t_1", FOLLOWER) as never);
    expect(lastText()).toContain("📏 Size <code>0.009</code>");
  });

  it("the connect link is only offered in a private chat", async () => {
    setup({ publicUrl: URL_BASE });
    await bot.handleUpdate(groupMsg("/connect", 4444) as never);
    expect(calls.length).toBe(0);
  });
});

describe("/record (a caller's record, from rows)", () => {
  const callRow = (status: "tp_hit" | "sl_hit" | "expired" | null, over: Record<string, unknown> = {}) => {
    const id = store.createDraftCall({ chatId: CHAT, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: T, ...over } as never);
    store.openCall(id, 50 + id);
    if (status) store.finishCall(id, { status, resultPrice: "1", closedAt: T });
    return id;
  };

  it("says there is nothing yet for a caller with no results", async () => {
    await bot.handleUpdate(dm("/record", CALLER) as never);
    expect(lastText()).toBe("Test\nNo calls with a result yet.\nTestnet.");
  });

  it("shows hit rate, average R and followers computed from the rows", async () => {
    const a = callRow("tp_hit");
    callRow("sl_hit");
    callRow(null);
    store.updateTail(store.createTail({ callId: a, tgId: 31, mode: "tail", strategyId: "s1", size: "1", notionalUsd: "1", feeBps: 0, createdAt: T }), { status: "filled" });
    store.updateTail(store.createTail({ callId: a, tgId: 32, mode: "fade", strategyId: "s2", size: "1", notionalUsd: "1", feeBps: 0, createdAt: T }), { status: "placed" });
    await bot.handleUpdate(dm("/record", CALLER) as never);
    expect(lastText()).toBe("Test\n3 calls · 1 open · 1 target · 1 stop\nHit rate 50.0% · average 0.17R\nFollowers in: 2\nTestnet.");
  });

  it("someone who runs no channel is pointed to /addchannel", async () => {
    await bot.handleUpdate(dm("/record", 4444) as never);
    expect(lastText()).toBe("No channel yet. Use /addchannel.");
  });

  it("escapes a channel title that contains HTML", async () => {
    store.registerChannel({ chatId: -777, title: "<b>Alpha</b> & co", kind: "channel", callerTgId: 4444, createdAt: T });
    await bot.handleUpdate(dm("/record", 4444) as never);
    expect(lastText()).toBe("&lt;b&gt;Alpha&lt;/b&gt; &amp; co\nNo calls with a result yet.\nTestnet.");
  });

  it("only works in a private chat and is listed in /help", async () => {
    await bot.handleUpdate(groupMsg("/record", CALLER) as never);
    expect(calls.length).toBe(0);
    await bot.handleUpdate(dm("/help", CALLER) as never);
    expect(lastText()).toContain("/record");
  });
});

describe("answering the parser's question (ask flow through the bot)", () => {
  it("an ambiguous channel post becomes a DM question with tappable answers", async () => {
    await bot.handleUpdate(channelPost("ETH 2480 tp 2560 sl 2420") as never);
    expect(sent()[0]?.payload).toMatchObject({ chat_id: CALLER, text: "Long or short on ETH-USD?" });
    expect(kbButtons(sent()[0]).map((b) => [b.text, b.callback_data])).toEqual([["Long", "a:1:0"], ["Short", "a:1:1"]]);
  });

  it("tapping an answer marks the question answered and sends the normal confirm card", async () => {
    await bot.handleUpdate(channelPost("ETH 2480 tp 2560 sl 2420") as never);
    calls.length = 0;
    await bot.handleUpdate(tap("a:1:0", CALLER, "Long or short on ETH-USD?") as never);
    expect(sent("editMessageText")[0]?.payload.text).toBe("Long or short on ETH-USD?\n\nLong");
    expect(lastText()).toContain("Post this call?");
    expect(kbButtons(sent()[0]).map((b) => b.callback_data)).toEqual(["p:1", "x:1"]);
    expect(store.getCall(1)).toMatchObject({ side: "long", status: "draft" });
  });

  it("the whole path ends in a posted card when the caller taps Post", async () => {
    await bot.handleUpdate(channelPost("ETH 2480 tp 2560 sl 2420") as never);
    await bot.handleUpdate(tap("a:1:0", CALLER) as never);
    calls.length = 0;
    await bot.handleUpdate(tap("p:1", CALLER) as never);
    expect(sent()[0]?.payload.chat_id).toBe(CHAT);
    expect(store.getCall(1)?.status).toBe("open");
  });

  it("a second tap on the same question is refused with a plain message", async () => {
    await bot.handleUpdate(channelPost("ETH 2480 tp 2560 sl 2420") as never);
    await bot.handleUpdate(tap("a:1:0", CALLER) as never);
    calls.length = 0;
    await bot.handleUpdate(tap("a:1:1", CALLER) as never);
    expect(sent("answerCallbackQuery")[0]?.payload).toMatchObject({ text: "This question has expired. Post the call again.", show_alert: true });
    expect(sent().length).toBe(0);
  });

  it("someone else tapping the caller's question is refused and does not use it up", async () => {
    await bot.handleUpdate(channelPost("ETH 2480 tp 2560 sl 2420") as never);
    calls.length = 0;
    await bot.handleUpdate(tap("a:1:0", 31337) as never);
    expect(sent("answerCallbackQuery")[0]?.payload.text).toBe("This question has expired. Post the call again.");
    await bot.handleUpdate(tap("a:1:0", CALLER) as never);
    expect(store.getCall(1)).toMatchObject({ side: "long" });
  });

  it("malformed answer data is ignored", async () => {
    await bot.handleUpdate(tap("a:1", CALLER) as never);
    await bot.handleUpdate(tap("a:x:0", CALLER) as never);
    expect(sent().length).toBe(0);
  });
});

describe("per-user rate limit", () => {
  it("answers 'Slow down' once, then stays quiet, and recovers after the window", async () => {
    setup({ rateLimit: { max: 3, windowMs: 60_000 } });
    for (let i = 0; i < 3; i++) await bot.handleUpdate(dm("/help", FOLLOWER) as never);
    expect(sent().length).toBe(3);
    await bot.handleUpdate(dm("/help", FOLLOWER) as never);
    expect(lastText()).toBe("Slow down. Try again in a minute.");
    await bot.handleUpdate(dm("/help", FOLLOWER) as never);
    await bot.handleUpdate(dm("/me", FOLLOWER) as never);
    expect(sent().length).toBe(4);
    nowMsForBot += 61_000;
    await bot.handleUpdate(dm("/help", FOLLOWER) as never);
    expect(lastText()).toContain("/addchannel");
  });

  it("limits button taps too, with an alert instead of a message", async () => {
    setup({ rateLimit: { max: 2, windowMs: 60_000 } });
    for (let i = 0; i < 2; i++) await bot.handleUpdate(tap("zzz", FOLLOWER) as never);
    await bot.handleUpdate(tap("zzz", FOLLOWER) as never);
    const answers = sent("answerCallbackQuery");
    expect(answers.at(-1)?.payload).toMatchObject({ text: "Slow down. Try again in a minute.", show_alert: true });
  });

  it("does not limit channel posts or other users", async () => {
    setup({ rateLimit: { max: 1, windowMs: 60_000 } });
    await bot.handleUpdate(dm("/help", FOLLOWER) as never);
    await bot.handleUpdate(dm("/help", FOLLOWER) as never);
    await bot.handleUpdate(dm("/help", 222) as never);
    expect(sent().filter((c) => c.payload.chat_id === 222).length).toBe(1);
    calls.length = 0;
    for (let i = 0; i < 3; i++) await bot.handleUpdate(channelPost(`ETH long ${2480 + i} tp ${2560 + i} sl ${2420 + i}`) as never);
    expect(sent().length).toBe(3);
  });

  it("a limit hit by one user never reaches the service", async () => {
    setup({ rateLimit: { max: 1, windowMs: 60_000 } });
    await bot.handleUpdate(dm("/addchannel", 777) as never);
    await bot.handleUpdate(dm("/addchannel", 777) as never);
    await bot.handleUpdate(dm("/addchannel", 777) as never);
    expect(sent().filter((c) => /TAIL-/.test(c.payload.text)).length).toBe(1);
  });
});

describe("help and fallback", () => {
  it("/help lists the commands", async () => {
    await bot.handleUpdate(dm("/help", FOLLOWER) as never);
    for (const c of ["/me", "/connect", "/link", "/risk", "/maxlev", "/maxnotional", "/revoke", "/addchannel", "/call"]) expect(lastText()).toContain(c);
  });

  it("a plain DM that is not a command gets a pointer, not silence", async () => {
    await bot.handleUpdate(dm("hello", FOLLOWER) as never);
    expect(lastText()).toBe("Tail reads calls from a channel. Tap Tail or Fade on a call card, or send /help.");
  });

  it("an unknown command gets the same pointer", async () => {
    await bot.handleUpdate(dm("/nope", FOLLOWER) as never);
    expect(lastText()).toBe("Tail reads calls from a channel. Tap Tail or Fade on a call card, or send /help.");
  });

  it("channel and group chatter still gets no reply", async () => {
    await bot.handleUpdate(channelPost("hello world") as never);
    await bot.handleUpdate(groupMsg("hello world", FOLLOWER) as never);
    expect(calls.length).toBe(0);
  });
});

describe("account commands", () => {
  it("/link by the owner stores the server-held key and never echoes it", async () => {
    await bot.handleUpdate(dm("/link", OWNER) as never);
    expect(lastText()).toMatch(/^Linked 0x0C3a…741d\./);
    expect(JSON.stringify(calls)).not.toContain(KEY);
    expect(store.getUser(OWNER)).toBeDefined();
  });

  it("/link by anyone else is refused", async () => {
    await bot.handleUpdate(dm("/link", 31337) as never);
    expect(lastText()).toBe("Not available.");
    expect(store.getUser(31337)).toBeUndefined();
  });

  it("/link with no owner configured tells the sender their own id, and links nothing", async () => {
    setup({ ownerTgId: undefined, linkKey: KEY });
    await bot.handleUpdate(dm("/link", 5150) as never);
    expect(lastText()).toBe("Owner is not set. Your Telegram ID is 5150. Set TAIL_OWNER_TG_ID to it and restart.");
    expect(store.getUser(5150)).toBeUndefined();
  });

  it("/link with no server key configured says so", async () => {
    setup({ ownerTgId: OWNER, linkKey: undefined });
    await bot.handleUpdate(dm("/link", OWNER) as never);
    expect(lastText()).toBe("No key is configured on this server.");
  });

  it("/me, /risk, /maxlev, /maxnotional and /revoke", async () => {
    linkFollower();
    await bot.handleUpdate(dm("/me", FOLLOWER) as never);
    expect(lastText()).toContain("Equity 19.92 USD");
    await bot.handleUpdate(dm("/risk 2", FOLLOWER) as never);
    expect(lastText()).toBe("Risk set to 2%.");
    await bot.handleUpdate(dm("/risk abc", FOLLOWER) as never);
    expect(lastText()).toContain("must be a number");
    await bot.handleUpdate(dm("/maxlev 7", FOLLOWER) as never);
    expect(lastText()).toBe("Max leverage set to 7x.");
    await bot.handleUpdate(dm("/maxnotional 100", FOLLOWER) as never);
    expect(lastText()).toBe("Max notional set to 100 USD.");
    expect(store.getUser(FOLLOWER)).toMatchObject({ riskPct: "2", maxLeverage: "7", maxNotionalUsd: "100" });
    await bot.handleUpdate(dm("/revoke", FOLLOWER) as never);
    expect(lastText()).toContain("Removed your key");
    expect(store.getUser(FOLLOWER)).toBeUndefined();
  });

  it("/risk with no value explains usage", async () => {
    linkFollower();
    await bot.handleUpdate(dm("/risk", FOLLOWER) as never);
    expect(lastText()).toBe("Usage: /risk 1");
  });
});

describe("earnings and the public page", () => {
  const PUBLIC = "https://tail.test";
  const call = (over: Record<string, unknown> = {}) => {
    const id = store.createDraftCall({ chatId: CHAT, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: T, ...over } as never);
    store.openCall(id, 50 + id);
    return id;
  };
  const filled = (callId: number, tg: number, feeBps: number) =>
    store.updateTail(store.createTail({ callId, tgId: tg, mode: "tail", strategyId: `s${tg}`, size: "0.009", notionalUsd: "22", feeBps, createdAt: T }), { status: "filled", fillPrice: "2480" });

  beforeEach(() => setup({ ownerTgId: OWNER, linkKey: KEY, publicUrl: PUBLIC }));

  it("/earnings shows the estimate with its basis, the counts, and that payout is not live", async () => {
    const id = call();
    filled(id, 31, 10);
    filled(id, 32, 10);
    filled(id, 33, 0);
    await bot.handleUpdate(dm("/earnings", CALLER) as never);
    expect(lastText()).toBe([
      "Test",
      "Estimated builder fee: 0.04464 USD",
      "Entry fills only: 44.64 USD at 10 bps, 2 tails. 1 tail used a personal wallet and earns nothing.",
      "Payout to callers is not live.",
    ].join("\n"));
  });

  it("/earnings says plainly when nothing has filled", async () => {
    call();
    await bot.handleUpdate(dm("/earnings", CALLER) as never);
    expect(lastText()).toBe("Test\nNo filled tails yet, so no builder fee.\nPayout to callers is not live.");
  });

  it("/earnings points a non-caller to /addchannel", async () => {
    await bot.handleUpdate(dm("/earnings", 4444) as never);
    expect(lastText()).toBe("No channel yet. Use /addchannel.");
  });

  it("/page says the page is private and how to publish", async () => {
    await bot.handleUpdate(dm("/page", CALLER) as never);
    expect(lastText()).toBe("Test\nThe public page is off. /publish turns it on.");
  });

  it("/publish makes the page public and replies with its link", async () => {
    await bot.handleUpdate(dm("/publish", CALLER) as never);
    const slug = store.getChannel(CHAT)!.slug as string;
    expect(lastText()).toBe(`Test\n${PUBLIC}/c/${slug}\nAnyone with the link sees your record and earnings estimate. Not your followers. /unpublish turns it off.`);
    expect(store.channelBySlug(slug)).toBeDefined();
  });

  it("/page then shows the link, and /unpublish hides it", async () => {
    await bot.handleUpdate(dm("/publish", CALLER) as never);
    const slug = store.getChannel(CHAT)!.slug as string;
    await bot.handleUpdate(dm("/page", CALLER) as never);
    expect(lastText()).toContain(`${PUBLIC}/c/${slug}`);
    await bot.handleUpdate(dm("/unpublish", CALLER) as never);
    expect(lastText()).toBe("Test\nThe public page is off.");
    expect(store.channelBySlug(slug)).toBeUndefined();
  });

  it("with several channels, a title picks one and no title lists them", async () => {
    store.registerChannel({ chatId: -888, title: "Second", kind: "group", callerTgId: CALLER, createdAt: T });
    await bot.handleUpdate(dm("/publish", CALLER) as never);
    expect(lastText()).toBe("You have several channels. Send /publish with a title: Test, Second");
    await bot.handleUpdate(dm("/publish second", CALLER) as never);
    expect(lastText()).toContain("Second\nhttps://tail.test/c/");
    expect(store.getChannel(-888)!.isPublic).toBe(true);
    expect(store.getChannel(CHAT)!.isPublic).toBe(false);
  });

  it("only the channel's caller can publish it", async () => {
    await bot.handleUpdate(dm("/publish", 4444) as never);
    expect(lastText()).toBe("No channel yet. Use /addchannel.");
    expect(store.getChannel(CHAT)!.isPublic).toBe(false);
  });

  it("without a public URL the page commands say pages are not set up", async () => {
    setup({ ownerTgId: OWNER, linkKey: KEY });
    await bot.handleUpdate(dm("/publish", CALLER) as never);
    expect(lastText()).toBe("Public pages are not set up on this server.");
    expect(store.getChannel(CHAT)!.isPublic).toBe(false);
  });

  it("works only in a private chat and is listed in /help", async () => {
    await bot.handleUpdate(groupMsg("/publish", CALLER) as never);
    expect(calls.length).toBe(0);
    await bot.handleUpdate(dm("/help", CALLER) as never);
    for (const c of ["/earnings", "/publish", "/unpublish", "/page"]) expect(lastText()).toContain(c);
  });
});
