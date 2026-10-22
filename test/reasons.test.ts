import { describe, expect, it } from "vitest";
import { reasonText } from "../src/core/reasons.js";

describe("reasonText: Strike's rejection codes as one plain line", () => {
  // The first six were provoked on testnet (docs/proof/p6-strike-errors.json); the rest come from the OpenAPI spec.
  it.each([
    ["insufficient_balance", "Not enough margin on your Strike account for this size."],
    ["position_notional_exceed", "This size is above the position limit for your account."],
    ["order_less_than_min_notional", "Too small for this market: below the minimum order value."],
    ["order_less_than_min_size", "Too small for this market: below the minimum size."],
    ["order_size_not_multiple_of_step", "The size is not a multiple of this market's lot step."],
    ["order_price_out_of_limit", "The entry price is too far from the market price."],
    ["invalid_secondary_order", "The take-profit and stop do not fit this order."],
    ["invalid_stop_price", "A stop or target price is missing or not above zero."],
    ["conditional_order_triggers_immediately", "A stop or target would trigger at once at the current price."],
  ])("%s", (code, line) => {
    expect(reasonText(code)).toBe(line);
  });

  it("explains an unapproved builder and points to /connect", () => {
    expect(reasonText('account has not approved builder "sigma"')).toBe("Your wallet has not approved this builder. Reconnect with /connect.");
  });

  it("returns undefined for a code it does not know, so the raw code can be shown instead", () => {
    expect(reasonText("something_new")).toBeUndefined();
    expect(reasonText("")).toBeUndefined();
  });

  it("every line is one sentence, ends with a period and has no markup", () => {
    for (const c of ["insufficient_balance", "position_notional_exceed", "order_less_than_min_notional", "order_less_than_min_size", "order_size_not_multiple_of_step", "order_price_out_of_limit", "invalid_secondary_order", "invalid_stop_price", "conditional_order_triggers_immediately"]) {
      const t = reasonText(c) as string;
      expect(t.endsWith(".")).toBe(true);
      expect(t).not.toMatch(/[<>&]/);
      expect(t.length).toBeLessThan(90);
    }
  });
});
