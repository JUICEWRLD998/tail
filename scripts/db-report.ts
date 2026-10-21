// Read-only report of Tail's database for proof and debugging. Prints no keys, no tokens, no full addresses.
import Database from "better-sqlite3";

const path = process.argv[2] ?? "data/tail.db";
const db = new Database(path, { readonly: true });
const rows = (sql: string) => db.prepare(sql).all();

const report = {
  users: rows(`SELECT tg_id, chain, substr(address, 1, 6) || '…' || substr(address, -4) AS address, builder_code,
                      risk_pct, max_leverage, max_notional_usd, api_priv_enc IS NOT NULL AS has_key,
                      substr(api_priv_enc, 1, 3) AS key_format FROM users`),
  channels: rows("SELECT chat_id, title, kind, caller_tg_id FROM channels"),
  calls: rows("SELECT id, chat_id, symbol, side, entry_kind, entry, tp, sl, status, card_message_id FROM calls"),
  tails: rows("SELECT id, call_id, tg_id, mode, size, notional_usd, status, order_id, primary_client_order_id, error FROM tails"),
  misses: rows("SELECT symbol, chat_id, count FROM misses"),
};
console.log(JSON.stringify(report, null, 2));
