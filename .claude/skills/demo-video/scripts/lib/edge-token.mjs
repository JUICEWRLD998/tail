// A signed Read Aloud URL taken from the installed Edge browser.
//
// On 2026-10-10 Edge 155 moved Read Aloud to wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1 with a
// new Sec-MS-GEC format ("<16 hex>-<64 hex>", version "2-<edge version>") that third-party clients cannot compute
// (rany2/edge-tts#490; the old speech.platform.bing.com endpoint answers 403 to everyone). The installed Edge still
// signs it. So: launch Edge headless with a net log, have a page speak one word with an online voice, and lift the
// signed URL from the log. The signature stays valid for several minutes and works from any client with a fresh
// ConnectionId, so one capture voices a whole demo. Cached in the temp folder; refreshed after maxAgeMs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CACHE = path.join(os.tmpdir(), 'demo-video-edge-tts-url.json');
const URL_RX = /wss:\/\/api\.msedgeservices\.com\/tts\/cognitiveservices\/websocket\/v1\?[^"&]*&Sec-MS-GEC=[^"&]*&Sec-MS-GEC-Version=[^"&]*/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function browserTtsUrl({ maxAgeMs = 4 * 60 * 1000, force = false } = {}) {
  if (!force) {
    try {
      const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
      if (Date.now() - c.at < maxAgeMs && URL_RX.test(c.url)) return c.url;
    } catch {}
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-tts-'));
  const netlog = path.join(dir, 'netlog.json');
  const port = 9700 + Math.floor(Math.random() * 200);
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(dir, 'profile')}`,
    `--log-net-log=${netlog}`, '--net-log-capture-mode=IncludeSensitive', '--no-first-run',
    '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    let pageWs;
    for (let i = 0; i < 60 && !pageWs; i++) {
      try { pageWs = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; }
      catch { await sleep(250); }
    }
    if (!pageWs) throw new Error('edge-token: Edge did not start');
    const ws = new WebSocket(pageWs);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const done = new Promise((r) => { ws.onmessage = (e) => { if (JSON.parse(e.data).id === 1) r(); }; });
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { awaitPromise: true, expression: `new Promise((r) => {
      const go = () => { const v = speechSynthesis.getVoices().find((x) => /Online \\(Natural\\)/.test(x.name) && /English/.test(x.name));
        if (!v) return; const u = new SpeechSynthesisUtterance('Hi.'); u.voice = v; u.onend = u.onerror = () => r(true); speechSynthesis.speak(u); };
      if (speechSynthesis.getVoices().length) go(); else speechSynthesis.onvoiceschanged = go;
      setTimeout(() => r(false), 15000); })` } }));
    await done;
    ws.close();
  } finally {
    edge.kill();
  }
  await sleep(1000); // let Edge flush the log
  const m = fs.readFileSync(netlog, 'utf8').match(URL_RX);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} // Edge can still hold a file for a moment
  if (!m) throw new Error('edge-token: no signed Read Aloud URL in the net log (is Edge installed and online?)');
  fs.writeFileSync(CACHE, JSON.stringify({ at: Date.now(), url: m[0] }));
  return m[0];
}
