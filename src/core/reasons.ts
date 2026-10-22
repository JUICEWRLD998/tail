// Strike's rejection codes as one plain line. The first six were provoked on testnet and recorded in
// docs/proof/p6-strike-errors.json (VERIFIED live); the rest come from the OpenAPI spec (VERIFIED, spec).
const BY_CODE: Readonly<Record<string, string>> = {
  insufficient_balance: "Not enough margin on your Strike account for this size.",
  position_notional_exceed: "This size is above the position limit for your account.",
  order_less_than_min_notional: "Too small for this market: below the minimum order value.",
  order_less_than_min_size: "Too small for this market: below the minimum size.",
  order_size_not_multiple_of_step: "The size is not a multiple of this market's lot step.",
  order_price_out_of_limit: "The entry price is too far from the market price.",
  invalid_secondary_order: "The take-profit and stop do not fit this order.",
  invalid_stop_price: "A stop or target price is missing or not above zero.",
  conditional_order_triggers_immediately: "A stop or target would trigger at once at the current price.",
};

/** A plain sentence for a Strike rejection code or error string, or undefined when it is not one we know. */
export function reasonText(code: string): string | undefined {
  if (/^account has not approved builder\b/.test(code)) return "Your wallet has not approved this builder. Reconnect with /connect.";
  return Object.hasOwn(BY_CODE, code) ? BY_CODE[code] : undefined;
}

/** The reason as a clause to follow "...order: ". Known codes become plain words; unknown ones are shown as-is, escaped. */
export function reasonClause(code: string, escape: (s: string) => string): string {
  const r = reasonText(code);
  return r === undefined ? `${escape(code)}.` : `${r.charAt(0).toLowerCase()}${r.slice(1)}`;
}
