// End-to-end check of the connect page in a real browser, against the real server and real Strike testnet.
// A stub window.ethereum signs with a throwaway ethers wallet exactly as MetaMask's personal_sign would.
// Needs: BUILDER_CODE, web/dist built (npm run web:build). Writes docs/proof/connect-e2e.json and screenshots.
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { Wallet, type HDNodeWallet } from "ethers";

type Signer = Wallet | HDNodeWallet;
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { decryptSecret } from "../src/db/crypto.js";
import { StrikeClient } from "../src/strike/client.js";
import { requireEnv } from "./env.js";

const PORT = 3917;
const OUT = "docs/proof/connect";
const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1440, 1920];
const kek = randomBytes(32).toString("base64");
const cfg = loadConfig({
  TELEGRAM_BOT_TOKEN: "123:dummy", TAIL_KEK: kek, TAIL_DB: ":memory:", TAIL_MODE: "dev", PORT: String(PORT),
  PUBLIC_URL: `http://localhost:${PORT}`, BUILDER_CODE: requireEnv("BUILDER_CODE").BUILDER_CODE as string, BUILDER_FEE_BPS: "10",
});
const botInfo = { id: 1, is_bot: true, first_name: "Tail", username: "tailbot" } as never;
const app = await createApp(cfg, { botInfo, staticDir: "web/dist" });
await app.server.listen({ port: PORT, host: "127.0.0.1" });
const origin = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

const results: Record<string, unknown> = { checkedAt: new Date().toISOString(), network: cfg.network, checks: [] as unknown[] };
const check = (name: string, pass: boolean, detail?: unknown) => {
  (results.checks as unknown[]).push({ name, pass, ...(detail === undefined ? {} : { detail }) });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : "  " + JSON.stringify(detail)}`);
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

async function newPage(opts: { signer?: Signer; wallet?: "evm" | "none" | "refuse"; width?: number; scheme?: "dark" | "light"; reducedMotion?: boolean } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width ?? 1280, height: 900 }, colorScheme: opts.scheme ?? "dark",
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const wallet = opts.signer ?? Wallet.createRandom();
  if (opts.wallet !== "none") {
    await page.exposeFunction("__sign", async (hex: string) => wallet.signMessage(Buffer.from(hex, "hex")));
    // A plain string, not a function: tsx/esbuild would inject a `__name` helper into a serialised function and
    // it would throw inside the page, which looks like "the wallet is missing".
    await page.addInitScript(`(() => {
      const address = ${JSON.stringify(wallet.address.toLowerCase())};
      const refuse = ${JSON.stringify(opts.wallet === "refuse")};
      window.ethereum = {
        isMetaMask: true,
        request: async ({ method, params }) => {
          if (method === "eth_requestAccounts") return [address];
          if (method === "personal_sign") {
            if (refuse) { const e = new Error("User rejected the request."); e.code = 4001; throw e; }
            return window.__sign(params[0].slice(2));
          }
          throw new Error("unsupported " + method);
        },
      };
    })();`);
  }
  return { page, ctx, wallet, errors };
}

const open = async (page: Page, token: string) => {
  await page.goto(`${origin}/connect?t=${token}`);
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important}" });
};
const text = (page: Page) => page.locator("body").innerText();

// ---- A. happy path: MetaMask-style wallet, real Strike ----
{
  const token = app.store.createConnectToken(7001, new Date().toISOString());
  const { page, ctx, wallet, errors } = await newPage();
  await open(page, token);
  await page.getByRole("button", { name: /Use MetaMask/ }).waitFor();
  check("A1 ready state lists MetaMask and the builder fee cap", (await text(page)).includes("MetaMask") && (await text(page)).includes("up to 0.1%"), undefined);
  check("A2 the token is gone from the address bar", !page.url().includes("t="), page.url());
  await page.screenshot({ path: `${OUT}/ready-1280-dark.png` });
  await page.getByRole("button", { name: /Use MetaMask/ }).click();
  await page.getByText("Wallet connected").waitFor({ timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/done-1280-dark.png` });
  const user = app.store.getUser(7001);
  check("A3 user linked as a builder wallet on Ethereum", user?.builderCode === "sigma" && user?.chain === "ethereum", { chain: user?.chain, builderCode: user?.builderCode });
  check("A4 the stored address is the wallet's address", user?.address === wallet.address.toLowerCase());
  const priv = decryptSecret(cfg.kek, user!.apiPrivEnc);
  const live = new StrikeClient({ baseUrl: cfg.baseUrl, privateKeyHex: priv });
  await live.syncClock();
  const acct = await live.account().catch((e: any) => ({ error: e.strikeError }));
  check("A5 the new API wallet signs a real Strike request (GET /v2/account 200)", Boolean((acct as any).account_id) && (acct as any).account_id === user!.strikeAccountId, { account_id: (acct as any).account_id });
  check("A6 the API key never appeared in the page", !(await page.content()).includes(priv));
  check("A7 no console or page errors", errors.length === 0, errors);
  await ctx.close();
}

// ---- B. wrong signer: Strike must refuse, the page must say so, nothing is linked ----
{
  const token = app.store.createConnectToken(7002, new Date().toISOString());
  const claimed = Wallet.createRandom();
  const ctxInfo = await newPage({ signer: claimed });
  // Make the injected wallet report one address but sign with another key.
  await ctxInfo.page.exposeFunction("__other", async (hex: string) => Wallet.createRandom().signMessage(Buffer.from(hex, "hex"))).catch(() => {});
  await ctxInfo.page.addInitScript("window.__sign = (h) => window.__other(h);");
  await open(ctxInfo.page, token);
  await ctxInfo.page.getByRole("button", { name: /Use MetaMask/ }).click();
  await ctxInfo.page.getByText(/Strike said/).waitFor({ timeout: 30_000 });
  const t = await text(ctxInfo.page);
  check("B1 a signature from the wrong wallet is refused by Strike and shown plainly", t.includes("Strike said: wallet signature verification failed."), t.match(/Strike said[^\n]*/)?.[0]);
  check("B2 nothing was linked", app.store.getUser(7002) === undefined);
  check("B4 the fee line stays correct after an error (the builder info is kept)", t.includes("up to 0.1%") && !t.includes("a small fee"));
  check("B3 the page offers a retry", await ctxInfo.page.getByRole("button", { name: /again/ }).isVisible());
  await ctxInfo.page.screenshot({ path: `${OUT}/error-1280-dark.png` });
  await ctxInfo.ctx.close();
}

// ---- C. the user closes the wallet prompt ----
{
  const token = app.store.createConnectToken(7003, new Date().toISOString());
  const { page, ctx } = await newPage({ wallet: "refuse" });
  await open(page, token);
  await page.getByRole("button", { name: /Use MetaMask/ }).click();
  await page.getByText("You closed the wallet prompt").waitFor({ timeout: 15_000 });
  check("C1 a refused prompt shows one plain message and links nothing", app.store.getUser(7003) === undefined);
  await ctx.close();
}

// ---- D. bad link, E. no wallet, F. reload keeps the token ----
{
  const { page, ctx } = await newPage();
  await open(page, "z".repeat(43));
  await page.getByText("This link cannot be used").waitFor();
  check("D1 an unknown token says the link cannot be used", (await text(page)).includes("Send /connect to the bot"));
  await ctx.close();
}
{
  const token = app.store.createConnectToken(7004, new Date().toISOString());
  const { page, ctx } = await newPage({ wallet: "none" });
  await open(page, token);
  await page.getByText(/No wallet found/).waitFor({ timeout: 5000 });
  check("E1 with no wallet the page says what to do instead of showing dead buttons", (await page.getByRole("button").count()) === 0);
  await page.screenshot({ path: `${OUT}/nowallet-1280-dark.png` });
  await ctx.close();
}
{
  const token = app.store.createConnectToken(7005, new Date().toISOString());
  const { page, ctx } = await newPage();
  await open(page, token);
  await page.getByRole("button", { name: /Use MetaMask/ }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /Use MetaMask/ }).waitFor({ timeout: 5000 });
  check("F1 a reload keeps working because the token moved to sessionStorage", await page.getByRole("button", { name: /Use MetaMask/ }).isVisible());
  await ctx.close();
}

// ---- responsive and theme checks (rendered values, transitions killed) ----
{
  const token = app.store.createConnectToken(7006, new Date().toISOString());
  const { page, ctx } = await newPage();
  await open(page, token);
  await page.getByRole("button", { name: /Use MetaMask/ }).waitFor();
  await page.waitForTimeout(300);
  const g = await page.evaluate(`(() => {
    const q = (sel) => document.querySelector(sel);
    const brand = q('[class*="brand"]').getBoundingClientRect();
    const h1 = q("h1");
    const lead = q('[class*="lead"]');
    return {
      brandAboveHeading: brand.bottom <= h1.getBoundingClientRect().top + 1,
      h1Outline: getComputedStyle(h1).outlineStyle + " " + getComputedStyle(h1).outlineWidth,
      h1Focused: document.activeElement === h1,
      bodyNumeric: getComputedStyle(document.body).fontVariantNumeric,
      leadNumeric: getComputedStyle(lead).fontVariantNumeric,
    };
  })()`) as { brandAboveHeading: boolean; h1Outline: string; h1Focused: boolean; bodyNumeric: string; leadNumeric: string };
  check("H1 the brand label sits above the heading, not after the content", g.brandAboveHeading);
  check("H2 the focused heading draws no focus ring (it is not a control)", g.h1Focused && g.h1Outline.startsWith("none"), g.h1Outline);
  check("H3 body text does not use tabular figures (they widen punctuation)", g.bodyNumeric === "normal" && g.leadNumeric === "normal", g.bodyNumeric);
  await page.keyboard.press("Tab");
  const ring = await page.evaluate(`(() => { const e = document.activeElement; const s = getComputedStyle(e); return { tag: e.tagName, outline: s.outlineStyle + " " + s.outlineWidth }; })()`) as { tag: string; outline: string };
  check("H4 a real control (the wallet button) does show a visible focus ring on Tab", ring.tag === "BUTTON" && ring.outline.startsWith("solid"), ring);
  await ctx.close();
}

const layout: unknown[] = [];
for (const scheme of ["dark", "light"] as const) {
  for (const width of WIDTHS) {
    const token = app.store.createConnectToken(7100 + width, new Date().toISOString());
    const { page, ctx } = await newPage({ width, scheme });
    await open(page, token);
    await page.getByRole("button", { name: /Use MetaMask/ }).waitFor();
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const root = document.documentElement;
      const btn = document.querySelector("button")!;
      const h1 = document.querySelector("h1")!;
      return {
        overflowX: root.scrollWidth - root.clientWidth,
        bg: getComputedStyle(document.body).backgroundColor,
        font: getComputedStyle(document.body).fontFamily.split(",")[0],
        btnH: Math.round(btn.getBoundingClientRect().height),
        h1Size: getComputedStyle(h1).fontSize,
        brandAbove: document.querySelector('[class*="brand"]')!.getBoundingClientRect().bottom <= h1.getBoundingClientRect().top + 1,
        shellW: Math.round(document.querySelector('[class*="shell"]')!.getBoundingClientRect().width),
        panelW: Math.round(document.querySelector('section[class*="panel"]')!.getBoundingClientRect().width),
        btnInside: btn.getBoundingClientRect().right <= document.querySelector('section[class*="panel"]')!.getBoundingClientRect().right + 0.5,
      };
    });
    layout.push({ scheme, width, ...m });
    if (scheme === "dark" || width === 375 || width === 1280) await page.screenshot({ path: `${OUT}/ready-${width}-${scheme}.png`, fullPage: true });
    await ctx.close();
  }
}
results.layout = layout;
check("G1 no horizontal overflow at any of 8 widths in both themes", (layout as any[]).every((l) => l.overflowX <= 0), (layout as any[]).filter((l) => l.overflowX > 0));
check("G5 the brand label is above the heading at every width", (layout as any[]).every((l) => l.brandAbove), (layout as any[]).filter((l) => !l.brandAbove).map((l) => l.width));
check("G6 content uses the viewport: the shell fills at least viewport minus 40px (catches a phantom grid column)", (layout as any[]).every((l) => l.shellW >= Math.min(l.width - 40, 1088)), (layout as any[]).map((l) => `${l.width}:${l.shellW}`));
check("G7 the wallet button stays inside its panel at every width", (layout as any[]).every((l) => l.btnInside), (layout as any[]).filter((l) => !l.btnInside).map((l) => l.width));
check("G2 touch targets are at least 44px tall", (layout as any[]).every((l) => l.btnH >= 44), [...new Set((layout as any[]).map((l) => l.btnH))]);
check("G3 the page uses Schibsted Grotesk, not a default face", (layout as any[]).every((l) => String(l.font).includes("Schibsted Grotesk")), (layout as any[])[0]?.font);

await browser.close();
await app.server.close();
writeFileSync("docs/proof/connect-e2e.json", JSON.stringify(results, null, 2) + "\n");
const failed = (results.checks as { pass: boolean }[]).filter((c) => !c.pass).length;
console.log(`\n${(results.checks as unknown[]).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
