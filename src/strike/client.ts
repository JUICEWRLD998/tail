// Strike REST client. Endpoints and fields: openapi/trade-api.yaml and user-api.yaml in
// github.com/strike-finance/strike-finance-skills (VERIFIED, spec) and the live responses in docs/proof/.
import { randomUUID } from "node:crypto";
import { signRequest } from "./sign.js";

export class StrikeError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    /** Strike's own `error` string, or the raw body when it was not JSON. */
    readonly strikeError: string,
  ) {
    super(`Strike ${method} ${path} -> ${status}: ${strikeError}`);
    this.name = "StrikeError";
  }
}

export interface MarketInfo {
  tickSize: string;
  stepSize: string;
  minQty: string;
  maxQty: string;
  /** Max quantity for market orders (MARKET_LOT_SIZE). */
  marketMaxQty: string;
  minNotional: string;
}

export interface ClientOptions {
  baseUrl: string;
  /** API wallet private key, hex. Only needed for signed calls. */
  privateKeyHex?: string;
  /** Per-order builder fee in bps (integer 0-100). Sent as X-Builder-Fee-Bps when above 0. */
  builderFeeBps?: number;
  fetch?: typeof fetch;
  nowMs?: () => number;
  nonce?: () => string;
  marketsTtlMs?: number;
  /** Sync the clock with /v2/time before the first signed call and every 10 minutes after. Off in unit tests. */
  autoSync?: boolean;
}

const SYNC_INTERVAL_MS = 10 * 60_000;

export interface BracketInput {
  symbol: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  size: string;
  /** Required for a limit primary. */
  price?: string;
  tp: string;
  sl: string;
  strategyId: string;
}

export class StrikeClient {
  private readonly f: typeof fetch;
  private readonly now: () => number;
  private readonly nonce: () => string;
  private readonly ttl: number;
  private offsetSeconds = 0;
  private syncedAt: number | undefined;
  private marketsCache: { at: number; value: Record<string, MarketInfo> } | undefined;

  constructor(private readonly o: ClientOptions) {
    const fee = o.builderFeeBps;
    if (fee !== undefined && (!Number.isInteger(fee) || fee < 0 || fee > 100)) {
      throw new Error("builderFeeBps must be an integer 0-100");
    }
    this.f = o.fetch ?? fetch;
    this.now = o.nowMs ?? Date.now;
    this.nonce = o.nonce ?? randomUUID;
    this.ttl = o.marketsTtlMs ?? 60_000;
  }

  private async send(method: string, path: string, opts: { body?: string; signed: boolean; headers?: Record<string, string> }): Promise<any> {
    let headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.signed) {
      if (!this.o.privateKeyHex) throw new Error("private key not configured for a signed call");
      if (this.o.autoSync && (this.syncedAt === undefined || this.now() - this.syncedAt > SYNC_INTERVAL_MS)) await this.syncClock();
      headers = {
        ...headers,
        ...signRequest({
          privateKeyHex: this.o.privateKeyHex,
          method,
          path,
          body: opts.body,
          timestamp: Math.floor(this.now() / 1000) + this.offsetSeconds,
          nonce: this.nonce(),
        }),
      };
    }
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.f(`${this.o.baseUrl}${path}`, { method, headers, body: opts.body });
    const text = await res.text();
    let json: unknown = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    if (!res.ok) {
      const msg = typeof json === "object" && json !== null && typeof (json as any).error === "string" ? (json as any).error : text;
      throw new StrikeError(res.status, method, path, msg);
    }
    return json;
  }

  /** Aligns signed timestamps to Strike's clock (requests must be within 3 minutes). */
  async syncClock(): Promise<number> {
    const { serverTime } = await this.send("GET", "/v2/time", { signed: false });
    this.offsetSeconds = Math.round((Number(serverTime) - this.now()) / 1000);
    this.syncedAt = this.now();
    return this.offsetSeconds;
  }

  async markets(): Promise<Record<string, MarketInfo>> {
    if (this.marketsCache && this.now() - this.marketsCache.at < this.ttl) return this.marketsCache.value;
    const info = await this.send("GET", "/price/v2/exchangeInfo", { signed: false });
    const out: Record<string, MarketInfo> = {};
    for (const s of info.symbols as any[]) {
      if (s.status !== "trading") continue;
      const flt = (t: string) => (s.filters as any[]).find((x) => x.filterType === t);
      const price = flt("PRICE_FILTER");
      const lot = flt("LOT_SIZE");
      const mlot = flt("MARKET_LOT_SIZE");
      const notional = flt("MIN_NOTIONAL");
      if (!price || !lot || !notional) continue;
      out[s.symbol] = {
        tickSize: price.tickSize,
        stepSize: lot.stepSize,
        minQty: lot.minQty,
        maxQty: lot.maxQty,
        marketMaxQty: (mlot ?? lot).maxQty,
        minNotional: notional.notional,
      };
    }
    this.marketsCache = { at: this.now(), value: out };
    return out;
  }

  async markPrice(symbol: string): Promise<string> {
    const r = await this.send("GET", `/price/v2/premiumIndex?symbol=${encodeURIComponent(symbol)}`, { signed: false });
    return r.markPrice as string;
  }

  /** Builder Connect step 1. Public: no API wallet needed. VERIFIED: docs.strikefinance.org/api/builder-codes/builder-connect.md */
  builderRequestSignature(i: { address: string; chain: "ethereum" | "solana" | "cardano"; code: string; feeShareBps: number; publicKey: string }): Promise<{ nonce: string; message_to_sign: string }> {
    if (!Number.isInteger(i.feeShareBps) || i.feeShareBps < 0 || i.feeShareBps > 100) {
      return Promise.reject(new Error("feeShareBps must be an integer 0-100"));
    }
    return this.send("POST", "/auth/builder/request-signature", {
      signed: false,
      body: JSON.stringify({ address: i.address, chain: i.chain, code: i.code, fee_share_bps: i.feeShareBps, public_key: i.publicKey }),
    });
  }

  /** Builder Connect step 2. The nonce is single use. */
  builderVerifySignature(i: { nonce: string; walletSignature: string }): Promise<{ account_id: string; api_wallet_public_key: string; fee_share_bps: number; builder_code: string }> {
    return this.send("POST", "/auth/builder/verify-signature", {
      signed: false,
      body: JSON.stringify({ nonce: i.nonce, wallet_signature: i.walletSignature }),
    });
  }

  account(): Promise<any> {
    return this.send("GET", "/v2/account", { signed: true });
  }

  positions(symbol?: string): Promise<any> {
    return this.send("GET", `/v2/positions${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`, { signed: true });
  }

  placeBracket(i: BracketInput): Promise<any> {
    const body = {
      strategy_id: i.strategyId,
      symbol: i.symbol,
      side: i.side,
      type: i.type,
      size: i.size,
      ...(i.type === "limit" ? { price: i.price, time_in_force: "GTC" } : {}),
      tp_order: { type: "take_profit", size: i.size, stop_price: i.tp },
      sl_order: { type: "stop", size: i.size, stop_price: i.sl },
    };
    const fee = this.o.builderFeeBps;
    return this.send("POST", "/v2/order/strategy", {
      signed: true,
      body: JSON.stringify(body),
      headers: fee ? { "X-Builder-Fee-Bps": String(fee) } : {},
    });
  }

  openOrders(symbol?: string): Promise<any> {
    return this.send("GET", `/v2/openOrders${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`, { signed: true });
  }

  cancelAll(symbol?: string): Promise<any> {
    return this.send("DELETE", "/v2/order/cancel-all", { signed: true, body: JSON.stringify(symbol ? { symbol } : {}) });
  }

  /** Strike requires `symbol` on this route (400 "symbol parameter is required" otherwise). */
  order(q: { symbol: string; orderId?: string; clientOrderId?: string }): Promise<any> {
    const p = new URLSearchParams({ symbol: q.symbol });
    if (q.orderId) p.set("order_id", q.orderId);
    if (q.clientOrderId) p.set("client_order_id", q.clientOrderId);
    return this.send("GET", `/v2/order?${p}`, { signed: true });
  }

  fills(q: { symbol?: string; sinceTradeId?: string; fromId?: string } = {}): Promise<any> {
    const p = new URLSearchParams();
    if (q.symbol) p.set("symbol", q.symbol);
    if (q.sinceTradeId) p.set("since_trade_id", q.sinceTradeId);
    if (q.fromId) p.set("fromId", q.fromId);
    const qs = p.toString();
    return this.send("GET", `/v2/history/fill${qs ? `?${qs}` : ""}`, { signed: true });
  }
}
