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
| Core coverage | `npm run test:cov` | `src/core` above 90% statements |

## Not yet claimed

- That a bracket order fills and reports fees (Spikes B, C).
- That the bot reads channel posts and edits cards (Spike D).
