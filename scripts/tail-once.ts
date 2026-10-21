// The product's core path with no Telegram: parse a call, size it for Follower A, place the bracket.
//   npx tsx scripts/tail-once.ts "ADA long 0.62 tp 0.70 sl 0.58"            dry run (default): prints the plan
//   npx tsx scripts/tail-once.ts "ADA long 0.62 tp 0.70 sl 0.58" --place    places it on testnet
//   add --fade to take the other side. Risk settings: TAIL_RISK_PCT, TAIL_MAX_LEV, TAIL_MAX_NOTIONAL.
import { randomUUID } from "node:crypto";
import { bracketFromDraft } from "../src/core/order.js";
import { parseCall } from "../src/core/parser.js";
import { sizeTail } from "../src/core/sizing.js";
import { StrikeClient } from "../src/strike/client.js";
import { BASE_URL, requireEnv } from "./env.js";

const args = process.argv.slice(2);
const text = args.find((a) => !a.startsWith("--"));
if (!text) {
  console.error('usage: tail-once.ts "<call text>" [--place] [--fade]');
  process.exit(2);
}
const place = args.includes("--place");
const fade = args.includes("--fade");

const env = requireEnv("SPIKE_API_PRIV");
const feeBps = Number(process.env.BUILDER_FEE_BPS ?? "0");
// Personal API wallets carry no builder code, so the header is ignored there; send it only for builder wallets.
const client = new StrikeClient({
  baseUrl: BASE_URL,
  privateKeyHex: env.SPIKE_API_PRIV as string,
  ...(process.env.TAIL_BUILDER_WALLET === "1" ? { builderFeeBps: feeBps } : {}),
});
await client.syncClock();

const markets = await client.markets();
const parsed = parseCall(text, { markets });
if (!parsed.ok) {
  console.log("parse: NOT A DRAFT ->", JSON.stringify(parsed));
  process.exit(1);
}
const draft = parsed.draft;
console.log("parse:", JSON.stringify(draft));

const account = await client.account();
const market = markets[draft.symbol]!;
const entryForSizing = draft.entry ?? (await client.markPrice(draft.symbol));
const levels = fade
  ? { entry: entryForSizing, sl: draft.tp }
  : { entry: entryForSizing, sl: draft.sl };
const sizing = sizeTail({
  equity: account.margin_balance,
  riskPct: process.env.TAIL_RISK_PCT ?? "1",
  maxLeverage: process.env.TAIL_MAX_LEV ?? "5",
  maxNotionalUsd: process.env.TAIL_MAX_NOTIONAL ?? "500",
  entry: levels.entry,
  sl: levels.sl,
  market,
});
console.log(`equity (margin_balance): ${account.margin_balance}`);
console.log("sizing:", JSON.stringify(sizing));
if (!sizing.ok) {
  console.log(`REFUSED: ${sizing.reason}: ${sizing.detail}`);
  process.exit(1);
}

const bracket = bracketFromDraft({ draft, size: sizing.size, strategyId: randomUUID(), fade });
console.log("bracket:", JSON.stringify(bracket));
if (!place) {
  console.log("dry run: nothing sent. Add --place to send it to testnet.");
  process.exit(0);
}
const created = await client.placeBracket(bracket);
console.log("PLACED:", JSON.stringify(created));
const open = await client.openOrders(draft.symbol);
console.log("openOrders:", JSON.stringify(open).slice(0, 600));
