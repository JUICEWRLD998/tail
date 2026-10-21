// Zero-dependency Chrome DevTools Protocol helper (Node 22+ has fetch and WebSocket built in).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Screencast frames come out in device pixels only when the DPR is forced on the command
// line; an Emulation override alone yields CSS-pixel (1440x810) frames. Layout 1440x810 at
// DPR 4/3 gives crisp 1920x1080 frames at ~25 fps.
export async function launch({ port = 9340 + Math.floor(Math.random() * 400), headless = true, scale = 4 / 3 } = {}) {
  if (!CHROME) throw new Error('Chrome not found; set CHROME_PATH');
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-chrome-'));
  const args = [
    `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`, `--force-device-scale-factor=${scale}`,
    '--window-size=1920,1200', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,OptimizationHints', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ];
  if (headless) args.push('--headless=new');
  const proc = spawn(CHROME, [...args, 'about:blank'], { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 100 && !ver; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(100); }
  }
  if (!ver) throw new Error('Chrome did not open its debugging port');
  const browser = await connect(ver.webSocketDebuggerUrl);
  browser.close = async () => {
    try { await browser.send('Browser.close'); } catch {}
    proc.kill();
    await sleep(300);
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  };
  return browser;
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, method } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject, method });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  return { send, on, ws };
}

// Opens a tab and returns a page handle bound to its session.
export async function newPage(browser, { width = 1440, height = 810, scale = 4 / 3 } = {}) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);
  const on = (method, fn) => browser.on((msg) => { if (msg.sessionId === sessionId && msg.method === method) fn(msg.params); });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  const page = {
    send, on, targetId, sessionId, width, height, scale,
    async eval(expr, { awaitPromise = true } = {}) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      return r.result.value;
    },
    async goto(url, { timeout = 30000 } = {}) {
      const loaded = new Promise((res) => {
        // A hash-route change in the same document never fires load; it fires navigatedWithinDocument.
        const offs = [];
        const done = () => { offs.forEach((f) => f()); res(); };
        offs.push(on('Page.loadEventFired', done), on('Page.navigatedWithinDocument', done));
        setTimeout(done, timeout);
      });
      await send('Page.navigate', { url });
      await loaded;
      // Bounded: fonts.ready never settles in a background tab.
      await Promise.race([page.eval('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => {}), sleep(5000)]);
    },
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
    },
  };
  return page;
}

export { sleep };
