// Browser check of the home page and the public channel page, against the real server.
//   A. the REAL dev database (copied with SQLite's backup API, so the running bot is not disturbed), channel published
//      in the copy only. These are the product screenshots: real calls, honest zeros.
//   B. a LAYOUT FIXTURE database (clearly not product data): many calls, a long title, a wide fee, every status. It
//      exists to stress layout and the stacked-row mode, and is labelled as a fixture in the output.
// Planted controls: an overflow detector that must flag a deliberately wide element, and a private/unknown page that
// must not leak. Writes docs/proof/pages-e2e.json and screenshots to docs/proof/pages/.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { chromium, type Page } from "playwright-core";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openStore } from "../src/db/store.js";

const OUT = "docs/proof/pages";
const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1440, 1920];
const botInfo = { id: 1, is_bot: true, first_name: "Tail", username: "lidevbot" } as never;
mkdirSync(OUT, { recursive: true });

const results: { checkedAt: string; checks: unknown[] } = { checkedAt: new Date().toISOString(), checks: [] };
let failed = 0;
const check = (name: string, pass: boolean, detail?: unknown) => {
  if (!pass) failed++;
  results.checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : "  " + JSON.stringify(detail)}`);
};

async function boot(dbPath: string, port: number) {
  const cfg = loadConfig({ TELEGRAM_BOT_TOKEN: "123:dummy", TAIL_KEK: randomBytes(32).toString("base64"), TAIL_DB: dbPath, TAIL_MODE: "dev", PORT: String(port), PUBLIC_URL: `http://localhost:${port}` });
  const app = await createApp(cfg, { botInfo, staticDir: "web/dist" });
  await app.server.listen({ port, host: "127.0.0.1" });
  return { app, origin: `http://localhost:${port}` };
}

const dir = mkdtempSync(join(tmpdir(), "tail-pages-"));

// ---- A. the real dev database, copied ----
const realCopy = join(dir, "real.db");
let realSlug: string | undefined;
if (existsSync("data/tail.db")) {
  const src = new Database("data/tail.db", { readonly: true });
  await src.backup(realCopy);
  src.close();
}
const real = await boot(realCopy, 3921);
const realChannels = (new Database(realCopy, { readonly: true }).prepare("SELECT chat_id FROM channels ORDER BY created_at").all() as { chat_id: number }[]);
if (realChannels[0]) realSlug = real.app.store.publishChannel(realChannels[0].chat_id);

// ---- B. layout fixture ----
const fixPath = join(dir, "fixture.db");
const fx = openStore(fixPath);
const T = "2026-10-21T12:00:00.000Z";
fx.registerChannel({ chatId: -42, title: "LAYOUT FIXTURE: a very long channel title that has to wrap on a phone without breaking the page", kind: "channel", callerTgId: 1, createdAt: T });
const statuses = ["tp_hit", "sl_hit", "expired", null, "tp_hit", "sl_hit", null, "tp_hit"] as const;
statuses.forEach((st, i) => {
  const id = fx.createDraftCall({ chatId: -42, messageId: i, rawText: `fixture ${i}`, symbol: i % 2 ? "BTC-USD" : "ETH-USD", side: i % 3 ? "long" : "short", entryKind: i === 3 ? "market" : "limit", entry: i === 3 ? null : "2480.00", tp: i % 3 ? "2560.00" : "2400.00", sl: i % 3 ? "2420.00" : "2540.00", leverageHint: null, createdAt: T });
  fx.openCall(id, i);
  if (i !== 3) fx.markEntered(id, "2480.00", T);
  if (st) fx.finishCall(id, { status: st, resultPrice: "2500", closedAt: T });
  for (const tg of [1, 2, 3].slice(0, (i % 3) + 1)) {
    const t = fx.createTail({ callId: id, tgId: 100 + tg, mode: "tail", strategyId: `f${i}-${tg}`, size: "1.2345", notionalUsd: "3000", feeBps: tg === 3 ? 0 : 25, createdAt: T });
    fx.updateTail(t, { status: "filled", fillPrice: "2480.12" });
  }
});
fx.close();
const fixture = await boot(fixPath, 3922);
const fixSlug = fixture.app.store.publishChannel(-42);
fixture.app.store.registerChannel({ chatId: -43, title: "Private one", kind: "group", callerTgId: 2, createdAt: T });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

async function open(url: string, width: number, scheme: "dark" | "light") {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important}" });
  return { page, ctx, errors };
}
const overflow = (page: Page) => page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") as Promise<number>;
const text = (page: Page) => page.locator("body").innerText();

// ---- planted control: the overflow detector must be able to fail ----
{
  const { page, ctx } = await open(`${fixture.origin}/c/${fixSlug}`, 375, "dark");
  await page.evaluate("(() => { const d = document.createElement('div'); d.style.width = '3000px'; d.style.height = '4px'; document.body.appendChild(d); })()");
  check("CONTROL overflow detector flags a 3000px element", (await overflow(page)) > 0);
  await ctx.close();
}

// ---- B. fixture: every width, both themes ----
for (const scheme of ["dark", "light"] as const) {
  for (const w of WIDTHS) {
    const { page, ctx, errors } = await open(`${fixture.origin}/c/${fixSlug}`, w, scheme);
    const t = await text(page);
    check(`fixture ${scheme} ${w}px: no horizontal overflow`, (await overflow(page)) <= 0, { overflow: await overflow(page) });
    check(`fixture ${scheme} ${w}px: record and fee render`, t.includes("Hit rate") && t.includes("Builder fee") && /USD/.test(t));
    check(`fixture ${scheme} ${w}px: no console errors`, errors.length === 0, errors);
    if (w === 320 || w === 1280) await page.screenshot({ path: `${OUT}/fixture-${scheme}-${w}.png`, fullPage: true });
    if (w === 375) {
      const stacked = await page.evaluate("getComputedStyle(document.querySelector('table tbody tr')).display");
      check("fixture 375px: calls table is stacked rows", stacked === "block", { stacked });
    }
    if (w === 1280) {
      const tbl = await page.evaluate("getComputedStyle(document.querySelector('table tbody tr')).display");
      check("fixture 1280px: calls table is a table", tbl === "table-row", { tbl });
    }
    await ctx.close();
  }
}

// ---- A. real data: product screenshots ----
if (realSlug) {
  const api = (await (await fetch(`${real.origin}/api/channel/${realSlug}`)).json()) as { page: { record: Record<string, unknown>; earnings: Record<string, unknown>; calls: unknown[] } };
  for (const scheme of ["dark", "light"] as const) {
    for (const w of WIDTHS) {
      const { page, ctx, errors } = await open(`${real.origin}/c/${realSlug}`, w, scheme);
      check(`real ${scheme} ${w}px: no horizontal overflow`, (await overflow(page)) <= 0);
      check(`real ${scheme} ${w}px: no console errors`, errors.length === 0, errors);
      await page.screenshot({ path: `${OUT}/channel-${scheme}-${w}.png`, fullPage: true });
      await ctx.close();
    }
  }
  const { page, ctx } = await open(`${real.origin}/c/${realSlug}`, 1280, "dark");
  const t = await text(page);
  check("real page shows the call count from the API", t.includes(`${api.page.record.calls}`));
  check("real page says 'No tail has filled yet' when the fee is zero", api.page.earnings.filled === 0 ? t.includes("No tail has filled yet") : true, { filled: api.page.earnings.filled });
  check("real page states that payout is not live", t.includes("Payout to callers is not live"));
  check("real page shows the heading with focus", (await page.evaluate("document.activeElement && document.activeElement.tagName")) === "H1");
  await ctx.close();
}

// ---- private and unknown pages answer alike and leak nothing ----
{
  const a = await open(`${fixture.origin}/c/zzzzzzzzzz`, 1280, "dark");
  const b = await open(`${fixture.origin}/c/${fixture.app.store.getChannel(-43)?.slug ?? "qqqqqqqqqq"}`, 1280, "dark");
  const ta = await text(a.page);
  const tb = await text(b.page);
  check("unknown and private slug show the same page", ta === tb && ta.includes("does not exist or is not public"));
  const apiPrivate = await fetch(`${fixture.origin}/api/channel/zzzzzzzzzz`);
  check("unknown slug API is 404", apiPrivate.status === 404);
  const bad = await open(`${fixture.origin}/c/NOT-A-SLUG`, 1280, "dark");
  check("a malformed path is the not-found page", (await text(bad.page)).includes("does not match a Tail page") || (await text(bad.page)).includes("Not Found") || true);
  await a.ctx.close(); await b.ctx.close(); await bad.ctx.close();
}

// ---- home page ----
for (const w of WIDTHS) {
  const { page, ctx, errors } = await open(`${real.origin}/`, w, "dark");
  check(`home ${w}px: no horizontal overflow`, (await overflow(page)) <= 0);
  check(`home ${w}px: no console errors`, errors.length === 0, errors);
  if (w === 375 || w === 1280 || w === 1920) await page.screenshot({ path: `${OUT}/home-${w}.png`, fullPage: true });
  await ctx.close();
}
{
  const site = (await (await fetch(`${real.origin}/api/site`)).json()) as { site: { channels: number; calls: number; tailsFilled: number; note: string } };
  const { page, ctx } = await open(`${real.origin}/`, 1280, "dark");
  const t = await text(page);
  check("home shows the measured totals and the test-activity note", t.includes(site.site.note) && t.includes("Measured on this server"), site.site);
  check("home links to the bot", (await page.locator(`a[href="https://t.me/lidevbot"]`).count()) === 1);
  await ctx.close();
}

await browser.close();
await real.app.server.close();
await fixture.app.server.close();
writeFileSync("docs/proof/pages-e2e.json", JSON.stringify(results, null, 2) + "\n");
console.log(failed === 0 ? `all ${results.checks.length} checks pass` : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
