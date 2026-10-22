// Records what Strike and our database say about one tail placed from a real Telegram tap (testnet). No keys are read out.
// Usage: npx tsx scripts/p6-proof.ts <tailId>   (needs SPIKE_API_PRIV in the service's environment and data/tail.db)
import { writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import { StrikeClient } from "../src/strike/client.js";

const tailId = Number(process.argv[2]);
const db = new Database("data/tail.db", { readonly: true });
const tail = db.prepare("SELECT id, call_id, mode, status, size, notional_usd, order_id, fee_bps, fill_price, tp_client_order_id, sl_client_order_id, error, created_at FROM tails WHERE id = ?").get(tailId) as Record<string, unknown>;
const call = db.prepare("SELECT id, symbol, side, entry_kind, entry, tp, sl, status, entered_price, result_price, receipt_message_id FROM calls WHERE id = ?").get(tail.call_id) as Record<string, unknown>;
const c = new StrikeClient({ baseUrl: "https://api-v2-testnet.strikefinance.org", privateKeyHex: process.env.SPIKE_API_PRIV, autoSync: true });
const order = await c.order({ symbol: String(call.symbol), orderId: String(tail.order_id) });
const fills = ((await c.fills({ symbol: String(call.symbol) })).fills as any[]).filter((f) => String(f.order_id) === String(tail.order_id));
const open = (await c.openOrders(String(call.symbol))).orders as any[];
const positions = (await c.positions()).positions as any[];
const out = {
  checkedAt: new Date().toISOString(), network: "testnet", tail, call,
  strikePrimary: { ID: order.ID, Status: order.Status, Type: order.Type, Side: order.Side, Size: order.Size, Filled: order.Filled },
  strikeFills: fills.map((f) => ({ price: f.price, size: f.size, role: f.role, fee: f.fee, fee_type: f.fee_type })),
  strikeOpenLegs: open.map((o) => ({ ID: o.ID, Type: o.Type, Side: o.Side, Status: o.Status, StopPrice: o.StopPrice, Size: o.Size })),
  strikePositions: positions.map((p) => ({ symbol: p.symbol, size: p.size, entry_price: p.entry_price, upnl: p.upnl })),
  fillPriceMatchesStrike: fills.length > 0 && Number(tail.fill_price) === Number(fills[0].price),
};
writeFileSync(`docs/proof/p6-live-tail-${tailId}.json`, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ tail: tail.status, order: order.Status, fills: fills.length, legs: open.length, match: out.fillPriceMatchesStrike }));
