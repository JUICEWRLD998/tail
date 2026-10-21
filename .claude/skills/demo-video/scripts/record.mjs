#!/usr/bin/env node
// Step 2: record every scene to build/clips/<id>.mp4 (1920x1080, 30 fps) for exactly as long
// as its voice-over needs (timeline target from tts.mjs). Card scenes render assets/cards/card.html;
// page scenes drive the live product in ONE persistent tab, so app state carries scene to scene.
// usage: node record.mjs [demoDir] [--only=id1,id2] [--headed]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, newPage, sleep } from './lib/cdp.mjs';
import { CHAPTERS } from './lib/story.mjs';
import { demoDir, ffmpeg, loadPlan, loadTimeline, saveTimeline } from './lib/util.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = demoDir(process.argv.slice(2).find((a) => !a.startsWith('--')));
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;
const plan = loadPlan(dir);
const tl = loadTimeline(dir);
const theme = plan.theme || {};
const build = path.join(dir, 'build');
const cardUrl = pathToFileURL(path.join(here, '..', 'assets', 'cards', 'card.html')).href;
const director = fs.readFileSync(path.join(here, 'lib', 'director.js'), 'utf8');

for (const s of plan.scenes) if (!tl.scenes[s.id]?.target) throw new Error(`no timeline for ${s.id}: run tts.mjs first`);

const browser = await launch({ headless: !process.argv.includes('--headed') });
const app = await newPage(browser);
const card = await newPage(browser);
await app.send('Page.addScriptToEvaluateOnNewDocument', { source: director });
// Headless Chrome reports prefers-color-scheme: dark. Pin the scheme the product is meant to be seen in.
if (plan.colorScheme) await app.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: plan.colorScheme }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
let cursorPos = null;
const chipTheme = { fg: theme.fg, bg: theme.surface };
// The chapter label shows on the first scene of each new beat (problem, solution, demo, proof) unless the
// scene sets its own `chapter` text or false, or the plan sets "chapters": false.
let prevBeat = null;
function chapterFor(s) {
  const changed = s.beat && s.beat !== prevBeat;
  prevBeat = s.beat || prevBeat;
  if (plan.chapters === false || s.chapter === false) return null;
  if (typeof s.chapter === 'string') return s.chapter;
  return changed ? CHAPTERS[s.beat] || null : null;
}

// ---------- capture ----------
async function capture(page, id, seconds, body) {
  const fdir = path.join(build, 'frames', id);
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  const frames = [];
  const off = page.on('Page.screencastFrame', (p) => {
    page.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
    const name = `${String(frames.length).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(fdir, name), Buffer.from(p.data, 'base64'));
    frames.push({ name, t: p.metadata.timestamp });
  });
  // A background tab gets no animation frames: rAF stalls, the cursor never moves, nothing is captured.
  await page.send('Page.bringToFront');
  await sleep(150);
  const start = Date.now() / 1000;
  const elapsed = () => Date.now() / 1000 - start;
  await page.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  let watchdog;
  try {
    await Promise.race([body(elapsed), new Promise((_, rej) => { watchdog = setTimeout(() => rej(new Error(`scene ${id} still running ${seconds + 30 | 0}s in: an action hung`)), (seconds + 30) * 1000); })]);
  } finally {
    clearTimeout(watchdog);
  }
  const left = seconds - elapsed();
  if (left > 0) await sleep(left * 1000);
  await page.send('Page.stopScreencast');
  off();
  const total = Math.max(seconds, elapsed());
  if (!frames.length) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    fs.writeFileSync(path.join(fdir, '00000.jpg'), Buffer.from(data, 'base64'));
    frames.push({ name: '00000.jpg', t: start });
  }
  // Variable-rate frames -> constant 30 fps clip via the concat demuxer's per-file durations.
  const times = frames.map((f, i) => (i === 0 ? 0 : Math.min(total, Math.max(0, f.t - start))));
  let list = '';
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? times[i + 1] : total) - times[i];
    list += `file '${frames[i].name}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`;
  }
  list += `file '${frames.at(-1).name}'\n`;
  fs.writeFileSync(path.join(fdir, 'list.txt'), list);
  const out = path.join(build, 'clips', `${id}.mp4`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,settb=AVTB',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-t', total.toFixed(3), path.relative(fdir, out)], { cwd: fdir });
  return { total, frames: frames.length };
}

// ---------- actions on the live page ----------
async function rectOf(spec, timeout = 8000) {
  const t0 = Date.now();
  for (;;) {
    const r = await app.eval(`window.__demo && __demo.rect(${JSON.stringify(spec)})`).catch(() => null);
    if (r) return r;
    if (Date.now() - t0 > timeout) return null;
    await sleep(150);
  }
}

// Layout-viewport CSS px -> coordinates Input.dispatchMouseEvent expects under pinch zoom.
async function toInput(x, y) {
  const vv = await app.eval('({s: visualViewport.scale, ox: visualViewport.offsetLeft, oy: visualViewport.offsetTop})');
  return { x: (x - vv.ox) * vv.s, y: (y - vv.oy) * vv.s };
}

async function ensureInView(spec, r) {
  if (r.top >= 40 && r.top + r.h <= app.height - 40) return r;
  await app.eval(`__demo.scrollTo(${JSON.stringify(spec)}, 900, 0.35)`);
  await sleep(150);
  return rectOf(spec);
}

const KEYS = { Enter: 13, Tab: 9, Escape: 27, Backspace: 8, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Space: 32 };
const pinchSpeed = (ms) => Math.max(60, Math.round(240000 / ms));

async function act(a, scene) {
  const spec = a.selector ? { selector: a.selector, nth: a.nth } : a.text ? { text: a.text, nth: a.nth } : null;
  const need = async () => {
    const r = spec && await rectOf(spec, a.timeout ?? 8000);
    if (!r) throw new Error(`scene ${scene.id}: "${a.do}" target not found: ${JSON.stringify(spec)}`);
    return ensureInView(spec, r);
  };
  switch (a.do) {
    case 'wait': await sleep(a.ms ?? 500); break;
    case 'goto': await app.goto(new URL(a.url, plan.url).href); await restoreCursor(); break;
    case 'waitFor': {
      if (a.js) {
        const t0 = Date.now();
        while (!(await app.eval(a.js).catch(() => false))) {
          if (Date.now() - t0 > (a.timeout ?? 15000)) throw new Error(`scene ${scene.id}: waitFor js timed out: ${a.js}`);
          await sleep(200);
        }
      } else await need();
      break;
    }
    case 'hover':
    case 'click': {
      const r = await need();
      const tx = r.x + (a.dx || 0), ty = r.y + (a.dy || 0);
      await app.eval(`__demo.moveTo(${tx}, ${ty}, ${a.move ?? 750})`);
      cursorPos = { x: tx, y: ty };
      if (a.do === 'hover') {
        // The presenter cursor is drawn; the page never sees it. Send a real move so :hover and pointerenter fire.
        const hp = await toInput(tx, ty);
        await app.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hp.x, y: hp.y });
        await sleep(a.after ?? 300);
        break;
      }
      await sleep(a.pause ?? 120);
      const p = await toInput(tx, ty);
      app.eval('__demo.press()').catch(() => {});
      await app.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await app.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(70);
      await app.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(a.after ?? 500);
      break;
    }
    case 'type': {
      if (spec) await act({ ...a, do: 'click', after: 200 }, scene);
      if (a.clear) {
        for (const [type, key, code, vk, mod] of [['keyDown', 'a', 'KeyA', 65, 2], ['keyUp', 'a', 'KeyA', 65, 2], ['keyDown', 'Backspace', 'Backspace', 8, 0], ['keyUp', 'Backspace', 'Backspace', 8, 0]])
          await app.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, modifiers: mod });
      }
      const cps = a.cps ?? 14;
      // paste: insert the whole value at once, so a form never flags a half-typed address.
      if (a.paste) await app.send('Input.insertText', { text: String(a.value) });
      else for (const ch of String(a.value)) {
        await app.send('Input.insertText', { text: ch });
        await sleep((1000 / cps) * (0.6 + Math.random() * 0.8));
      }
      await sleep(a.after ?? 300);
      break;
    }
    case 'press': {
      const code = KEYS[a.key] ?? a.key.toUpperCase().charCodeAt(0);
      await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key: a.key, code: a.key, windowsVirtualKeyCode: code, text: a.key === 'Enter' ? '\r' : undefined });
      await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key: a.key, code: a.key, windowsVirtualKeyCode: code });
      await sleep(a.after ?? 300);
      break;
    }
    case 'scroll': {
      const target = a.y != null ? a.y : spec;
      const ok = await app.eval(`__demo.scrollTo(${JSON.stringify(target)}, ${a.ms ?? 1200}, ${a.block ?? 0.3})`);
      if (!ok) throw new Error(`scene ${scene.id}: scroll target not found: ${JSON.stringify(spec)}`);
      break;
    }
    case 'zoom': {
      // Native pinch zoom: crisp at any scale, keeps fixed headers intact, cursor scales with it.
      const r = await need();
      const cur = await app.eval('visualViewport.scale');
      const p = await toInput(r.x, r.y);
      await app.send('Input.synthesizePinchGesture', { x: p.x, y: p.y, scaleFactor: (a.scale ?? 1.5) / cur, relativeSpeed: pinchSpeed(a.ms ?? 900), gestureSourceType: 'mouse' });
      break;
    }
    case 'unzoom': {
      const cur = await app.eval('visualViewport.scale');
      if (cur > 1.01) await app.send('Input.synthesizePinchGesture', { x: app.width / 2, y: app.height / 2, scaleFactor: 1 / cur, relativeSpeed: pinchSpeed(a.ms ?? 800), gestureSourceType: 'mouse' });
      break;
    }
    case 'spotlight': await app.eval(`__demo.spotlight(${JSON.stringify(spec || {})}, ${!a.off})`); break;
    case 'focus': {
      if (a.off) { await app.eval('__demo.focus(null, false)'); break; }
      await need();
      await app.eval(`__demo.focus(${JSON.stringify(spec)}, true)`);
      break;
    }
    case 'chapter': await app.eval(`__demo.chip(${JSON.stringify(a.text || '')}, ${a.ms ?? 2800}, ${JSON.stringify(chipTheme)})`); break;
    case 'cursor': await app.eval(`__demo.hideCursor(${!!a.hide})`); break;
    case 'eval': await app.eval(a.js); break;
    default: throw new Error(`scene ${scene.id}: unknown action "${a.do}"`);
  }
}

// When an action carries onWord/at, start it so it lands while the narrator says that word.
function startTime(a, entry) {
  if (a.at != null) return a.at;
  if (!a.onWord) return null;
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');
  const hits = (entry.words || []).filter((w) => clean(w.text) === clean(a.onWord));
  const w = hits[a.occurrence ?? 0];
  if (!w) { console.warn(`  ! onWord "${a.onWord}" not in voice-over, running immediately`); return null; }
  const travel = (a.do === 'click' || a.do === 'hover') ? ((a.move ?? 750) + 120) / 1000 : 0;
  return Math.max(0, entry.lead + w.start - travel);
}

async function restoreCursor() {
  await app.eval(`window.__demo && __demo.setAccent(${JSON.stringify(theme.accent || '#3ee0c0')})`).catch(() => {});
  if (cursorPos) await app.eval(`window.__demo && __demo.place(${cursorPos.x}, ${cursorPos.y})`).catch(() => {});
}

async function resetZoom() {
  const cur = await app.eval('visualViewport.scale').catch(() => 1);
  if (cur > 1.01) {
    await app.send('Input.synthesizePinchGesture', { x: app.width / 2, y: app.height / 2, scaleFactor: 1 / cur, relativeSpeed: 3000, gestureSourceType: 'mouse' });
    await sleep(200);
  }
}

// ---------- run ----------
const failures = [];
for (const s of plan.scenes) {
  const chapter = chapterFor(s); // before --only, so beat changes are tracked across skipped scenes
  if (only && !only.has(s.id)) continue;
  const entry = tl.scenes[s.id];
  const v = s.visual || { type: 'card', template: 'statement', lines: [s.vo] };
  try {
    let res;
    // Front the tab BEFORE navigating: a background tab never resolves document.fonts.ready or rAF,
    // so goto/prep hang outside the capture watchdog (cost a 10-minute stall on the first real run).
    await (v.type === 'card' ? card : app).send('Page.bringToFront');
    if (v.type === 'card') {
      await card.goto(cardUrl);
      const data = { ...v, theme: { ...theme, ...(v.theme || {}) } };
      // On a card the chapter is the kicker, unless the card already has one.
      if (chapter && data.kicker == null && data.template !== 'title' && data.template !== 'end') data.kicker = chapter;
      if (data.image) data.image = pathToFileURL(path.resolve(dir, data.image)).href;
      await card.eval(`render(${JSON.stringify(data)})`);
      await sleep(250);
      // Start the motion just before capture so frame 0 already has content (verify fails black openings).
      await card.eval('go()');
      await sleep(250);
      res = await capture(card, s.id, entry.target, async () => {});
    } else {
      await resetZoom();
      if (v.url) { await app.goto(new URL(v.url, plan.url).href); await restoreCursor(); }
      for (const a of v.prep || []) await act(a, s);
      await app.eval(`__demo.hideCursor(${v.cursor === false})`).catch(() => {});
      await app.eval('__demo.focus(null, false); __demo.chip("")').catch(() => {});
      await sleep(v.settle ?? 400);
      res = await capture(app, s.id, entry.target, async (elapsed) => {
        if (chapter) await app.eval(`__demo.chip(${JSON.stringify(chapter)}, 2800, ${JSON.stringify(chipTheme)})`).catch(() => {});
        for (const a of v.actions || []) {
          const at = startTime(a, entry);
          if (at != null && elapsed() < at) await sleep((at - elapsed()) * 1000);
          try { await act(a, s); } catch (e) { if (!a.optional) throw e; console.warn(`  ! ${e.message} (optional, skipped)`); }
        }
      });
    }
    entry.dur = +res.total.toFixed(3);
    entry.clip = `build/clips/${s.id}.mp4`;
    const over = entry.dur - entry.target;
    console.log(`  rec ${s.id.padEnd(18)} ${entry.dur.toFixed(2)}s  ${String(res.frames).padStart(4)} frames${over > 0.3 ? `  (+${over.toFixed(1)}s past voice: actions ran long)` : ''}`);
  } catch (e) {
    fs.mkdirSync(path.join(build, 'debug'), { recursive: true });
    const shot = path.join(build, 'debug', `${s.id}.png`);
    await (v.type === 'card' ? card : app).screenshot(shot).catch(() => {});
    console.error(`  FAIL ${s.id}: ${e.message}\n       screenshot: ${shot}`);
    failures.push(s.id);
    if (v.type !== 'card') break; // later page scenes depend on this one's state
  }
  saveTimeline(dir, tl);
}
await browser.close();
if (failures.length) { console.error(`\nfailed: ${failures.join(', ')}`); process.exit(1); }
