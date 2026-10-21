#!/usr/bin/env node
// Step 0: look at the deployed product before writing a word. For each route, saves a 1920x1080
// screenshot plus a half-scale full-page one, and dumps what a director needs: headings, button
// and link labels, inputs, and the live theme (background, text, accent, fonts) for the cards.
// usage: node scout.mjs <url> [outDir=demo/scout] [/route2 /route3 ...]
import fs from 'node:fs';
import path from 'node:path';
import { launch, newPage, sleep } from './lib/cdp.mjs';

const [base, outArg, ...routes] = process.argv.slice(2);
if (!base) { console.error('usage: node scout.mjs <url> [outDir] [/route ...]'); process.exit(2); }
const out = path.resolve(outArg || 'demo/scout');
fs.mkdirSync(out, { recursive: true });

const browser = await launch();
const page = await newPage(browser);
const report = { url: base, at: new Date().toISOString(), routes: [] };

const DUMP = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const txt = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '').replace(/\\s+/g, ' ').trim();
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  const q = (s) => [...document.querySelectorAll(s)].filter(vis);
  const body = getComputedStyle(document.body);
  let bg = body.backgroundColor;
  if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.documentElement).backgroundColor;
  const btn = q('button, a[class*=btn], a[class*=button], [role=button]').map((b) => getComputedStyle(b))
    .find((c) => c.backgroundColor !== 'rgba(0, 0, 0, 0)' && c.backgroundColor !== bg);
  const h = q('h1, h2')[0];
  const rootVars = {};
  for (const sheet of document.styleSheets) { try { for (const r of sheet.cssRules) if (r.selectorText === ':root') for (const p of r.style) if (p.startsWith('--')) rootVars[p] = r.style.getPropertyValue(p).trim(); } catch {} }
  return {
    title: document.title,
    headings: uniq(q('h1,h2,h3').map(txt)).slice(0, 25),
    buttons: uniq(q('button,[role=button],input[type=submit]').map(txt)).slice(0, 40),
    links: uniq(q('a[href]').map((a) => txt(a) + '  ->  ' + a.getAttribute('href'))).slice(0, 40),
    inputs: q('input:not([type=hidden]),textarea,select').map((i) => ({ tag: i.tagName.toLowerCase(), type: i.type, name: i.name, placeholder: i.placeholder, label: i.labels?.[0] ? txt(i.labels[0]) : '' })).slice(0, 20),
    theme: { bg, fg: body.color, accent: btn?.backgroundColor, accentText: btn?.color, font: body.fontFamily, display: h ? getComputedStyle(h).fontFamily : body.fontFamily },
    rootVars: Object.fromEntries(Object.entries(rootVars).slice(0, 60)),
    height: document.documentElement.scrollHeight,
  };
})()`;

for (const r of ['', ...routes]) {
  const url = new URL(r || '', base).href;
  const t0 = Date.now();
  await page.goto(url);
  await sleep(1500);
  const info = await page.eval(DUMP);
  const name = (r || 'home').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  await page.screenshot(path.join(out, `${name}.png`));
  const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1440, height: Math.min(info.height, 6000), scale: 0.5 } });
  fs.writeFileSync(path.join(out, `${name}-full.jpg`), Buffer.from(data, 'base64'));
  report.routes.push({ route: r || '/', url, loadMs: Date.now() - t0, ...info });
  console.log(`  ${url}  ${Date.now() - t0}ms  ${info.buttons.length} buttons  "${info.title}"`);
}
fs.writeFileSync(path.join(out, 'scout.json'), JSON.stringify(report, null, 2));
console.log(`\n${path.join(out, 'scout.json')}\ntheme: ${JSON.stringify(report.routes[0].theme)}`);
await browser.close();
