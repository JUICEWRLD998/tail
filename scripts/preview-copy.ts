// Sends the owner a DM with every message style, built by the real functions from SAMPLE numbers (labelled as such),
// so the copy can be read on a phone. Only ever sends to TAIL_OWNER_TG_ID, never to a channel.
import { callCard, callerConfirmCard, followerConfirmCard } from "../src/bot/cards.js";
import { earnings, earningsText } from "../src/core/earnings.js";
import { receiptText, resultLine } from "../src/core/outcome.js";
import { recordText, summarize } from "../src/core/record.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const to = process.env.TAIL_OWNER_TG_ID;
if (!token || !to) throw new Error("TELEGRAM_BOT_TOKEN and TAIL_OWNER_TG_ID are required");

const call = { symbol: "ETH-USD", side: "long" as const, entryKind: "limit" as const, entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: 5 as number | null };
const oc = { ...call, createdAt: "2026-10-22T10:00:00.000Z", enteredAt: "2026-10-22T10:05:00.000Z", enteredPrice: "2480.00" };
const sizing = { ok: true as const, size: "0.009", notional: "22.32", riskUsd: "0.54", binding: "risk" as const };
const card = callCard(call, { tailed: 3, faded: 1 });
const rows = [{ ...call, enteredPrice: "2480.00", status: "tp_hit" as const }, { ...call, enteredPrice: "2480.00", status: "sl_hit" as const }];
const tails = [{ callId: 1, tgId: 1, status: "filled" as const, size: "0.009", fillPrice: "2480", feeBps: 10 }];

const messages = [
  "🧪 <b>Preview of the new message style</b>\nSample numbers, not a real call. Each message below is built by the real code.",
  `<i>Channel card</i>\n\n${card}`,
  `<i>Caller confirm</i>\n\n${callerConfirmCard({ ...call, extraTargets: [] })}`,
  `<i>Follower quote (Tail)</i>\n\n${followerConfirmCard({ call, mode: "tail", sizing, equity: "19.92", riskPct: "3", levels: { side: "long", tp: call.tp, sl: call.sl }, rewardRisk: "1.33" })}`,
  `<i>Follower quote (Fade)</i>\n\n${followerConfirmCard({ call, mode: "fade", sizing, equity: "19.92", riskPct: "3", levels: { side: "short", tp: "2420.00", sl: "2560.00" }, rewardRisk: "0.75" })}`,
  `<i>Receipt under the card: target</i>\n\n${receiptText(oc, { state: "tp_hit", resultPrice: "2561.10" })}`,
  `<i>Receipt under the card: stop</i>\n\n${receiptText(oc, { state: "sl_hit", resultPrice: "2419.00" })}`,
  `<i>Card after a result</i>\n\n${card}\n\n${resultLine(oc, "tp_hit")}`,
  "<i>Fill DM</i>\n\n✅ <b>Filled</b>\nETH-USD · LONG · 0.009 at <code>2480.00</code>",
  "<i>Close DM</i>\n\n🎯 <b>Closed at take profit</b>\n💰 Realized PnL +0.729 USD",
  `<i>/record</i>\n\n${recordText("Tail test channel", summarize(rows, 3))}`,
  `<i>/earnings</i>\n\n${earningsText("Tail test channel", earnings(tails))}`,
];

for (const text of messages) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: Number(to), text, parse_mode: "HTML", disable_notification: true }),
  });
  const body = (await r.json()) as { ok: boolean; description?: string };
  console.log(body.ok ? "sent" : `FAILED: ${body.description}`);
}
