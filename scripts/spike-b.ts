// Spike B: a resting bracket far from mark, read back from /v2/openOrders, then cancelled.
// Smallest valid size (min notional from exchangeInfo x1.3), limit buy 0.5% under the reference price.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { publicGet, signed } from "./spike-lib.js";

// Testnet books are dislocated for ADA, SOL and BTC (book far from mark, `order_price_out_of_limit`); ETH-USD is coherent.
const SYMBOL = process.env.SPIKE_SYMBOL ?? "ETH-USD";
const info = await publicGet("/price/v2/exchangeInfo");
const sym = info.symbols.find((s: any) => s.symbol === SYMBOL);
const f = (t: string) => sym.filters.find((x: any) => x.filterType === t);
const tick = Number(f("PRICE_FILTER").tickSize);
const step = Number(f("LOT_SIZE").stepSize);
const minNotional = Number(f("MIN_NOTIONAL").notional);
const mark = Number((await publicGet(`/price/v2/premiumIndex?symbol=${SYMBOL}`)).markPrice);
const last = Number((await publicGet(`/price/v2/ticker/price?symbol=${SYMBOL}`)).price);
// A 201 only means "sequenced". The first run was rejected `order_price_out_of_limit`: testnet last (0.2337) sits
// 2.7% above mark, so 3% under mark was 5.2% under last. Stay inside limitTakeBound (5%) of BOTH references.
const ref = Math.min(mark, last);

const roundTick = (p: number) => (Math.round(p / tick) * tick).toFixed(String(f("PRICE_FILTER").tickSize).split(".")[1]?.length ?? 0);
const entry = roundTick(ref * 0.995);
const tp = roundTick(ref * 1.03);
const sl = roundTick(ref * 0.97);
const size = (Math.ceil((minNotional * 1.3) / Number(entry) / step) * step).toString();

const strategy_id = randomUUID();
const body = {
  strategy_id,
  symbol: SYMBOL,
  side: "buy",
  type: "limit",
  size,
  price: entry,
  time_in_force: "GTC",
  tp_order: { type: "take_profit", size, stop_price: tp },
  sl_order: { type: "stop", size, stop_price: sl },
};
console.log("request:", JSON.stringify(body));
const created = await signed("POST", "/v2/order/strategy", body);
console.log("POST /v2/order/strategy ->", created.status, JSON.stringify(created.json));
// Poll the primary until it leaves `pending`; the POST response says nothing about acceptance.
const primaryId = (created.json as any).primary_client_order_id as string;
let status: unknown;
for (let i = 0; i < 12; i++) {
  status = (await signed("GET", `/v2/order?symbol=${SYMBOL}&client_order_id=${primaryId}`)).json;
  if ((status as any)?.status && (status as any).status !== "pending") break;
  await new Promise((r) => setTimeout(r, 500));
}
console.log("GET /v2/order (primary) ->", JSON.stringify(status));
const open = await signed("GET", `/v2/openOrders?symbol=${SYMBOL}`);
console.log("GET /v2/openOrders ->", open.status, JSON.stringify(open.json));
const cancelled = await signed("DELETE", "/v2/order/cancel-all", { symbol: SYMBOL });
console.log("DELETE /v2/order/cancel-all ->", cancelled.status, JSON.stringify(cancelled.json));
writeFileSync(
  "docs/proof/spike-b.json",
  JSON.stringify({ filters: { tick, step, minNotional }, mark, last, body, created, primary: status, open, cancelled }, null, 2),
);
if (created.status !== 201 || (status as any)?.status === "rejected") process.exit(1);
