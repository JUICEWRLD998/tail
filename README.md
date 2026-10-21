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
| Strike request signing (Ed25519) | LIVE | `npm test`, RFC 8032 vector. Not yet checked against a Strike-accepted request |
| Strike client, bracket order from the CLI | NEXT | Waiting on a funded testnet API wallet |
| Telegram bot, cards, Tail and Fade buttons | NEXT | Waiting on the dev bot token |
| Builder Connect (wallet signs once), builder fees | NEXT | Waiting on a testnet builder code |
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
| `POST /v2/order/strategy` | entry, take-profit and stop-loss in one request | NEXT |
| `GET /price/v2/exchangeInfo` | listed markets, tick size, lot step, minimum notional | read; used by the parser and sizing |
| `GET /v2/account` | follower equity (`margin_balance`) for sizing | NEXT |
| API wallets (Ed25519 signed requests) | trade without withdrawal rights | signing LIVE, calls NEXT |
| Builder Connect and `X-Builder-Fee-Bps` | one-signature onboarding, caller fee per fill | NEXT |

## Verify in 60 seconds

```
npm ci
npm test
```

Expect all tests green. `npm run test:cov` prints coverage for `src/core` and `src/strike/sign.ts`.

## What Tail is not

- Not a trading terminal and not a Telegram Mini App.
- It holds no funds and cannot withdraw. API wallets cannot withdraw on Strike.
- Not on mainnet. Testnet until the owner says otherwise.
- Test activity is not adoption. Any number shown on a page comes from real rows and is labelled as test activity.
