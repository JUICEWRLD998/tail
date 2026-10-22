import { describe, expect, it } from "vitest";
import { recordText, summarize, type RecordCall } from "../src/core/record.js";

const base = { symbol: "ETH-USD", side: "long" as const, entryKind: "limit" as const, entry: "2480.00", tp: "2560.00", sl: "2420.00", enteredPrice: "2480.00" };
const call = (status: RecordCall["status"], over: Partial<RecordCall> = {}): RecordCall => ({ ...base, status, ...over });

describe("summarize", () => {
  it("is all nulls and zeros with no calls", () => {
    expect(summarize([], 0)).toEqual({ calls: 0, open: 0, tpHit: 0, slHit: 0, expired: 0, decided: 0, hitRatePct: null, avgR: null, followers: 0 });
  });

  it("counts results, hit rate over decided calls only, and average R from the calls' own levels", () => {
    const s = summarize([call("tp_hit"), call("tp_hit"), call("sl_hit"), call("expired"), call("open")], 4);
    expect(s).toMatchObject({ calls: 5, open: 1, tpHit: 2, slHit: 1, expired: 1, decided: 3, followers: 4 });
    expect(s.hitRatePct).toBe("66.7"); // 2 of 3
    expect(s.avgR).toBe("0.55"); // (1.33 + 1.33 - 1) / 3
  });

  it("a stop is -1R and a short's target uses its own distances", () => {
    const short = call("tp_hit", { side: "short", entry: "2480.00", enteredPrice: "2480.00", tp: "2400.00", sl: "2540.00" });
    expect(summarize([short], 0).avgR).toBe("1.33");
    expect(summarize([call("sl_hit")], 0).avgR).toBe("-1");
  });

  it("rounds a negative average the same way as a positive one", () => {
    const s = summarize([call("sl_hit"), call("sl_hit"), call("tp_hit", { tp: "2486.00" })], 0); // R = -1, -1, +0.10
    expect(s.avgR).toBe("-0.63"); // (-1 -1 +0.10)/3 = -0.6333
  });

  it("a market call uses the price it entered at for R", () => {
    const m = call("tp_hit", { entryKind: "market", entry: null, enteredPrice: "2500.00", tp: "2560.00", sl: "2440.00" });
    expect(summarize([m], 0).avgR).toBe("1");
  });

  it("ignores expired and open calls in the average and the hit rate", () => {
    const s = summarize([call("expired"), call("open")], 0);
    expect(s).toMatchObject({ decided: 0, hitRatePct: null, avgR: null });
  });

  it("is deterministic and order-independent", () => {
    const rows = [call("tp_hit"), call("sl_hit"), call("tp_hit", { tp: "2600.00" }), call("expired")];
    expect(summarize(rows, 2)).toEqual(summarize([...rows].reverse(), 2));
  });
});

describe("recordText (what a caller reads)", () => {
  it("says there are no results yet, instead of inventing numbers", () => {
    expect(recordText("Tail test channel", summarize([], 0))).toBe("Tail test channel\nNo calls with a result yet.\nTestnet.");
  });

  it("shows the record from the rows", () => {
    const t = recordText("Tail test channel", summarize([call("tp_hit"), call("sl_hit"), call("open")], 3));
    expect(t).toBe("Tail test channel\n3 calls · 1 open · 1 target · 1 stop\nHit rate 50.0% · average 0.17R\nFollowers in: 3\nTestnet.");
  });

  it("omits hit rate and R until a call has a result, but still shows counts", () => {
    expect(recordText("X", summarize([call("open"), call("expired")], 1))).toBe("X\n2 calls · 1 open · 0 target · 0 stop · 1 expired\nFollowers in: 1\nTestnet.");
  });
});
