# Tail: implementation plan

**Mustapha Fadhlullah — independent security researcher** · Strike Hackathon · plan written 2026-10-21

A caller posts a trade call in a Telegram channel. Tail turns it into a card with **Tail** and **Fade** buttons. One
tap places a Strike bracket order (entry, take-profit, stop-loss) sized to that follower's own risk. The caller earns
a builder fee on every follower fill.

> Tagline: Tail the call. Strike does the rest.

Read `CLAUDE.md` first (house rules, verification rules). This file is the build order. Write each phase's result
into `DECISIONS.md` as you go. Mark every claim about Strike or Telegram VERIFIED (doc URL, OpenAPI line or live
response) or UNVERIFIED.

---

## 0. Facts that fix the build

| Fact | Value | Source |
|---|---|---|
| Deadline | Submission closes Fri 2026-10-23 10:00 "EST". Treat it as **2026-10-23 14:00 UTC** (10:00 EDT, the earlier reading) | hackathon post, medium.com/@strikecardano (RSS) |
| Start | Building opens Wed 2026-10-21 10:00 "EST". **First code commit after 15:00 UTC 2026-10-21** (safe under both readings). This plan and the skills are not product code | same |
| Must ship | Working prototype; docs ("what it does, and how it interacts with Strike"); a video or live demo; source code | same |
| Judged on (no weights) | Innovation and Creativity · Integration With Strike · Utility and Impact ("Could it attract users, improve trading") · Technical Execution · Future Potential | same |
| API hosts | Mainnet `https://api.strikefinance.org`; testnet `https://api-v2-testnet.strikefinance.org`. Market data under `/price`, stats under `/stat`. WS: `/ws/price`, `/ws/user-api` (API-wallet logon), `/ws/l3` | docs.strikefinance.org/llms.txt; live ping 200 on both, 2026-10-21 |
| Request signing | Ed25519. Headers `X-API-Wallet-Public-Key`, `X-API-Wallet-Signature`, `X-API-Wallet-Timestamp` (unix s), `X-API-Wallet-Nonce` (UUID v4). Message `{METHOD}:{PATH}:{TIMESTAMP}:{NONCE}:{BODY_HASH}`, PATH includes the query string, BODY_HASH = sha256 hex of the exact body sent (**CORRECTED 2026-10-21: for GET it is the sha256 of the empty string, `e3b0c442…b855`, not an empty field**; docs Python example `hashlib.sha256(body_str.encode())` with `body_str=""`). Timestamp within 3 minutes; nonce single use | docs.strikefinance.org/api/getting-started.md |
| API wallet rights | Personal API wallets: "Can perform trading operations but cannot withdraw funds". Builder wallets: "The builder cannot redirect withdrawals or withdraw without the user's wallet signature" | same; /api/builder-codes/withdraw.md |
| Builder Connect | `POST /auth/builder/request-signature` {address, chain: cardano/solana/ethereum, code, fee_share_bps 0-100, public_key (our Ed25519, 64 hex), referral_code?} → {nonce (5 min), message_to_sign}. `POST /auth/builder/verify-signature` {address, chain, nonce, wallet_signature} → {account_id, api_wallet_public_key, ...}. Creates the Strike account if none exists; revokes older API wallets for that account and code. Cardano signature: CIP-30 `signData`, sent as `"{coseSign1Hex}:{coseKeyHex}"`, address bech32, payload hex-encoded. Solana: Ed25519 over the UTF-8 message, base58 address and signature. Ethereum: EIP-191 | /api/builder-codes.md, /builder-connect.md; strike-builder-reference `src/api/wallets.ts` header comment |
| Builder fee | Header `X-Builder-Fee-Bps` (integer, 0-100) on `POST /v2/order`, `/v2/orders/batch`, strategy orders. Must be ≤ the builder's registered share and ≤ the user's approved cap, else 400 and no order. `replace` and TWAP carry no builder code | strike-finance-skills `openapi/trade-api.yaml` lines 95-113 |
| Bracket order | `POST /v2/order/strategy`, required `strategy_id, symbol, side, type, size`; optional `price, time_in_force, tp_order, sl_order`. Legs: `{type: take_profit or take_profit_limit / stop or stop_limit, size, stop_price}`; leg side is forced opposite and reduce-only. "If one TP/SL triggers, the other is automatically canceled" | trade-api.yaml `CreateStrategyOrderRequest`, `StrategyLeg` |
| Limits | 2,400 request weight/min, 1,200 orders/min | `GET /price/v2/exchangeInfo` live, 2026-10-21 |
| Testnet | App `https://testnet.strikefinance.org` (also `/api-keys`, `/builder-codes`). Wallet networks: Cardano **Preprod**, Solana **devnet**, Ethereum **Sepolia** (strings in the testnet app bundle). Markets: ADA-USD, SOL-USD, BTC-USD, ETH-USD. Deposits accept ADA (swapped to a stablecoin, credited in USD). 1,013 users, $40.4M deposited | live exchangeInfo and `/stat/v1/dashboard/summary`, 2026-10-21; docs Exchanger page |
| Mainnet | 31 markets (crypto, US stocks, indices, gold, pre-IPO). 30-day average DAU 277; 16-27 new users a day | `/price/v2/exchangeInfo`, `/stat/v1/dashboard/users`, 2026-10-21 |
| References | Official reference app `github.com/strike-finance/strike-builder-reference` (React; builder connect, deposits, orders, WS, trading math in `src/math/`). Official agent skills `npx strike-finance-skills install` and OpenAPI specs in `github.com/strike-finance/strike-finance-skills/openapi/`. No license file seen on either: read and reimplement, cite the file, do not paste wholesale | GitHub, 2026-10-21 |
| Cloud sessions | Network levels None / Trusted (default: package registries, GitHub, cloud SDKs) / Full / Custom (own domain list). Env vars are readable by anyone using the environment. Foreground commands time out at 2 min by default, 10 min max (`BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS`). No inbound traffic reaches the VM | code.claude.com/docs/en/cloud-environments |

UNVERIFIED, settled in P0: the account equity field (`margin_balance` or `available_balance` in user-api.yaml); how a
fill reports the builder fee; the `/ws/user-api` logon frame; min size and tick per symbol (exchangeInfo filters);
whether a fresh testnet account can register a builder code; what USD credit a tADA deposit gives on testnet; whether a
builder-connect wallet may call `/v2/leverage`.

## 1. Inputs he provides (blocking, in this order)

1. **Preprod wallets.** Lace or Eternl switched to Preprod, with three accounts: Caller, Follower A, Follower B. Fund
   each from the Cardano testnet faucet (docs.cardano.org/cardano-testnets/tools/faucet). Deposit on
   testnet.strikefinance.org from each. Record the USD credited in `DECISIONS.md`. **No real money anywhere.**
2. **Two Telegram bots from @BotFather.** `@<name>DevBot` for cloud sessions (long polling) and `@<name>Bot` for the
   deployed service (webhook). One token cannot serve both: Telegram rejects `getUpdates` while a webhook is set.
   For each: `/setprivacy` → Disable (so it reads free text in groups). Create a test channel and a test group; add
   both bots as admins (post and edit messages).
3. **A testnet builder code** from testnet.strikefinance.org/builder-codes (fee share 10 bps). If registration is
   gated, say so; the fallback is in P0.
4. **The cloud environment** at claude.ai/code. Network: **Custom**, keep the Trusted defaults, add
   `api-v2-testnet.strikefinance.org`, `testnet.strikefinance.org`, `api.strikefinance.org`,
   `docs.strikefinance.org`, `api.telegram.org`, `api.devnet.solana.com`. Env vars: `TELEGRAM_BOT_TOKEN` (the Dev
   bot), `TAIL_KEK` (32 random bytes, base64), `STRIKE_NETWORK=testnet`, `BUILDER_CODE`, `BUILDER_FEE_BPS=10`, and
   after P0 generates them, `SPIKE_API_PRIV` / `SPIKE_API_PUB`. Setup script: `npm ci || true` and
   `npx -y strike-finance-skills install --agents claude --yes`. **Testnet keys only. Never a mainnet key here.**
5. **A host** for the always-on service: Render or Railway (his account, linked to this repo). Check the current
   free-tier terms in P8; a sleeping free instance makes the first tap slow.
6. **Optional, worth most:** one real caller or trading-group admin who runs Tail on testnet during the window, with
   consent recorded in `DECISIONS.md`.

## 2. Architecture

```
Caller in channel/group ── channel_post or /call ──▶ bot (grammY)
   └▶ core/parser (pure) ─▶ CallDraft ─▶ caller confirms ─▶ Call row ─▶ card in channel [Tail] [Fade]
                                                                 (URL buttons: t.me/<bot>?start=t_<id> / f_<id>)
Follower taps ─▶ bot DM /start t_<id>
   ├ not linked ─▶ connect link (one-time token) ─▶ web/connect: wallet signs ─▶ server ─▶ Strike verify-signature
   │                                                   ─▶ api wallet key stored (AES-256-GCM with TAIL_KEK)
   └ linked ─▶ core/sizing (pure: equity, entry, SL, caps, exchangeInfo) ─▶ confirm card ─▶ [Confirm]
              ─▶ POST /v2/order/strategy + X-Builder-Fee-Bps ─▶ Tail row
jobs/fills: order status until filled ─▶ card counters edited ("Tailed 14 · Faded 3 · $9.2k in")
jobs/outcomes: mark price vs open calls ─▶ "TP hit" / "SL hit" receipt in the channel ─▶ caller record
web: /connect, /c/<channel> (record from real fills, earnings), / (landing)
```

**The model never builds an order.** Parsing and sizing are deterministic code with tests. An LLM may be added only as
a fallback that proposes a parse which the caller then confirms (stretch).

Stack: Node 24, TypeScript, `grammy` (Telegram), `fastify` (webhook, connect API, static web), `better-sqlite3`,
`vitest`. Ed25519 through `node:crypto` (JWK `{kty:"OKP", crv:"Ed25519"}`), no extra crypto dependency for request
signing. Web pages: Vite + React, **CSS Modules + design tokens, no Tailwind, `motion` from `motion/react`**.
Check every library API with context7 before use.

### Layout

```
src/core/      parser.ts sizing.ts symbols.ts fade.ts outcome.ts      pure, no I/O, 100% tested
src/strike/    sign.ts client.ts types.ts                              REST + WS, testnet by default
src/bot/       bot.ts handlers/ cards.ts                               grammY; long polling in dev, webhook in prod
src/web/       server.ts connect-api.ts                                fastify
src/db/        schema.sql db.ts crypto.ts                              SQLite + key encryption
src/jobs/      fills.ts outcomes.ts
web/           Vite app: connect, caller page, landing
test/          *.test.ts, fixtures/calls/*.txt (real call formats)
scripts/       keygen.ts spike-*.ts scripted-follower.ts
```

### Data model (SQLite; ISO 8601 UTC timestamps; prices and sizes stored as decimal strings)

| Table | Fields |
|---|---|
| `users` | tg_id PK, chain, address, strike_account_id, api_pub, api_priv_enc, builder_code, risk_pct (default 1), max_leverage (default 5), max_notional_usd (default 500), linked_at, revoked_at |
| `channels` | chat_id PK, title, kind (channel, group), caller_tg_id, builder_code, fee_bps, created_at |
| `calls` | id PK, chat_id, message_id, card_message_id, raw_text, symbol, side, entry_kind (limit, market), entry, tp, sl, leverage_hint, status (open, tp_hit, sl_hit, expired, cancelled), created_at, closed_at |
| `tails` | id PK, call_id, tg_id, mode (tail, fade), strategy_id, order_id, size, notional_usd, fee_bps, status (placed, filled, rejected, cancelled, closed), fill_price, error, created_at, filled_at |
| `connect_tokens` | token PK, tg_id, expires_at (10 min), used_at |
| `misses` | symbol, chat_id, count (calls for markets Strike does not list) |

### Parser contract (`core/parser.ts`)

Input: message text. Output: `{ok: true, draft}` or `{ok: false, reason, ask?}`. Formats in the first test fixtures:
- Compact: `ADA long 0.62 tp 0.70 sl 0.58 5x`, `short btc 67000 tp 64000 sl 68500`
- Cornix-style block: `#ADA/USDT` / `Long` / `Entry: 0.61 - 0.63` / `Targets: 0.66 0.70` / `Stop: 0.58` / `Leverage: Cross 5x`
- Emoji style: `🟢 LONG $ADA Entry 0.62 TP1 0.66 TP2 0.70 SL 0.58`
- Market entries: `ADA long now`, `CMP`, `market`

Rules: map `ADA/USDT`, `ADAUSDT`, `$ADA`, `ADA-PERP` to `ADA-USD`; aliases (XBT→BTC, GOLD→XAU); validate against
exchangeInfo; a long needs SL < entry < TP, a short the reverse; an entry range becomes a limit at the range midpoint;
TP1 is the take-profit in MVP; round to tick size. Anything ambiguous returns `ask` (one question with buttons), never a
guess. Unknown symbol: "Not on Strike yet", and the `misses` counter goes up.

### Sizing contract (`core/sizing.ts`)

`risk_usd = equity × risk_pct / 100`; `size = risk_usd / |entry − sl|`; then cap by `max_notional_usd`, by
`equity × max_leverage / entry`, by the market's max leverage, then round **down** to the lot step. Below the market
minimum: refuse with the reason. Fade: side flipped, TP = caller's SL, SL = caller's TP; the confirm card shows the
inverted reward-to-risk honestly.

## 3. Phases

Each phase ends with an **exit check that is run, not reasoned about**. When it passes, commit with a real message
and add a line to `DECISIONS.md`. Skills are in `.claude/skills/` (Strike's own skills arrive through the setup script).

### P0: Environment and spikes (nothing else starts until this passes)
- Confirm network: `curl -s https://api-v2-testnet.strikefinance.org/v2/ping` and `curl -s https://api.telegram.org`
  answer. If either is blocked, stop and name the domain to add.
- `scripts/keygen.ts` prints an Ed25519 pair (raw 32-byte hex). He registers the public key for Follower A at
  testnet.strikefinance.org/api-keys and puts both halves in the env as `SPIKE_API_*`.
- **Spike A (signing):** signed `GET /v2/account` and `GET /v2/positions` for Follower A. Record the equity field.
- **Spike B (bracket):** `POST /v2/order/strategy` on ADA-USD, smallest valid size, limit far from mark, with TP and
  SL legs; read it back with `GET /v2/openOrders`; cancel it. Record request, response and min size/tick.
- **Spike C (fills):** one tiny market bracket, then confirm the fill through `GET /v2/history/fill` and through
  `/ws/user-api` logon. Record which fields carry fees (and the builder fee, if any). Close the position.
- **Spike D (Telegram):** the Dev bot reads a channel post (long polling), posts a card with URL buttons to
  `t.me/<DevBot>?start=t_test`, receives `/start t_test` in DM, edits the card. Record update types and limits.
- **Spike E (Builder Connect without a browser):** `scripts/scripted-follower.ts` makes a Solana keypair, calls
  request-signature with `chain: "solana"` and `BUILDER_CODE`, signs `message_to_sign` (Ed25519, base58), calls
  verify-signature. Record the response. If the builder code is missing or gated: record it, and run P3-P5 with
  personal API wallets (fees show as 0 and are labelled NOT LIVE) until a code exists.
- Exit: `DECISIONS.md` holds five spike results with real responses (keys redacted). `npm run spikes` reruns A-B.
- Skills: `systematic-debugging` when a spike misbehaves.

### P1: Day-one files and the pure core (test first)
- `README.md` (thesis, how it works, how it uses Strike, live links, verify in 60 seconds, what it is NOT), `CLAIMS.md`
  (each README claim → the command that reproduces it), `DECISIONS.md` (newest first).
- `core/parser.ts`, `core/symbols.ts`, `core/sizing.ts`, `core/fade.ts` with `vitest`, tests first
  (`test-driven-development`). Fixtures: real call texts in `test/fixtures/calls/` (collect public examples; cite the
  source in the fixture header). Properties: the same input always gives the same output; sizes never exceed any cap;
  rounding never rounds up; a long never gets SL above entry.
- `strike/sign.ts` with a test vector checked against Spike A's accepted request.
- Exit: `npm test` green; coverage report for `src/core` and `src/strike/sign.ts`.

### P2: Strike client and the thin path from the CLI
- `strike/client.ts`: exchangeInfo (cached), mark price, account, positions, strategy order, order status, cancel,
  fills, builder request/verify. Typed errors carrying Strike's `error` string. Clock offset from `GET /v2/time`.
- `scripts/tail-once.ts "ADA long 0.62 tp 0.70 sl 0.58"`: parse, size for Follower A, place the bracket, print the
  order id. This is the product's core path with no Telegram.
- Exit: the script places a real testnet bracket and prints its id; `GET /v2/openOrders` shows it.

### P3: The Telegram bot, thin path end to end
- grammY bot, long polling in dev (`TAIL_MODE=dev`), webhook in prod. Handlers: `channel_post` and group text from a
  registered caller → parse → caller confirm (DM) → card in the chat; `/call` wizard; `/start t_<id>` → confirm card
  → order; `/start f_<id>` → fade confirm; `/me` (linked address, equity, caps), `/risk`, `/maxlev`, `/revoke`.
- Card text in HTML parse mode, short and scannable:
  `ADA-USD · LONG · 5x` / `Entry 0.6200 · TP 0.7000 · SL 0.5800 · R:R 2.0` / `Tailed 0 · Faded 0`.
- Linking in this phase: Follower A via personal API wallet (`/link` stores `SPIKE_API_*` for his tg_id).
- Exit: in the test channel, a caller post → card → tap → confirm → testnet order id in the DM. Screenshots of each
  step saved in `docs/proof/` (Telegram Web or Desktop).

### P4: Builder Connect and the first deploy
- Deploy the service to the host (prod bot, webhook with `secret_token`, SQLite on a volume). Health route.
- `web/connect`: `/connect?t=<token>`. Cardano CIP-30 first (Lace, Eternl, Vespr), then Phantom (Solana) and
  Rabby/MetaMask (EVM). Shows the address, the fee cap, and what Tail can and cannot do ("trade on your behalf; cannot
  withdraw"). Server: token single-use, 10 min, bound to tg_id; generate the Ed25519 key server-side; request and
  verify against Strike; store the key encrypted; DM "Linked".
- `X-Builder-Fee-Bps` on every order from builder wallets (≤ both caps; 0 for personal wallets).
- Exit: Follower B (never touched Strike API before) taps Tail on the deployed bot, signs once in Lace on Preprod, and
  gets a testnet order. Also `scripts/scripted-follower.ts` passes against the deployed service.

### P5: Live state (the card comes alive)
- `jobs/fills`: poll pending tails (respect the weight limit), set filled/rejected, edit the card counters.
- `jobs/outcomes`: mark price for symbols with open calls; mark `tp_hit` / `sl_hit` / `expired` (default 72 h); post
  a short receipt as a reply to the card.
- Caller record: per channel, calls, hit rate, average R, followers in, all from rows; never typed by hand.
- Exit: one call reaches a result on testnet (use a tight TP for the test call); the receipt posts; the record updates.

### P6: Fade, guard rails and the unscripted path
- Fade end to end. Risk settings enforced server-side. Rejections explained in one line (min size, margin, cap).
- Parser `ask` flow with inline buttons. "Not on Strike yet" with the `misses` counter.
- Abuse limits: per-user rate limit, max open tails per user, call spam limit per channel.
- Exit: 20 call texts the parser has never seen (collected from public channels, saved as fixtures) → each one either
  becomes a correct card or asks one question. Report the count.

### P7: Caller earnings and the web pages
- Earnings: per channel and per call, builder fees from real fills (field from Spike C) or `notional × fee_bps`, labelled
  which one it is. Payout to callers is **NOT LIVE** in the MVP unless per-caller builder codes work (below).
- Per-caller builder codes (if P0 shows a fresh account can register one): `/setcode` in the channel; followers of that
  channel connect with the caller's code, so Strike pays the caller directly.
- Web: `/c/<channel>` record and earnings; `/` landing (what Tail is, the 20-second loop as real screenshots, add to
  your channel).
- Exit: the caller page shows numbers that match a SQL query written in `CLAIMS.md`.

### P8: UI pass and the signature moment
- Run `ui-studio` on the web pages. The vocabulary comes from signal-channel culture (call cards, tail, fade, receipts),
  not from a trading terminal. His product, so SIGNAL DECK applies only if it fits after the slop audit.
- The signature moment: on the landing page, a real call card filling with real tails, replayed from rows, never faked.
- Telegram copy: every bot message read on a phone; no emoji walls.
- Every width: 320, 375, 414, 768, 1024, 1280, 1440, 1920 px screenshots, each band composed.
- Exit: the ui-studio QUALITY BAR passes in a real browser (Playwright), contrast pairs written out.

### P9: Hardening and verification
- `product-hardening` demo-seam audit. `ecc:security-review` on key storage and the connect API. `attacker` only if he
  allows a subagent that session.
- The judge's path from zero, on the deployed bot: open the test channel link, tap Tail, connect a fresh Preprod wallet
  (or a Phantom devnet wallet), get an order. Then a judge's own call text in the test group.
- Pre-submit grep: `mock|fake|dummy|lorem|example.com|TODO` and any private key pattern. Justify or fix every hit.
- One status vocabulary in README: LIVE / NEXT / NOT LIVE.
- Exit: checklist in `DECISIONS.md`, each item run, with its result.

### P10: Packaging (he presses submit)
- Video, about 90 seconds: run `demo-video`. The product lives in Telegram, so record Telegram Web
  (web.telegram.org) in the recording browser, logged in as the demo follower, plus the connect page and the Strike
  testnet app. Outline: pain in reviewers' words (0-10 s); the wow, post to position (10-30 s); a new follower links in
  one signature (30-45 s); Fade and the caller record (45-60 s); caller earnings (60-75 s); why Strike: builder codes,
  brackets, an acquisition channel against 16-27 new users a day (75-90 s).
- Submission text through `humanizer`. Draft the form fields; he submits through Strike's Discord.
- Exit: every link opens from a logged-out browser; the bot answers `/start` from a fresh Telegram account.

## 4. Milestones (no calendar; the deadline above is a fact)
1. Thin path: a channel post becomes a testnet bracket from a tap (P0-P3).
2. Feature-complete: Builder Connect, live cards, outcomes, Fade, earnings, pages (P4-P7).
3. Demo freeze: UI pass, hardening, judge's path verified (P8-P9).
4. Packaging (P10). Never cut.

## 5. Scope
- **MVP:** parser + sizing; Strike client; bot in channels and groups; Tail and Fade; Builder Connect (Cardano first);
  live counters; outcomes and receipts; caller record; earnings view; connect page; landing; caller page.
- **Stretch:** per-caller builder codes; auto-tail with a per-channel budget; multi-TP split; forward-to-bot mode for
  channels that have not joined; STRIKE-paid VIP channel gate (WANT: "subscription model paid in $STRIKE"); LLM parse
  fallback with caller confirmation; `/ws/user-api` instead of polling.
- **NOT BUILDING:** a Telegram Mini App terminal, vaults, deposits or withdrawals inside Tail, mainnet by default.

## 6. Rubric map (fill in as features ship)
| Criterion | What answers it | Evidence |
|---|---|---|
| Innovation | a channel post becomes a sized bracket in one tap; Fade; caller paid by protocol fees | the video's first 30 s |
| Integration With Strike | Builder Connect, builder fees, strategy orders, exchangeInfo filters, fills, mark price | order ids in `docs/proof/`, README API table |
| Utility and Impact | every new follower is a new Strike account; callers bring their audience | connect count from rows; 16-27 new users/day context |
| Technical Execution | deterministic parser and sizing with tests; encrypted keys; idempotent jobs | `npm test`, coverage, `DECISIONS.md` |
| Future Potential | builder-fee business (Telegram bots earned $7-15M on Hyperliquid builder codes); auto-tail into vaults | README "next" section |

## 7. Risks and fallbacks
1. **Builder code gated on testnet.** Personal API wallets for the demo; fees labelled NOT LIVE; say it in README.
2. **Testnet deposit fails.** Solana devnet or Sepolia deposit through the testnet app; mainnet only with his explicit
   go and at most a few dollars.
3. **A parser miss in front of a judge.** The `ask` flow; never a silent wrong order.
4. **Key theft from our server.** Trade-only keys (Strike blocks withdrawals without a wallet signature), encryption at
   rest, caps, `/revoke`, no keys in logs.
5. **Free host sleeps.** Paid tier during judging (his call), or a keep-alive ping.
6. **Telegram limits** (about 30 messages/s overall, edits per chat throttled): batch counter edits every few seconds.

## 8. Never
- A mocked core path, a hardcoded "live" number, invented callers or followers presented as real.
- A mainnet key in the cloud environment or in the repo. Secrets in commits (grep before every push).
- Orders on any account he has not linked himself; trading on a judge's account beyond what they tap.
- Posting in public channels, messaging Strike's Discord, or submitting without his go.
