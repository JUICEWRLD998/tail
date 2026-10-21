// P3 exit proof: reads the placed tail from the database, asks Strike for that order's real status, and writes
// docs/proof/p3-live.json (no keys). With --cancel it then cancels everything open on the symbol so nothing is left resting.
import { writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import { StrikeClient } from "../src/strike/client.js";
import { BASE_URL, requireEnv } from "./env.js";

const db = new Database("data/tail.db", { readonly: true });
const tail = db.prepare("SELECT t.*, c.symbol FROM tails t JOIN calls c ON c.id = t.call_id WHERE t.status IN ('placed','filled') ORDER BY t.id DESC LIMIT 1").get() as any;
if (!tail) {
  console.error("no placed tail in the database");
  process.exit(1);
}
const client = new StrikeClient({ baseUrl: BASE_URL, privateKeyHex: requireEnv("SPIKE_API_PRIV").SPIKE_API_PRIV as string, autoSync: true });
const order = await client.order({ symbol: tail.symbol, clientOrderId: tail.primary_client_order_id });
const open = await client.openOrders(tail.symbol);
const proof = {
  tail: { id: tail.id, mode: tail.mode, size: tail.size, notionalUsd: tail.notional_usd, status: tail.status, orderId: tail.order_id },
  strikeOrder: { id: order.ID, status: order.Status, type: order.Type, side: order.Side, size: order.Size, price: order.Price, strategyId: order.Strategy?.ID },
  openOrdersOnSymbol: (open.orders as any[]).map((o) => ({ id: o.ID, type: o.Type, side: o.Side, status: o.Status, stopPrice: o.StopPrice })),
  checkedAt: new Date().toISOString(),
};
console.log(JSON.stringify(proof, null, 2));
writeFileSync("docs/proof/p3-live.json", JSON.stringify(proof, null, 2) + "\n");
if (process.argv.includes("--cancel")) {
  await client.cancelAll(tail.symbol);
  await new Promise((r) => setTimeout(r, 1000));
  console.log("after cancel-all, open orders:", (await client.openOrders(tail.symbol)).count);
}
