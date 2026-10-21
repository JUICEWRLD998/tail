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

function setup(opts: { ownerTgId?: number | undefined; linkKey?: string | undefined; equity?: string } = {}) {
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
    token: "123:abc", service, store, ownerTgId: opts.ownerTgId, linkKey: opts.linkKey, now: () => T,
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
    expect(card.payload.text).toBe("<b>ETH-USD · LONG</b>\nEntry 2480.00 · TP 2560.00 · SL 2420.00 · R:R 1.33\nTailed 0 · Faded 0");
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
    expect(lastText()).toContain("Size 0.009 · notional 22.32 USD");
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
