// Composition root: builds the store, Strike clients, services, bot and HTTP server from a Config.
// main.ts only starts it. Dependencies can be replaced so the wiring is testable without the network.
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Api, InlineKeyboard, type Bot } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { createAiReader } from "./ai/openrouter.js";
import { createBot } from "./bot/bot.js";
import { createEditQueue } from "./bot/edit-queue.js";
import { createService, type StrikeLike } from "./bot/service.js";
import type { Config } from "./config.js";
import { createConnectService } from "./connect/service.js";
import { decryptSecret } from "./db/crypto.js";
import { openStore, type User } from "./db/store.js";
import { runOutcomes } from "./jobs/outcomes.js";
import { runReconcile, type ReconcileStrike } from "./jobs/reconcile.js";
import { createScheduler } from "./jobs/scheduler.js";
import { StrikeClient } from "./strike/client.js";
import { createPages } from "./web/pages.js";
import { buildServer } from "./web/server.js";

/** What the app needs from a Strike client: trading calls for the service and read calls for reconciliation. */
type FullStrike = StrikeLike & ReconcileStrike;

export interface AppDeps {
  publicStrike?: StrikeLike & Pick<StrikeClient, "builderRequestSignature" | "builderVerifySignature">;
  strikeFor?: (user: User) => FullStrike;
  clientForKey?: (privateKeyHex: string) => StrikeLike;
  botInfo?: UserFromGetMe;
  staticDir?: string;
}

/** How often the live-state jobs run. Reconcile is cheaper per tick and bounded per run; outcomes is one price read per symbol. */
export const OUTCOMES_EVERY_MS = 30_000;
export const RECONCILE_EVERY_MS = 15_000;
/** Telegram throttles edits per chat; counter edits for one card are spaced at least this far apart. */
export const CARD_EDIT_WINDOW_MS = 3_000;

const ALLOWED_UPDATES = ["message", "channel_post", "callback_query", "my_chat_member"] as const;

export async function createApp(cfg: Config, deps: AppDeps = {}) {
  if (cfg.dbPath !== ":memory:") mkdirSync(dirname(cfg.dbPath), { recursive: true });
  const store = openStore(cfg.dbPath);

  const publicStrike = deps.publicStrike ?? new StrikeClient({ baseUrl: cfg.baseUrl });
  const clients = new Map<string, StrikeClient>();
  const strikeFor =
    deps.strikeFor ??
    ((user: User): FullStrike => {
      const key = `${user.tgId}:${user.apiPub}:${user.builderCode ?? ""}`;
      let c = clients.get(key);
      if (!c) {
        c = new StrikeClient({
          baseUrl: cfg.baseUrl,
          privateKeyHex: decryptSecret(cfg.kek, user.apiPrivEnc),
          autoSync: true,
          // A caller-code wallet carries that caller's rate; the default builder wallet carries the server's.
          ...(user.feeBps !== undefined ? { builderFeeBps: user.feeBps } : user.builderCode && cfg.builderFeeBps ? { builderFeeBps: cfg.builderFeeBps } : {}),
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
    builderFeeBps: cfg.builderFeeBps,
    ai: cfg.aiApiKey ? createAiReader({ apiKey: cfg.aiApiKey, model: cfg.aiModel }) : undefined,
  });

  // Wallet connect needs a builder code, its fee, and a URL the browser can reach.
  const connectEnabled = Boolean(cfg.publicUrl && cfg.builderCode && cfg.builderFeeBps !== undefined);

  // All channel-card edits (confirm, reconcile, outcomes) share one queue so a stale counter cannot overwrite a result.
  // The bot is created just below; the edit function reads it lazily.
  let botRef: Bot | undefined;
  const cardQueue = createEditQueue({
    delayMs: CARD_EDIT_WINDOW_MS,
    edit: async (chatId, messageId, text, buttons) => {
      const kb = new InlineKeyboard();
      for (const b of buttons) kb.url(b.text, b.url);
      await (botRef as Bot).api.editMessageText(chatId, messageId, text, { parse_mode: "HTML", ...(buttons.length > 0 ? { reply_markup: kb } : {}) });
    },
    log: (m) => console.warn(`[cards] ${m}`),
  });

  const bot: Bot = createBot({
    token: cfg.token, botInfo: me, service, store, ownerTgId: cfg.ownerTgId, linkKey: cfg.linkKey,
    publicUrl: connectEnabled ? cfg.publicUrl : undefined, enqueueCardEdit: (e) => cardQueue.enqueue(e), now,
  });
  botRef = bot;

  const connect = createConnectService({
    store, kek: cfg.kek, builderCode: cfg.builderCode ?? "", feeShareBps: cfg.builderFeeBps ?? 0, strike: publicStrike, now,
    notify: async (tgId, text) => void (await bot.api.sendMessage(tgId, text, { parse_mode: "HTML" })),
  });

  const html = { parse_mode: "HTML" as const };
  const outcomes = () =>
    runOutcomes({
      store, now: Date.now, markPrice: (symbol) => publicStrike.markPrice(symbol),
      reply: async (chatId, text, replyTo) =>
        (await bot.api.sendMessage(chatId, text, { ...html, ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}) })).message_id,
      // Final edit: the call is over, so the buttons go (no buttons = no reply_markup) and nothing may overwrite it.
      editCard: (chatId, messageId, text) => cardQueue.enqueue({ chatId, messageId, text, buttons: [] }, { final: true }),
      log: (m) => console.warn(`[outcomes] ${m}`),
    });
  const reconcile = () =>
    runReconcile({
      store, now: Date.now, botUsername: me.username as string, strikeFor,
      dm: async (tgId, text) => void (await bot.api.sendMessage(tgId, text, html)),
      editCard: (chatId, messageId, text, buttons) => cardQueue.enqueue({ chatId, messageId, text, buttons }),
      log: (m) => console.warn(`[reconcile] ${m}`),
    });
  const scheduler = createScheduler(
    [
      { name: "outcomes", everyMs: OUTCOMES_EVERY_MS, run: outcomes },
      { name: "reconcile", everyMs: RECONCILE_EVERY_MS, run: reconcile },
    ],
    (m) => console.warn(`[jobs] ${m}`),
  );

  const server = buildServer({
    connect, now: Date.now, staticDir: deps.staticDir ?? "web/dist", pages: createPages(store, { botUsername: me.username as string }),
    ...(cfg.mode === "prod" && cfg.webhookPath && cfg.webhookSecret
      ? { webhook: { path: cfg.webhookPath, secretToken: cfg.webhookSecret, handle: (u: unknown) => bot.handleUpdate(u as Update) } }
      : {}),
  });

  return {
    bot, server, store, me,

    /** Runs both live-state jobs once, in order; a failure in one does not stop the other. Used by tests and one-off checks. */
    async runJobsOnce() {
      const result: Record<string, unknown> = {};
      for (const [name, job] of [["outcomes", outcomes], ["reconcile", reconcile]] as const) {
        try {
          result[name] = await job();
        } catch (e) {
          result[name] = { error: (e as Error).message };
        }
      }
      return result;
    },

    startJobs: () => scheduler.start(),

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
        scheduler.start();
        log(`Tail @${me.username} serving webhook on :${cfg.port} (${cfg.network}, prod)`);
        return;
      }
      const hook = await bootstrap.getWebhookInfo();
      if (hook.url) throw new Error("This bot token has a webhook set; long polling cannot run. Never set a webhook on the dev bot.");
      if (connectEnabled) await server.listen({ port: cfg.port, host: "127.0.0.1" });
      scheduler.start();
      void bot.start({
        allowed_updates: [...ALLOWED_UPDATES],
        onStart: (info) => log(`Tail bot @${info.username} polling (${cfg.network}, dev); owner ${cfg.ownerTgId ?? "not set"}`),
      });
    },

    async stop() {
      await scheduler.stop();
      await cardQueue.flush();
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
