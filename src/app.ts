// Composition root: builds the store, Strike clients, services, bot and HTTP server from a Config.
// main.ts only starts it. Dependencies can be replaced so the wiring is testable without the network.
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Api, type Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { createBot } from "./bot/bot.js";
import { createService, type StrikeLike } from "./bot/service.js";
import type { Config } from "./config.js";
import { createConnectService } from "./connect/service.js";
import { decryptSecret } from "./db/crypto.js";
import { openStore, type User } from "./db/store.js";
import { StrikeClient } from "./strike/client.js";
import { buildServer } from "./web/server.js";

export interface AppDeps {
  publicStrike?: StrikeLike & Pick<StrikeClient, "builderRequestSignature" | "builderVerifySignature">;
  strikeFor?: (user: User) => StrikeLike;
  clientForKey?: (privateKeyHex: string) => StrikeLike;
  botInfo?: UserFromGetMe;
  staticDir?: string;
}

const ALLOWED_UPDATES = ["message", "channel_post", "callback_query", "my_chat_member"] as const;

export async function createApp(cfg: Config, deps: AppDeps = {}) {
  if (cfg.dbPath !== ":memory:") mkdirSync(dirname(cfg.dbPath), { recursive: true });
  const store = openStore(cfg.dbPath);

  const publicStrike = deps.publicStrike ?? new StrikeClient({ baseUrl: cfg.baseUrl });
  const clients = new Map<string, StrikeClient>();
  const strikeFor =
    deps.strikeFor ??
    ((user: User): StrikeLike => {
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
    });
  const clientForKey = deps.clientForKey ?? ((privateKeyHex: string): StrikeLike => new StrikeClient({ baseUrl: cfg.baseUrl, privateKeyHex, autoSync: true }));

  // The bot's username builds the Tail and Fade deep links.
  const bootstrap = new Api(cfg.token);
  const me = deps.botInfo ?? (await bootstrap.getMe());

  const now = () => new Date().toISOString();
  const service = createService({
    store, kek: cfg.kek, botUsername: me.username as string, publicStrike, strikeFor, clientForKey,
    now, uuid: randomUUID, sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });

  // Wallet connect needs a builder code, its fee, and a URL the browser can reach.
  const connectEnabled = Boolean(cfg.publicUrl && cfg.builderCode && cfg.builderFeeBps !== undefined);

  const bot: Bot = createBot({
    token: cfg.token, botInfo: me, service, store, ownerTgId: cfg.ownerTgId, linkKey: cfg.linkKey,
    publicUrl: connectEnabled ? cfg.publicUrl : undefined, now,
  });

  const connect = createConnectService({
    store, kek: cfg.kek, builderCode: cfg.builderCode ?? "", feeShareBps: cfg.builderFeeBps ?? 0, strike: publicStrike, now,
    notify: async (tgId, text) => void (await bot.api.sendMessage(tgId, text)),
  });

  const server = buildServer({
    connect, now: Date.now, staticDir: deps.staticDir ?? "web/dist",
    ...(cfg.mode === "prod" && cfg.webhookPath && cfg.webhookSecret
      ? { webhook: { path: cfg.webhookPath, secretToken: cfg.webhookSecret, handle: (u: unknown) => bot.handleUpdate(u as Update) } }
      : {}),
  });

  return {
    bot, server, store, me,

    async registerWebhook() {
      if (cfg.mode !== "prod" || !cfg.publicUrl || !cfg.webhookPath || !cfg.webhookSecret) throw new Error("webhook is a prod-mode feature");
      await bot.api.setWebhook(`${cfg.publicUrl}${cfg.webhookPath}`, { secret_token: cfg.webhookSecret, allowed_updates: [...ALLOWED_UPDATES] });
    },

    /** Dev: long polling (refuses a token that has a webhook). Prod: HTTP server plus Telegram webhook. */
    async start(log: (m: string) => void = console.log) {
      if (cfg.mode === "prod") {
        await server.listen({ port: cfg.port, host: "0.0.0.0" });
        await bot.init();
        await this.registerWebhook();
        log(`Tail @${me.username} serving webhook on :${cfg.port} (${cfg.network}, prod)`);
        return;
      }
      const hook = await bootstrap.getWebhookInfo();
      if (hook.url) throw new Error("This bot token has a webhook set; long polling cannot run. Never set a webhook on the dev bot.");
      if (connectEnabled) await server.listen({ port: cfg.port, host: "127.0.0.1" });
      void bot.start({
        allowed_updates: [...ALLOWED_UPDATES],
        onStart: (info) => log(`Tail bot @${info.username} polling (${cfg.network}, dev); owner ${cfg.ownerTgId ?? "not set"}`),
      });
    },

    async stop() {
      await server.close();
      try {
        await bot.stop();
      } catch {
        /* not polling */
      }
      store.close();
    },
  };
}

export type App = Awaited<ReturnType<typeof createApp>>;
