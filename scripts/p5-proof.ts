// P5 proof: the call outcome and tail state from the database, and the exact /record text computed from the rows.
// Prints no keys. Writes docs/proof/p5-live.json.
import { writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import { recordText, summarize, type RecordCall } from "../src/core/record.js";

const db = new Database("data/tail.db", { readonly: true });
const calls = db.prepare("SELECT id, chat_id, symbol, side, entry_kind, entry, tp, sl, status, entered_at, entered_price, result_price, closed_at, card_message_id, receipt_message_id FROM calls ORDER BY id").all() as any[];
const tails = db.prepare("SELECT id, call_id, mode, status, size, order_id, close_reason, realized_pnl FROM tails ORDER BY id").all() as any[];
const channels = db.prepare("SELECT chat_id, title FROM channels").all() as { chat_id: number; title: string }[];

const records = channels.map((c) => {
  const rows: RecordCall[] = calls
    .filter((x) => x.chat_id === c.chat_id && !["draft", "cancelled"].includes(x.status))
    .map((x) => ({ symbol: x.symbol, side: x.side, entryKind: x.entry_kind, entry: x.entry, tp: x.tp, sl: x.sl, enteredPrice: x.entered_price, status: x.status }));
  const followers = (db.prepare(`SELECT COUNT(DISTINCT t.tg_id) n FROM tails t JOIN calls c ON c.id = t.call_id WHERE c.chat_id = ? AND t.status IN ('placed','filled','closed')`).get(c.chat_id) as { n: number }).n;
  return { title: c.title, summary: summarize(rows, followers), text: recordText(c.title, summarize(rows, followers)) };
});

const proof = { checkedAt: new Date().toISOString(), schemaVersion: db.pragma("user_version", { simple: true }), calls, tails, records };
writeFileSync("docs/proof/p5-live.json", JSON.stringify(proof, null, 2) + "\n");
console.log(JSON.stringify({ calls, tails }, null, 1));
for (const r of records) console.log("\n/record would show:\n" + r.text);
