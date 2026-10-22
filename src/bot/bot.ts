// grammY wiring. All decisions live in the service; this file only maps Telegram updates to it and back.
import { Bot, InlineKeyboard } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import type { Store } from "../db/store.js";
import { recordText, summarize, type RecordCall } from "../core/record.js";
import { escapeHtml, parseCallbackData, parseStartPayload } from "./cards.js";
import type { Button, Reply, Service } from "./service.js";

export interface BotOptions {
  token: string;
  botInfo?: UserFromGetMe;
  service: Service;
  store: Store;
  /** Telegram id allowed to use /link with the server-held dev key. */
  ownerTgId?: number | undefined;
  /** Dev-only API wallet key held by the server (SPIKE_API_PRIV). Never sent to Telegram. */
  linkKey?: string | undefined;
  /** Public https origin of this service. When set, unlinked followers get a wallet-connect button. */
  publicUrl?: string | undefined;
  now: () => string;
}

const HTML = { parse_mode: "HTML" as const };
const CODE_RE = /^TAIL-[A-Z2-9]{6}$/i;
const POINTER = "Tail reads calls from a channel. Tap Tail or Fade on a call card, or send /help.";
const HELP = [
  "Followers",
  "/me  your account and limits",
  "/connect  link your wallet",
  "/link  link a dev key (server owner only)",
  "/risk 1  percent of equity risked per trade",
  "/maxlev 5  leverage cap",
  "/maxnotional 500  size cap in USD",
  "/revoke  remove your key from Tail",
  "",
  "Callers",
  "/addchannel  register a channel or group",
  "/call ETH long 2480 tp 2560 sl 2420  draft a call",
  "/record  your calls, hit rate and followers",
].join("\n");
const CONNECT_TEXT = "Connect your wallet once to trade. It signs one message and cannot withdraw funds.";
const WELCOME = "Tail turns a channel call into a Strike order in one tap.\nTap Tail or Fade on a call card to start.\n/me shows your account. /link connects it.";

function keyboard(buttons: Button[] | undefined): InlineKeyboard | undefined {
  if (!buttons || buttons.length === 0) return undefined;
  const kb = new InlineKeyboard();
  for (const b of buttons) {
    if (b.url) kb.url(b.text, b.url);
    else kb.text(b.text, b.callback as string);
  }
  return kb;
}

export function createBot(o: BotOptions): Bot {
  const bot = new Bot(o.token, o.botInfo ? { botInfo: o.botInfo } : {});
  const { service, store } = o;

  const dmUser = async (tgId: number, reply: Reply) => {
    try {
      await bot.api.sendMessage(tgId, reply.text, { ...HTML, reply_markup: keyboard(reply.buttons) });
    } catch (e) {
      // The caller must have started the bot once before it can message them. Log without the message body.
      console.warn(`could not DM ${tgId}: ${(e as Error).message}`);
    }
  };

  const connectReply = async (ctx: { from?: { id: number }; reply: (t: string, o?: object) => Promise<unknown> }) => {
    const token = store.createConnectToken(ctx.from!.id, o.now());
    const url = `${(o.publicUrl as string).replace(/\/+$/, "")}/connect?t=${token}`;
    await ctx.reply(CONNECT_TEXT, { reply_markup: new InlineKeyboard().url("Connect wallet", url) });
  };

  // ---- registration and calls: channel posts and group messages ----
  const handleChatText = async (ctx: any, text: string, senderTgId: number | undefined) => {
    const chat = ctx.chat;
    if (CODE_RE.test(text.trim())) {
      const tgId = store.consumeChannelCode(text, o.now());
      if (tgId === undefined) return;
      store.registerChannel({
        chatId: chat.id, title: chat.title ?? String(chat.id), kind: chat.type === "channel" ? "channel" : "group",
        callerTgId: tgId, createdAt: o.now(),
      });
      try {
        await ctx.api.deleteMessage(chat.id, ctx.msg.message_id);
      } catch {
        /* the bot may lack delete permission; the code is single use and expires anyway */
      }
      await dmUser(tgId, { text: `Registered ${escapeHtml(chat.title ?? String(chat.id))}. Post a call there to try it.` });
      return;
    }
    const r = await service.onCallerPost({ chatId: chat.id, messageId: ctx.msg.message_id, text, ...(senderTgId === undefined ? {} : { senderTgId }) });
    if (r.type === "dm") await dmUser(r.tgId, r.reply);
  };

  bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const link = parseStartPayload(ctx.match.trim());
    if (!link) return void (await ctx.reply(WELCOME, HTML));
    const q = await service.quote({ tgId: ctx.from!.id, callId: link.callId, mode: link.mode });
    if (!q.ok) {
      if (q.needsLink && o.publicUrl) return void (await connectReply(ctx));
      return void (await ctx.reply(q.text, HTML));
    }
    await ctx.reply(q.reply.text, { ...HTML, reply_markup: keyboard(q.reply.buttons) });
  });

  bot.command("help", async (ctx) => {
    if (ctx.chat.type === "private") await ctx.reply(HELP);
  });

  bot.command("connect", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (!o.publicUrl) return void (await ctx.reply("Wallet connect is not set up on this server. Use /link."));
    await connectReply(ctx);
  });

  bot.command("addchannel", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const code = store.createChannelCode(ctx.from!.id, o.now());
    await ctx.reply(
      `Add me as an admin of your channel or group, with permission to post and delete messages. Then post this code there within 10 minutes:\n<code>${code}</code>`,
      HTML,
    );
  });

  bot.command("call", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const channels = store.channelsOf(ctx.from!.id);
    if (channels.length === 0) return void (await ctx.reply("No channel yet. Use /addchannel."));
    if (channels.length > 1) return void (await ctx.reply("You have several channels. Post the call in the channel itself."));
    const r = await service.onCallerPost({ chatId: channels[0]!.chatId, messageId: 0, text: ctx.match });
    if (r.type === "dm") await dmUser(r.tgId, r.reply);
    else await ctx.reply("That does not look like a call.");
  });

  bot.command("record", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const channels = store.channelsOf(ctx.from!.id);
    if (channels.length === 0) return void (await ctx.reply("No channel yet. Use /addchannel."));
    const blocks = channels.map((c) => {
      const rows: RecordCall[] = store.callsOfChat(c.chatId).map((x) => ({
        symbol: x.symbol, side: x.side, entryKind: x.entryKind, entry: x.entry, tp: x.tp, sl: x.sl, enteredPrice: x.enteredPrice,
        status: x.status as RecordCall["status"],
      }));
      return recordText(escapeHtml(c.title), summarize(rows, store.followersIn(c.chatId)));
    });
    await ctx.reply(blocks.join("\n\n"), HTML);
  });

  bot.command("link", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const id = ctx.from!.id;
    if (o.ownerTgId === undefined) {
      return void (await ctx.reply(`Owner is not set. Your Telegram ID is ${id}. Set TAIL_OWNER_TG_ID to it and restart.`));
    }
    if (id !== o.ownerTgId) return void (await ctx.reply("Not available."));
    if (!o.linkKey) return void (await ctx.reply("No key is configured on this server."));
    const r = await service.link(id, o.linkKey);
    await ctx.reply(r.text, HTML);
  });

  bot.command("me", async (ctx) => {
    if (ctx.chat.type === "private") await ctx.reply(await service.me(ctx.from!.id), HTML);
  });

  const setting = (name: string, key: "riskPct" | "maxLeverage" | "maxNotionalUsd", example: string) =>
    bot.command(name, async (ctx) => {
      if (ctx.chat.type !== "private") return;
      const arg = ctx.match.trim();
      if (!arg) return void (await ctx.reply(`Usage: /${name} ${example}`));
      await ctx.reply(service.set(ctx.from!.id, key, arg).text, HTML);
    });
  setting("risk", "riskPct", "1");
  setting("maxlev", "maxLeverage", "5");
  setting("maxnotional", "maxNotionalUsd", "500");

  bot.command("revoke", async (ctx) => {
    if (ctx.chat.type === "private") await ctx.reply(service.revoke(ctx.from!.id), HTML);
  });

  // ---- chat text (after commands, so commands never reach here) ----
  bot.on("channel_post:text", (ctx) => handleChatText(ctx, ctx.channelPost.text, undefined));
  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type === "private") return void (await ctx.reply(POINTER));
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") return;
    if (ctx.message.text.startsWith("/")) return;
    await handleChatText(ctx, ctx.message.text, ctx.from.id);
  });

  // ---- button taps ----
  bot.on("callback_query:data", async (ctx) => {
    const cb = parseCallbackData(ctx.callbackQuery.data);
    const from = ctx.from.id;
    if (!cb) return void (await ctx.answerCallbackQuery());
    const original = escapeHtml((ctx.callbackQuery.message as { text?: string } | undefined)?.text ?? "");

    if (cb.kind === "post") {
      const r = service.postDraft(cb.id, from);
      if (!r.ok) return void (await ctx.answerCallbackQuery({ text: r.text, show_alert: true }));
      const msg = await ctx.api.sendMessage(r.chatId, r.text, { ...HTML, reply_markup: keyboard(r.buttons) });
      service.afterPosted(cb.id, msg.message_id);
      await ctx.editMessageText("Posted.", HTML);
      return void (await ctx.answerCallbackQuery());
    }
    if (cb.kind === "drop") {
      await ctx.editMessageText(service.dropDraft(cb.id, from).text, HTML);
      return void (await ctx.answerCallbackQuery());
    }
    if (cb.kind === "cancel") {
      await ctx.editMessageText(service.cancel({ tgId: from, tailId: cb.id }).text, HTML);
      return void (await ctx.answerCallbackQuery());
    }
    // confirm
    const r = await service.confirm({ tgId: from, tailId: cb.id });
    await ctx.editMessageText(`${original}\n\n${r.text}`, HTML);
    await ctx.answerCallbackQuery();
    if (r.cardEdit) {
      try {
        await ctx.api.editMessageText(r.cardEdit.chatId, r.cardEdit.messageId, r.cardEdit.text, { ...HTML, reply_markup: keyboard(r.cardEdit.buttons) });
      } catch (e) {
        // "message is not modified" and a deleted card are harmless; the order is already placed.
        console.warn(`card edit failed: ${(e as Error).message}`);
      }
    }
  });

  bot.catch((err) => console.error(`handler error: ${(err.error as Error).message}`));
  return bot;
}
