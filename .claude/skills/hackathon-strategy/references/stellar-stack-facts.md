# Stellar stack facts (measured, for Stellar events only)

First written 2026-10-06 (Find Your Way / Stellar Passport pass). Re-measure before relying on any number.
Scripts: `Desktop/stellar-findyourway/strategy/{census,corridors}.mjs`, `strategy/spikes/spike2.mjs`.

## Verified on testnet (2026-10-06)

- A **claimable balance can name a claimant account that does not exist yet**. This lets you pay a link key, and the account is created at claim time.
- **One transaction can do it all:** BeginSponsoring → CreateAccount(0) → ChangeTrust → EndSponsoring → ClaimClaimableBalance → PathPaymentStrictSend → ChangeTrust(limit 0). It is all-or-nothing. A `destMin` breach (`op_under_dest_min`) reverts everything, and the balance keeps waiting.
- **Trap:** an `AccountMerge` of an account created in the same ledger fails with `op_seq_num_too_far`. Merge in a later transaction.
- Refund predicates work: recipient `before(T)` and sender `not(before(T))`. An early sender claim fails with `op_cannot_claim`.

## Measured on mainnet (2026-10-06)

- **Anchor directories are stale.** Of 125 listed or known anchor domains:
  - 38 serve a stellar.toml;
  - 8 mainnet anchors answer SEP-24 `/info` (Anclap ARS/PEN, Link NGNC, nTokens BRL, MoneyGram USDC, Zeam, Ultra);
  - 1 mainnet anchor answers SEP-38 (zeam.money).
  - "Live anchor quotes" ideas need a live census first.
  - Control: `testanchor.stellar.org` serves every SEP.
- **Emerging-market DEX corridors are thin.** USDC → NGNC loses 43% at $100; GHSC −85%; PEN −78%. ARS (+4%), ZARZ (0%) and BRL (to about $100) are fair. Measure with Horizon `/paths/strict-send` against a reference mid.
- MoneyGram Ramps on Stellar is **allowlisted wallets only**. Never plan a demo on it without approval.

## Winner DNA

Stellar Builder Summit São Paulo 2026 winners (developers.stellar.org/meetings/2026/08/13):
- a PIX ramp aggregator with live anchor quotes;
- a BRL treasury-yield token;
- a passkey wallet with confidential transfers;
- QuietBook (confidential RWA book-building);
- StellarPay (x402/MPP middleware);
- Stellar Memory (dev tooling).

Field signal: x402 / agent payments was the most crowded cell (9 of 38) in Find Your Way.
