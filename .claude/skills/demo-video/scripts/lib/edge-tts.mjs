// Minimal Microsoft Edge "Read aloud" neural TTS client (free, no key).
// Returns { audio: Buffer(mp3), words: [{ text, start, end }] } with times in seconds.
// The endpoint rejects stale browser versions with HTTP 403, so the version string is
// read from the locally installed Edge when possible.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { browserTtsUrl } from './edge-token.mjs';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

function edgeVersion() {
  if (process.env.EDGE_TTS_VERSION) return process.env.EDGE_TTS_VERSION;
  for (const dir of ['C:/Program Files (x86)/Microsoft/Edge/Application', 'C:/Program Files/Microsoft/Edge/Application']) {
    try {
      const v = fs.readdirSync(dir).filter((d) => /^\d+\.\d+\.\d+\.\d+$/.test(d))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
      if (v) return v;
    } catch {}
  }
  return '155.0.4283.45';
}

function secMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  const s = `${BigInt(ticks) * 10000000n}${TOKEN}`;
  return crypto.createHash('sha256').update(s, 'ascii').digest('hex').toUpperCase();
}

const uuid = () => crypto.randomUUID().replaceAll('-', '');
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stamp = () => new Date().toString();

// The legacy endpoint answers 403 intermittently even with a valid token, so it is retried with backoff. Since
// 2026-10-10 it answers 403 to every client (Edge 155 moved Read Aloud; see edge-token.mjs): after two 403s in a row
// this process switches to a URL signed by the installed Edge for the rest of the run. EDGE_TTS_BROWSER=1 starts there.
let useBrowser = process.env.EDGE_TTS_BROWSER === '1';
export async function edgeSpeak(text, opts = {}) {
  let last;
  let forbidden = 0;
  for (let i = 0; i < 8; i++) {
    try {
      const url = useBrowser ? `${await browserTtsUrl({ force: forbidden > 0 })}&ConnectionId=${uuid()}` : null;
      return await speakOnce(text, { ...opts, url });
    } catch (e) {
      last = e;
      if (/403/.test(e.message) && ++forbidden >= 2 && !useBrowser) { useBrowser = true; forbidden = 0; continue; }
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

async function speakOnce(text, { voice = 'en-US-AvaMultilingualNeural', rate = '-4%', pitch = '+0Hz', style, url: signed } = {}) {
  const ver = edgeVersion();
  const major = ver.split('.')[0];
  const url = signed || `${WSS}?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=1-${ver}&ConnectionId=${uuid()}`;
  const ws = new WebSocket(url, {
    headers: {
      'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 Edg/${major}.0.0.0`,
      Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      Pragma: 'no-cache', 'Cache-Control': 'no-cache',
    },
  });
  const chunks = [];
  const words = [];
  const reqId = uuid();
  let body = `<prosody pitch="${pitch}" rate="${rate}">${esc(text)}</prosody>`;
  if (style) body = `<mstts:express-as style="${style}">${body}</mstts:express-as>`;
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${voice}">${body}</voice></speak>`;

  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('edge-tts timeout')); }, 60000);
    ws.on('error', (e) => { clearTimeout(timer); reject(new Error(`edge-tts: ${e.message}`)); });
    ws.on('open', () => {
      ws.send(`X-Timestamp:${stamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'true' }, outputFormat: 'audio-24khz-96kbitrate-mono-mp3' } } } }));
      ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const headLen = data.readUInt16BE(0);
        const head = data.subarray(2, 2 + headLen).toString();
        if (head.includes('Path:audio')) chunks.push(data.subarray(2 + headLen));
        return;
      }
      const msg = data.toString();
      if (msg.includes('Path:audio.metadata')) {
        const json = JSON.parse(msg.slice(msg.indexOf('\r\n\r\n') + 4));
        for (const m of json.Metadata || []) {
          if (m.Type !== 'WordBoundary') continue;
          const start = m.Data.Offset / 1e7;
          words.push({ text: m.Data.text.Text, start, end: start + m.Data.Duration / 1e7 });
        }
      } else if (msg.includes('Path:turn.end')) {
        clearTimeout(timer);
        ws.close();
        if (!chunks.length) return reject(new Error('edge-tts: no audio returned'));
        resolve({ audio: Buffer.concat(chunks), words });
      }
    });
  });
}
