# DECISIONS (newest first)

**Mustapha Fadhlullah — independent security researcher**

## 2026-10-21 23:40 UTC: bot was not running; OPENROUTER_API_KEY confirmed present

- He reported that commands to the dev bot did nothing. Cause: the bot process was gone (my earlier `( npm start & )` job did not
  survive) and Telegram held 3 undelivered updates. Restarted as a tracked background job; the queued updates were delivered.
  Rule: long-lived processes run with the tool's background mode, never `( cmd & )`, so an exit is noticed.
- `OPENROUTER_API_KEY` is present in the session environment (checked presence only, value never printed).
- Added `/help` and a pointer reply for unrecognised DMs; silence read as a dead bot.

## 2026-10-21 23:10 UTC: P4 in progress (feat/p4-builder-connect); merged to main; Ethereum connect verified live

- **Merged and pushed to `main`** at his request (fast-forward from `5dc8e3b`, no force). P3's live tap-through is still **not**
  done: it needs his Telegram id (`/link` to the dev bot, then `TAIL_OWNER_TG_ID`). README marks the bot NEXT.
- **VERIFIED live (testnet): Builder Connect with an Ethereum wallet.** A throwaway `ethers` wallet signs Strike's
  `message_to_sign` with EIP-191 (what MetaMask's `personal_sign` does). Strike accepts the signature **with or without the
  `0x` prefix**; the page will send what the wallet returns (0x-prefixed). Negative control: a signature from a different
  wallet returns `401 wallet signature verification failed`. Cardano (CIP-30) is still UNVERIFIED: it needs a real wallet.
- Strike's verify-signature "revokes any existing API wallets for this account + builder code": connecting does not touch a
  personal API wallet, only older builder wallets.
- **Built (tests first, 339 green):** connect tokens (single use, 10 min), pending API keys (encrypted, bound to the token,
  5 min), connect service (server generates the Ed25519 key; the browser only ever sees the nonce and the message to sign),
  Fastify server (schema validation with Ajv coercion off, per-token rate limit, generic 500s, no-referrer, no-store,
  constant-time webhook secret check).
- **Still to build for P4:** the Vite/React connect page (EVM, Phantom, CIP-30), `/connect` in the bot and the link button on
  the Tail flow, `PUBLIC_URL` and webhook wiring in `main.ts`, Dockerfile and host config. **Deploy is his step** (his Render or
  Railway account); a cloud session has no inbound traffic, so the page cannot be opened until it is deployed.
- Builder fee on orders: `strikeFor` already sends `X-Builder-Fee-Bps` for builder wallets; whether a builder fee shows on a
  fill is UNVERIFIED until a funded builder wallet trades.

## 2026-10-21 22:25 UTC: git hygiene corrections (found by him and by a new check)

- **Process change, at his request:** feature branch per phase or feature, cut from `claude/blissful-keller-tn6jzm`, merged back
  with a merge commit; tests, implementation, docs and proof in separate commits. P0-P3 went onto one branch in coarse commits
  (largest: service 754 lines, store 507, client 506, bot 469); history is not rewritten.
- **CORRECTION: runtime SQLite files were tracked.** `data/tail.db-shm` and `-wal` were committed in `2e19013` (`.gitignore` had
  `*.db` only). Tables were all empty at that point (schema pages), so no keys leaked. Untracked and ignored now.
- **CORRECTION: a private key literal was in tests.** The throwaway pair generated at the start of the session
  (`828f85bc…` private half, also printed in chat) was a test constant in three test files. It was never registered with Strike
  (401), so it opens nothing. Replaced with a placeholder. It remains in earlier history.
- New: `npm run check:push` (`scripts/prepush-check.sh`). It caught the key literal on its first run. Run before every push.

## 2026-10-21 22:05 UTC: P3 built and running; exit check (live taps) pending

- **Built, test first, 283 tests green:** `db/crypto.ts` (AES-256-GCM, TAIL_KEK), `db/store.ts` + `schema.sql` (users, channels,
  registration codes, calls, tails, misses; one live tail per follower per call is a partial unique index), `bot/cards.ts`
  (all Telegram text, pinned by tests), `bot/service.ts` (all decisions), `bot/bot.ts` (grammY wiring), `config.ts`
  (fails closed; mainnet needs an explicit flag), `main.ts` (long polling, refuses a token that has a webhook).
- **Design choices:**
  - Channel posts carry no sender, so a channel is bound to its caller by a one-time code: the caller runs `/addchannel`
    in a DM, posts `TAIL-XXXXXX` in the channel, the bot deletes the code message and DMs "Registered". In groups only the
    registered caller's messages are read.
  - A parsed call is DMed to the caller as a draft; nothing is posted until the caller taps Post.
  - A follower's confirm card is sized from their own equity and settings. Confirm claims the quote atomically before any
    network call, then reads the primary order's final status (a 201 is only "sequenced").
  - A network failure after sending keeps the tail live as `unconfirmed`, so a blind retry cannot double up. P5's job must
    reconcile these by `strategy_id` / `primary_client_order_id`.
  - `/link` (dev only) installs the server-held `SPIKE_API_PRIV` for `TAIL_OWNER_TG_ID` only; with no owner set it tells the
    sender their own Telegram id and links nothing. The key is never sent to Telegram. P4 replaces it with Builder Connect.
  - URL buttons give no callback, so counters change when a follower confirms, not when they tap Tail.
- **Mutation controls (each fails a named test):** no status read after the 201; no caller check on Post; no market-entry
  order check; no double-send guard (both protections removed); no `/link` owner check; no card counter edit; no group
  "/command" guard. One mutation survived (claim guard alone) because the early status check also blocks the second tap;
  that is redundancy, not a gap.
- **Live:** `npm start` ran `@lidevbot` on testnet (long polling, no webhook). Owner not set yet.
- **OPEN, exit check:** in the test channel a caller post becomes a card, a tap leads to a confirm and a testnet order id in the
  DM. Needs his taps. Screenshots in `docs/proof/` need a logged-in Telegram client, which is his side.
- `OPENROUTER_API_KEY` is not in this session's environment yet (checked presence only).

## 2026-10-21 21:45 UTC: P0 and P2 exit checks PASSED

- **P0 exit met:** five spike results with real responses are above (A signing + account, B bracket, C fill and fees,
  D Telegram, E Builder Connect), keys never printed. `npm run spikes` reruns A and B green (ETH-USD, places and cancels).
- **P2 exit met:** `TAIL_RISK_PCT=3 npx tsx scripts/tail-once.ts "ETH long 2480 tp 2560 sl 2420 5x" --place` parsed the call,
  read `margin_balance` 19.92115252, sized 0.009 ETH (notional 22.32, risk 0.54 USD), placed the bracket, and read the primary
  as `open` with order id **243140841**; `GET /v2/openOrders` listed 3 orders: `limit buy open`, `take_profit sell pending`,
  `stop sell pending`. Output in `docs/proof/p2-tail-once.txt`. The orders were then cancelled; nothing is left open.
- `tail-once` now reads the primary's final status before printing success, and exits 1 on `rejected`.
- Why `TAIL_RISK_PCT=3`: at the default 1% a 19.92 USD account risks 0.20 USD, which sizes below the 10 USD minimum
  notional, and sizing correctly refuses. Small test accounts need a higher risk percent or more margin.
- Open: builder-fee reporting on a fill (needs a funded builder-code wallet, P4); why the position showed leverage 20.
- Next: P3, the Telegram bot's thin path.

## 2026-10-21 21:36 UTC: Spike C PASSED (fills and fees, live, ETH-USD)

- Market bracket buy 0.006 ETH-USD (about $15 notional) with TP +3% and SL -3% of mark. Primary `Status: filled`,
  `Filled 0.006`. Raw: `docs/proof/spike-c.json`.
- **Fill fields (`GET /v2/history/fill`):** `id`, `trade_id`, `order_id`, `side`, `role` (taker), `price` 2499.57, `size`,
  `realized_pnl`, `fee` **0.00749871**, `fee_type: commission`, `client_order_id`, `timestamp` (ms). The fee is 5 bps of
  the notional (14.997 USD): the taker rate. **No builder-fee field on a personal-wallet fill.** Where a builder fee
  shows for a builder-code wallet is still UNVERIFIED (the scripted account holds $0); P4 must check it.
- After the fill the SL and TP legs go live: `openOrders` count 2. Position: `leverage` **20**, `margin_mode` cross, though
  the account reports `default_leverage` 10. Why is UNVERIFIED (sizing must not assume the account default).
- Closed with `cancel-all` then `POST /v2/order` market sell `reduce_only` -> positions 0. Account 19.996 -> 19.92115
  (-0.075 USD: two taker fees plus crossing a 10 USD spread). Testnet money; not a result about any strategy.
- Fills carry `client_order_id`, so `jobs/fills` can match a Tail row to its fill by the primary's client order id.

## 2026-10-21 21:30 UTC: deposit credited; Spike B PASSED on ETH-USD; three testnet facts that change the build

- **Deposit credited.** Strike tx id 246976: 20 USDC from Sepolia (hash `0x05f8a81b…6688056`) credited as **19.996 USD**
  (`wallet_balance` = `margin_balance` = 19.996). `GET /v2/history/transaction` shows `type: deposit, status: completed`.
- **Spike B PASSED (live).** ETH-USD, buy limit 0.006 @ 2482.15, `take_profit` 2569.46, `stop` 2419.78. `POST
  /v2/order/strategy` -> 201. The primary reads `open`; `GET /v2/openOrders` lists 3 orders: the primary, the TP (sell,
  `take_profit`, `reduce_only` true, `pending`, `working_type` mark_price) and the SL. Cancelled with `DELETE
  /v2/order/cancel-all`. Raw: `docs/proof/spike-b.json`.
- **CORRECTION 1: HTTP 201 is not acceptance.** It means "sequenced". The same request can be **rejected afterwards**
  (`status: rejected`, `close_reason: order_price_out_of_limit`). The first Spike B run read an empty `openOrders` and I
  almost recorded it as a pass. Tail must read the primary's final status (`GET /v2/order?symbol=&client_order_id=`) before it
  tells a follower "placed". `jobs/fills` and the confirm handler must treat `rejected` as a result.
- **CORRECTION 2: `GET /v2/order` needs `symbol`** (400 "symbol parameter is required"), and its response keys are
  PascalCase (`Status`, `CloseReason`, `Strategy.ID`), while `/v2/history/order` uses snake_case. Client updated and tested.
- **FACT: testnet books are dislocated except ETH-USD.** ADA-USD book 0.2575/0.2622 vs mark 0.2287 (depth: no bids, one ask at
  100); SOL-USD book 82.55/82.67 vs mark 107.96; BTC-USD bid 72247 / ask 82783 vs mark 84649 and a $100 minimum notional.
  ETH-USD is coherent (bid 2489.59, ask 2499.57, mark 2494.6, min notional $10, lot 0.001). Every ADA-USD limit tried
  (0.2215 to 0.2570, 0.999x to 1.03x mark) was rejected `order_price_out_of_limit`. **Testnet demos and spikes use ETH-USD.**
  The reference price for the limit-bound check is UNVERIFIED (docs say "validated against the current mark price", no
  number); it is not mark within 5%.
- Docs gap: `exchangeInfo` PRICE_FILTER minPrice is 10 for ADA-USD and BTC-USD (looks like a generic default); not the
  cause of the rejections as far as tested (ETH-USD minPrice 39.86 accepted).

## 2026-10-21 23:05 UTC: 20 Sepolia USDC received; Strike deposit not yet made

- Tx `0x83d6b21f…59af45d` on Ethereum Sepolia (block 11964956, 17 confirmations, success): `transfer` of 20 USDC on the
  FiatTokenProxy `0x1c7D4B19…C7238` from `0x319dd63E…460F` (the faucet) to his own address `0x0C3a…741d`. VERIFIED
  (eth-sepolia.blockscout.com tx API). This is the faucet payout, **not** a Strike deposit; Strike `margin_balance` is still 0.
- The earlier hash `0x802b26ae…` is the same kind of faucet payout, on Arc Testnet.
- Next step is his: send the USDC to Strike through the Deposit button on testnet.strikefinance.org (needs Sepolia ETH for gas).

## 2026-10-21 22:40 UTC: deposit route

- His tx `0x802b26ae…8b7cbf` on explorer.testnet.arc.io is a faucet transfer of 20 USDC (Arc Testnet) to his own MetaMask
  address, not a Strike deposit. Strike balance stayed 0. VERIFIED (explorer API + `GET /v2/account`).
- VERIFIED live: `POST /v2/deposit/quote` (blockchain `ethereum`, `USDC`, 20000000 = 20 USDC) returns `usd_value` 19.99275
  (rate 0.9996375), `confirmations_required` 12, quote valid 10 minutes, and a Strike deposit address. No funds moved;
  the quote was requested only to learn the route. Which EVM testnet "ethereum" means (Sepolia) is UNVERIFIED by the quote.
- Sepolia USDC source: faucet.circle.com answers 200; that it issues Sepolia USDC is from memory, UNVERIFIED.

## 2026-10-21 22:10 UTC: P2 built; exit check NOT met (needs margin)

- `src/strike/client.ts`: exchangeInfo (cached 60 s), mark price, account, positions, strategy order (optional
  `X-Builder-Fee-Bps`), open orders, cancel-all (DELETE with body), order lookup, fills, clock sync from `/v2/time`,
  `StrikeError` carrying status and Strike's `error` string. `src/core/order.ts`: draft to bracket, with Fade.
- 118 tests green. Planted control: signing without the body fails the Ed25519 verification test.
- `scripts/tail-once.ts` runs live on testnet: parse (against live exchangeInfo), account, mark price, sizing, bracket.
  Dry run by default; `--place` sends. Run on `ADA long 0.62 tp 0.70 sl 0.58 5x`: parses, reads `margin_balance` 0,
  sizing refuses `no_equity`. So the refusal path is VERIFIED live; **no order has been placed**.
- P2 exit ("places a real testnet bracket, `GET /v2/openOrders` shows it") is **not met**: Follower A has no margin.
  Spikes B and C are blocked for the same reason.
- UNVERIFIED until the first real order: that `take_profit` and `stop` legs are accepted as built, the response field names
  of `/v2/order/strategy`, and whether the builder-wallet header is accepted on the scripted account.

## 2026-10-21 21:40 UTC: Spike D PASSED (Telegram, live)

- Dev bot `@lidevbot`, long polling, no webhook. Test channel `-1004446016960`, test group `-1003697379035` (supergroup).
- VERIFIED live: `channel_post` arrives when the bot is a channel admin (text "Hey"); group `message` updates arrive with
  privacy off; `my_chat_member` fires on admin changes. Updates seen are in `docs/proof/spike-d.json`.
- VERIFIED live: `sendMessage` with `parse_mode: HTML` and an inline keyboard of two **URL** buttons works in a channel;
  the button opens `t.me/lidevbot?start=t_test`; the DM delivers `/start t_test` with `ctx.match === "t_test"`;
  `editMessageText` on the channel card (message_id 3) with a new keyboard succeeds.
- Note: URL buttons give no callback to the bot. The tap is only visible as the later `/start` DM. Card counters therefore
  change only after the follower confirms, as planned.
- Follower A balance still 0 at 21:40 UTC (`GET /v2/account` 200, `margin_balance` "0"). Spikes B and C stay blocked.

## 2026-10-21 21:05 UTC: Spike A passes on his own account; Telegram still silent

- His registered API wallet (public key prefix `2517380c`, from the Strike page) signs `GET /v2/account` and
  `GET /v2/positions`: both **200**. Account is `ethereum`, the MetaMask address, `wallet_balance` / `margin_balance` **0**,
  `default_leverage` 10, `default_margin_mode` cross. So the deposit has not been credited yet. Blocks B and C (need margin).
  `docs/proof/spike-a.json` now holds this run (replaces the scripted-account run; that result stays recorded above).
- `getUpdates` still returns **0 updates**: no `my_chat_member`, no `channel_post`. Spike D cannot start until `@lidevbot`
  is admin in the channel and group and a message is posted in each.

## 2026-10-21 20:40 UTC: env landed; SPIKE_API_* not yet registered with Strike

- All 8 variables are set in the session environment (lengths and the `.env` match checked; values not printed). VERIFIED.
- `TELEGRAM_BOT_TOKEN` is `@lidevbot` (getMe ok, `can_read_all_group_messages` true, no webhook, 0 pending). VERIFIED live.
- Spike A with the `SPIKE_API_*` pair returns `401 authentication failed`: the public key is not registered at
  testnet.strikefinance.org/api-keys. Blocks Spikes A (Follower A), B, C. Waiting on him.
- `getUpdates` returns 0 updates: `@lidevbot` is not yet an admin in the test channel or group. Blocks Spike D.
- `scripts/spike-a.ts` now writes `docs/proof/spike-a.json` only on a 200, after a failed rerun overwrote the passing proof
  (restored from git).

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
