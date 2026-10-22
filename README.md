# Tail

A caller posts a trade call in a Telegram channel. Tail turns it into a card with **Tail** and **Fade** buttons. One tap
places a Strike bracket order (entry, take-profit, stop-loss) sized to that follower's own risk. The caller earns a
builder fee on every follower fill.

Tail the call. Strike does the rest.

Built for the Strike Hackathon (2026-10-21 to 2026-10-23) by Mustapha Fadhlullah — independent security researcher.
Testnet only. The build order is in [implementation.md](implementation.md); decisions and spike results are in
[DECISIONS.md](DECISIONS.md); every claim below maps to a command in [CLAIMS.md](CLAIMS.md).

## Status

Each line says LIVE, NEXT or NOT LIVE. Nothing is marked LIVE until it has been run.

| Piece | Status | Note |
|---|---|---|
| Call parser (compact, block, emoji, market entries) | LIVE | `npm test`. Asks a question instead of guessing |
| Position sizing (risk, notional, leverage, lot step) | LIVE | `npm test`. Floors to the lot step, never rounds up |
| Fade (flip side, swap TP and SL, show the inverted reward-to-risk) | LIVE | `npm test` |
| Strike request signing (Ed25519) | LIVE | `npm test` (RFC 8032 vector); Strike accepted a signed `GET /v2/account` on testnet, `docs/proof/spike-a.json` |
| Strike client, bracket order from the CLI | LIVE | `scripts/tail-once.ts`, testnet, ETH-USD. Proof: `docs/proof/p2-tail-once.txt` |
| Telegram: read channel posts, post cards with deep-link buttons, edit them | LIVE (spike) | `docs/proof/spike-d.json` |
| Telegram bot: register a channel, confirm a call, post the card, Tail and Fade quotes, place a bracket | LIVE | Ran end to end on testnet from real taps: Strike order 243140879. `docs/proof/p3-live.json` |
| Builder Connect from a script (Solana wallet) | LIVE | `scripts/scripted-follower.ts`, testnet. Fees on orders: NEXT |
| Connect page: one wallet signature links a follower (MetaMask, Rabby, Phantom, Lace, Eternl) | NEXT | Built; browser-tested locally against real Strike testnet with a scripted Ethereum wallet (`scripts/e2e-connect.ts`). Not deployed |
| Deployment (Docker, Render blueprint, `docs/DEPLOY.md`) | NEXT | Files written; waiting on a host and the prod bot token |
| Live card state: counters from Strike's real order status, call results with a receipt, caller record (`/record`) | LIVE | Ran on testnet against the real dev database: `docs/proof/p5-live.json`. A fresh fill-to-close run with a follower is still to do |
| Builder fee on orders | NEXT | Sent for builder wallets; not yet seen on a fill |
| Caller record and earnings pages | NOT LIVE | |
| Payout to callers | NOT LIVE | |

## How it works

```
caller post -> parser -> draft the caller confirms -> card in the channel [Tail] [Fade]
follower taps -> bot DM -> sizing from the follower's own equity and caps -> confirm -> Strike bracket order
```

The model never builds an order. Parsing and sizing are plain tested code. If a call is ambiguous (no side, two
possible entries, a stop on the wrong side of the entry), the bot asks one question.

## How it uses Strike

| Strike feature | Use | Status |
|---|---|---|
| `POST /v2/order/strategy` | entry, take-profit and stop-loss in one request; the order's final status is read afterwards, because a 201 only means sequenced | LIVE |
| `GET /price/v2/exchangeInfo` | listed markets, tick size, lot step, minimum notional | read; used by the parser and sizing |
| `GET /v2/account` | follower equity (`margin_balance`) for sizing | LIVE |
| API wallets (Ed25519 signed requests) | trade without withdrawal rights | LIVE |
| Builder Connect and `X-Builder-Fee-Bps` | one-signature onboarding, caller fee per fill | NEXT |

## Verify in 60 seconds

```
npm ci
npm test
```

Expect all tests green. `npm run test:cov` prints coverage for `src/core` and `src/strike/sign.ts`.

## Testnet notes

Testnet order books are thin. Only ETH-USD has a book that agrees with its mark price; limit orders on ADA-USD, SOL-USD and
BTC-USD were rejected as `order_price_out_of_limit` (details in [DECISIONS.md](DECISIONS.md)). Demos run on ETH-USD.

## What Tail is not

- Not a trading terminal and not a Telegram Mini App.
- It holds no funds and cannot withdraw. API wallets cannot withdraw on Strike.
- Not on mainnet. Testnet until the owner says otherwise.
- Test activity is not adoption. Any number shown on a page comes from real rows and is labelled as test activity.
