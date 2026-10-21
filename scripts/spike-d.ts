// Spike D: the dev bot (long polling) reads a channel post, posts a card with URL buttons that deep-link to
// t.me/<bot>?start=t_test, receives /start t_test in a DM, then edits the card. Test channel only.
import { writeFileSync } from "node:fs";
import { Bot, InlineKeyboard } from "grammy";
import { requireEnv } from "./env.js";

const TELEGRAM_BOT_TOKEN = requireEnv("TELEGRAM_BOT_TOKEN").TELEGRAM_BOT_TOKEN as string;
const CHANNEL_ID = Number(process.env.SPIKE_CHANNEL_ID ?? "-1004446016960");
const WAIT_MS = Number(process.env.SPIKE_WAIT_MS ?? 8 * 60_000);

const bot = new Bot(TELEGRAM_BOT_TOKEN);
const me = await bot.api.getMe();
const seen: { type: string; chat?: string; text?: string }[] = [];
let card: { message_id: number } | undefined;
let done: (() => void) | undefined;
const finished = new Promise<void>((r) => (done = r));

bot.use(async (ctx, next) => {
  const kind = Object.keys(ctx.update).filter((k) => k !== "update_id")[0] ?? "?";
  const m = (ctx.update as any)[kind];
  seen.push({ type: kind, chat: m?.chat?.type, text: typeof m?.text === "string" ? m.text.slice(0, 40) : undefined });
  await next();
});

bot.on("channel_post", (ctx) => console.log("channel_post:", ctx.chat.title, JSON.stringify(ctx.channelPost.text)));

bot.command("start", async (ctx) => {
  console.log("/start payload:", JSON.stringify(ctx.match), "chat type:", ctx.chat.type);
  if (ctx.match !== "t_test" || !card) return void (await ctx.reply("Spike D: expected /start t_test."));
  await ctx.reply("Spike D: got your tap. Editing the card now.");
  await bot.api.editMessageText(CHANNEL_ID, card.message_id, "<b>ADA-USD · LONG</b>\nTailed 1 · Faded 0", {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard()
      .url("Tail", `https://t.me/${me.username}?start=t_test`)
      .url("Fade", `https://t.me/${me.username}?start=f_test`),
  });
  console.log("card edited");
  done?.();
});

bot.catch((e) => console.error("handler error:", e.message));
void bot.start({ allowed_updates: ["message", "channel_post", "my_chat_member"], drop_pending_updates: false });

card = await bot.api.sendMessage(
  CHANNEL_ID,
  "<b>ADA-USD · LONG</b>\nEntry 0.6200 · TP 0.7000 · SL 0.5800 · R:R 2.0\nTailed 0 · Faded 0\n<i>Spike D test card</i>",
  {
    parse_mode: "HTML",
    reply_markup: new InlineKeyboard()
      .url("Tail", `https://t.me/${me.username}?start=t_test`)
      .url("Fade", `https://t.me/${me.username}?start=f_test`),
  },
);
console.log(`card posted: message_id=${card.message_id}. Waiting up to ${WAIT_MS / 1000}s for /start t_test in a DM.`);

const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), WAIT_MS));
const outcome = await Promise.race([finished.then(() => "ok" as const), timeout]);
await bot.stop();
writeFileSync(
  "docs/proof/spike-d.json",
  JSON.stringify({ bot: me.username, channelId: CHANNEL_ID, cardMessageId: card.message_id, outcome, updatesSeen: seen }, null, 2),
);
console.log("outcome:", outcome);
process.exit(outcome === "ok" ? 0 : 1);
