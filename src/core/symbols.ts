// Maps the many ways a caller writes a ticker onto a Strike market symbol ("ADA-USD").
// Pure: the set of listed markets is passed in (from exchangeInfo), nothing is fetched here.

const ALIASES: Readonly<Record<string, string>> = {
  XBT: "BTC",
  GOLD: "XAU",
  SILVER: "XAG",
};

// Longest first so "USDT" is tried before "USD".
const QUOTE_SUFFIXES = ["USDT", "USDC", "USD", "PERP"];

export type SymbolResult =
  | { ok: true; symbol: string }
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "not_listed"; base: string };

function stripQuote(token: string): string {
  let base = token;
  // Peel suffixes repeatedly: "BTCUSDT.P" -> "BTCUSDT" -> "BTC"; "ADA-PERP" -> "ADA".
  for (let guard = 0; guard < 3; guard++) {
    const next = QUOTE_SUFFIXES.reduce(
      (acc, q) => (acc.length > q.length && acc.endsWith(q) ? acc.slice(0, -q.length) : acc),
      base,
    );
    if (next === base) break;
    base = next;
  }
  return base;
}

export function normalizeSymbol(raw: string, listed: Iterable<string>): SymbolResult {
  let token = raw.trim().toUpperCase().replace(/^[#$]+/, "");
  token = token.replace(/\.P$/, "").replace(/[/_-]+/g, "");
  if (!/^[A-Z]{2,12}$/.test(token)) return { ok: false, reason: "malformed" };

  const base = ALIASES[stripQuote(token)] ?? stripQuote(token);
  const symbol = `${base}-USD`;
  return new Set(listed).has(symbol) ? { ok: true, symbol } : { ok: false, reason: "not_listed", base };
}
