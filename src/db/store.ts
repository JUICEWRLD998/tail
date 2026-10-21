// SQLite persistence (better-sqlite3). All statements are parameterised; callers pass `now` explicitly so tests are exact.
import Database from "better-sqlite3";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";

const SCHEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60_000;

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
}

const SETTING_COLUMNS = { riskPct: "risk_pct", maxLeverage: "max_leverage", maxNotionalUsd: "max_notional_usd" } as const;
export type SettingKey = keyof typeof SETTING_COLUMNS;

const TAIL_PATCH_COLUMNS = {
  status: "status", orderId: "order_id", primaryClientOrderId: "primary_client_order_id", fillPrice: "fill_price",
  error: "error", filledAt: "filled_at",
} as const;

const mapUser = (r: any): User => ({
  tgId: r.tg_id, chain: r.chain, address: r.address, strikeAccountId: r.strike_account_id, apiPub: r.api_pub,
  apiPrivEnc: r.api_priv_enc, builderCode: r.builder_code, riskPct: r.risk_pct, maxLeverage: r.max_leverage,
  maxNotionalUsd: r.max_notional_usd, linkedAt: r.linked_at,
});

const mapCall = (r: any): Call => ({
  id: r.id, chatId: r.chat_id, messageId: r.message_id, cardMessageId: r.card_message_id, rawText: r.raw_text,
  symbol: r.symbol, side: r.side, entryKind: r.entry_kind, entry: r.entry, tp: r.tp, sl: r.sl,
  leverageHint: r.leverage_hint, status: r.status, createdAt: r.created_at, closedAt: r.closed_at,
});

const mapTail = (r: any): Tail => ({
  id: r.id, callId: r.call_id, tgId: r.tg_id, mode: r.mode, strategyId: r.strategy_id,
  primaryClientOrderId: r.primary_client_order_id, orderId: r.order_id, size: r.size, notionalUsd: r.notional_usd,
  feeBps: r.fee_bps, status: r.status, fillPrice: r.fill_price, error: r.error, createdAt: r.created_at, filledAt: r.filled_at,
});

export function openStore(path: string) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

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
      const r = q.getChannel.get(chatId) as any;
      return r && { chatId: r.chat_id, title: r.title, kind: r.kind, callerTgId: r.caller_tg_id, builderCode: r.builder_code, feeBps: r.fee_bps, createdAt: r.created_at };
    },

    createDraftCall: (c: Omit<Call, "id" | "cardMessageId" | "status" | "closedAt">): number =>
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
    updateTail(id: number, patch: Partial<Record<keyof typeof TAIL_PATCH_COLUMNS, string>>) {
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

    recordMiss(symbol: string, chatId: number) {
      q.miss.run(symbol, chatId);
    },
    missCount: (symbol: string, chatId: number): number => (q.getMiss.get(symbol, chatId) as { count: number } | undefined)?.count ?? 0,
  };
}

export type Store = ReturnType<typeof openStore>;
