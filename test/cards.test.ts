import { describe, expect, it } from "vitest";
import {
  callCard, callerConfirmCard, escapeHtml, followerConfirmCard, parseCallbackData, parseStartPayload, refusalText,
  rejectionText, tailButtons, callbackData,
} from "../src/bot/cards.js";

const call = { symbol: "ETH-USD", side: "long" as const, entryKind: "limit" as const, entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: 5 as number | null };

describe("callCard (posted in the channel)", () => {
  it("shows market, side, leverage, levels, reward-to-risk and counters", () => {
    expect(callCard(call, { tailed: 0, faded: 0 })).toBe(
      "<b>ETH-USD · LONG · 5x</b>\nEntry 2480.00 · TP 2560.00 · SL 2420.00 · R:R 1.33\nTailed 0 · Faded 0",
    );
  });

  it("omits the leverage hint when there is none", () => {
    expect(callCard({ ...call, leverageHint: null }, { tailed: 0, faded: 0 }).split("\n")[0]).toBe("<b>ETH-USD · LONG</b>");
  });

  it("shows a whole reward-to-risk with one decimal", () => {
    expect(callCard({ ...call, entry: "2480.00", tp: "2540.00", sl: "2450.00" }, { tailed: 0, faded: 0 })).toContain("R:R 2.0");
  });

  it("says market for a market entry and leaves out R:R", () => {
    const t = callCard({ ...call, entryKind: "market", entry: null }, { tailed: 0, faded: 0 });
    expect(t).toContain("Entry market · TP 2560.00 · SL 2420.00");
    expect(t).not.toContain("R:R");
  });

  it("shows the live counters", () => {
    expect(callCard(call, { tailed: 14, faded: 3 })).toMatch(/Tailed 14 · Faded 3$/);
  });
});

describe("callerConfirmCard", () => {
  it("asks before posting and lists the levels", () => {
    const t = callerConfirmCard({ ...call, extraTargets: [] });
    expect(t.startsWith("Post this call?\n")).toBe(true);
    expect(t).toContain("ETH-USD · LONG");
  });

  it("states that later targets are not used", () => {
    expect(callerConfirmCard({ ...call, extraTargets: ["2600.00", "2650.00"] })).toContain("Only TP1 is used. Ignored: 2600.00, 2650.00");
  });
});

describe("followerConfirmCard", () => {
  const sizing = { ok: true as const, size: "0.009", notional: "22.32", riskUsd: "0.54", binding: "risk" as const };
  const base = { call, mode: "tail" as const, sizing, equity: "19.92", riskPct: "3", levels: { side: "long" as const, tp: "2560.00", sl: "2420.00" }, rewardRisk: "1.33" };

  it("shows size, notional and the risk against equity", () => {
    const t = followerConfirmCard(base);
    expect(t).toBe(
      "<b>Tail ETH-USD · LONG</b>\nEntry 2480.00 · TP 2560.00 · SL 2420.00\nSize 0.009 · notional 22.32 USD\nRisk 0.54 USD (3% of 19.92 USD)\nR:R 1.33",
    );
  });

  it("names the cap when it is not the risk budget", () => {
    expect(followerConfirmCard({ ...base, sizing: { ...sizing, binding: "max_notional" } })).toContain("Capped by your max notional.");
    expect(followerConfirmCard({ ...base, sizing: { ...sizing, binding: "user_leverage" } })).toContain("Capped by your max leverage.");
  });

  it("fade flips the side, swaps the levels and shows the inverted R:R", () => {
    const t = followerConfirmCard({ ...base, mode: "fade", levels: { side: "short", tp: "2420.00", sl: "2560.00" }, rewardRisk: "0.75" });
    expect(t).toContain("<b>Fade ETH-USD · SHORT</b>");
    expect(t).toContain("Entry 2480.00 · TP 2420.00 · SL 2560.00");
    expect(t).toContain("R:R 0.75 (the caller's call is 1.33)");
  });

  it("says market for a market entry", () => {
    expect(followerConfirmCard({ ...base, call: { ...call, entryKind: "market", entry: null } })).toContain("Entry market ·");
  });
});

describe("refusal and rejection text", () => {
  it.each([
    ["no_equity", "No margin on your Strike account. Deposit first."],
    ["below_min_notional", "Too small for this market."],
    ["below_min_qty", "Too small for this market."],
    ["invalid_settings", "Check your settings with /me."],
  ])("%s", (reason, start) => {
    expect(refusalText({ reason, detail: "x" } as never)).toContain(start);
  });

  it("includes the detail line for a size refusal", () => {
    expect(refusalText({ reason: "below_min_notional", detail: "notional 7.44 USD is below the market minimum 10" } as never)).toContain("notional 7.44 USD is below the market minimum 10");
  });

  it("shows Strike's rejection code, HTML-escaped", () => {
    expect(rejectionText("order_price_out_of_limit")).toBe("Strike rejected the order: order_price_out_of_limit.");
    expect(rejectionText("<b>x</b>")).toBe("Strike rejected the order: &lt;b&gt;x&lt;/b&gt;.");
  });
});

describe("escapeHtml", () => {
  it("escapes the three characters Telegram HTML cares about", () => {
    expect(escapeHtml(`a<b>&"c"`)).toBe("a&lt;b&gt;&amp;\"c\"");
  });
});

describe("deep links and callbacks", () => {
  it("parses start payloads", () => {
    expect(parseStartPayload("t_12")).toEqual({ mode: "tail", callId: 12 });
    expect(parseStartPayload("f_7")).toEqual({ mode: "fade", callId: 7 });
  });
  it.each(["", "t_", "t_0x1", "x_1", "t_-1", "t_1 ", "T_1", "t_1234567890", "t_1;drop"])("rejects %j", (p) => {
    expect(parseStartPayload(p)).toBeUndefined();
  });

  it("round-trips callback data and stays under Telegram's 64-byte limit", () => {
    for (const kind of ["post", "drop", "confirm", "cancel"] as const) {
      const d = callbackData(kind, 42);
      expect(Buffer.byteLength(d)).toBeLessThanOrEqual(64);
      expect(parseCallbackData(d)).toEqual({ kind, id: 42 });
    }
  });
  it("encodes an answer to a question as ask id and option index", () => {
    expect(callbackData("ask", 12, 1)).toBe("a:12:1");
    expect(parseCallbackData("a:12:1")).toEqual({ kind: "ask", id: 12, option: 1 });
    expect(parseCallbackData("a:12:0")).toEqual({ kind: "ask", id: 12, option: 0 });
  });

  it.each(["a:12", "a:12:", "a:12:x", "a:12:100", "p:1:2", "y:3:0", "a:-1:0"])("rejects malformed callback %j", (d) => {
    expect(parseCallbackData(d)).toBeUndefined();
  });

  it.each(["", "zz:1", "p:", "p:abc", "p:-1", "p:1:2"])("rejects callback %j", (d) => {
    expect(parseCallbackData(d)).toBeUndefined();
  });

  it("builds URL buttons that deep-link to the bot", () => {
    expect(tailButtons("tailbot", 12)).toEqual([
      { text: "Tail", url: "https://t.me/tailbot?start=t_12" },
      { text: "Fade", url: "https://t.me/tailbot?start=f_12" },
    ]);
  });
});
