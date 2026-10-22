import { describe, expect, it } from "vitest";
import { openStore, type Store } from "../src/db/store.js";

const T0 = "2026-10-21T12:00:00.000Z";
const at = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();

function fresh(): Store {
  return openStore(":memory:");
}

const user = {
  tgId: 111, chain: "ethereum", address: "0xabc", strikeAccountId: "acc-1", apiPub: "pub", apiPrivEnc: "v1:a:b:c",
  builderCode: null as string | null, linkedAt: T0,
};

const callDraft = {
  chatId: -1001, messageId: 7, rawText: "ETH long 2480 tp 2560 sl 2420", symbol: "ETH-USD", side: "long" as const,
  entryKind: "limit" as const, entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: 5, createdAt: T0,
};

describe("users", () => {
  it("links a user with default settings and reads it back", () => {
    const s = fresh();
    s.linkUser(user);
    expect(s.getUser(111)).toMatchObject({ tgId: 111, address: "0xabc", riskPct: "1", maxLeverage: "5", maxNotionalUsd: "500", apiPrivEnc: "v1:a:b:c" });
  });

  it("returns undefined for an unknown user", () => {
    expect(fresh().getUser(1)).toBeUndefined();
  });

  it("re-linking replaces the key but keeps the user's settings", () => {
    const s = fresh();
    s.linkUser(user);
    s.setSetting(111, "riskPct", "2");
    s.linkUser({ ...user, apiPub: "pub2", apiPrivEnc: "v1:x:y:z" });
    expect(s.getUser(111)).toMatchObject({ apiPub: "pub2", apiPrivEnc: "v1:x:y:z", riskPct: "2" });
  });

  it("revoke wipes the stored key and hides the user", () => {
    const s = fresh();
    s.linkUser(user);
    s.revokeUser(111, at(5));
    expect(s.getUser(111)).toBeUndefined();
    expect(s.rawUserRow(111)).toMatchObject({ api_priv_enc: null, revoked_at: at(5) });
  });

  it("only known settings can be changed", () => {
    const s = fresh();
    s.linkUser(user);
    s.setSetting(111, "maxLeverage", "3");
    expect(s.getUser(111)?.maxLeverage).toBe("3");
    expect(() => s.setSetting(111, "apiPrivEnc" as never, "x")).toThrow(/setting/);
  });
});

describe("channel registration codes", () => {
  it("is single use", () => {
    const s = fresh();
    const code = s.createChannelCode(111, T0);
    expect(code).toMatch(/^TAIL-[A-Z0-9]{6}$/);
    expect(s.consumeChannelCode(code, at(1))).toBe(111);
    expect(s.consumeChannelCode(code, at(2))).toBeUndefined();
  });

  it("expires after 10 minutes", () => {
    const s = fresh();
    const code = s.createChannelCode(111, T0);
    expect(s.consumeChannelCode(code, at(11))).toBeUndefined();
  });

  it("is case-insensitive and ignores unknown codes", () => {
    const s = fresh();
    const code = s.createChannelCode(111, T0);
    expect(s.consumeChannelCode("TAIL-NOPE00", at(1))).toBeUndefined();
    expect(s.consumeChannelCode(code.toLowerCase(), at(1))).toBe(111);
  });

  it("codes are unique across many draws", () => {
    const s = fresh();
    const set = new Set(Array.from({ length: 200 }, () => s.createChannelCode(1, T0)));
    expect(set.size).toBe(200);
  });
});

describe("channels", () => {
  it("registers and reads a channel", () => {
    const s = fresh();
    s.registerChannel({ chatId: -1001, title: "Test", kind: "channel", callerTgId: 111, createdAt: T0 });
    expect(s.getChannel(-1001)).toMatchObject({ title: "Test", callerTgId: 111, kind: "channel" });
    expect(s.getChannel(-5)).toBeUndefined();
  });

  it("re-registering moves the channel to the new caller", () => {
    const s = fresh();
    s.registerChannel({ chatId: -1001, title: "Test", kind: "channel", callerTgId: 111, createdAt: T0 });
    s.registerChannel({ chatId: -1001, title: "Test 2", kind: "channel", callerTgId: 222, createdAt: at(1) });
    expect(s.getChannel(-1001)).toMatchObject({ callerTgId: 222, title: "Test 2" });
  });
});

describe("channelsOf", () => {
  it("lists the channels a caller registered", () => {
    const s = fresh();
    s.registerChannel({ chatId: -1, title: "A", kind: "channel", callerTgId: 111, createdAt: T0 });
    s.registerChannel({ chatId: -2, title: "B", kind: "group", callerTgId: 111, createdAt: T0 });
    s.registerChannel({ chatId: -3, title: "C", kind: "group", callerTgId: 222, createdAt: T0 });
    expect(s.channelsOf(111).map((c) => c.chatId).sort((a, b) => a - b)).toEqual([-2, -1]);
    expect(s.channelsOf(999)).toEqual([]);
  });
});

describe("calls", () => {
  it("creates a draft, opens it with a card, and reads it back", () => {
    const s = fresh();
    const id = s.createDraftCall(callDraft);
    expect(s.getCall(id)).toMatchObject({ status: "draft", symbol: "ETH-USD", side: "long", entry: "2480.00", cardMessageId: null });
    s.openCall(id, 99);
    expect(s.getCall(id)).toMatchObject({ status: "open", cardMessageId: 99 });
  });

  it("a cancelled draft cannot be opened", () => {
    const s = fresh();
    const id = s.createDraftCall(callDraft);
    s.cancelDraft(id);
    expect(() => s.openCall(id, 1)).toThrow(/draft/);
  });

  it("stores a market call with a null entry", () => {
    const s = fresh();
    const id = s.createDraftCall({ ...callDraft, entryKind: "market", entry: null });
    expect(s.getCall(id)).toMatchObject({ entryKind: "market", entry: null });
  });
});

describe("tails", () => {
  const tail = (callId: number, over = {}) => ({
    callId, tgId: 111, mode: "tail" as const, strategyId: "s1", size: "0.009", notionalUsd: "22.32", feeBps: 0, createdAt: T0, ...over,
  });

  it("creates a quote and updates it to placed", () => {
    const s = fresh();
    const call = s.createDraftCall(callDraft);
    const id = s.createTail(tail(call));
    expect(s.getTail(id)).toMatchObject({ status: "quoted", mode: "tail" });
    s.updateTail(id, { status: "placed", orderId: "243140841", primaryClientOrderId: "c1" });
    expect(s.getTail(id)).toMatchObject({ status: "placed", orderId: "243140841" });
  });

  it("blocks a second live tail by the same user on the same call", () => {
    const s = fresh();
    const call = s.createDraftCall(callDraft);
    const a = s.createTail(tail(call));
    s.updateTail(a, { status: "placed" });
    const b = s.createTail(tail(call, { mode: "fade", strategyId: "s2" }));
    expect(() => s.updateTail(b, { status: "placed" })).toThrow(/UNIQUE/);
  });

  it("a rejected tail does not block another attempt", () => {
    const s = fresh();
    const call = s.createDraftCall(callDraft);
    const a = s.createTail(tail(call));
    s.updateTail(a, { status: "rejected", error: "order_price_out_of_limit" });
    const b = s.createTail(tail(call, { strategyId: "s2" }));
    s.updateTail(b, { status: "placed" });
    expect(s.findLiveTail(call, 111)?.id).toBe(b);
  });

  it("claimTail moves a quote to placed exactly once", () => {
    const s = fresh();
    const call = s.createDraftCall(callDraft);
    const id = s.createTail(tail(call));
    expect(s.claimTail(id)).toBe(true);
    expect(s.claimTail(id)).toBe(false);
    expect(s.getTail(id)?.status).toBe("placed");
  });

  it("claimTail refuses a quote whose call already has a live tail by that user", () => {
    const s = fresh();
    const call = s.createDraftCall(callDraft);
    s.updateTail(s.createTail(tail(call)), { status: "placed" });
    const second = s.createTail(tail(call, { strategyId: "s2" }));
    expect(s.claimTail(second)).toBe(false);
  });

  it("counts tailed and faded, ignoring quotes and rejections", () => {
    const s = fresh();
    const call = s.createDraftCall(callDraft);
    const mk = (tg: number, mode: "tail" | "fade", status: "placed" | "filled" | "rejected" | "quoted") => {
      const id = s.createTail(tail(call, { tgId: tg, mode }));
      s.updateTail(id, { status });
    };
    mk(1, "tail", "placed");
    mk(2, "tail", "filled");
    mk(3, "fade", "placed");
    mk(4, "tail", "rejected");
    mk(5, "fade", "quoted");
    expect(s.tailCounts(call)).toEqual({ tailed: 2, faded: 1 });
  });

  it("counts a user's live tails across calls", () => {
    const s = fresh();
    const c1 = s.createDraftCall(callDraft);
    const c2 = s.createDraftCall(callDraft);
    for (const c of [c1, c2]) s.updateTail(s.createTail(tail(c)), { status: "placed" });
    expect(s.countLiveTails(111)).toBe(2);
  });
});

describe("misses", () => {
  it("counts calls for unlisted markets per chat", () => {
    const s = fresh();
    s.recordMiss("DOGE", -1001);
    s.recordMiss("DOGE", -1001);
    s.recordMiss("DOGE", -1002);
    expect(s.missCount("DOGE", -1001)).toBe(2);
    expect(s.missCount("DOGE", -1002)).toBe(1);
    expect(s.missCount("PEPE", -1001)).toBe(0);
  });
});

describe("queries for the live-state jobs", () => {
  const draft = (over = {}) => ({
    chatId: -1001, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long" as const, entryKind: "limit" as const, entry: "2480.00",
    tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: T0, ...over,
  });
  const open = (s: Store, over = {}) => {
    const id = s.createDraftCall(draft(over));
    s.openCall(id, 50 + id);
    return id;
  };

  it("openCalls returns only open calls", () => {
    const s = fresh();
    const a = open(s);
    s.createDraftCall(draft()); // stays a draft
    const c = open(s);
    s.finishCall(c, { status: "tp_hit", resultPrice: "2561.00", closedAt: T0 });
    expect(s.openCalls().map((x) => x.id)).toEqual([a]);
  });

  it("markEntered records the entry once", () => {
    const s = fresh();
    const id = open(s);
    expect(s.markEntered(id, "2480.00", at(1))).toBe(true);
    expect(s.markEntered(id, "2470.00", at(2))).toBe(false);
    expect(s.getCall(id)).toMatchObject({ enteredAt: at(1), enteredPrice: "2480.00" });
  });

  it("finishCall closes an open call exactly once (the first caller wins)", () => {
    const s = fresh();
    const id = open(s);
    expect(s.finishCall(id, { status: "sl_hit", resultPrice: "2419.00", closedAt: at(3) })).toBe(true);
    expect(s.finishCall(id, { status: "tp_hit", resultPrice: "2561.00", closedAt: at(4) })).toBe(false);
    expect(s.getCall(id)).toMatchObject({ status: "sl_hit", resultPrice: "2419.00", closedAt: at(3) });
  });

  it("setReceipt stores the receipt message id", () => {
    const s = fresh();
    const id = open(s);
    s.setReceipt(id, 777);
    expect(s.getCall(id)?.receiptMessageId).toBe(777);
  });

  it("activeTails returns placed and filled tails, not rejected, cancelled or closed ones", () => {
    const s = fresh();
    const call = open(s);
    const mk = (tg: number, status: "placed" | "filled" | "rejected" | "cancelled" | "closed" | "quoted") => {
      const id = s.createTail({ callId: call, tgId: tg, mode: "tail", strategyId: `s${tg}`, size: "1", notionalUsd: "1", feeBps: 0, createdAt: T0 });
      s.updateTail(id, { status });
      return id;
    };
    const placed = mk(1, "placed");
    const filled = mk(2, "filled");
    mk(3, "rejected");
    mk(4, "cancelled");
    mk(5, "closed");
    mk(6, "quoted");
    expect(s.activeTails().map((t) => t.id).sort()).toEqual([placed, filled].sort());
  });

  it("callsOfChat lists decided and open calls for the record, never drafts or cancelled", () => {
    const s = fresh();
    open(s);
    s.createDraftCall(draft());
    const dropped = s.createDraftCall(draft());
    s.cancelDraft(dropped);
    open(s, { chatId: -2002 });
    expect(s.callsOfChat(-1001).length).toBe(1);
  });

  it("followersIn counts distinct followers with a live tail on the chat's calls", () => {
    const s = fresh();
    const c1 = open(s);
    const c2 = open(s);
    const live = (call: number, tg: number, status: "placed" | "filled" | "rejected") => s.updateTail(s.createTail({ callId: call, tgId: tg, mode: "tail", strategyId: `${call}-${tg}`, size: "1", notionalUsd: "1", feeBps: 0, createdAt: T0 }), { status });
    live(c1, 1, "placed");
    live(c2, 1, "filled"); // same follower again: counted once
    live(c1, 2, "placed");
    live(c1, 3, "rejected"); // not live
    expect(s.followersIn(-1001)).toBe(2);
  });
});

describe("receipts that failed to post", () => {
  it("callsMissingReceipt lists finished calls with a card but no receipt, newest window only", () => {
    const s = fresh();
    const mk = () => {
      const id = s.createDraftCall({ chatId: -1001, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: T0 });
      s.openCall(id, 40 + id);
      return id;
    };
    const a = mk(), b = mk(), c = mk(), d = mk();
    s.finishCall(a, { status: "tp_hit", resultPrice: "2561.00", closedAt: at(1) });
    s.finishCall(b, { status: "sl_hit", resultPrice: "2419.00", closedAt: at(1) });
    s.setReceipt(b, 9); // already has one
    s.finishCall(c, { status: "expired", resultPrice: null, closedAt: at(-60 * 30) }); // closed long ago
    expect(s.callsMissingReceipt(at(5), 24 * 60 * 60_000, 30_000).map((x) => x.id)).toEqual([a]);
    expect(s.callsMissingReceipt(at(1) , 24 * 60 * 60_000, 30_000).map((x) => x.id)).toEqual([]); // inside the grace period
    expect(d).toBeGreaterThan(0); // still open: never listed
  });
});


describe("pending questions (asks)", () => {
  const ask = (over = {}) => ({ tgId: 111, chatId: -1001, messageId: 9, rawText: "ADA 0.62 tp 0.70 sl 0.58", field: "side", options: ["Long", "Short"], createdAt: T0, ...over });

  it("is returned once, to the same caller, within 15 minutes", () => {
    const s = fresh();
    const id = s.createAsk(ask());
    expect(s.takeAsk(id, 222, at(1))).toBeUndefined(); // someone else
    expect(s.takeAsk(id, 111, at(1))).toEqual({ chatId: -1001, messageId: 9, rawText: "ADA 0.62 tp 0.70 sl 0.58", field: "side", options: ["Long", "Short"] });
    expect(s.takeAsk(id, 111, at(2))).toBeUndefined(); // single use
  });

  it("a wrong-user attempt does not burn the question", () => {
    const s = fresh();
    const id = s.createAsk(ask());
    s.takeAsk(id, 222, at(1));
    expect(s.takeAsk(id, 111, at(2))).toBeDefined();
  });

  it("expires after 15 minutes", () => {
    const s = fresh();
    const id = s.createAsk(ask());
    expect(s.takeAsk(id, 111, at(16))).toBeUndefined();
  });

  it("peekAsk reads a question without using it", () => {
    const s = fresh();
    const id = s.createAsk(ask());
    expect(s.peekAsk(id, 111, at(1))?.options).toEqual(["Long", "Short"]);
    expect(s.peekAsk(id, 222, at(1))).toBeUndefined();
    expect(s.takeAsk(id, 111, at(2))).toBeDefined();
    expect(s.peekAsk(id, 111, at(3))).toBeUndefined();
  });

  it("keeps the original text and options exactly, including newlines and unicode", () => {
    const s = fresh();
    const raw = "ETH long\nEntry Targets:\n1) 2480\n2) 2470 🔴";
    const id = s.createAsk(ask({ rawText: raw, options: ["2480", "2470"] }));
    expect(s.takeAsk(id, 111, at(1))?.rawText).toBe(raw);
  });
});
