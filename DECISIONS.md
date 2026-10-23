# DECISIONS (newest first)

**Mustapha Fadhlullah — independent security researcher**

## 2026-10-23 Connect: pick the account on purpose; explain the own-code refusal

- After funding a second MetaMask account he still got "cannot connect an account to its own builder code". Cause: the connect
  page used the first account from `eth_requestAccounts`, and a site stays connected to the account it was first given, so
  switching the active account in MetaMask changed nothing. Fix: the page first sends `wallet_requestPermissions` (the wallet's
  account chooser); a wallet without it falls back to the plain connect; a refusal (4001) stops. Tested with stubs, and the 25
  live-Strike connect checks still pass. UNVERIFIED in a real MetaMask: the chooser itself.
- Strike's own sentence is now a plain message: the account owns the builder code Tail uses; choose a different account.

## 2026-10-23 Correction (marked): the demo guide told him to follow with the wallet that owns `sigma`

- `docs/demo/telegram.md` said to connect the MetaMask account that holds the Strike testnet deposit (`0x0C3a`). That account
  registered the builder code `sigma`. Strike refuses to connect an account under its own builder code: `Strike said: cannot
  connect an account to its own builder code` (live, via the connect page). The guide now says to use a second MetaMask account
  funded from Strike's test-USD faucet. The default path hits the same rule, since orders carry `sigma` when a channel has no
  code of its own: **the owner of a builder code can never follow through Builder Connect under it.** Not a Tail bug; a Strike rule.
- Earlier live tails (orders 243140879 and 243144232) used the dev-only `/link` personal key, which has no builder code, so
  they never met this rule.

## 2026-10-23 Demo guide: paste-ready live-price calls

- Replaced the PowerShell snippets in `docs/demo/telegram.md` C2, C3 and C4 with literal, copy-ready messages derived from the live testnet ETH-USD mark (2401). The guide identifies them as a time-sensitive snapshot and tells the recorder to check the mark before recording.

## 2026-10-22 Correction in the README (marked): "API wallets cannot withdraw"

- The README said Strike API wallets cannot withdraw. Strike's builder-code docs (VERIFIED, `api/builder-codes/withdraw.md`) say
  the Builder Connect API wallet can request a withdrawal quote, but the user's own wallet must sign the confirmation, and the
  destination is locked to the account's registered address. The claim is now worded that way in the README. The bot's connect
  text ("cannot withdraw funds") stays: true in effect, since it cannot complete one alone.

## 2026-10-22 P9: hardening checklist (each item run, with its result)

| # | Item | Result |
|---|---|---|
| 1 | Byline removed from public pages (his call) | Home footer and README: removed. Internal notes keep it |
| 2 | "Payout to callers is not live": what it meant | VERIFIED (`docs.strikefinance.org/api/builder-codes.md`): builder fees are "credited instantly to your account balance" of the code's owner. Every order carried `sigma`, so fees went to him, never to a caller |
| 3 | Fix: callers' own builder codes | `/setcode CODE RATE`; Strike checks the code (live: `sigma` ok, unknown code 404 `builder code not found`). Follows from a coded channel connect once under the caller's code (one API wallet per follower per code, migration v5) and orders carry it, so Strike pays the caller directly. Tail never holds money |
| 4 | Binding: the fee goes only to the caller of the call taken | Pinned: one follower with wallets for two codes; a call in channel B trades and reconciles only through B's wallet |
| 5 | Followers see the fee before they confirm | Quote shows "Builder fee N bps, paid by Strike to this caller's code X", "to Tail's code", or "No builder fee" |
| 6 | Key storage | AES-256-GCM, random 96-bit nonce per key; `/revoke` now deletes every wallet key in one transaction; no route returns a key; logs carry error messages only. Not done: binding ciphertext to the row (AAD), since it needs database write access to exploit |
| 7 | Connect API | Token 256-bit, single use, 10 min, bound to one Telegram user; pending key 5 min; 20 attempts/min per token; Strike's returned key must equal ours. Pages: 120 reads/min per client |
| 8 | Content-Security-Policy | Every HTML page: own scripts only, no framing, no plugins, no base or form targets. Control: an injected inline script is blocked and logged. Pages (115), replay (9) and wallet connect against live Strike (25/25) still pass under it |
| 9 | Secret sweep, tree and history | `npm run check:push` clean. Full history: the bot token, KEK, API key and OpenRouter key values: 0 occurrences each. One 64-hex in history: the throwaway test key recorded on 2026-10-21 (never registered with Strike); history is not rewritten (no force-push on main) |
| 10 | `mock/fake/dummy/lorem/example.com/TODO` sweep | `src/` and `web/`: 0. Tests: test doubles only. Local browser scripts: a placeholder bot token, renamed `123:local-browser-check-no-telegram` |
| 11 | Real migration | A copy of the dev database went v4 to v5 with 3 calls, 3 tails, 1 user kept; the live database then migrated on restart (v5) |
| 12 | One status vocabulary | A test fails any README status that is not LIVE, NEXT or NOT LIVE; it caught `LIVE (spike)` and `LIVE (local)`, now fixed |
| 13 | Judge's path from zero, on the deployed bot | NOT RUN: needs the deploy (his step, `docs/DEPLOY.md`) |
| 14 | A real fill under a caller's code | NOT RUN: needs a follower connected through the deployed page under a coded channel. UNVERIFIED: whether Strike refuses an order whose rate is above the code's registered rate |

## 2026-10-22 P8 built: ticket design, real-call replay, charts

- **Direction: the call as a printed ticket.** Signal channels trade in call cards and receipts, so the card is a paper
  ticket (warm paper, ink, IBM Plex Mono numerals) with a perforated stub where follows land and a rubber-stamp result.
  Not terminal, not neon. Tail is mint, Fade is coral, everywhere (hero, buttons, chips, charts).
- **Signature moment, real only:** the home page replays the newest call real followers took (today: call 3, one tail,
  target hit +0.44R). Follows drop onto the stub in their real order and rough rhythm (compressed to under 2.5 s), then the
  stamp lands. No call: it says so. Reduced motion: final state at once. API gives mode, status and timing only.
- **Charts (hand-drawn SVG, `motion`):** running result in R as a step line that draws itself in; where calls ended as a
  segmented bar; each call's levels drawn to scale on a ladder inside the ticket. Charts render at their real width so axis
  text stays readable on a phone.
- **Checks:** `scripts/pages-e2e.ts` 115/115 (8 widths x 2 themes, SQL parity, planted controls);
  `scripts/replay-probe.ts` with motion ON samples the replay every ~150 ms in both themes: starts empty, follows land
  strictly before the stamp, Replay resets; control: reduced motion shows the final state at once. Contrast: every new
  pair measured (ticket text 13.4:1 / 16.8:1; Tail and Fade inks on paper 5.3:1 and above).
- **Bugs the probes found:** mid-replay the ticket said "No one has taken this call yet" before the real tail landed (false;
  fixed with the call's real total); my probes misread uppercase labels through `innerText` and counted the chip list as a
  chip (both probe bugs, fixed: `textContent`, `li` selector).
- Not redone: the connect page keeps its P4 design (same tokens).

## 2026-10-22 Telegram copy pass (his request: "not properly structured, no emojis, just bland")

- One vocabulary across every message: a side marker (green circle long, red circle short), one marker emoji per line at
  most (📍 entry, 🎯 target, 🛑 stop, ⚖️ R:R, 📏 size, 💸 risk, 👥 followers, ✅ filled or hit, 🚫 cancelled, ❌ rejected,
  ⚠️ warning, ❓ question), bold headings, numbers in code spans, blank lines between header, levels and counters. A test
  pins "at most one emoji per line" on the call card so it cannot become a wall.
- Covers the channel card, caller and follower confirm cards, receipts and the card's result line, fill and close DMs,
  rejections and cancellations, Linked and Registered, /me, /record, /earnings, /page, /help and the welcome. Popup alerts
  (answerCallbackQuery) stay plain text: Telegram shows them in a small dialog.
- Previewed to him with `scripts/preview-copy.ts` (owner DM only, sample numbers, labelled as a preview).
- Also fixed while there: the connect "Linked" DM is now sent as HTML like every other message.

## 2026-10-22 12:20 UTC: live follower test, first attempt did not place; bot restarted

- He posted `ETH-USD LONG NOW / TP 2404 / SL 2390 / 5x` in the test channel; the card appeared (call 2) and Tail produced a quote
  (tail 2, size 0.041, 98.45 USD, from his 19.92 USD equity). Confirm never reached the bot: tail 2 stayed `quoted`, Strike
  showed no order, position or history. The dev bot had hit its 2-hour background cap and stopped. Restarted (new 2 h).
- My own probe first used the repo `.env` keys and got 401; the bot's environment key works (`GET /v2/account` 200, equity
  19.92). Lesson written into `product-hardening` Pitfalls with the `|| true` and bot-cap lessons.
- **Second attempt, live (testnet): a real tap placed a real order.** Call 3 (`ETH-USD LONG NOW`, TP 2380, SL 2365, 5x) was
  tailed from Telegram: Strike order 243144232, market buy 0.041 ETH, status `filled`, fill 2380.31 (taker, fee 0.0488),
  position 0.041 at 2380.31, take-profit and stop legs `untriggered` on Strike. `docs/proof/p6-live-tail-3.json`.
- **Bug found by that run:** a market order fills while Confirm waits, so the reconcile step that records the fill price never
  ran: `fill_price` stayed null and the earnings estimate could not count the tail. Fixed (reconcile backfills the size-weighted
  price from Strike's fills, silently, never a guess); live, the tail got 2380.31, equal to Strike's fill.
- **Plainly:** the testnet market fill (2380.31) landed above the call's own target (2380) because the testnet book is thin;
  a market call with a target this close to the mark can fill past it. The call is judged from polled marks, so the call
  and the follower's position can disagree. Not a Tail logic fault, but worth saying in the demo notes.
- This tail used his personal API wallet (no builder code): `fee_bps` 0, so it earns the caller nothing, as the page says.
- Still open for P6: Fade end to end and a real fill from a follower tap (his taps).

## 2026-10-22 P7 built (795 tests + 115 browser checks); not deployed

- **Fee rate is now stored per tail.** Every tail recorded `fee_bps` 0 until now, so no earnings could be computed. A tail takes
  the configured rate only when the follower is a builder wallet (the same condition as the `X-Builder-Fee-Bps` header).
  Tails placed before this change keep 0 and show as "personal wallet": their earnings are understated, not invented.
- **Earnings are an estimate and say so.** Strike's fill has no builder-share field (VERIFIED, `user-api.yaml` 868-884), so the
  figure is entry-fill notional x rate, floored at 8 decimals, entry fills only; exit fills would add more. Payout to callers
  is NOT LIVE: all fees accrue to the one registered code (`sigma`); per-caller codes need a $100 deposit each (UNVERIFIED
  beyond that).
- **Public pages are opt-in.** Migration v4 adds `slug` and `is_public`. `/publish` creates an unguessable 10-character slug,
  `/unpublish` hides it, `/page` shows the state. A private, unknown or malformed slug returns the same 404. Pages carry no
  Telegram ids, chat ids, raw call text or order ids.
- **Home page** shows totals measured from this server's database and says they are test activity.
- **Verified in a browser** (`scripts/pages-e2e.ts`, 115 checks): the real dev database (copied with SQLite's backup API),
  plus a clearly labelled layout fixture. 8 widths x 2 themes, no overflow, stacked rows under 40rem, console clean. Page
  numbers equal the SQL in `CLAIMS.md`; planted controls (overflow detector, wrong fee, call count, followers) all fire.
- **Two mistakes of mine, caught by the checks:** a vacuous `|| true` in my own check for the malformed path (replaced with a
  real assertion); and the first run hit the connect flow's 20/min limit because page reads shared it (page reads now have
  their own 120/min bucket, tested).
- **Not done:** the P8 design pass (this is structurally clean, not yet the final look), screenshots in the README, deploy.

## 2026-10-22 P6 built (723 tests); live Fade and follower checks still his taps

- **Parser, tested on 24 calls written in other people's formats** (`test/fixtures/unseen/`, `scripts/unseen-report.ts`):
  baseline 16/24 (`docs/proof/p6-unseen-baseline.txt`), after tuning 24/24 (`p6-unseen-after-fixes.txt`). Fixes: Cornix-style
  blocks, a direction glued to a symbol (`XAUUSDSELL`), list markers read as prices, entry lists, soft calls, `TP4: Hold`
  leaving a phantom target. 24/24 is on calls I tuned against; it is not a claim about calls I have not seen.
- **Guard rails:** per-user rate limit, at most 10 calls per channel per hour, 10 open tails per follower, a 2-minute
  duplicate window (cancelled drafts do not block a re-post).
- **Ask flow:** when a call is ambiguous (which number is the entry, long or short) the caller gets buttons; the answer fixes
  one field and every rule still applies.
- **Plain rejection reasons** from strings seen live (`docs/proof/p6-strike-errors.json`), shared by confirm and reconcile.
- **AI fallback (OpenRouter, `google/gemini-2.5-flash`)** for calls the parser could not read. The model proposes, it builds
  nothing. A proposal is accepted only if: the market is listed and named in the message; the direction is stated; tp and sl
  appear in the message; entry appears in the message or is the midpoint of two prices in it; and the deterministic parser
  re-validates the result. The caller then sees a draft labelled "Read by AI" and must tap Post. Limits: 20 readings per
  channel per hour, 8 s timeout, text-hash cache, off without `OPENROUTER_API_KEY`, errors never echo the key. Not used for
  answers to questions. The message text is sent to OpenRouter; say so in the privacy note.
- **Live check** (`scripts/ai-live.ts`, `docs/proof/p6-ai-live.json`): 9 cases, each planted control rejected.
- **Correction (my check was wrong, not the app):** an injection control that put `tp 999999` in the message itself was
  accepted. Numbers typed in the message pass the number check by design. Recorded as a known limit in the proposal test: the
  caller's confirmation is the gate, and the channel is admin-only. The control now injects without numbers.
- **Still open:** Fade end to end and a live follower tap (his), deploy (his), P7 onward.

## 2026-10-22 09:55 UTC: P5 built (551 tests); live exit check partly met

- **Built, test first:** versioned migrations (v2 adds leg order ids, close details, call outcome tracking; the live dev database
  was upgraded in place without losing rows); pure outcome rules (`core/outcome.ts`); caller record maths (`core/record.ts`);
  outcomes job; reconciliation job; scheduler; card edit queue; `/record`; all wired into `createApp`
  (reconcile every 15 s, outcomes every 30 s).
- **Strike is the source of truth for a tail.** Reconcile reads each live tail's real order status and records fills (with
  Strike's fill price), rejections, cancellations, a position closed by its take-profit or stop leg (with realized PnL), and
  recovers an "unconfirmed" order by strategy id (open orders, then order history), writing it off after 10 minutes.
- **Bugs the tests found:** (1) two overlapping outcome runs posted two receipts (the retry step saw "no receipt id yet"
  while the first was still posting): fixed with an in-flight guard; (2) the retry step would steal a receipt a second
  instance was about to post: fixed with a 30 s grace period; (3) confirm never re-checked that the call was still open, so
  a follower could open a trade on a call that had already hit its target or stop: fixed.
- **Live, on the real dev database (testnet):** on start the schema went to v2; reconcile read Strike's status for the stale
  test order I cancelled earlier and moved the tail to `cancelled`; outcomes judged call 1 (long ETH-USD limit 2480, tp 2560,
  sl 2420) against the live mark 2403.42 and closed it `sl_hit` with a receipt posted as message 8, a reply to card 7.
  `/record` would show: 1 call, 0 target, 1 stop, hit rate 0.0%, average -1R, followers in 0. `docs/proof/p5-live.json`.
- **Caveats, stated plainly:**
  - That call entered and stopped in the same tick (`entered_at` = `closed_at`): nothing was polling earlier, so the job
    inferred "entered at the limit, then stopped" from a price already below both levels. Samples are polled marks; a wick
    between two polls is missed. R is the call's own ideal reward-to-risk, not a slippage measurement.
  - A target reached without ever touching the limit entry is not counted as a hit; it waits and expires after 72 h.
  - The result edit is a final edit; the defensive "final" flag in the queue is covered by its own unit test, but the
    app-level test cannot distinguish it from coalescing (a mutation survived there), so it is defence in depth.
- **NOT yet done for the P5 exit check as written:** one call reaching a result with a *follower's* order in it. Needs a
  market-entry call with a tight target and one real Tail tap, so the follower's fill and its TP-leg close are exercised
  live. The logic is unit-tested; the live path so far covered cancellation and a call result.
- Not verified visually: how Telegram renders the receipt reply and the edited card (I cannot see his chat). Telegram
  removes the inline keyboard on an edit that omits `reply_markup`; that is from the API's behaviour, UNVERIFIED until he looks.

## 2026-10-21 23:55 UTC: P4 built except the deploy and real-wallet checks

**Status:** P4's exit check is **not met**: it needs the service deployed and a follower signing in a real wallet. Everything
that can be proven without those is proven below.

- **Built (tests first, 441 unit tests):** connect tokens, connect service, HTTP server, `createApp` composition root with
  dev (long polling) and prod (webhook) modes, `/connect` and a connect button for unlinked followers, wallet adapters
  (Ethereum, Phantom, CIP-30), bech32 pinned to BIP-173 vectors, the connect page, Dockerfile, Render blueprint, `docs/DEPLOY.md`.
- **Browser test (`scripts/e2e-connect.ts`, 25 checks, real server, real Strike testnet):** a stub MetaMask signs with a throwaway
  `ethers` wallet. The page links the wallet as a builder wallet (`builder_code` sigma), and the new API key signs a real
  `GET /v2/account` (200, same `account_id`). Controls that must fail do: wrong signer shows "Strike said: wallet signature
  verification failed." and links nothing; a refused prompt links nothing; an unknown token says the link cannot be used.
  Screenshots at 320, 375, 414, 768, 1024, 1280, 1440, 1920 px, dark and light, in `docs/proof/connect/`.
- **Found by looking at renders, not by the checks:** the mobile grid had no area for the brand label, so it spilled into a
  phantom third column and squeezed the page to 212 px at 320 px; the fee line fell back to "a small fee" after an error;
  the focused heading drew a focus ring; tabular figures widened punctuation. All fixed, each with a check that fails on
  the old behaviour (G5 to G7, B4, H1 to H4). The G6 control is the measured broken shell (212 px at 320 px) against a
  280 px floor.
- **Found by the browser run:** `@fastify/static` requires an absolute root; the server passed `web/dist` and would have
  crashed on boot. Test added, fixed.
- **Contrast, measured (WCAG, OKLCH to sRGB, `scripts/contrast.ts`; probe controls: black on white 21:1, same colour 1:1):**

| Theme | Ratio | Needs | Pair |
|---|---|---|---|
| dark | 16.26:1 | 4.5 | text on bg (body text) |
| dark | 8.77:1 | 4.5 | muted on bg (secondary text) |
| dark | 14.78:1 | 4.5 | text on surface (text on panel) |
| dark | 7.97:1 | 4.5 | muted on surface (secondary text on panel) |
| dark | 10.78:1 | 4.5 | onAccent on accent (primary button label) |
| dark | 11.28:1 | 3 | accent on bg (focus ring, active step) |
| dark | 3.42:1 | 3 | line on bg (control border) |
| dark | 3.11:1 | 3 | line on surface (control border on panel) |
| dark | 9.68:1 | 4.5 | warn on surface (notice text) |
| dark | 7.51:1 | 4.5 | danger on surface (error text) |
| light | 15.88:1 | 4.5 | text on bg (body text) |
| light | 7.11:1 | 4.5 | muted on bg (secondary text) |
| light | 16.58:1 | 4.5 | text on surface (text on panel) |
| light | 7.43:1 | 4.5 | muted on surface (secondary text on panel) |
| light | 6.51:1 | 4.5 | onAccent on accent (primary button label) |
| light | 6.30:1 | 3 | accent on bg (focus ring, active step) |
| light | 4.44:1 | 3 | line on bg (control border) |
| light | 4.64:1 | 3 | line on surface (control border on panel) |
| light | 6.69:1 | 4.5 | warn on surface (notice text) |
| light | 6.28:1 | 4.5 | danger on surface (error text) |

- **Image layout verified without Docker:** a clean directory with `npm ci --omit=dev` (86 packages, no vitest, vite, ethers
  or react) started by the container's command serves `/health`, `/connect` and its assets, and answers an unsigned
  webhook with 401. `docker build` itself and the entrypoint's privilege drop are **UNVERIFIED** (no daemon).
- **Hardening:** prod mode drops `SPIKE_API_PRIV` and `TAIL_OWNER_TG_ID`, so the dev `/link` shortcut cannot exist in
  production. Ajv type coercion is off (a number was passing as a string). The token leaves the address bar and lives in
  sessionStorage; the referrer policy is `no-referrer`.
- **Design status:** the page is competent but plain (no signature moment, no real image, a lot of empty space on wide
  screens). That is the P8 `ui-studio` pass; the full pipeline has not been run. Quick-pass tells checked: no eyebrow, no
  gradient, no centred hero, one accent, named transitions, reduced-motion path.
- **UNVERIFIED, needs him:** a real MetaMask signature; Phantom and Lace/Eternl (CIP-30) signatures; the prod bot token's
  webhook registration; a builder fee on a real fill (a builder wallet needs margin; his personal account becomes a
  builder wallet once he connects through the deployed page).
- Branches this phase: `feat/p4-builder-connect`, `feat/p4-connect-link`, `feat/p4-connect-page`, `feat/p4-deploy`.

## 2026-10-21 22:05 UTC: P3 exit check PASSED (live, testnet)

- He ran the whole flow from his phone: `/link`, `/risk 3`, `/addchannel`, the code posted in "Tail test channel" (consumed),
  the call `ETH long 2480 tp 2560 sl 2420 5x`, Post, Tail, Start, Confirm.
- **Checked by me, not taken on trust:** the database (`scripts/db-report.ts`) holds the linked user (key stored as `v1:` ciphertext),
  the registered channel, the open call with card message 7, and a `placed` tail with order id **243140879**. Strike
  (`scripts/p3-proof.ts`, read by client order id) shows that order `open`: limit buy 0.009 ETH-USD at 2480, with the
  `take_profit` (2560) and `stop` (2420) legs `pending`. That is what the confirm card showed. `docs/proof/p3-live.json`.
- Cancelled afterwards: 0 open orders on ETH-USD. The `tails` row still says `placed` for a cancelled order. This is the drift
  P5's reconciliation job exists to fix (status from Strike, not from our row).
- Not captured: Telegram screenshots (need his logged-in client). The database and Strike readings above are the evidence.
- Not yet exercised live: the Fade button, the duplicate guard ("You already took this call") and `/revoke`. Covered by tests only.

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
