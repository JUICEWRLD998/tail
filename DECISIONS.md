# DECISIONS (newest first)

**Mustapha Fadhlullah — independent security researcher**

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
