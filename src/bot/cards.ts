// Telegram message text and callback encoding. Pure functions: every string a user reads is pinned by tests.
// Copy rules: short lines, plain words, one marker emoji per line at most, never a wall. HTML parse mode, so dynamic text is always escaped.
import { rewardRisk, type Side } from "../core/fade.js";
import { reasonClause } from "../core/reasons.js";
import type { Binding, SizingResult } from "../core/sizing.js";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface CardCall {
  symbol: string;
  side: Side;
  entryKind: "limit" | "market";
  entry: string | null;
  tp: string;
  sl: string;
  leverageHint: number | null;
}

const withOneDecimal = (rr: string) => (rr.includes(".") ? rr : `${rr}.0`);

function callRR(c: CardCall): string | null {
  if (c.entry === null) return null;
  const rr = rewardRisk({ side: c.side, entry: c.entry, tp: c.tp, sl: c.sl });
  return rr === null ? null : withOneDecimal(rr);
}

export const sideMark = (side: Side) => (side === "long" ? "🟢" : "🔴");
const code = (v: string) => `<code>${v}</code>`;

/** One level per line, each with its own marker. Numbers sit in code spans so they are easy to tap and copy. */
function levelLines(entry: string | null, tp: string, sl: string): string[] {
  return [`📍 Entry  ${code(entry ?? "market")}`, `🎯 Target  ${code(tp)}`, `🛑 Stop  ${code(sl)}`];
}

const heading = (c: CardCall) => `${sideMark(c.side)} <b>${c.symbol} · ${c.side.toUpperCase()}</b>${c.leverageHint ? ` · ${c.leverageHint}x` : ""}`;

export function callCard(c: CardCall, counts: { tailed: number; faded: number }): string {
  const rr = callRR(c);
  return [
    heading(c), "", ...levelLines(c.entry, c.tp, c.sl), ...(rr ? [`⚖️ R:R ${rr}`] : []), "",
    `👥 Tailed ${counts.tailed} · Faded ${counts.faded}`,
  ].join("\n");
}

export function callerConfirmCard(c: CardCall & { extraTargets: string[] }, aiRead = false): string {
  const rr = callRR(c);
  const lines = ["📝 <b>Post this call?</b>", "", heading(c), ...levelLines(c.entry, c.tp, c.sl), ...(rr ? [`⚖️ R:R ${rr}`] : [])];
  if (aiRead) lines.push("", "🤖 Read by AI from your message. Check every price before you post.");
  if (c.extraTargets.length > 0) lines.push("", `ℹ️ Only TP1 is used. Ignored: ${c.extraTargets.join(", ")}`);
  return lines.join("\n");
}

const CAP_TEXT: Record<Binding, string | null> = {
  risk: null,
  max_notional: "🔒 Capped by your max notional.",
  user_leverage: "🔒 Capped by your max leverage.",
  market_leverage: "🔒 Capped by the market's max leverage.",
  max_qty: "🔒 Capped by the market's max size.",
};

export interface FollowerCardInput {
  call: CardCall;
  mode: "tail" | "fade";
  sizing: Extract<SizingResult, { ok: true }>;
  equity: string;
  riskPct: string;
  /** The side and exit levels this follower will actually trade (flipped and swapped for a fade). */
  levels: { side: Side; tp: string; sl: string };
  /** This follower's reward-to-risk, or null for a market entry. */
  rewardRisk: string | null;
}

export function followerConfirmCard(i: FollowerCardInput): string {
  const verb = i.mode === "fade" ? "Fade" : "Tail";
  const lines = [
    `${sideMark(i.levels.side)} <b>${verb} ${i.call.symbol} · ${i.levels.side.toUpperCase()}</b>`,
    "",
    ...levelLines(i.call.entry, i.levels.tp, i.levels.sl),
    "",
    `📏 Size ${code(i.sizing.size)} · ${code(i.sizing.notional)} USD notional`,
    `💸 Risk ${code(i.sizing.riskUsd)} USD (${i.riskPct}% of ${i.equity} USD)`,
  ];
  if (i.rewardRisk !== null) {
    const mine = withOneDecimal(i.rewardRisk);
    const theirs = i.mode === "fade" ? callRR(i.call) : null;
    lines.push(theirs ? `⚖️ R:R ${mine} (the caller's call is ${theirs})` : `⚖️ R:R ${mine}`);
  }
  const cap = CAP_TEXT[i.sizing.binding];
  if (cap) lines.push(cap);
  return lines.join("\n");
}

export function refusalText(r: Extract<SizingResult, { ok: false }>): string {
  const d = escapeHtml(r.detail);
  switch (r.reason) {
    case "no_equity":
      return "⚠️ No margin on your Strike account. Deposit first.";
    case "below_min_notional":
    case "below_min_qty":
      return `⚠️ Too small for this market. ${d}.`;
    case "invalid_settings":
      return `⚠️ Check your settings with /me. ${d}.`;
    default:
      return `⚠️ These levels cannot be sized. ${d}.`;
  }
}

export function rejectionText(code: string): string {
  return `❌ Strike rejected the order: ${reasonClause(code, escapeHtml)}`;
}

export function parseStartPayload(p: string): { mode: "tail" | "fade"; callId: number } | undefined {
  const m = /^([tf])_(\d{1,9})$/.exec(p);
  if (!m || Number(m[2]) === 0) return undefined;
  return { mode: m[1] === "t" ? "tail" : "fade", callId: Number(m[2]) };
}

const KIND_CODE = { post: "p", drop: "x", confirm: "y", cancel: "n", ask: "a" } as const;
export type CallbackKind = keyof typeof KIND_CODE;

/** `option` is only for answers to a question (kind "ask"): the index of the button that was tapped. */
export const callbackData = (kind: CallbackKind, id: number, option?: number) =>
  option === undefined ? `${KIND_CODE[kind]}:${id}` : `${KIND_CODE[kind]}:${id}:${option}`;

export function parseCallbackData(d: string): { kind: CallbackKind; id: number; option?: number } | undefined {
  const m = /^([pxyna]):(\d{1,9})(?::(\d{1,2}))?$/.exec(d);
  if (!m) return undefined;
  const kind = (Object.keys(KIND_CODE) as CallbackKind[]).find((k) => KIND_CODE[k] === m[1]) as CallbackKind;
  // An option index belongs to "ask" only, and "ask" always carries one.
  if ((kind === "ask") !== (m[3] !== undefined)) return undefined;
  return kind === "ask" ? { kind, id: Number(m[2]), option: Number(m[3]) } : { kind, id: Number(m[2]) };
}

export function tailButtons(botUsername: string, callId: number): { text: string; url: string }[] {
  return [
    { text: "Tail", url: `https://t.me/${botUsername}?start=t_${callId}` },
    { text: "Fade", url: `https://t.me/${botUsername}?start=f_${callId}` },
  ];
}
