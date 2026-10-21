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
| Core coverage | `npm run test:cov` | `src/core` above 90% statements |

## Not yet claimed

- That a builder fee appears on a fill (needs a funded builder-code wallet).
- That Cardano (Lace, Eternl) and Phantom signatures link in a real wallet. Ethereum is verified with a scripted wallet only.
- That the Docker image builds and runs (no Docker daemon was available).
