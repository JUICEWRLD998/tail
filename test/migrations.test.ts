import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openStore } from "../src/db/store.js";

const BASELINE = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
const tmp = () => join(mkdtempSync(join(tmpdir(), "tail-mig-")), "tail.db");

const cols = (path: string, table: string) => {
  const db = new Database(path, { readonly: true });
  const names = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name).sort();
  db.close();
  return names;
};
const version = (path: string) => {
  const db = new Database(path, { readonly: true });
  const v = db.pragma("user_version", { simple: true }) as number;
  db.close();
  return v;
};

/** A database as P3/P4 left it: baseline schema, no user_version, real rows. */
function legacyDb(path: string) {
  const db = new Database(path);
  db.exec(BASELINE);
  db.prepare("INSERT INTO channels (chat_id, title, kind, caller_tg_id, created_at) VALUES (-1, 'T', 'channel', 9, 't')").run();
  db.prepare("INSERT INTO calls (chat_id, raw_text, symbol, side, entry_kind, entry, tp, sl, status, created_at) VALUES (-1, 'x', 'ETH-USD', 'long', 'limit', '2480', '2560', '2420', 'open', 't')").run();
  db.prepare("INSERT INTO tails (call_id, tg_id, mode, strategy_id, size, notional_usd, fee_bps, status, order_id, created_at) VALUES (1, 5, 'tail', 's', '0.009', '22', 0, 'placed', '243140879', 't')").run();
  db.close();
}

describe("schema migrations", () => {
  it("a legacy database gains the P5 columns and keeps every row", () => {
    const path = tmp();
    legacyDb(path);
    const store = openStore(path);
    expect(store.getTail(1)).toMatchObject({ orderId: "243140879", status: "placed", tpClientOrderId: null, slClientOrderId: null, closedAt: null });
    expect(store.getCall(1)).toMatchObject({ status: "open", enteredAt: null, enteredPrice: null, resultPrice: null, receiptMessageId: null });
    store.close();
    expect(cols(path, "tails")).toEqual(expect.arrayContaining(["tp_client_order_id", "sl_client_order_id", "closed_at", "realized_pnl", "close_reason"]));
    expect(cols(path, "calls")).toEqual(expect.arrayContaining(["entered_at", "entered_price", "result_price", "receipt_message_id"]));
  });

  it("a fresh database ends up with exactly the same columns as a migrated one", () => {
    const fresh = tmp();
    openStore(fresh).close();
    const old = tmp();
    legacyDb(old);
    openStore(old).close();
    for (const t of ["tails", "calls", "users", "channels", "connect_tokens"]) expect(cols(fresh, t)).toEqual(cols(old, t));
  });

  it("records the schema version and is idempotent when opened again", () => {
    const path = tmp();
    legacyDb(path);
    openStore(path).close();
    const v = version(path);
    expect(v).toBeGreaterThanOrEqual(2);
    openStore(path).close();
    openStore(path).close();
    expect(version(path)).toBe(v);
  });

  it("refuses to open a database written by a newer version of Tail", () => {
    const path = tmp();
    openStore(path).close();
    const db = new Database(path);
    db.pragma("user_version = 999");
    db.close();
    expect(() => openStore(path)).toThrow(/newer/);
  });

  it("a failing migration leaves the database unchanged (it runs in a transaction)", () => {
    const path = tmp();
    legacyDb(path);
    expect(() => openStore(path, { extraMigrations: ["ALTER TABLE tails ADD COLUMN good_col TEXT; ALTER TABLE nope ADD COLUMN x TEXT;"] })).toThrow();
    expect(cols(path, "tails")).not.toContain("good_col");
    openStore(path).close();
    expect(cols(path, "tails")).toContain("tp_client_order_id");
  });
});
