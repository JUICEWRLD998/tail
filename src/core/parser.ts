// Deterministic trade-call parser. No I/O, no model. Anything unclear becomes a question (`ask`), never a guess.
import { D, type Dec } from "./dec.js";
import type { Side } from "./fade.js";
import { normalizeSymbol } from "./symbols.js";
import { decimalsOf, formatToTick } from "./tick.js";

export interface ParseContext {
  /** Listed Strike markets with their price tick (from exchangeInfo). */
  markets: Readonly<Record<string, { tickSize: string }>>;
}

export interface CallDraft {
  symbol: string;
  side: Side;
  entryKind: "limit" | "market";
  /** Null for market entries; the follower's mark price is used at tap time. */
  entry: string | null;
  tp: string;
  sl: string;
  leverageHint: number | null;
  /** TP2, TP3 ... kept for display; the MVP brackets TP1 only. */
  extraTargets: string[];
}

export type AskField = "side" | "symbol" | "entry" | "sl" | "tp" | "levels";

export interface Ask {
  field: AskField;
  question: string;
  options?: string[];
}

export type ParseResult =
  | { ok: true; draft: CallDraft }
  | { ok: false; reason: "not_a_call" }
  | { ok: false; reason: "not_listed"; base: string }
  | { ok: false; reason: "ambiguous" | "incomplete" | "inconsistent"; ask: Ask };

const NUM = String.raw`\d{1,12}(?:\.\d{1,12})?`;
const NUM_LIST = String.raw`${NUM}(?:[\s,;|/]+${NUM})*`;

const STOP_WORDS = new Set(
  (
    "long short buy sell entry enter entries tp sl stop loss take profit target targets leverage cross isolated iso " +
    "now market cmp current price at zone usdt usd usdc perp signal call alert new setup trade the and or to for " +
    "with from my is are of in on it this that tp sl x"
  ).split(" "),
);

const ask = (reason: "ambiguous" | "incomplete" | "inconsistent", a: Ask): ParseResult => ({ ok: false, reason, ask: a });

function consume(work: string, m: RegExpMatchArray): string {
  const start = m.index ?? 0;
  return work.slice(0, start) + " ".repeat(m[0].length) + work.slice(start + m[0].length);
}

export function parseCall(text: string, ctx: ParseContext): ParseResult {
  try {
    return parse(text, ctx);
  } catch {
    // A parser bug must never become an order or a crash in the channel handler.
    return { ok: false, reason: "not_a_call" };
  }
}

function parse(text: string, ctx: ParseContext): ParseResult {
  const clean = text
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[^\x00-\x7F]/g, " ")
    // "XAUUSDSELL" and "BUYBTCUSDT": a direction glued to a quote-asset-suffixed symbol is split off. Only next to a
    // quote suffix, so ordinary words that merely contain "long" or "sell" are left alone.
    .replace(/(?<=usdt|usdc|usd|perp)(long|short|buy|sell)\b/gi, " $1")
    .replace(/\b(long|short|buy|sell)(?=[a-z]{2,8}(?:usdt|usdc|usd|perp)\b)/gi, "$1 ");
  // A list marker ("1) 2480", "2. 2470") is not a price: blank it when a number follows.
  let work = clean.toLowerCase().replace(/(^|\n)([ \t]*)\d{1,2}[).][ \t]+(?=\d)/g, (_m, nl: string, sp: string) => `${nl}${sp}   `);
  const listed = Object.keys(ctx.markets);

  // Side is read from the whole text first: "buy at 150" is both a side and an entry marker.
  const words = work.match(/\b(?:long|buy|short|sell)\b/g) ?? [];
  const hasLong = words.some((w) => w === "long" || w === "buy");
  const hasShort = words.some((w) => w === "short" || w === "sell");

  // Leverage.
  let leverageHint: number | null = null;
  const lev =
    work.match(/leverage\s*[:=@]?\s*(?:cross|isolated|iso)?\s*x?\s*(\d{1,4}(?:\.\d+)?)(?:\s*x(?!\d))?(?:\s+x\d{1,4}(?:\.\d+)?)*/) ??
    work.match(/(?<![\w.])(\d{1,4}(?:\.\d+)?)\s*x(?![a-z0-9])/);
  if (lev) {
    const n = Number(lev[1]);
    if (n >= 1 && n <= 1000) leverageHint = n;
    work = consume(work, lev);
  }

  // Targets: "tp 0.7", "TP1 0.66 TP2 0.70", "TP 1: 4350", "Target 1 : 1.43", "take profit 0.7", "Targets: 0.66 0.70".
  // The optional index must never be read as a price: "tp4: hold" is a label with no number, not a target of 4.
  const index = String.raw`(?:(\d)(?![\d.])|\s*(\d{1,2})\s*[:.)=-](?=\s)|(?!\d))`;
  const targetRe = new RegExp(String.raw`(?<!(?:entry|stop)\s*)\b(?:tp|take[\s-]*profit(?:\s*targets?)?|targets?)${index}\s*[:@=]?\s*(${NUM_LIST})`, "g");
  const tpMatches = [...work.matchAll(targetRe)];
  const labelled = tpMatches.map((m) => ({ label: Number(m[1] || m[2] || 0), nums: (m[3] as string).match(new RegExp(NUM, "g")) ?? [] }));
  for (const m of tpMatches) work = consume(work, m);
  if (labelled.length > 0 && labelled.every((l) => l.label > 0)) labelled.sort((a, b) => a.label - b.label);
  const targets = labelled.flatMap((l) => l.nums);
  // A target label left without a number ("TP4: Hold", a bare "Target :" header) must not leave its index behind as a price.
  work = work.replace(/\b(?:tp|take[\s-]*profit|targets?)\s*\d{0,2}\s*[:.)=-]?/g, (m) => " ".repeat(m.length));

  // Stop.
  const slMatches = [...work.matchAll(new RegExp(String.raw`\b(?:stopp?[\s-]*(?:loss|lose|los|targets?)|stopp?|sl)\s*[:@=]?\s*(${NUM})`, "g"))];
  const slValues = slMatches.map((m) => m[1] as string);
  for (const m of slMatches) work = consume(work, m);

  // Entry: "entry 0.62", "entry 0.61 - 0.63", "@ 150", "buy at 150".
  let entryNums: string[] = [];
  let entryList: string[] = []; // further numbers listed after the entry ("Entry Targets: 1) 2480 2) 2470"): a choice, not a range
  let hasEntryLabel = false;
  const entryRe = new RegExp(
    String.raw`(?:\b(?:entry|entery|enter|entries)(?:\s*(?:targets?|zone|price))?\b|\b(?:buy\s+zone|buy\s+at|sell\s+at|at)\b|@)\s*[:=]?\s*(${NUM})(?:\s*(?:-|to|/)\s*(${NUM}))?((?:[\s,;|]+${NUM})*)`,
  );
  const em = work.match(entryRe);
  if (em) {
    hasEntryLabel = true;
    entryNums = [em[1] as string, ...(em[2] ? [em[2]] : [])];
    entryList = (em[3] ?? "").match(new RegExp(NUM, "g")) ?? [];
    work = consume(work, em);
  }

  // Market-entry keywords.
  const marketKw = /\b(?:now|cmp|market|current(?:\s+price)?)\b/.test(work);

  const hardCall =
    tpMatches.length > 0 ||
    slMatches.length > 0 ||
    hasEntryLabel ||
    ((hasLong || hasShort) && /\d/.test(work + targets.join("") + slValues.join("")));
  // "GOLD BUY NOW": an alert whose levels follow in a later message. It is a call only if a listed market is named.
  const softCall = !hardCall && (hasLong || hasShort) && marketKw;
  if (!hardCall && !softCall) return { ok: false, reason: "not_a_call" };

  // Bare numbers left over are the entry (compact style), including a bare range "0.61-0.63".
  if (entryNums.length === 0) {
    const bareRange = work.match(new RegExp(String.raw`(${NUM})\s*(?:-|to|/)\s*(${NUM})`));
    if (bareRange) {
      entryNums = [bareRange[1] as string, bareRange[2] as string];
      work = consume(work, bareRange);
    }
  }
  const bare = entryNums.length > 0 ? [] : (work.match(new RegExp(NUM, "g")) ?? []);

  // Symbol.
  const tokenRe = /[#$]?[A-Za-z]{2,12}(?:[/_-](?:USDT|USD|USDC|PERP))?(?:\.P)?/g;
  const found = new Set<string>();
  let strongUnlisted: string | undefined;
  for (const m of clean.matchAll(tokenRe)) {
    const tok = m[0];
    const bareWord = tok.replace(/^[#$]/, "").split(/[/_-]/)[0] as string;
    if (STOP_WORDS.has(bareWord.toLowerCase())) continue;
    const r = normalizeSymbol(tok, listed);
    if (r.ok) found.add(r.symbol);
    else if (r.reason === "not_listed") {
      const strong = /^[#$]/.test(tok) || /[/_-]|\.P$/.test(tok) || /^[A-Z]{2,6}$/.test(tok);
      if (strong && strongUnlisted === undefined) strongUnlisted = r.base;
    }
  }
  if (found.size > 1) {
    return ask("ambiguous", { field: "symbol", question: "Which market is this call for?", options: [...found] });
  }
  if (found.size === 0) {
    if (strongUnlisted !== undefined) return { ok: false, reason: "not_listed", base: strongUnlisted };
    if (softCall) return { ok: false, reason: "not_a_call" }; // "sell now" with no market named is chatter
    return ask("ambiguous", { field: "symbol", question: "Which market is this call for?" });
  }
  const symbol = [...found][0] as string;
  const market = ctx.markets[symbol] as { tickSize: string };
  const tick = D.of(market.tickSize);
  const decimals = decimalsOf(market.tickSize);
  const fmt = (s: string) => formatToTick(D.of(s), tick, decimals);

  // Side.
  if (hasLong === hasShort) {
    return ask("ambiguous", { field: "side", question: `Long or short on ${symbol}?`, options: ["Long", "Short"] });
  }
  const side: Side = hasLong ? "long" : "short";

  // Entry.
  let entryKind: "limit" | "market" = "limit";
  let entry: string | null = null;
  if (entryNums.length > 0 && entryList.length > 0) {
    return ask("ambiguous", { field: "entry", question: "Which entry should Tail use?", options: [...entryNums, ...entryList] });
  } else if (entryNums.length > 0) {
    const mid = D.div(entryNums.map((n) => D.of(n)).reduce(D.add), D.of(String(entryNums.length)));
    entry = formatToTick(mid, tick, decimals);
  } else if (bare.length === 1) {
    entry = fmt(bare[0] as string);
  } else if (bare.length > 1) {
    return ask("ambiguous", { field: "entry", question: "Which number is the entry?", options: bare });
  } else if (marketKw) {
    entryKind = "market";
  } else {
    return ask("incomplete", { field: "entry", question: "No entry found. Give an entry price, or say market." });
  }

  // Stop and target.
  if (slValues.length === 0) return ask("incomplete", { field: "sl", question: "No stop found. Where is the stop loss?" });
  if (new Set(slValues.map((v) => D.str(D.of(v)))).size > 1) {
    return ask("ambiguous", { field: "sl", question: "Two different stops. Which one?", options: [...new Set(slValues)] });
  }
  if (targets.length === 0) return ask("incomplete", { field: "tp", question: "No target found. Where is the take profit?" });

  const sl = fmt(slValues[0] as string);
  const tp = fmt(targets[0] as string);
  const extraTargets = targets.slice(1).map(fmt);

  // Level order must fit the side; a violation is a question, never a silent fix.
  const [e, t, s] = [entry === null ? null : D.of(entry), D.of(tp), D.of(sl)];
  const positive = t > 0n && s > 0n && (e === null || e > 0n);
  const ordered = positive && (e === null ? (side === "long" ? s < t : t < s) : side === "long" ? s < e && e < t : t < e && e < s);
  if (!ordered) {
    const what = side === "long" ? "stop below entry and target above" : "target below entry and stop above";
    return ask("inconsistent", {
      field: "levels",
      question: `These levels do not fit a ${side}: it needs ${what}. Which number is wrong?`,
    });
  }

  return { ok: true, draft: { symbol, side, entryKind, entry, tp, sl, leverageHint, extraTargets } };
}
