// Entrypoint. Dev mode runs grammY with long polling (the dev bot token); prod mode (webhook) arrives in P4.
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Api } from "grammy";
import { createBot } from "./bot/bot.js";
import { createService } from "./bot/service.js";
import { loadConfig } from "./config.js";
import { decryptSecret } from "./db/crypto.js";
import { openStore, type User } from "./db/store.js";
import { StrikeClient } from "./strike/client.js";

const cfg = loadConfig(process.env);
if (cfg.mode !== "dev") throw new Error("prod mode (webhook) is not built yet; run with TAIL_MODE=dev");

mkdirSync(dirname(cfg.dbPath), { recursive: true });
const store = openStore(cfg.dbPath);

const api = new Api(cfg.token);
const me = await api.getMe();
const hook = await api.getWebhookInfo();
if (hook.url) {
  throw new Error("This bot token has a webhook set; long polling cannot run. Never set a webhook on the dev bot.");
}

const publicStrike = new StrikeClient({ baseUrl: cfg.baseUrl });
const clients = new Map<string, StrikeClient>();
const strikeFor = (user: User): StrikeClient => {
  const key = `${user.tgId}:${user.apiPub}:${user.builderCode ?? ""}`;
  let c = clients.get(key);
  if (!c) {
    c = new StrikeClient({
      baseUrl: cfg.baseUrl,
      privateKeyHex: decryptSecret(cfg.kek, user.apiPrivEnc),
      autoSync: true,
      ...(user.builderCode && cfg.builderFeeBps ? { builderFeeBps: cfg.builderFeeBps } : {}),
    });
    clients.set(key, c);
  }
  return c;
};

const service = createService({
  store, kek: cfg.kek, botUsername: me.username, publicStrike, strikeFor,
  clientForKey: (privateKeyHex) => new StrikeClient({ baseUrl: cfg.baseUrl, privateKeyHex, autoSync: true }),
  now: () => new Date().toISOString(), uuid: randomUUID, sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
});

const bot = createBot({ token: cfg.token, botInfo: me, service, store, ownerTgId: cfg.ownerTgId, linkKey: cfg.linkKey, now: () => new Date().toISOString() });

const stop = async () => {
  await bot.stop();
  store.close();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await bot.start({
  allowed_updates: ["message", "channel_post", "callback_query", "my_chat_member"],
  onStart: (info) => console.log(`Tail bot @${info.username} polling (${cfg.network}, ${cfg.mode}); owner ${cfg.ownerTgId ?? "not set"}`),
});
