import { createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { StrikeClient, StrikeError } from "../src/strike/client.js";
import { derivePublicKeyHex, signingMessage } from "../src/strike/sign.js";

const SEED = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const exchangeInfo = JSON.parse(readFileSync(new URL("./fixtures/strike/exchangeInfo.json", import.meta.url), "utf8"));

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

function fakeFetch(routes: Record<string, { status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body as string | undefined });
    const key = `${method} ${new URL(url).pathname}${new URL(url).search}`;
    const hit = routes[key] ?? routes[`${method} ${new URL(url).pathname}`];
    if (!hit) throw new Error(`unexpected request: ${key}`);
    return new Response(JSON.stringify(hit.json), { status: hit.status ?? 200 });
  };
  return { fn: fn as unknown as typeof fetch, calls };
}

const BASE = "https://api-v2-testnet.strikefinance.org";
const mk = (routes: Record<string, { status?: number; json: unknown }>, extra: Partial<ConstructorParameters<typeof StrikeClient>[0]> = {}) => {
  const f = fakeFetch(routes);
  const client = new StrikeClient({ baseUrl: BASE, privateKeyHex: SEED, fetch: f.fn, nowMs: () => 1_700_000_000_000, nonce: () => "n-1", ...extra });
  return { client, calls: f.calls };
};

describe("exchangeInfo", () => {
  it("parses tick, lot step, min qty and min notional per symbol", async () => {
    const { client } = mk({ "GET /price/v2/exchangeInfo": { json: exchangeInfo } });
    const m = await client.markets();
    expect(m["ADA-USD"]).toMatchObject({ tickSize: "0.00010", stepSize: "1", minQty: "1", minNotional: "5" });
    expect(m["SOL-USD"]).toMatchObject({ stepSize: "0.01", minNotional: "10" });
  });

  it("caches within the ttl and refetches after it", async () => {
    let now = 1_700_000_000_000;
    const f = fakeFetch({ "GET /price/v2/exchangeInfo": { json: exchangeInfo } });
    const c = new StrikeClient({ baseUrl: BASE, fetch: f.fn, nowMs: () => now, marketsTtlMs: 60_000 });
    await c.markets();
    await c.markets();
    expect(f.calls.length).toBe(1);
    now += 61_000;
    await c.markets();
    expect(f.calls.length).toBe(2);
  });
});

describe("public market data", () => {
  it("reads the mark price from premiumIndex", async () => {
    const { client } = mk({ "GET /price/v2/premiumIndex?symbol=ADA-USD": { json: { symbol: "ADA-USD", markPrice: "0.22746314" } } });
    expect(await client.markPrice("ADA-USD")).toBe("0.22746314");
  });
});

describe("errors", () => {
  it("throws StrikeError carrying status and Strike's error string", async () => {
    const { client } = mk({ "GET /v2/account": { status: 401, json: { error: "authentication failed" } } });
    const err = await client.account().catch((e) => e);
    expect(err).toBeInstanceOf(StrikeError);
    expect(err).toMatchObject({ status: 401, strikeError: "authentication failed", method: "GET", path: "/v2/account" });
  });

  it("refuses a signed call when no private key is configured", async () => {
    const f = fakeFetch({});
    const c = new StrikeClient({ baseUrl: BASE, fetch: f.fn });
    await expect(c.account()).rejects.toThrow(/private key/);
    expect(f.calls.length).toBe(0);
  });
});

describe("signing on the wire", () => {
  it("signs method, path with query, timestamp, nonce and the exact body sent (Ed25519 verified)", async () => {
    const resp = { strategy_id: "s1" };
    const { client, calls } = mk({ "POST /v2/order/strategy": { status: 201, json: resp } });
    await client.placeBracket({ symbol: "ADA-USD", side: "buy", type: "limit", size: "27", price: "0.2200", tp: "0.2400", sl: "0.2100", strategyId: "s1" });
    const c = calls[0] as Call;
    expect(c.method).toBe("POST");
    const message = signingMessage({ method: "POST", path: "/v2/order/strategy", body: c.body, timestamp: 1_700_000_000, nonce: "n-1" });
    const pub = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(derivePublicKeyHex(SEED), "hex").toString("base64url") }, format: "jwk" });
    expect(verify(null, Buffer.from(message), pub, Buffer.from(c.headers["X-API-Wallet-Signature"] as string, "hex"))).toBe(true);
    expect(c.headers["X-API-Wallet-Public-Key"]).toBe(derivePublicKeyHex(SEED));
  });

  it("applies the server clock offset from /v2/time", async () => {
    const { client, calls } = mk({
      "GET /v2/time": { json: { serverTime: 1_700_000_100_000 } },
      "GET /v2/account": { json: { margin_balance: "1" } },
    });
    await client.syncClock();
    await client.account();
    const acct = calls.find((c) => c.url.endsWith("/v2/account")) as Call;
    expect(acct.headers["X-API-Wallet-Timestamp"]).toBe("1700000100");
  });
});

describe("autoSync", () => {
  it("syncs the clock once before the first signed request, then not again within the interval", async () => {
    const f = fakeFetch({
      "GET /v2/time": { json: { serverTime: 1_700_000_100_000 } },
      "GET /v2/account": { json: { margin_balance: "1" } },
    });
    const c = new StrikeClient({ baseUrl: BASE, privateKeyHex: SEED, fetch: f.fn, nowMs: () => 1_700_000_000_000, nonce: () => "n", autoSync: true });
    await c.account();
    await c.account();
    expect(f.calls.filter((x) => x.url.endsWith("/v2/time")).length).toBe(1);
    expect((f.calls.find((x) => x.url.endsWith("/v2/account")) as Call).headers["X-API-Wallet-Timestamp"]).toBe("1700000100");
  });

  it("re-syncs after the interval", async () => {
    let now = 1_700_000_000_000;
    const f = fakeFetch({ "GET /v2/time": { json: { serverTime: now } }, "GET /v2/account": { json: {} } });
    const c = new StrikeClient({ baseUrl: BASE, privateKeyHex: SEED, fetch: f.fn, nowMs: () => now, nonce: () => "n", autoSync: true });
    await c.account();
    now += 11 * 60_000;
    await c.account();
    expect(f.calls.filter((x) => x.url.endsWith("/v2/time")).length).toBe(2);
  });
});

describe("bracket order", () => {
  it("builds the documented strategy body with TP and SL legs sized to the primary", async () => {
    const { client, calls } = mk({ "POST /v2/order/strategy": { status: 201, json: { strategy_id: "s1" } } });
    await client.placeBracket({ symbol: "ADA-USD", side: "buy", type: "limit", size: "27", price: "0.2200", tp: "0.2400", sl: "0.2100", strategyId: "s1" });
    expect(JSON.parse((calls[0] as Call).body as string)).toEqual({
      strategy_id: "s1",
      symbol: "ADA-USD",
      side: "buy",
      type: "limit",
      size: "27",
      price: "0.2200",
      time_in_force: "GTC",
      tp_order: { type: "take_profit", size: "27", stop_price: "0.2400" },
      sl_order: { type: "stop", size: "27", stop_price: "0.2100" },
    });
  });

  it("omits price and time_in_force for a market primary", async () => {
    const { client, calls } = mk({ "POST /v2/order/strategy": { status: 201, json: {} } });
    await client.placeBracket({ symbol: "ADA-USD", side: "sell", type: "market", size: "27", tp: "0.2000", sl: "0.2400", strategyId: "s2" });
    const body = JSON.parse((calls[0] as Call).body as string);
    expect(body).not.toHaveProperty("price");
    expect(body).not.toHaveProperty("time_in_force");
    expect(body.type).toBe("market");
  });

  it("sends X-Builder-Fee-Bps only when a fee is set", async () => {
    const withFee = mk({ "POST /v2/order/strategy": { status: 201, json: {} } }, { builderFeeBps: 10 });
    await withFee.client.placeBracket({ symbol: "ADA-USD", side: "buy", type: "market", size: "27", tp: "0.2400", sl: "0.2100", strategyId: "s" });
    expect((withFee.calls[0] as Call).headers["X-Builder-Fee-Bps"]).toBe("10");

    const noFee = mk({ "POST /v2/order/strategy": { status: 201, json: {} } });
    await noFee.client.placeBracket({ symbol: "ADA-USD", side: "buy", type: "market", size: "27", tp: "0.2400", sl: "0.2100", strategyId: "s" });
    expect((noFee.calls[0] as Call).headers).not.toHaveProperty("X-Builder-Fee-Bps");
  });

  it("rejects a builder fee outside 0-100 before any request", async () => {
    const f = fakeFetch({});
    expect(() => new StrikeClient({ baseUrl: BASE, fetch: f.fn, builderFeeBps: 101 })).toThrow(/0-100/);
    expect(() => new StrikeClient({ baseUrl: BASE, fetch: f.fn, builderFeeBps: 1.5 })).toThrow(/0-100/);
  });
});

describe("orders and fills", () => {
  it("reads open orders for a symbol", async () => {
    const { client, calls } = mk({ "GET /v2/openOrders?symbol=ADA-USD": { json: [] } });
    await client.openOrders("ADA-USD");
    expect((calls[0] as Call).url).toContain("/v2/openOrders?symbol=ADA-USD");
  });

  it("cancel-all is DELETE with a JSON body", async () => {
    const { client, calls } = mk({ "DELETE /v2/order/cancel-all": { json: {} } });
    await client.cancelAll("ADA-USD");
    expect((calls[0] as Call).method).toBe("DELETE");
    expect((calls[0] as Call).body).toBe('{"symbol":"ADA-USD"}');
    await mk({ "DELETE /v2/order/cancel-all": { json: {} } }).client.cancelAll();
  });

  it("looks an order up by id", async () => {
    const { client, calls } = mk({ "GET /v2/order?symbol=ADA-USD&order_id=abc": { json: { status: "filled" } } });
    expect(await client.order({ symbol: "ADA-USD", orderId: "abc" })).toEqual({ status: "filled" });
    expect((calls[0] as Call).url).toContain("symbol=ADA-USD&order_id=abc");
  });

  it("reads fills, polling forward with since_trade_id", async () => {
    const { client, calls } = mk({ "GET /v2/history/fill?symbol=ADA-USD&since_trade_id=5": { json: [] } });
    await client.fills({ symbol: "ADA-USD", sinceTradeId: "5" });
    expect((calls[0] as Call).url).toContain("since_trade_id=5");
  });
});
