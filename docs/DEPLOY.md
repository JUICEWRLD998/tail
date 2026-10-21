# Deploying Tail

Written for Mustapha Fadhlullah. Deploying is your step: it needs your host account and the production bot token, and
neither belongs in a cloud coding session. Testnet only (`STRIKE_NETWORK=testnet`).

## What runs

One container: the Telegram bot (webhook), the connect API and the connect page. State is one SQLite file on a volume.

## 0. Before you start

| You need | Where it comes from |
|---|---|
| The **prod** bot token | @BotFather: the second bot (not `@lidevbot`). Run `/setprivacy` and choose Disable. |
| A **new** `TAIL_KEK` | `openssl rand -base64 32`. Not the dev one: it protects every stored key. |
| A `WEBHOOK_SECRET` | `openssl rand -hex 24` (48 characters). |
| Builder code | `sigma`, fee share 10 bps (already registered on testnet). |

Never reuse `TAIL_KEK`, the bot token or any key between dev and prod, and never paste them into a chat.

## 1. Render

1. New, then Blueprint, pick this repository. `render.yaml` creates the web service and a 1 GB disk at `/data`.
   A disk needs a paid instance (`starter`). Without a disk the database is wiped on every deploy and every follower has to
   connect again.
2. Set the three secrets it asks for: `TELEGRAM_BOT_TOKEN` (prod bot), `TAIL_KEK`, `WEBHOOK_SECRET`.
3. Deploy. `PUBLIC_URL` is taken from Render's `RENDER_EXTERNAL_URL`; set it yourself only for a custom domain.

## 1b. Railway instead

New project from the repo (it builds the `Dockerfile`), add a volume mounted at `/data`, and set:
`TAIL_MODE=prod`, `STRIKE_NETWORK=testnet`, `BUILDER_CODE=sigma`, `BUILDER_FEE_BPS=10`, `TAIL_DB=/data/tail.db`, plus the
three secrets. Generate a public domain; `PUBLIC_URL` comes from `RAILWAY_PUBLIC_DOMAIN`.

## 2. Check it, in this order

```
curl https://<your-host>/health                      # {"ok":true}
curl "https://api.telegram.org/bot<PROD_TOKEN>/getWebhookInfo"
```

`getWebhookInfo` should show `url` ending in `/telegram/<32 hex>`, `last_error_message` empty, and `pending_update_count` 0.
The service registers the webhook itself on start. **Run `getWebhookInfo` against the prod token only**; a webhook on the
dev bot stops its long polling.

Then, in Telegram with the prod bot:

1. `/start` replies with the welcome text.
2. `/addchannel`, post the code in a channel where the prod bot is an admin (post and delete messages).
3. Post `ETH long 2480 tp 2560 sl 2420`, tap Post in the DM, then tap Tail on the card from a second account.
4. The second account has no key yet, so the bot sends **Connect wallet**. Open it, sign once in MetaMask (Sepolia
   account), return to Telegram, tap Tail again, then Confirm. You should get a Strike order id.

## 3. Things that will bite

- **Free instances sleep.** The first tap after idle is slow and Telegram may retry. Use a paid instance while judges look.
- **Testnet books:** only `ETH-USD` has a usable order book on testnet. Use it for demos.
- **Never run prod with the dev bot's token.** Prod sets a webhook; the dev bot uses long polling.
- `TAIL_OWNER_TG_ID` and `SPIKE_API_PRIV` are ignored in prod on purpose: `/link` is a dev-only shortcut.

## What was and was not tested before you deploy

| Item | Status |
|---|---|
| Prod wiring (webhook route, secret check, connect over HTTP, static page) | tested in code (`test/app.test.ts`, `test/server.test.ts`) |
| The image layout (`npm ci --omit=dev`, same start command, `/health`, `/connect`, assets) | reproduced and run in a clean directory |
| The connect page in a real browser against real Strike testnet (Ethereum wallet) | `npx tsx scripts/e2e-connect.ts`, 25 checks |
| `docker build` and the entrypoint's privilege drop | **UNVERIFIED**: no Docker daemon was available |
| Webhook registration against Telegram with the prod token | **UNVERIFIED**: needs the prod token |
| Cardano (Lace, Eternl) and Phantom signatures in a real wallet | **UNVERIFIED**: needs a real wallet |
