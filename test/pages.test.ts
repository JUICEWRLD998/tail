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
    expect(first).toMatchObject({ status: "tp_hit", followers: 2, tails: 2 });
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
    const s = createPages(store).site();
    expect(s).toMatchObject({ network: "testnet", channels: 1, calls: 3, tailsFilled: 3 });
    expect(s.note).toMatch(/test activity/i);
  });

  it("is all zeros on an empty database, not hidden", () => {
    expect(createPages(store).site()).toMatchObject({ channels: 0, calls: 0, tailsFilled: 0 });
  });
});
