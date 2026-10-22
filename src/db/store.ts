// SQLite persistence (better-sqlite3). All statements are parameterised; callers pass `now` explicitly so tests are exact.
import Database from "better-sqlite3";
import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";

const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60_000;
const TOKEN_TTL_MS = 10 * 60_000;
const PENDING_TTL_MS = 5 * 60_000;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export interface User {
  tgId: number;
  chain: string;
  address: string;
  strikeAccountId: string;
  apiPub: string;
  apiPrivEnc: string;
  builderCode: string | null;
  riskPct: string;
  maxLeverage: string;
  maxNotionalUsd: string;
  linkedAt: string;
}

export interface Channel {
  chatId: number;
  title: string;
  kind: "channel" | "group";
  callerTgId: number;
  builderCode: string | null;
  feeBps: number | null;
  createdAt: string;
}

export type CallStatus = "draft" | "open" | "tp_hit" | "sl_hit" | "expired" | "cancelled";

export interface Call {
  id: number;
  chatId: number;
  messageId: number | null;
  cardMessageId: number | null;
  rawText: string;
  symbol: string;
  side: "long" | "short";
  entryKind: "limit" | "market";
  entry: string | null;
  tp: string;
  sl: string;
  leverageHint: number | null;
  status: CallStatus;
  createdAt: string;
  closedAt: string | null;
  /** When the price first reached the call's entry (or the first sample, for a market call). */
  enteredAt: string | null;
  enteredPrice: string | null;
  /** The mark price that ended the call (tp_hit, sl_hit, expired). */
  resultPrice: string | null;
  /** The receipt message posted as a reply to the card. */
  receiptMessageId: number | null;
}

export type TailStatus = "quoted" | "placed" | "filled" | "rejected" | "cancelled" | "closed";

export interface Tail {
  id: number;
  callId: number;
  tgId: number;
  mode: "tail" | "fade";
  strategyId: string;
  primaryClientOrderId: string | null;
  orderId: string | null;
  size: string;
  notionalUsd: string;
  feeBps: number;
  status: TailStatus;
  fillPrice: string | null;
  error: string | null;
  createdAt: string;
  filledAt: string | null;
  tpClientOrderId: string | null;
  slClientOrderId: string | null;
  closedAt: string | null;
  realizedPnl: string | null;
  /** "tp" or "sl" when a protective leg closed the position. */
  closeReason: string | null;
}

const SETTING_COLUMNS = { riskPct: "risk_pct", maxLeverage: "max_leverage", maxNotionalUsd: "max_notional_usd" } as const;
export type SettingKey = keyof typeof SETTING_COLUMNS;

const TAIL_PATCH_COLUMNS = {
  status: "status", orderId: "order_id", primaryClientOrderId: "primary_client_order_id", fillPrice: "fill_price",
  error: "error", filledAt: "filled_at", tpClientOrderId: "tp_client_order_id", slClientOrderId: "sl_client_order_id",
  closedAt: "closed_at", realizedPnl: "realized_pnl", closeReason: "close_reason",
} as const;

const mapUser = (r: any): User => ({
  tgId: r.tg_id, chain: r.chain, address: r.address, strikeAccountId: r.strike_account_id, apiPub: r.api_pub,
  apiPrivEnc: r.api_priv_enc, builderCode: r.builder_code, riskPct: r.risk_pct, maxLeverage: r.max_leverage,
  maxNotionalUsd: r.max_notional_usd, linkedAt: r.linked_at,
});

const mapChannel = (r: any): Channel => ({
  chatId: r.chat_id, title: r.title, kind: r.kind, callerTgId: r.caller_tg_id, builderCode: r.builder_code,
  feeBps: r.fee_bps, createdAt: r.created_at,
});

const mapCall = (r: any): Call => ({
  id: r.id, chatId: r.chat_id, messageId: r.message_id, cardMessageId: r.card_message_id, rawText: r.raw_text,
  symbol: r.symbol, side: r.side, entryKind: r.entry_kind, entry: r.entry, tp: r.tp, sl: r.sl,
  leverageHint: r.leverage_hint, status: r.status, createdAt: r.created_at, closedAt: r.closed_at,
  enteredAt: r.entered_at ?? null, enteredPrice: r.entered_price ?? null, resultPrice: r.result_price ?? null,
  receiptMessageId: r.receipt_message_id ?? null,
});

const mapTail = (r: any): Tail => ({
  id: r.id, callId: r.call_id, tgId: r.tg_id, mode: r.mode, strategyId: r.strategy_id,
  primaryClientOrderId: r.primary_client_order_id, orderId: r.order_id, size: r.size, notionalUsd: r.notional_usd,
  feeBps: r.fee_bps, status: r.status, fillPrice: r.fill_price, error: r.error, createdAt: r.created_at, filledAt: r.filled_at,
  tpClientOrderId: r.tp_client_order_id ?? null, slClientOrderId: r.sl_client_order_id ?? null, closedAt: r.closed_at ?? null,
  realizedPnl: r.realized_pnl ?? null, closeReason: r.close_reason ?? null,
});

/**
 * schema.sql is version 1 (the baseline P3/P4 shipped). Each entry below upgrades by one version, in a transaction,
 * and the same list builds a fresh database, so a fresh and a migrated database cannot drift apart.
 */
const MIGRATIONS: string[] = [
  // v2 (P5): live state. Leg order ids for reconciliation, close details, and call outcome tracking.
  `ALTER TABLE tails ADD COLUMN tp_client_order_id TEXT;
   ALTER TABLE tails ADD COLUMN sl_client_order_id TEXT;
   ALTER TABLE tails ADD COLUMN closed_at TEXT;
   ALTER TABLE tails ADD COLUMN realized_pnl TEXT;
   ALTER TABLE tails ADD COLUMN close_reason TEXT;
   ALTER TABLE calls ADD COLUMN entered_at TEXT;
   ALTER TABLE calls ADD COLUMN entered_price TEXT;
   ALTER TABLE calls ADD COLUMN result_price TEXT;
   ALTER TABLE calls ADD COLUMN receipt_message_id INTEGER;`,
  // v3 (P6): a question the parser asked a caller, kept until they tap an answer (single use, 15 minutes).
  `CREATE TABLE IF NOT EXISTS asks (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     tg_id       INTEGER NOT NULL,
     chat_id     INTEGER NOT NULL,
     message_id  INTEGER,
     raw_text    TEXT NOT NULL,
     field       TEXT NOT NULL,
     options     TEXT NOT NULL,
     created_at  TEXT NOT NULL,
     used_at     TEXT
   );`,
];
const ASK_TTL_MS = 15 * 60_000;

export function openStore(path: string, opts: { extraMigrations?: string[] } = {}) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  const migrations = [...MIGRATIONS, ...(opts.extraMigrations ?? [])];
  const stored = db.pragma("user_version", { simple: true }) as number;
  const version = Math.max(stored, 1); // a database from before migrations existed (0) is the v1 baseline
  if (version > migrations.length + 1) {
    db.close();
    throw new Error("this database was written by a newer version of Tail");
  }
  try {
    for (let v = version; v <= migrations.length; v++) {
      db.transaction(() => {
        db.exec(migrations[v - 1] as string);
        db.pragma(`user_version = ${v + 1}`);
      })();
    }
  } catch (e) {
    db.close();
    throw e;
  }

  const q = {
    getUser: db.prepare("SELECT * FROM users WHERE tg_id = ? AND revoked_at IS NULL AND api_priv_enc IS NOT NULL"),
    rawUser: db.prepare("SELECT * FROM users WHERE tg_id = ?"),
    linkUser: db.prepare(`
      INSERT INTO users (tg_id, chain, address, strike_account_id, api_pub, api_priv_enc, builder_code, linked_at)
      VALUES (@tgId, @chain, @address, @strikeAccountId, @apiPub, @apiPrivEnc, @builderCode, @linkedAt)
      ON CONFLICT(tg_id) DO UPDATE SET chain = excluded.chain, address = excluded.address,
        strike_account_id = excluded.strike_account_id, api_pub = excluded.api_pub, api_priv_enc = excluded.api_priv_enc,
        builder_code = excluded.builder_code, linked_at = excluded.linked_at, revoked_at = NULL`),
    revoke: db.prepare("UPDATE users SET api_priv_enc = NULL, revoked_at = ? WHERE tg_id = ?"),
    newCode: db.prepare("INSERT INTO channel_codes (code, tg_id, expires_at) VALUES (?, ?, ?)"),
    getCode: db.prepare("SELECT * FROM channel_codes WHERE code = ? AND used_at IS NULL AND expires_at > ?"),
    useCode: db.prepare("UPDATE channel_codes SET used_at = ? WHERE code = ?"),
    upsertChannel: db.prepare(`
      INSERT INTO channels (chat_id, title, kind, caller_tg_id, created_at) VALUES (@chatId, @title, @kind, @callerTgId, @createdAt)
      ON CONFLICT(chat_id) DO UPDATE SET title = excluded.title, kind = excluded.kind, caller_tg_id = excluded.caller_tg_id`),
    getChannel: db.prepare("SELECT * FROM channels WHERE chat_id = ?"),
    channelsOf: db.prepare("SELECT * FROM channels WHERE caller_tg_id = ?"),
    newCall: db.prepare(`
      INSERT INTO calls (chat_id, message_id, raw_text, symbol, side, entry_kind, entry, tp, sl, leverage_hint, status, created_at)
      VALUES (@chatId, @messageId, @rawText, @symbol, @side, @entryKind, @entry, @tp, @sl, @leverageHint, 'draft', @createdAt)`),
    getCall: db.prepare("SELECT * FROM calls WHERE id = ?"),
    openCall: db.prepare("UPDATE calls SET status = 'open', card_message_id = ? WHERE id = ? AND status = 'draft'"),
    cancelDraft: db.prepare("UPDATE calls SET status = 'cancelled' WHERE id = ? AND status = 'draft'"),
    newTail: db.prepare(`
      INSERT INTO tails (call_id, tg_id, mode, strategy_id, size, notional_usd, fee_bps, status, created_at)
      VALUES (@callId, @tgId, @mode, @strategyId, @size, @notionalUsd, @feeBps, 'quoted', @createdAt)`),
    getTail: db.prepare("SELECT * FROM tails WHERE id = ?"),
    liveTail: db.prepare("SELECT * FROM tails WHERE call_id = ? AND tg_id = ? AND status IN ('placed','filled','closed')"),
    counts: db.prepare(`
      SELECT mode, COUNT(*) n FROM tails WHERE call_id = ? AND status IN ('placed','filled','closed') GROUP BY mode`),
    liveCount: db.prepare("SELECT COUNT(*) n FROM tails WHERE tg_id = ? AND status IN ('placed','filled')"),
    retireTokens: db.prepare("UPDATE connect_tokens SET used_at = ? WHERE tg_id = ? AND used_at IS NULL"),
    newToken: db.prepare("INSERT INTO connect_tokens (token, tg_id, expires_at) VALUES (?, ?, ?)"),
    getToken: db.prepare("SELECT tg_id FROM connect_tokens WHERE token = ? AND used_at IS NULL AND expires_at > ?"),
    useToken: db.prepare("UPDATE connect_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL"),
    newPending: db.prepare(`
      INSERT OR REPLACE INTO connect_pending (nonce, token, tg_id, address, chain, api_pub, api_priv_enc, expires_at)
      VALUES (@nonce, @token, @tgId, @address, @chain, @apiPub, @apiPrivEnc, @expiresAt)`),
    getPending: db.prepare("SELECT * FROM connect_pending WHERE nonce = ? AND token = ? AND expires_at > ?"),
    delPending: db.prepare("DELETE FROM connect_pending WHERE nonce = ?"),
    openCalls: db.prepare("SELECT * FROM calls WHERE status = 'open' ORDER BY id"),
    markEntered: db.prepare("UPDATE calls SET entered_at = ?, entered_price = ? WHERE id = ? AND status = 'open' AND entered_at IS NULL"),
    finishCall: db.prepare("UPDATE calls SET status = ?, result_price = ?, closed_at = ? WHERE id = ? AND status = 'open'"),
    setReceipt: db.prepare("UPDATE calls SET receipt_message_id = ? WHERE id = ?"),
    missingReceipt: db.prepare(`
      SELECT * FROM calls WHERE status IN ('tp_hit','sl_hit','expired') AND receipt_message_id IS NULL
        AND card_message_id IS NOT NULL AND closed_at > ? AND closed_at <= ? ORDER BY id`),
    activeTails: db.prepare("SELECT * FROM tails WHERE status IN ('placed','filled') ORDER BY id"),
    callsOfChat: db.prepare("SELECT * FROM calls WHERE chat_id = ? AND status NOT IN ('draft','cancelled') ORDER BY id"),
    followersIn: db.prepare(`
      SELECT COUNT(DISTINCT t.tg_id) n FROM tails t JOIN calls c ON c.id = t.call_id
      WHERE c.chat_id = ? AND t.status IN ('placed','filled','closed')`),
    newAsk: db.prepare("INSERT INTO asks (tg_id, chat_id, message_id, raw_text, field, options, created_at) VALUES (@tgId, @chatId, @messageId, @rawText, @field, @options, @createdAt)"),
    getAsk: db.prepare("SELECT * FROM asks WHERE id = ? AND tg_id = ? AND used_at IS NULL AND created_at > ?"),
    useAsk: db.prepare("UPDATE asks SET used_at = ? WHERE id = ? AND used_at IS NULL"),
    miss: db.prepare(`
      INSERT INTO misses (symbol, chat_id, count) VALUES (?, ?, 1)
      ON CONFLICT(symbol, chat_id) DO UPDATE SET count = count + 1`),
    getMiss: db.prepare("SELECT count FROM misses WHERE symbol = ? AND chat_id = ?"),
  };

  return {
    close: () => db.close(),

    linkUser(u: Omit<User, "riskPct" | "maxLeverage" | "maxNotionalUsd">) {
      q.linkUser.run(u);
    },
    getUser: (tgId: number): User | undefined => {
      const r = q.getUser.get(tgId);
      return r ? mapUser(r) : undefined;
    },
    rawUserRow: (tgId: number) => q.rawUser.get(tgId) as Record<string, unknown> | undefined,
    revokeUser(tgId: number, now: string) {
      q.revoke.run(now, tgId);
    },
    setSetting(tgId: number, key: SettingKey, value: string) {
      const col = SETTING_COLUMNS[key];
      if (!col) throw new Error(`unknown setting: ${String(key)}`);
      db.prepare(`UPDATE users SET ${col} = ? WHERE tg_id = ?`).run(value, tgId);
    },

    createChannelCode(tgId: number, now: string): string {
      for (;;) {
        const code = "TAIL-" + Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
        try {
          q.newCode.run(code, tgId, new Date(Date.parse(now) + CODE_TTL_MS).toISOString());
          return code;
        } catch {
          /* collision: draw again */
        }
      }
    },
    consumeChannelCode(code: string, now: string): number | undefined {
      const c = code.trim().toUpperCase();
      return db.transaction(() => {
        const row = q.getCode.get(c, now) as { tg_id: number } | undefined;
        if (!row) return undefined;
        q.useCode.run(now, c);
        return row.tg_id;
      })();
    },

    registerChannel(c: { chatId: number; title: string; kind: "channel" | "group"; callerTgId: number; createdAt: string }) {
      q.upsertChannel.run(c);
    },
    getChannel: (chatId: number): Channel | undefined => {
      const r = q.getChannel.get(chatId);
      return r ? mapChannel(r) : undefined;
    },
    channelsOf: (tgId: number): Channel[] => q.channelsOf.all(tgId).map(mapChannel),

    createDraftCall: (c: Omit<Call, "id" | "cardMessageId" | "status" | "closedAt" | "enteredAt" | "enteredPrice" | "resultPrice" | "receiptMessageId">): number =>
      Number(q.newCall.run({ ...c, messageId: c.messageId ?? null }).lastInsertRowid),
    getCall: (id: number): Call | undefined => {
      const r = q.getCall.get(id);
      return r ? mapCall(r) : undefined;
    },
    openCall(id: number, cardMessageId: number) {
      if (q.openCall.run(cardMessageId, id).changes !== 1) throw new Error(`call ${id} is not a draft`);
    },
    cancelDraft(id: number) {
      q.cancelDraft.run(id);
    },

    createTail: (t: { callId: number; tgId: number; mode: "tail" | "fade"; strategyId: string; size: string; notionalUsd: string; feeBps: number; createdAt: string }): number =>
      Number(q.newTail.run(t).lastInsertRowid),
    getTail: (id: number): Tail | undefined => {
      const r = q.getTail.get(id);
      return r ? mapTail(r) : undefined;
    },
    /** A field set to null is cleared back to NULL; an undefined field is left alone. */
    updateTail(id: number, patch: Partial<Record<keyof typeof TAIL_PATCH_COLUMNS, string | null>>) {
      const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
      if (entries.length === 0) return;
      const sets = entries.map(([k]) => {
        const col = TAIL_PATCH_COLUMNS[k as keyof typeof TAIL_PATCH_COLUMNS];
        if (!col) throw new Error(`unknown tail field: ${k}`);
        return `${col} = ?`;
      });
      db.prepare(`UPDATE tails SET ${sets.join(", ")} WHERE id = ?`).run(...entries.map(([, v]) => v), id);
    },
    /** Atomically moves a quote to `placed` before anything is sent to Strike. False if already claimed or a live tail exists. */
    claimTail(id: number): boolean {
      try {
        return db.prepare("UPDATE tails SET status = 'placed' WHERE id = ? AND status = 'quoted'").run(id).changes === 1;
      } catch (e) {
        if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") return false;
        throw e;
      }
    },
    findLiveTail: (callId: number, tgId: number): Tail | undefined => {
      const r = q.liveTail.get(callId, tgId);
      return r ? mapTail(r) : undefined;
    },
    tailCounts(callId: number): { tailed: number; faded: number } {
      const rows = q.counts.all(callId) as { mode: string; n: number }[];
      return { tailed: rows.find((r) => r.mode === "tail")?.n ?? 0, faded: rows.find((r) => r.mode === "fade")?.n ?? 0 };
    },
    countLiveTails: (tgId: number): number => (q.liveCount.get(tgId) as { n: number }).n,

    createConnectToken(tgId: number, now: string): string {
      const token = randomBytes(32).toString("base64url");
      db.transaction(() => {
        q.retireTokens.run(now, tgId);
        q.newToken.run(token, tgId, new Date(Date.parse(now) + TOKEN_TTL_MS).toISOString());
      })();
      return token;
    },
    peekConnectToken(token: string, now: string): number | undefined {
      if (!TOKEN_RE.test(token)) return undefined;
      return (q.getToken.get(token, now) as { tg_id: number } | undefined)?.tg_id;
    },
    consumeConnectToken(token: string, now: string): number | undefined {
      if (!TOKEN_RE.test(token)) return undefined;
      return db.transaction(() => {
        const row = q.getToken.get(token, now) as { tg_id: number } | undefined;
        if (!row) return undefined;
        q.useToken.run(now, token);
        return row.tg_id;
      })();
    },

    savePending(p: { nonce: string; token: string; tgId: number; address: string; chain: string; apiPub: string; apiPrivEnc: string; createdAt: string }) {
      q.newPending.run({ ...p, expiresAt: new Date(Date.parse(p.createdAt) + PENDING_TTL_MS).toISOString() });
    },
    takePending(nonce: string, token: string, now: string) {
      return db.transaction(() => {
        const r = q.getPending.get(nonce, token, now) as any;
        if (!r) return undefined;
        q.delPending.run(nonce);
        return { nonce: r.nonce as string, tgId: r.tg_id as number, address: r.address as string, chain: r.chain as string, apiPub: r.api_pub as string, apiPrivEnc: r.api_priv_enc as string };
      })();
    },

    openCalls: (): Call[] => q.openCalls.all().map(mapCall),
    /** Records the entry once; false if the call already entered or is no longer open. */
    markEntered: (id: number, price: string, at: string): boolean => q.markEntered.run(at, price, id).changes === 1,
    /** Closes an open call exactly once; the first caller wins and a later one gets false. */
    finishCall: (id: number, r: { status: "tp_hit" | "sl_hit" | "expired"; resultPrice: string | null; closedAt: string }): boolean =>
      q.finishCall.run(r.status, r.resultPrice, r.closedAt, id).changes === 1,
    setReceipt(id: number, messageId: number) {
      q.setReceipt.run(messageId, id);
    },
    /** Finished calls whose receipt never posted, within a recent window, so a Telegram outage does not lose it. */
    callsMissingReceipt: (nowIso: string, windowMs: number, graceMs: number): Call[] =>
      q.missingReceipt.all(new Date(Date.parse(nowIso) - windowMs).toISOString(), new Date(Date.parse(nowIso) - graceMs).toISOString()).map(mapCall),
    activeTails: (): Tail[] => q.activeTails.all().map(mapTail),
    callsOfChat: (chatId: number): Call[] => q.callsOfChat.all(chatId).map(mapCall),
    followersIn: (chatId: number): number => (q.followersIn.get(chatId) as { n: number }).n,

    createAsk: (a: { tgId: number; chatId: number; messageId: number | null; rawText: string; field: string; options: string[]; createdAt: string }): number =>
      Number(q.newAsk.run({ ...a, messageId: a.messageId ?? null, options: JSON.stringify(a.options) }).lastInsertRowid),
    peekAsk(id: number, tgId: number, now: string) {
      const r = q.getAsk.get(id, tgId, new Date(Date.parse(now) - ASK_TTL_MS).toISOString()) as any;
      return r ? { chatId: r.chat_id as number, messageId: r.message_id as number | null, rawText: r.raw_text as string, field: r.field as string, options: JSON.parse(r.options) as string[] } : undefined;
    },
    /** Returns a pending question once, only to the caller it was asked of; a wrong caller does not burn it. */
    takeAsk(id: number, tgId: number, now: string) {
      return db.transaction(() => {
        const r = q.getAsk.get(id, tgId, new Date(Date.parse(now) - ASK_TTL_MS).toISOString()) as any;
        if (!r) return undefined;
        if (q.useAsk.run(now, id).changes !== 1) return undefined;
        return { chatId: r.chat_id as number, messageId: r.message_id as number | null, rawText: r.raw_text as string, field: r.field as string, options: JSON.parse(r.options) as string[] };
      })();
    },

    recordMiss(symbol: string, chatId: number) {
      q.miss.run(symbol, chatId);
    },
    missCount: (symbol: string, chatId: number): number => (q.getMiss.get(symbol, chatId) as { count: number } | undefined)?.count ?? 0,
  };
}

export type Store = ReturnType<typeof openStore>;
