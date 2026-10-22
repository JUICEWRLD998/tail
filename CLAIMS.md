# CLAIMS

Each claim in the README, and the command that reproduces it. If a command does not exist yet, the claim is not LIVE.

| Claim | Command | Expected |
|---|---|---|
| The parser turns the four documented call formats into a draft | `npx vitest run test/parser.test.ts` | all pass; 12 fixtures in `test/fixtures/calls/` |
| Ambiguous calls ask a question instead of guessing | `npx vitest run test/parser.test.ts -t "ambiguity"` | pass |
| A long never gets a stop at or above its entry | `npx vitest run test/parser.test.ts -t "valid level order"` | pass; the test asserts it accepted more than 100 drafts |
| Position size never exceeds a cap, never rounds up | `npx vitest run test/sizing.test.ts` | pass; the sweep covers 500 random inputs |
| Fade flips side, swaps TP and SL, and is its own inverse | `npx vitest run test/fade.test.ts` | pass |
| Request signing follows the documented message and Ed25519 | `npx vitest run test/sign.test.ts` | pass (RFC 8032 test 1) |
| Strike accepts our signed request; an unregistered key gets 401 | `set -a; . ./.env; set +a; npx tsx scripts/spike-a.ts` (needs a registered API wallet) | 200 and `margin_balance`; output in `docs/proof/spike-a.json` |
| Builder Connect works with no browser | `BUILDER_CODE=<code> npx tsx scripts/scripted-follower.ts` | verify-signature 200, new account id |
| A parsed call becomes a real testnet bracket and Strike lists it | `TAIL_RISK_PCT=3 npx tsx scripts/tail-once.ts "ETH long 2480 tp 2560 sl 2420 5x" --place` | primary `open`, openOrders lists the limit, take_profit and stop; output in `docs/proof/p2-tail-once.txt` |
| A market bracket fills and reports a fee | `npx tsx scripts/spike-c.ts` | primary `filled`, fill has `fee` and `fee_type`; `docs/proof/spike-c.json` |
| Telegram card with deep-link buttons, DM `/start`, card edit | `npx tsx scripts/spike-d.ts` (needs a tap) | outcome ok; `docs/proof/spike-d.json` |
| A channel post becomes a card; a tap becomes a Strike bracket | `npm start`, then follow the steps in `DECISIONS.md` (P3); `npx tsx scripts/p3-proof.ts` | tail `placed`, Strike order `open` with TP and SL `pending`; `docs/proof/p3-live.json` |
| A wallet signature links a follower and the new API key signs a real Strike request | `npm run web:build && BUILDER_CODE=sigma npx tsx scripts/e2e-connect.ts` | 25 checks pass (A5 is the live `GET /v2/account`); `docs/proof/connect-e2e.json` |
| A wrong or refused signature links nothing | same script, checks B and C | pass |
| The connect page fits 8 widths in both themes with no overflow | same script, checks G1 to G7; screenshots in `docs/proof/connect/` | pass |
| Text contrast meets WCAG AA in both themes | `npx tsx scripts/contrast.ts` | every pair above its bar; planted controls in `test/web/contrast.test.ts` |
| A call's result is decided from real mark prices and posted once as a reply to its card | `npx vitest run test/outcome.test.ts test/outcomes-job.test.ts`; live: `npx tsx scripts/p5-proof.ts` | pass; `docs/proof/p5-live.json` shows call 1 `sl_hit` with a receipt id |
| A tail's status comes from Strike, not from our row (fills, rejections, cancellations, closed positions, unconfirmed orders) | `npx vitest run test/reconcile-job.test.ts` | pass; live: the stale tail became `cancelled` from Strike's status |
| A burst of confirms edits a card at most once per 3 s and a result can never be overwritten | `npx vitest run test/edit-queue.test.ts test/app.test.ts` | pass |
| The caller record is computed from rows only | `npx vitest run test/record.test.ts`; `/record` in Telegram | pass; says so when there are no results |
| The parser reads 24 calls in other formats | `npx tsx scripts/unseen-report.ts` | 24/24 (baseline before tuning 16/24, `docs/proof/p6-unseen-baseline.txt`); tuned on these calls |
| Abuse limits and the ask flow hold | `npx vitest run test/service.test.ts -t "guard rails"` and `-t "ask flow"` | pass |
| An AI reading is accepted only if every price is in the message and the parser agrees | `npx vitest run test/ai-proposal.test.ts test/ai-reader.test.ts` | pass; includes the known limit |
| The AI fallback never builds an order; the caller must confirm | `npx vitest run test/service.test.ts -t "AI fallback"` | pass |
| The real model behaves on planted controls | `OPENROUTER_API_KEY=... npx tsx scripts/ai-live.ts` | 9 cases behave; `docs/proof/p6-ai-live.json` |
| A caller's public page shows numbers that match SQL | `npm run web:build && npx tsx scripts/pages-e2e.ts` | 115 checks pass; SQL below; `docs/proof/pages-e2e.json`; screenshots in `docs/proof/pages/` |
| Builder-fee earnings are an estimate, floored, entry fills only | `npx vitest run test/earnings.test.ts` | pass; Strike's fill has no builder-share field (`user-api.yaml` 868-884) |
| A page is opt-in, and private, unknown and malformed slugs look alike | `npx vitest run test/store.test.ts test/pages.test.ts test/server.test.ts -t "public"` | pass |
| Core coverage | `npm run test:cov` | `src/core` above 90% statements |

## SQL behind the caller page (run against `data/tail.db`; `?` is the channel's chat id)

```sql
-- calls, target hits, stop hits (a draft or cancelled call is not part of the record)
SELECT COUNT(*) FROM calls WHERE chat_id = ? AND status NOT IN ('draft','cancelled');
SELECT COUNT(*) FROM calls WHERE chat_id = ? AND status = 'tp_hit';
SELECT COUNT(*) FROM calls WHERE chat_id = ? AND status = 'sl_hit';
-- followers in
SELECT COUNT(DISTINCT t.tg_id) FROM tails t JOIN calls c ON c.id = t.call_id
 WHERE c.chat_id = ? AND t.status IN ('placed','filled','closed');
-- filled tails, and the estimated builder fee: entry fill notional x the rate the order carried (USD)
SELECT COUNT(*), SUM(CAST(t.size AS REAL) * CAST(t.fill_price AS REAL) * t.fee_bps / 10000.0)
  FROM tails t JOIN calls c ON c.id = t.call_id
 WHERE c.chat_id = ? AND c.status NOT IN ('draft','cancelled')
   AND t.status IN ('filled','closed') AND t.fill_price IS NOT NULL;
```

## Not yet claimed

- That a follower's order fills and later closes at its target or stop, end to end on testnet (the logic is tested; the live run so far covered cancellation and a call result).
- That a builder fee appears on a fill (needs a funded builder-code wallet).
- That Cardano (Lace, Eternl) and Phantom signatures link in a real wallet. Ethereum is verified with a scripted wallet only.
- That the Docker image builds and runs (no Docker daemon was available).
