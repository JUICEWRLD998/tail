// Spike B: a resting bracket far from mark, read back from /v2/openOrders, then cancelled.
// Smallest valid size for ADA-USD (min notional from exchangeInfo), limit buy 3% under mark (inside limitTakeBound).
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { publicGet, signed } from "./spike-lib.js";

const SYMBOL = "ADA-USD";
const info = await publicGet("/price/v2/exchangeInfo");
const sym = info.symbols.find((s: any) => s.symbol === SYMBOL);
const f = (t: string) => sym.filters.find((x: any) => x.filterType === t);
const tick = Number(f("PRICE_FILTER").tickSize);
const step = Number(f("LOT_SIZE").stepSize);
const minNotional = Number(f("MIN_NOTIONAL").notional);
const mark = Number((await publicGet(`/price/v2/premiumIndex?symbol=${SYMBOL}`)).markPrice);

const roundTick = (p: number) => (Math.round(p / tick) * tick).toFixed(String(f("PRICE_FILTER").tickSize).split(".")[1]?.length ?? 0);
const entry = roundTick(mark * 0.97);
const tp = roundTick(mark * 1.05);
const sl = roundTick(mark * 0.93);
const size = (Math.ceil((minNotional * 1.2) / Number(entry) / step) * step).toString();

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
const open = await signed("GET", `/v2/openOrders?symbol=${SYMBOL}`);
console.log("GET /v2/openOrders ->", open.status, JSON.stringify(open.json));
const cancelled = await signed("DELETE", "/v2/order/cancel-all", { symbol: SYMBOL });
console.log("DELETE /v2/order/cancel-all ->", cancelled.status, JSON.stringify(cancelled.json));
writeFileSync(
  "docs/proof/spike-b.json",
  JSON.stringify({ filters: { tick, step, minNotional }, mark, body, created, open, cancelled }, null, 2),
);
if (created.status !== 201) process.exit(1);
