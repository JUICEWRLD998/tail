import { beforeEach, describe, expect, it } from "vitest";
import { runOutcomes, type OutcomeDeps } from "../src/jobs/outcomes.js";
import { openStore, type Store } from "../src/db/store.js";

const T0 = Date.parse("2026-10-21T12:00:00.000Z");
const H = 3_600_000;
let clock = T0;
let store: Store;
let marks: Record<string, string | Error>;
let posts: { chatId: number; text: string; replyTo: number | null }[];
let edits: { chatId: number; messageId: number; text: string }[];
let failReply: boolean;
let markCalls: string[];

const deps = (): OutcomeDeps => ({
  store,
  now: () => clock,
  markPrice: async (symbol) => {
    markCalls.push(symbol);
    const m = marks[symbol];
    if (m instanceof Error) throw m;
    if (m === undefined) throw new Error("no price");
    return m;
  },
  reply: async (chatId, text, replyTo) => {
    if (failReply) throw new Error("telegram down");
    posts.push({ chatId, text, replyTo });
    return 900 + posts.length;
  },
  editCard: async (chatId, messageId, text) => void edits.push({ chatId, messageId, text }),
  log: () => {},
});

function openCall(over: Record<string, unknown> = {}): number {
  const id = store.createDraftCall({
    chatId: -1001, messageId: 1, rawText: "x", symbol: "ETH-USD", side: "long", entryKind: "limit", entry: "2480.00", tp: "2560.00", sl: "2420.00",
    leverageHint: null, createdAt: new Date(T0).toISOString(), ...over,
  } as never);
  store.openCall(id, 70 + id);
  return id;
}

beforeEach(() => {
  clock = T0 + H;
  store = openStore(":memory:");
  marks = { "ETH-USD": "2500.00" };
  posts = [];
  edits = [];
  failReply = false;
  markCalls = [];
});

describe("runOutcomes", () => {
  it("does nothing for a call that is still waiting for its entry", async () => {
    const id = openCall();
    expect(await runOutcomes(deps())).toEqual({ evaluated: 1, finished: 0 });
    expect(store.getCall(id)).toMatchObject({ status: "open", enteredAt: null });
    expect(posts.length + edits.length).toBe(0);
  });

  it("records the entry when the price touches it, and posts nothing yet", async () => {
    const id = openCall();
    marks["ETH-USD"] = "2479.00";
    await runOutcomes(deps());
    expect(store.getCall(id)).toMatchObject({ status: "open", enteredPrice: "2480.00", enteredAt: new Date(clock).toISOString() });
    expect(posts.length).toBe(0);
  });

  it("a target hit finishes the call, replies to the card with the receipt, and edits the card with the result", async () => {
    const id = openCall();
    marks["ETH-USD"] = "2479.00";
    await runOutcomes(deps());
    marks["ETH-USD"] = "2561.10";
    clock += H;
    expect(await runOutcomes(deps())).toEqual({ evaluated: 1, finished: 1 });
    expect(store.getCall(id)).toMatchObject({ status: "tp_hit", resultPrice: "2561.10", closedAt: new Date(clock).toISOString(), receiptMessageId: 901 });
    expect(posts).toEqual([
      { chatId: -1001, replyTo: 70 + id, text: "<b>ETH-USD · LONG · take profit hit</b>\n+1.33R · entry 2480.00 · TP 2560.00 · mark 2561.10" },
    ]);
    expect(edits[0]).toMatchObject({ chatId: -1001, messageId: 70 + id });
    expect(edits[0]?.text).toBe("<b>ETH-USD · LONG</b>\nEntry 2480.00 · TP 2560.00 · SL 2420.00 · R:R 1.33\nTailed 0 · Faded 0\nResult: take profit hit (+1.33R)");
  });

  it("a stop hit says stopped out", async () => {
    openCall();
    marks["ETH-USD"] = "2479.00";
    await runOutcomes(deps());
    marks["ETH-USD"] = "2419.00";
    await runOutcomes(deps());
    expect(posts[0]?.text).toBe("<b>ETH-USD · LONG · stopped out</b>\n-1R · entry 2480.00 · SL 2420.00 · mark 2419.00");
  });

  it("a gap through the entry to the stop is recorded as entered and stopped in one tick", async () => {
    const id = openCall();
    marks["ETH-USD"] = "2410.00";
    await runOutcomes(deps());
    expect(store.getCall(id)).toMatchObject({ status: "sl_hit", enteredPrice: "2480.00" });
    expect(posts[0]?.text).toContain("stopped out");
  });

  it("a market call enters at the first price it sees", async () => {
    const id = openCall({ entryKind: "market", entry: null });
    marks["ETH-USD"] = "2495.00";
    await runOutcomes(deps());
    expect(store.getCall(id)).toMatchObject({ status: "open", enteredPrice: "2495.00" });
  });

  it("expires a call after 72 hours and says it never entered", async () => {
    const id = openCall();
    clock = T0 + 73 * H;
    await runOutcomes(deps());
    expect(store.getCall(id)?.status).toBe("expired");
    expect(posts[0]?.text).toBe("<b>ETH-USD · LONG · never entered</b>\nThe price did not reach 2480.00 in 72 hours.");
    expect(edits[0]?.text).toMatch(/Result: expired$/);
  });

  it("is idempotent: a second run posts no second receipt", async () => {
    openCall();
    marks["ETH-USD"] = "2479.00";
    await runOutcomes(deps());
    marks["ETH-USD"] = "2561.00";
    await runOutcomes(deps());
    await runOutcomes(deps());
    await runOutcomes(deps());
    expect(posts.length).toBe(1);
  });

  it("two overlapping runs finish a call once", async () => {
    openCall();
    marks["ETH-USD"] = "2479.00";
    await runOutcomes(deps());
    marks["ETH-USD"] = "2561.00";
    await Promise.all([runOutcomes(deps()), runOutcomes(deps())]);
    expect(posts.length).toBe(1);
  });

  it("asks for each symbol's price once per run, however many calls use it", async () => {
    openCall();
    openCall();
    openCall({ symbol: "SOL-USD" });
    marks["SOL-USD"] = "150.00";
    await runOutcomes(deps());
    expect(markCalls.sort()).toEqual(["ETH-USD", "SOL-USD"]);
  });

  it("a symbol whose price fails does not stop the others or throw", async () => {
    const bad = openCall({ symbol: "SOL-USD", entry: "150.00", tp: "165.00", sl: "142.00" });
    const good = openCall();
    marks["SOL-USD"] = new Error("503");
    marks["ETH-USD"] = "2479.00";
    expect(await runOutcomes(deps())).toEqual({ evaluated: 1, finished: 0 });
    expect(store.getCall(good)?.enteredPrice).toBe("2480.00");
    expect(store.getCall(bad)?.enteredPrice).toBeNull();
  });

  it("an unparseable price is skipped, not fatal", async () => {
    const id = openCall();
    marks["ETH-USD"] = "not-a-number";
    await expect(runOutcomes(deps())).resolves.toEqual({ evaluated: 0, finished: 0 });
    expect(store.getCall(id)?.status).toBe("open");
  });

  it("if the receipt cannot be posted the call still finishes, and the next run retries only the receipt", async () => {
    const id = openCall();
    marks["ETH-USD"] = "2479.00";
    await runOutcomes(deps());
    marks["ETH-USD"] = "2561.00";
    failReply = true;
    await runOutcomes(deps());
    expect(store.getCall(id)).toMatchObject({ status: "tp_hit", receiptMessageId: null });
    failReply = false;
    clock += H;
    await runOutcomes(deps());
    expect(store.getCall(id)?.receiptMessageId).toBe(901);
    expect(posts.length).toBe(1);
    await runOutcomes(deps());
    expect(posts.length).toBe(1);
  });

  it("follower counters on the card come from the tail rows", async () => {
    const id = openCall();
    for (const [tg, mode] of [[1, "tail"], [2, "tail"], [3, "fade"]] as const) {
      store.updateTail(store.createTail({ callId: id, tgId: tg, mode, strategyId: `s${tg}`, size: "1", notionalUsd: "1", feeBps: 0, createdAt: "t" }), { status: "placed" });
    }
    marks["ETH-USD"] = "2479.00";
    await runOutcomes(deps());
    marks["ETH-USD"] = "2561.00";
    await runOutcomes(deps());
    expect(edits[0]?.text).toContain("Tailed 2 · Faded 1");
  });
});
