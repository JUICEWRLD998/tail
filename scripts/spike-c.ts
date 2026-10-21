// Spike C: one tiny market bracket on testnet, confirm the fill through /v2/history/fill, record fee fields, close it.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { StrikeClient } from "../src/strike/client.js";
import { BASE_URL, requireEnv } from "./env.js";

const SYMBOL = process.env.SPIKE_SYMBOL ?? "ETH-USD";
const client = new StrikeClient({ baseUrl: BASE_URL, privateKeyHex: requireEnv("SPIKE_API_PRIV").SPIKE_API_PRIV as string });
await client.syncClock();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const raw = (m: string, p: string, body?: unknown) =>
  (client as any).send(m, p, { signed: true, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

const markets = await client.markets();
const m = markets[SYMBOL]!;
const mark = Number(await client.markPrice(SYMBOL));
const tickDecimals = m.tickSize.split(".")[1]?.length ?? 0;
const px = (n: number) => n.toFixed(tickDecimals);
const step = Number(m.stepSize);
const size = (Math.ceil((Number(m.minNotional) * 1.3) / mark / step) * step).toFixed(String(m.stepSize).split(".")[1]?.length ?? 0);

const before = await client.account();
const created = await client.placeBracket({
  symbol: SYMBOL, side: "buy", type: "market", size, tp: px(mark * 1.03), sl: px(mark * 0.97), strategyId: randomUUID(),
});
console.log("bracket ->", JSON.stringify(created).slice(0, 300));

let primary: any;
for (let i = 0; i < 20; i++) {
  primary = await client.order({ symbol: SYMBOL, clientOrderId: created.primary_client_order_id });
  if (primary.Status !== "pending" && primary.Status !== "open") break;
  await sleep(500);
}
console.log("primary status:", primary.Status, primary.CloseReason, "filled", primary.Filled);

await sleep(1000);
const fills = await client.fills({ symbol: SYMBOL });
const positions = await client.positions(SYMBOL);
const open = await client.openOrders(SYMBOL);
console.log("fills:", JSON.stringify(fills).slice(0, 900));
console.log("positions:", JSON.stringify(positions).slice(0, 500));
console.log("open orders (legs):", open.count);

// Close: cancel the protective legs, then a reduce-only market sell of the same size.
await client.cancelAll(SYMBOL);
await sleep(800);
const closed = await raw("POST", "/v2/order", { symbol: SYMBOL, side: "sell", type: "market", size, reduce_only: true });
console.log("close ->", JSON.stringify(closed).slice(0, 200));
await sleep(1500);
const fills2 = await client.fills({ symbol: SYMBOL });
const after = await client.account();
const positions2 = await client.positions(SYMBOL);
console.log("positions after close:", JSON.stringify(positions2).slice(0, 200));
console.log(`margin_balance: ${before.margin_balance} -> ${after.margin_balance}`);

writeFileSync(
  "docs/proof/spike-c.json",
  JSON.stringify({ symbol: SYMBOL, mark, size, created, primary, fills, positions, openLegs: open, closed, fillsAfterClose: fills2, positionsAfterClose: positions2, balanceBefore: before.margin_balance, balanceAfter: after.margin_balance }, null, 2),
);
if (primary.Status !== "filled") process.exit(1);
