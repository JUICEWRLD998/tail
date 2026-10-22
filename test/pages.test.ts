import { beforeEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../src/db/store.js";
import { createPages } from "../src/web/pages.js";

const T = "2026-10-21T12:00:00.000Z";
let store: Store;

function seed() {
  store.registerChannel({ chatId: -1001, title: "Alpha Calls", kind: "channel", callerTgId: 9001, createdAt: T });
  const mk = (over = {}) => store.createDraftCall({
    chatId: -1001, messageId: 1, rawText: "ETH long 2480 tp 2560 sl 2420 PRIVATE-RAW", symbol: "ETH-USD", side: "long", entryKind: "limit",
    entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: T, ...over,
  });
  const a = mk();
  store.openCall(a, 10);
  store.markEntered(a, "2480.00", T);
  store.finishCall(a, { status: "tp_hit", resultPrice: "2561.00", closedAt: T });
  const b = mk({ symbol: "BTC-USD", entry: "60000.00", tp: "61000.00", sl: "59000.00" });
  store.openCall(b, 11);
  store.markEntered(b, "60000.00", T);
  store.finishCall(b, { status: "sl_hit", resultPrice: "58990.00", closedAt: T });
  const c = mk();
  store.openCall(c, 12);
  const tail = (callId: number, tgId: number, over = {}) => {
    const id = store.createTail({ callId, tgId, mode: "tail", strategyId: `s${callId}${tgId}`, size: "0.009", notionalUsd: "22", feeBps: 10, createdAt: T });
    store.updateTail(id, { status: "filled", fillPrice: "2480", ...over });
  };
  tail(a, 5001);
  tail(a, 5002);
  tail(b, 5001, { fillPrice: "60000" });
  return { a, b, c };
}

beforeEach(() => { store = openStore(":memory:"); });

describe("channel page data", () => {
  it("is undefined for a private channel, an unknown slug and a malformed slug alike", () => {
    seed();
    const pages = createPages(store);
    expect(pages.channel("abcdefghij")).toBeUndefined();
    store.publishChannel(-1001);
    expect(pages.channel("abcdefghij")).toBeUndefined();
    expect(pages.channel("x")).toBeUndefined();
    store.unpublishChannel(-1001);
  });

  it("shows the record and the earnings estimate for a published channel", () => {
    seed();
    const slug = store.publishChannel(-1001);
    const p = createPages(store).channel(slug)!;
    expect(p.title).toBe("Alpha Calls");
    expect(p.network).toBe("testnet");
    expect(p.record).toMatchObject({ calls: 3, open: 1, tpHit: 1, slHit: 1, decided: 2, hitRatePct: "50.0", followers: 2 });
    expect(p.earnings).toMatchObject({ basis: expect.stringContaining("estimate"), filled: 3, paying: 3, withoutRate: 0 });
    expect(Number(p.earnings.fee)).toBeCloseTo(0.009 * 2480 * 10 / 10000 * 2 + 0.009 * 60000 * 10 / 10000, 6);
    expect(p.payout).toBe("not live");
  });

  it("lists calls newest first with per-call result, followers and fee, and no private fields", () => {
    const { a } = seed();
    const slug = store.publishChannel(-1001);
    const p = createPages(store).channel(slug)!;
    expect(p.calls.map((c) => c.symbol)).toEqual(["ETH-USD", "BTC-USD", "ETH-USD"]);
    const first = p.calls.find((c) => c.id === a)!;
    expect(first).toMatchObject({ status: "tp_hit", followers: 2, tails: 2, tailed: 2, faded: 0 });
    expect(first.fee).toBe("0.04464");
    const json = JSON.stringify(p);
    for (const secret of ["9001", "5001", "5002", "-1001", "PRIVATE-RAW", "s1", "strategy"]) expect(json).not.toContain(secret);
  });

  it("when nothing filled, the fee is zero and the page says there is no result yet", () => {
    store.registerChannel({ chatId: -7, title: "Empty", kind: "group", callerTgId: 1, createdAt: T });
    const slug = store.publishChannel(-7);
    const p = createPages(store).channel(slug)!;
    expect(p.record.calls).toBe(0);
    expect(p.earnings.fee).toBe("0");
    expect(p.calls).toEqual([]);
  });

  it("caps the call list at 50 and keeps the record over all calls", () => {
    store.registerChannel({ chatId: -8, title: "Busy", kind: "channel", callerTgId: 1, createdAt: T });
    for (let i = 0; i < 60; i++) {
      const id = store.createDraftCall({ chatId: -8, messageId: i, rawText: `r${i}`, symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: null, createdAt: T });
      store.openCall(id, i);
    }
    const p = createPages(store).channel(store.publishChannel(-8))!;
    expect(p.calls).toHaveLength(50);
    expect(p.record.calls).toBe(60);
  });
});

describe("site data", () => {
  it("reports measured totals and labels them as test activity", () => {
    seed();
    const s = createPages(store, { botUsername: "lidevbot" }).site();
    expect(s).toMatchObject({ network: "testnet", channels: 1, calls: 3, tailsFilled: 3, bot: "lidevbot" });
    expect(s.note).toMatch(/test activity/i);
  });

  it("is all zeros on an empty database, not hidden", () => {
    expect(createPages(store).site()).toMatchObject({ channels: 0, calls: 0, tailsFilled: 0, bot: null });
  });
});

describe("featured call (the replay on the home page)", () => {
  it("is null on an empty database: nothing is staged", () => {
    expect(createPages(store).site().featured).toBeNull();
  });

  it("is the newest call that real followers took, not merely the newest call", () => {
    const { b, c } = seed();
    // seed(): a has two filled tails, b (newer) has one, c (newest) has none. b wins.
    const f = createPages(store).site().featured!;
    expect(f.id).toBe(b);
    expect(f.id).not.toBe(c);
    expect(f).toMatchObject({ symbol: "BTC-USD", side: "long", entry: "60000.00", status: "sl_hit", resultR: "-1" });
  });

  it("lists tails as mode, status and offset only: no ids, no sizes, no people", () => {
    seed();
    const f = createPages(store).site().featured!;
    expect(f.tails.length).toBeGreaterThan(0);
    for (const t of f.tails) expect(Object.keys(t).sort()).toEqual(["atMs", "mode", "status"]);
    const json = JSON.stringify(f);
    for (const secret of ["5001", "9001", "-1001", "PRIVATE-RAW", "0.009"]) expect(json).not.toContain(secret);
  });

  it("leaves out quotes that never became orders", () => {
    store.registerChannel({ chatId: -9, title: "Q", kind: "channel", callerTgId: 1, createdAt: T });
    const id = store.createDraftCall({ chatId: -9, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "short", entryKind: "market", entry: null, tp: "2300.00", sl: "2400.00", leverageHint: null, createdAt: T });
    store.openCall(id, 1);
    store.createTail({ callId: id, tgId: 7, mode: "fade", strategyId: "q", size: "1", notionalUsd: "1", feeBps: 0, createdAt: "2026-10-21T12:00:05.000Z" });
    const t2 = store.createTail({ callId: id, tgId: 8, mode: "tail", strategyId: "r", size: "1", notionalUsd: "1", feeBps: 0, createdAt: "2026-10-21T12:00:09.500Z" });
    store.updateTail(t2, { status: "filled" });
    const f = createPages(store).site().featured!;
    expect(f.tails).toEqual([{ mode: "tail", status: "filled", atMs: 9500 }]);
    expect(f.entry).toBeNull();
  });

  it("falls back to the newest posted call when no one has taken any, with no tails", () => {
    store.registerChannel({ chatId: -9, title: "Q", kind: "channel", callerTgId: 1, createdAt: T });
    const id = store.createDraftCall({ chatId: -9, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: 5, createdAt: T });
    store.openCall(id, 1);
    expect(createPages(store).site().featured).toMatchObject({ id, tails: [], status: "open", leverageHint: 5 });
  });
});
