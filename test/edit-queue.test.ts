import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditQueue } from "../src/bot/edit-queue.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const btn = [{ text: "Tail", url: "https://t.me/b?start=t_1" }];
const e = (text: string, chatId = -1, messageId = 7) => ({ chatId, messageId, text, buttons: btn });

function setup(delayMs = 3000) {
  const sent: { chatId: number; messageId: number; text: string }[] = [];
  const q = createEditQueue({ delayMs, edit: async (chatId, messageId, text) => void sent.push({ chatId, messageId, text }), log: () => {} });
  return { q, sent };
}

describe("edit queue", () => {
  it("sends the first edit for a card immediately", async () => {
    const { q, sent } = setup();
    await q.enqueue(e("Tailed 1"));
    expect(sent.map((s) => s.text)).toEqual(["Tailed 1"]);
  });

  it("coalesces a burst into one immediate edit and one trailing edit with the latest text", async () => {
    const { q, sent } = setup();
    await q.enqueue(e("Tailed 1"));
    await q.enqueue(e("Tailed 2"));
    await q.enqueue(e("Tailed 3"));
    await q.enqueue(e("Tailed 4"));
    expect(sent.map((s) => s.text)).toEqual(["Tailed 1"]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(sent.map((s) => s.text)).toEqual(["Tailed 1", "Tailed 4"]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent.length).toBe(2);
  });

  it("goes immediate again once the window has passed", async () => {
    const { q, sent } = setup();
    await q.enqueue(e("a"));
    await vi.advanceTimersByTimeAsync(3500);
    await q.enqueue(e("b"));
    expect(sent.map((s) => s.text)).toEqual(["a", "b"]);
  });

  it("keeps different cards independent", async () => {
    const { q, sent } = setup();
    await q.enqueue(e("one", -1, 7));
    await q.enqueue(e("two", -1, 8));
    await q.enqueue(e("three", -2, 7));
    expect(sent.map((s) => s.text)).toEqual(["one", "two", "three"]);
  });

  it("a final edit goes out at once, cancels the pending edit, and blocks later edits to that card", async () => {
    const { q, sent } = setup();
    await q.enqueue(e("Tailed 1"));
    await q.enqueue(e("Tailed 2")); // pending
    await q.enqueue(e("Result: take profit hit"), { final: true });
    await q.enqueue(e("Tailed 3")); // must not overwrite the result
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent.map((s) => s.text)).toEqual(["Tailed 1", "Result: take profit hit"]);
  });

  it("a failing edit is logged and does not break the queue", async () => {
    const log: string[] = [];
    let fail = true;
    const q = createEditQueue({ delayMs: 1000, edit: async () => { if (fail) throw new Error("message is not modified"); }, log: (m) => log.push(m) });
    await expect(q.enqueue(e("a"))).resolves.toBeUndefined();
    fail = false;
    await q.enqueue(e("b"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(log.some((l) => l.includes("not modified"))).toBe(true);
  });

  it("with a zero delay every edit is immediate", async () => {
    const { q, sent } = setup(0);
    await q.enqueue(e("a"));
    await q.enqueue(e("b"));
    await q.enqueue(e("c"));
    expect(sent.map((s) => s.text)).toEqual(["a", "b", "c"]);
  });

  it("flush sends every pending edit now", async () => {
    const { q, sent } = setup();
    await q.enqueue(e("a"));
    await q.enqueue(e("b"));
    await q.flush();
    expect(sent.map((s) => s.text)).toEqual(["a", "b"]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent.length).toBe(2);
  });
});
