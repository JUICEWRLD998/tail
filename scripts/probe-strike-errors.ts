// Provokes Strike's rejections on testnet with orders that cannot fill (limits far below the book), to record the REAL
// error strings instead of guessing them. Synchronous errors arrive as HTTP 4xx; asynchronous ones as the primary
// order's CloseReason after a 201. Everything is cancelled afterwards. Writes docs/proof/p6-strike-errors.json.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { StrikeClient, StrikeError } from "../src/strike/client.js";
import { BASE_URL, requireEnv } from "./env.js";

const SYMBOL = "ETH-USD";
const client = new StrikeClient({ baseUrl: BASE_URL, privateKeyHex: requireEnv("SPIKE_API_PRIV").SPIKE_API_PRIV as string, autoSync: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mark = Number(await client.markPrice(SYMBOL));
const entry = (mark * 0.995).toFixed(2); // resting buy just under the market: valid price, so only the size/levels vary
const tp = (mark * 1.03).toFixed(2);
const sl = (mark * 0.97).toFixed(2);

const cases: { name: string; size: string; price?: string; tp?: string; sl?: string }[] = [
  { name: "valid bracket (control)", size: "0.006" },
  { name: "oversize: needs far more margin than the account has", size: "40" },
  { name: "below the minimum notional", size: "0.001" },
  { name: "not a multiple of the lot step", size: "0.0065" },
  { name: "zero size", size: "0" },
  { name: "take-profit below the stop (inconsistent legs)", size: "0.006", tp: sl, sl: tp },
  { name: "stop above a buy entry that would trigger at once", size: "0.006", sl: (mark * 1.02).toFixed(2) },
  { name: "price far from the book", size: "0.006", price: (mark * 0.7).toFixed(2) },
];

const out: unknown[] = [];
for (const c of cases) {
  const body = { symbol: SYMBOL, side: "buy" as const, type: "limit" as const, size: c.size, price: c.price ?? entry, tp: c.tp ?? tp, sl: c.sl ?? sl, strategyId: randomUUID() };
  const row: Record<string, unknown> = { case: c.name, size: c.size };
  try {
    const created = await client.placeBracket(body);
    await sleep(1500);
    const o = await client.order({ symbol: SYMBOL, clientOrderId: created.primary_client_order_id });
    row.http = 201;
    row.primaryStatus = o.Status;
    row.closeReason = o.CloseReason ?? "";
  } catch (e) {
    if (e instanceof StrikeError) Object.assign(row, { http: e.status, strikeError: e.strikeError });
    else throw e;
  }
  await client.cancelAll(SYMBOL);
  await sleep(600);
  out.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync("docs/proof/p6-strike-errors.json", JSON.stringify({ checkedAt: new Date().toISOString(), symbol: SYMBOL, mark, results: out }, null, 2) + "\n");
console.log("open orders left:", (await client.openOrders(SYMBOL)).count, "positions:", (await client.positions()).count);
