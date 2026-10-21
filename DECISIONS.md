# DECISIONS (newest first)

**Mustapha Fadhlullah — independent security researcher**

## 2026-10-21 20:05 UTC: builder code live; Spike E passed; signing accepted by Strike

- **Spike E PASSED (live, testnet).** `BUILDER_CODE=sigma`, fee share 10 bps. `request-signature` 200 (message says "collect up
  to 0.1% fee": 10 bps = 0.1%, VERIFIED). `verify-signature` 200 for a throwaway Solana wallet: account created,
  `api_wallet_id` 465, `api_wallet_expired_at` 9999-12-31 (the builder API wallet does not expire), `fee_share_bps` 10,
  `referral.status` not_requested. Solana path via base58 and Ed25519 works with no browser. The test account is test
  activity, not a user.
- **Spike A PASSED (live), using that builder API wallet.** Signed `GET /v2/account` and `GET /v2/positions` return 200.
  Equity field: `margin_balance` (also `wallet_balance`, `available_balance`) present, as the spec says; this account holds
  0, so it proves the field exists, not a funded balance. Planted control: the same request signed by an unregistered key
  returns `401 {"error":"authentication failed"}`. So `sign.ts` is accepted by Strike (closes the OPEN signing item).
  Account also reports `default_leverage` 10, `default_margin_mode` cross. Raw output in `docs/proof/spike-a.json`.
- Remaining P0: B (bracket) and C (fills) need a funded account; D (Telegram) needs the bot token in the environment.
- The scripted follower's key is in `keys/` (git-ignored). `.env` (git-ignored, mode 600) holds the dev values.

## 2026-10-21 17:20 UTC: P1 pure core done; P0 spikes written, waiting on keys

Gate passed (17:01 UTC, after 15:00). Per his call, work continues without the keys; spikes run when they arrive.

**P1 (exit check: `npm test` green, coverage for core and sign.ts): met, with one open item.**
- 90 tests green, `src/core` 96% statements / 91% branches (`npm run test:cov`).
- `src/core`: `dec.ts` (exact BigInt decimals), `symbols.ts`, `parser.ts`, `sizing.ts`, `fade.ts`. `src/strike/sign.ts`.
- Planted controls: rounding sizes with round instead of floor fails 4 sizing tests; disabling the level-order check fails 4
  parser tests. Both reverted, suite green.
- OPEN: the `sign.ts` test vector is checked against RFC 8032 and the documented message format, **not** against a request
  Strike accepted. UNVERIFIED until Spike A.
- OPEN: parser fixtures are format examples written from the plan. Public-channel calls are not collected yet (P6 needs
  20 unseen ones). They are labelled as such in each fixture header.
- CORRECTED in `implementation.md` §0: the GET body hash is sha256 of the empty string, not an empty field.
- `README.md` and `CLAIMS.md` written with LIVE / NEXT / NOT LIVE only.

**P0:** `scripts/keygen.ts`, `scripts/spike-a.ts`, `scripts/spike-b.ts` written; they stop with `MISSING ENV` when keys are
absent and refuse to run off testnet. Spikes A-E have **not** run, so P0's exit check has not passed. Spikes C, D, E are
not written yet (C needs a funded account, D needs the bot token, E needs `BUILDER_CODE`).
- VERIFIED from the spec: `DELETE /v2/order/cancel-all` needs a JSON body (`{}` for all symbols); `POST /v2/order/strategy`
  rejects TP type not `take_profit*` and SL type not `stop*` (`invalid_secondary_order`).
- VERIFIED live: `GET /price/v2/premiumIndex?symbol=ADA-USD` returns `markPrice`. On testnet ADA-USD last price 0.2337 vs
  mark 0.2275 (about 2.7% apart); `limitTakeBound` is 0.05, so Spike B puts its limit 3% under mark.
- Spike E, step 1 (partial, live, 2026-10-21 17:30 UTC): `POST /auth/builder/request-signature` on testnet with
  `code: sigma` returns `404 {"error":"builder code not found"}`, identical to a bogus code. So `sigma` is **not
  registered on testnet** (VERIFIED). The 404 shape and the endpoint are confirmed. verify-signature not reached.
  `scripts/scripted-follower.ts` is written and stops with `MISSING ENV: BUILDER_CODE` when unset.
- VERIFIED (docs): builder fee share is capped at 100 bps (1%). His registration form shows a 1% fee rate; a $100 minimum
  was reported on the registration page (not in the docs). Which site, testnet or mainnet, is still unconfirmed.

## 2026-10-21 13:40 UTC: P0 pre-flight (read-only; no product code written)

Status: P0 NOT passed. P1 NOT started. Reasons below.

### Gate: first code commit after 15:00 UTC
Session clock read 13:31 UTC. `implementation.md` §0 puts the first product-code commit after 15:00 UTC on 2026-10-21
(safe under both readings of "10:00 EST"). Nothing under `src/`, `scripts/`, `test/` or `web/` has been written.
This file is documentation, not product code.

### Environment
| Check | Result | Tag |
|---|---|---|
| `GET https://api-v2-testnet.strikefinance.org/v2/ping` | `{}` HTTP 200 | VERIFIED (live, 2026-10-21) |
| `GET https://api-v2-testnet.strikefinance.org/v2/time` | `{"serverTime":1792589517713}` | VERIFIED (live) |
| `https://api.telegram.org` | HTTP 302 (reachable) | VERIFIED (live) |
| `https://docs.strikefinance.org/llms.txt` | HTTP 200 | VERIFIED (live) |
| Node | **v22.22.0**; the plan and CLAUDE.md say Node 24 | VERIFIED. Decide before P1: pin `engines` to >=22 or have the setup script install 24. `better-sqlite3` needs a prebuild for whichever it is |
| Env vars `TELEGRAM_BOT_TOKEN`, `TAIL_KEK`, `STRIKE_NETWORK`, `BUILDER_CODE`, `BUILDER_FEE_BPS`, `SPIKE_API_PRIV`, `SPIKE_API_PUB`, `TAIL_MODE` | all **unset** in this session | VERIFIED |

### UNVERIFIED items from `implementation.md` §0, status now
| Item | Answer | Source / tag |
|---|---|---|
| Account equity field | `GET /v2/account` returns `wallet_balance`, `available_balance`, `margin_balance`, `unrealized_pnl`. `margin_balance` = cross margin balance (wallet − isolated + cross uPnL). `available_balance` = free for new orders (can go negative). Sizing should use `margin_balance` as equity; confirm against a live account in Spike A | OpenAPI `user-api.yaml` lines 245-268. VERIFIED (spec); live confirmation pending Spike A |
| Fill fee fields | `/v2/history/fill` has `fee` (negative = maker rebate), `fee_type` (none, commission, liquidation, funding, mixed), `liquidation_fee`. **No builder-fee field seen** in the fill schema. Builder fee reporting stays UNVERIFIED until Spike C reads a real fill | `user-api.yaml` lines 868-884. VERIFIED (spec) |
| `/ws/user-api` logon | Frame `{"method":"session.logon","id":1,"params":{"apiKey":"<pub hex>","signature":"<hex>","timestamp":<ms>}}` → `{"id":1,"status":200,"result":{"authenticated":true,"account_id":...}}`. Events use Binance-futures single-letter keys; frames may hold several JSON objects split on `\n`; ping every 54 s. The canonical string to sign is in the "exact scheme" section of the page, not yet read | docs.strikefinance.org/api/user/websocket.md. VERIFIED (doc) |
| ADA-USD filters (testnet) | tick `0.0001`; LOT_SIZE min 1, step 1, max 6,000,000; MARKET_LOT_SIZE max 2,000,000; MIN_NOTIONAL 5; `triggerProtect` 0.05; `limitTakeBound` / `marketTakeBound` 0.05 | live `/price/v2/exchangeInfo`. VERIFIED. Note: SOL-USD min notional is 10, so read it per symbol |
| `exchangeInfo.serverTime` vs `/v2/time` | the two differ by about 80 s (1792509548484 vs 1792589517713). exchangeInfo looks cached. Use `/v2/time` for the clock offset, never exchangeInfo | VERIFIED (live). Cause of the cache UNVERIFIED |
| Builder code on a fresh testnet account | needs his browser at testnet.strikefinance.org/builder-codes | UNVERIFIED, blocked on him |
| tADA deposit USD credit | needs funded Preprod wallets | UNVERIFIED, blocked on him |
| Builder-connect wallet calling `/v2/leverage` | needs Spike E | UNVERIFIED |

### What blocks P0, in the order the plan lists them (§1)
1. Preprod wallets funded and deposited (Caller, Follower A, Follower B). His browser.
2. Two Telegram bots (Dev and prod), privacy disabled, a test channel and group with both bots as admins.
3. A testnet builder code (10 bps), or a note that registration is gated.
4. The cloud environment variables listed in §1.4. None are set here.
5. After keygen: Follower A's public key registered at testnet.strikefinance.org/api-keys, and `SPIKE_API_PRIV` / `SPIKE_API_PUB` set.

Spikes A-E cannot run without 2-5. Spike D needs the Dev bot token; Spike E needs `BUILDER_CODE`.

### Next, once the clock passes 15:00 UTC
- P1 can start without any of his inputs: `package.json`, vitest, `core/` tests-first, `strike/sign.ts`.
  Exception: the `sign.ts` test vector "checked against Spike A's accepted request" needs Spike A. Until then the vector
  comes from the documented message format only and is marked UNVERIFIED.
- `README.md`, `CLAIMS.md` as specified in P1.
