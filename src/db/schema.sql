-- Tail schema. Timestamps are ISO 8601 UTC strings; prices and sizes are decimal strings.
CREATE TABLE IF NOT EXISTS users (
  tg_id             INTEGER PRIMARY KEY,
  chain             TEXT NOT NULL,
  address           TEXT NOT NULL,
  strike_account_id TEXT NOT NULL,
  api_pub           TEXT NOT NULL,
  api_priv_enc      TEXT,                      -- AES-256-GCM blob; NULL after /revoke
  builder_code      TEXT,                      -- NULL for personal API wallets (no builder fee)
  risk_pct          TEXT NOT NULL DEFAULT '1',
  max_leverage      TEXT NOT NULL DEFAULT '5',
  max_notional_usd  TEXT NOT NULL DEFAULT '500',
  linked_at         TEXT NOT NULL,
  revoked_at        TEXT
);

CREATE TABLE IF NOT EXISTS channels (
  chat_id       INTEGER PRIMARY KEY,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('channel', 'group')),
  caller_tg_id  INTEGER NOT NULL,
  builder_code  TEXT,
  fee_bps       INTEGER,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_codes (
  code        TEXT PRIMARY KEY,
  tg_id       INTEGER NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE TABLE IF NOT EXISTS calls (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id          INTEGER NOT NULL,
  message_id       INTEGER,
  card_message_id  INTEGER,
  raw_text         TEXT NOT NULL,
  symbol           TEXT NOT NULL,
  side             TEXT NOT NULL CHECK (side IN ('long', 'short')),
  entry_kind       TEXT NOT NULL CHECK (entry_kind IN ('limit', 'market')),
  entry            TEXT,
  tp               TEXT NOT NULL,
  sl               TEXT NOT NULL,
  leverage_hint    INTEGER,
  status           TEXT NOT NULL CHECK (status IN ('draft', 'open', 'tp_hit', 'sl_hit', 'expired', 'cancelled')),
  created_at       TEXT NOT NULL,
  closed_at        TEXT
);

CREATE TABLE IF NOT EXISTS tails (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id                  INTEGER NOT NULL REFERENCES calls(id),
  tg_id                    INTEGER NOT NULL,
  mode                     TEXT NOT NULL CHECK (mode IN ('tail', 'fade')),
  strategy_id              TEXT NOT NULL,
  primary_client_order_id  TEXT,
  order_id                 TEXT,
  size                     TEXT NOT NULL,
  notional_usd             TEXT NOT NULL,
  fee_bps                  INTEGER NOT NULL DEFAULT 0,
  status                   TEXT NOT NULL CHECK (status IN ('quoted', 'placed', 'filled', 'rejected', 'cancelled', 'closed')),
  fill_price               TEXT,
  error                    TEXT,
  created_at               TEXT NOT NULL,
  filled_at                TEXT
);
-- One live tail per follower per call; a rejected or abandoned quote does not block another try.
CREATE UNIQUE INDEX IF NOT EXISTS tails_one_live ON tails(call_id, tg_id) WHERE status IN ('placed', 'filled', 'closed');

CREATE TABLE IF NOT EXISTS misses (
  symbol   TEXT NOT NULL,
  chat_id  INTEGER NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (symbol, chat_id)
);

-- Builder Connect: a one-time link token (10 min) bound to the Telegram user who asked for it.
CREATE TABLE IF NOT EXISTS connect_tokens (
  token       TEXT PRIMARY KEY,
  tg_id       INTEGER NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

-- The API wallet key generated for a connect attempt, held (encrypted) until the wallet signature arrives (5 min).
CREATE TABLE IF NOT EXISTS connect_pending (
  nonce         TEXT PRIMARY KEY,
  token         TEXT NOT NULL,
  tg_id         INTEGER NOT NULL,
  address       TEXT NOT NULL,
  chain         TEXT NOT NULL,
  api_pub       TEXT NOT NULL,
  api_priv_enc  TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);
