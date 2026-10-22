// Captures the home-page replay over time with motion ON, and asserts the sequence: no follows and no stamp at first,
// follows land, then the stamp. Planted control: with reduced motion the final state must be there at once.
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { chromium } from "playwright-core";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const dir = mkdtempSync(join(tmpdir(), "tail-replay-"));
const db = join(dir, "real.db");
const src = new Database("data/tail.db", { readonly: true });
await src.backup(db);
src.close();
const port = 3931;
const cfg = loadConfig({ TELEGRAM_BOT_TOKEN: "123:local-browser-check-no-telegram", TAIL_KEK: randomBytes(32).toString("base64"), TAIL_DB: db, TAIL_MODE: "dev", PORT: String(port) });
const app = await createApp(cfg, { botInfo: { id: 1, is_bot: true, first_name: "Tail", username: "lidevbot" } as never, staticDir: "web/dist" });
await app.server.listen({ port, host: "127.0.0.1" });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const results: { name: string; pass: boolean; detail?: unknown }[] = [];
const check = (name: string, pass: boolean, detail?: unknown) => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : "  " + JSON.stringify(detail)}`); };
const state = (p: import("playwright-core").Page) => p.evaluate(`({ chips: document.querySelectorAll('li[class*="chip"]').length, none: /No one has taken/.test(document.body.textContent ?? ''), stamp: !!document.querySelector('[class*="stamp"]') })`) as Promise<{ chips: number; stamp: boolean; none: boolean }>;

for (const scheme of ["dark", "light"] as const) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('[class*="ticket"]');
  const frames: { at: number; chips: number; stamp: boolean; none: boolean }[] = [];
  const t0 = Date.now();
  for (const at of [150, 400, 650, 800, 950, 1100, 1250, 1400, 1550, 1700, 2000, 2600, 3500]) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    frames.push({ at, ...(await state(page)) });
    if ([150, 950, 1700, 3500].includes(at)) await page.screenshot({ path: `docs/proof/pages/replay/${scheme}-${String(at).padStart(4, "0")}ms.png`, clip: { x: 700, y: 80, width: 520, height: 620 } });
  }
  const first = frames[0]!, last = frames.at(-1)!;
  check(`${scheme}: starts with no follows and no stamp`, first.chips === 0 && !first.stamp, first);
  check(`${scheme}: follows land strictly before the stamp, and the stamp lands`, last.chips > 0 && last.stamp && frames.findIndex((f) => f.stamp) > frames.findIndex((f) => f.chips > 0), frames.map((f) => `${f.at}:${f.chips}${f.stamp ? "S" : ""}`));
  check(`${scheme}: never claims "no one has taken" a call that has follows`, frames.every((f) => !f.none));
  await page.getByRole("button", { name: "Replay" }).click();
  await page.waitForTimeout(150);
  const again = await state(page);
  check(`${scheme}: Replay resets and plays again`, again.chips === 0 && !again.stamp, again);
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('[class*="ticket"]');
  await page.waitForTimeout(150);
  const s = await state(page);
  check("CONTROL reduced motion shows the final state at once", s.chips > 0 && s.stamp, s);
}

await browser.close();
await app.server.close();
writeFileSync("docs/proof/pages/replay/replay-probe.json", JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + "\n");
process.exit(results.every((r) => r.pass) ? 0 : 1);
