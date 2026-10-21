// Deterministic position sizing. No I/O, no model. All money is decimal strings via D.
import { D, type Dec } from "./dec.js";

export interface Market {
  tickSize: string;
  stepSize: string;
  minQty: string;
  maxQty: string;
  minNotional: string;
  /** Market's own max leverage, when exchangeInfo or the symbols endpoint provides it. */
  maxLeverage?: string;
}

export interface SizingInput {
  /** Follower equity in USD (account `margin_balance`). */
  equity: string;
  /** Percent of equity risked between entry and stop, in (0, 100]. */
  riskPct: string;
  maxLeverage: string;
  maxNotionalUsd: string;
  entry: string;
  sl: string;
  market: Market;
}

export type Binding = "risk" | "max_notional" | "user_leverage" | "market_leverage" | "max_qty";

export type SizingResult =
  | { ok: true; size: string; notional: string; riskUsd: string; binding: Binding }
  | {
      ok: false;
      reason:
        | "no_equity"
        | "invalid_prices"
        | "invalid_settings"
        | "invalid_input"
        | "below_min_qty"
        | "below_min_notional";
      detail: string;
    };

const fail = (reason: Extract<SizingResult, { ok: false }>["reason"], detail: string): SizingResult => ({
  ok: false,
  reason,
  detail,
});

export function sizeTail(i: SizingInput): SizingResult {
  let equity: Dec, riskPct: Dec, maxLev: Dec, maxNotional: Dec, entry: Dec, sl: Dec;
  let step: Dec, minQty: Dec, maxQty: Dec, minNotional: Dec, marketLev: Dec | undefined;
  try {
    equity = D.of(i.equity);
    riskPct = D.of(i.riskPct);
    maxLev = D.of(i.maxLeverage);
    maxNotional = D.of(i.maxNotionalUsd);
    entry = D.of(i.entry);
    sl = D.of(i.sl);
    step = D.of(i.market.stepSize);
    minQty = D.of(i.market.minQty);
    maxQty = D.of(i.market.maxQty);
    minNotional = D.of(i.market.minNotional);
    marketLev = i.market.maxLeverage === undefined ? undefined : D.of(i.market.maxLeverage);
  } catch (e) {
    return fail("invalid_input", (e as Error).message);
  }

  const zero = 0n;
  if (equity <= zero) return fail("no_equity", "equity is zero or negative");
  if (entry <= zero || sl <= zero) return fail("invalid_prices", "entry and stop must be positive");
  const dist = D.abs(D.sub(entry, sl));
  if (dist === zero) return fail("invalid_prices", "entry equals stop");
  if (riskPct <= zero || riskPct > D.of("100")) return fail("invalid_settings", "risk percent must be in (0, 100]");
  if (maxLev <= zero || maxNotional <= zero) return fail("invalid_settings", "caps must be positive");

  const riskUsd = D.div(D.mul(equity, riskPct), D.of("100"));
  const candidates: [Binding, Dec][] = [
    ["risk", D.div(riskUsd, dist)],
    ["max_notional", D.div(maxNotional, entry)],
    ["user_leverage", D.div(D.mul(equity, maxLev), entry)],
    ["max_qty", maxQty],
  ];
  if (marketLev !== undefined) candidates.push(["market_leverage", D.div(D.mul(equity, marketLev), entry)]);

  // First candidate wins ties, so "risk" is reported when nothing else is tighter.
  const [binding, raw] = candidates.reduce((best, c) => (c[1] < best[1] ? c : best));
  const size = D.floorToStep(raw, step);

  if (size < minQty) {
    return fail("below_min_qty", `size ${D.str(size)} is below the market minimum ${D.str(minQty)}`);
  }
  const notional = D.mul(size, entry);
  if (notional < minNotional) {
    return fail("below_min_notional", `notional ${D.str(notional)} USD is below the market minimum ${D.str(minNotional)}`);
  }
  return {
    ok: true,
    size: D.str(size),
    notional: D.str(notional),
    riskUsd: D.str(D.mul(size, dist)),
    binding,
  };
}
