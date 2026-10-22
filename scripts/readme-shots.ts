// Builds the README images. Web screenshots come from scripts/pages-e2e.ts and replay-probe.ts (real server, real data);
// this renders the bot's real message builders (sample numbers, labelled as such) in a chat-style frame, because a
// Telegram screenshot needs his phone. Usage: npx tsx scripts/readme-shots.ts
import { copyFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { callCard, followerConfirmCard } from "../src/bot/cards.js";
import { receiptText, resultLine } from "../src/core/outcome.js";

const call = { symbol: "ETH-USD", side: "long" as const, entryKind: "limit" as const, entry: "2480.00", tp: "2560.00", sl: "2420.00", leverageHint: 5 as number | null };
const oc = { ...call, createdAt: "2026-10-22T10:00:00.000Z", enteredAt: "2026-10-22T10:05:00.000Z", enteredPrice: "2480.00" };
const sizing = { ok: true as const, size: "0.009", notional: "22.32", riskUsd: "0.54", binding: "risk" as const };
const card = callCard(call, { tailed: 3, faded: 1 });
const quote = followerConfirmCard({ call, mode: "tail", sizing, equity: "19.92", riskPct: "3", levels: { side: "long", tp: call.tp, sl: call.sl }, rewardRisk: "1.33", fee: { bps: 10, to: "tail" } });
const receipt = receiptText(oc, { state: "tp_hit", resultPrice: "2561.10" });
const html = (s: string) => s.replace(/\n/g, "<br>").replace(/<b>/g, "<strong>").replace(/<\/b>/g, "</strong>");

const page = `<!doctype html><meta charset="utf-8"><style>
  :root{--bg:#0e1621;--bubble:#182533;--line:#243447;--text:#e9eef5;--muted:#8a9bb0;--accent:#5fe0c2;--fade:#ff9a7a}
  *{box-sizing:border-box;margin:0}body{width:1500px;background:var(--bg);color:var(--text);font:21px/1.45 "Inter","Segoe UI",system-ui,sans-serif;padding:56px 64px 64px}
  .cols{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;align-items:start}
  .col h3{font-size:17px;font-weight:600;color:var(--muted);margin-bottom:16px;letter-spacing:.01em}
  .bub{background:var(--bubble);border:1px solid var(--line);border-radius:20px 20px 20px 6px;padding:18px 22px}
  .bub strong{font-weight:700}.bub code{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.92em;color:var(--accent)}
  .kb{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px;margin-top:8px}
  .kb span{background:var(--bubble);border:1px solid var(--line);border-radius:12px;padding:11px 0;text-align:center;font-weight:700;font-size:19px}
  .kb .t{color:var(--accent)}.kb .f{color:var(--fade)}
  .note{margin-top:34px;color:var(--muted);font-size:16px}
</style><div class="cols">
  <div class="col"><h3>The call card in the channel</h3><div class="bub">${html(card)}</div><div class="kb"><span class="t">Tail</span><span class="f">Fade</span></div></div>
  <div class="col"><h3>The follower's quote, sized to their own risk</h3><div class="bub">${html(quote)}</div><div class="kb"><span>Confirm</span><span>Cancel</span></div></div>
  <div class="col"><h3>The receipt, from the market</h3><div class="bub">${html(receipt)}</div><div class="bub" style="margin-top:14px;border-radius:20px">${html(card + "\n\n" + resultLine(oc, "tp_hit"))}</div></div>
</div><p class="note">Rendered from the bot's real message builders with sample numbers, in a chat-style frame. Not a Telegram screenshot.</p>`;

const tmp = "/tmp/claude-0/-home-user-tail/d3be0dc7-4f10-5e11-8237-2de98b893ae7/scratchpad/bot-messages.html";
writeFileSync(tmp, page);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1500, height: 700 }, deviceScaleFactor: 1.5 });
await p.goto(`file://${tmp}`);
await p.waitForTimeout(400);
await p.screenshot({ path: "docs/img/bot-messages.png", fullPage: true });
await b.close();

// web screenshots: the real server's pages (from pages-e2e.ts and replay-probe.ts)
const src = "docs/proof/pages";
copyFileSync(`${src}/home-1280.png`, "docs/img/home.png");
copyFileSync(`${src}/channel-dark-1280.png`, "docs/img/channel-dark.png");
copyFileSync(`${src}/channel-light-375.png`, "docs/img/channel-phone.png");
copyFileSync(`${src}/home-375.png`, "docs/img/home-phone.png");
// replay strip: the empty ticket, then the follow and the result stamp
execFileSync("convert", [`${src}/replay/dark-0150ms.png`, `${src}/replay/dark-3500ms.png`, "+append", "-resize", "1500x", "docs/img/replay.png"]);
for (const f of ["bot-messages", "home", "channel-dark", "channel-phone", "home-phone", "replay"]) execFileSync("convert", [`docs/img/${f}.png`, "-strip", `docs/img/${f}.png`]);
console.log("wrote docs/img/*.png");
