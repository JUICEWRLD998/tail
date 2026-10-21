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
