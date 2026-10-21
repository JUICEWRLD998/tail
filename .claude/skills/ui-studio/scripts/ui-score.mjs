#!/usr/bin/env node
/*
 * ui-score — one deterministic 0–100 score for a rendered surface.
 *
 * This is the instrument the score loop calls once per round (references/score-loop.md).
 * One instrument, run 4x. Do NOT hand-score: a self-produced A/B judgement has no
 * evaluator and scores every round higher (measured 2026-09-25 — three rounds, 6→8→9,
 * every change better by construction, the composition still wrong).
 *
 * Zero dependencies. Node 22+ (global fetch + WebSocket) drives Chrome over CDP directly.
 *
 *   node ui-score.mjs <dir|html|url> --round 2 --label legibility [--out <dir>] [--keep-best]
 *
 * Produces <out>/r<N>[-label].json: subscores, fired tells, each metric's provenance
 * (measured | fixture-asserted | source-inferred | unknown), and the control report.
 * With --keep-best, writes <out>/SCORE-LOOP.md and names the round to keep.
 *
 * Exit codes: 0 scored · 2 CONTROL_FAILED (score withheld — do not use it) · 1 usage/transport error.
 *
 * The three planted positive controls (see references/score-loop.md):
 *   __ctlA  cream ground, near-identical text   -> the contrast sampler must report < 1.5:1
 *   __ctlB  a distinctive amber 64x64 block     -> the geometry+clustering path must find ~4096px of it
 *   __ctlC  the reserved name above             -> the font resolver must answer with a family
 * A blind sampler prints a clean pass and looks identical to a working one, so any failed
 * assertion withholds the score rather than reporting it.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

// ─── args ────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const positional = argv.filter(a => !a.startsWith('--'))
const flag = name => {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return null
  const v = argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const target = positional[0]
if (!target) {
  console.error('usage: node ui-score.mjs <dir|html|url> --round <n> [--label <label>] [--out <dir>] [--keep-best] [--no-snapshot]')
  process.exit(1)
}
const round = Number(flag('round') || 1)
const label = flag('label') === true || !flag('label') ? '' : String(flag('label'))
const outDir = flag('out') === true || !flag('out') ? process.cwd() : resolve(String(flag('out')))
const basePort = Number(flag('port') || 9333)
const debugPort = basePort + 1
const viewports = [
  { w: 1280, h: 800, label: 'desktop' },
  { w: 768, h: 1024, label: 'tablet' },
  { w: 375, h: 812, label: 'mobile' },
]

// ─── resolve the target ──────────────────────────────────────────────────────────
const isRemote = /^https?:\/\//.test(String(target))
let url = String(target)
if (!isRemote) {
  const abs = resolve(String(target))
  if (!existsSync(abs)) {
    console.error(`ui-score: target not found: ${abs}`)
    process.exit(1)
  }
  const file = /\.html?$/.test(abs) ? abs : join(abs, 'index.html')
  if (!existsSync(file)) {
    console.error(`ui-score: no index.html under ${abs}`)
    process.exit(1)
  }
  url = pathToFileURL(file).href
}

// ─── chrome ──────────────────────────────────────────────────────────────────────
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)
const chromePath = CHROME_CANDIDATES.find(p => existsSync(p))
if (!chromePath) {
  console.error('ui-score: no Chrome/Edge binary found. Set CHROME_PATH to one.')
  process.exit(1)
}

const profile = join(tmpdir(), `ui-score-${Date.now()}`)
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--mute-audio',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${debugPort}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] })

const sleep = ms => new Promise(r => setTimeout(r, ms))
const shutdown = () => { try { chrome.kill() } catch {} }
process.on('exit', shutdown)
process.on('SIGINT', () => { shutdown(); process.exit(130) })

async function devtoolsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}/json/version`)
      if (r.ok) return (await r.json()).webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  return null
}

// ─── CDP ─────────────────────────────────────────────────────────────────────────
function connect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl)
    const waiting = new Map()
    const events = []
    let id = 0
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data)
      if (msg.id && waiting.has(msg.id)) {
        const { resolve: ok, reject } = waiting.get(msg.id)
        waiting.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : ok(msg.result)
      } else if (msg.method) events.push(msg)
    }
    ws.onerror = e => rej(new Error(`ws error: ${e.message || 'unknown'}`))
    ws.onopen = () => res({
      send(method, params = {}, sessionId) {
        return new Promise((ok, reject) => {
          const mid = ++id
          waiting.set(mid, { resolve: ok, reject })
          ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }))
        })
      },
      events,
      close: () => ws.close(),
    })
  })
}

// ─── the page-side probe ─────────────────────────────────────────────────────────
const PROBE = String.raw`(() => {
  const A = a => Array.prototype.slice.call(a)
  const isCtl = el => el && el.hasAttribute && el.hasAttribute('data-__uiscorectl')
  // Every window.innerHeight-derived tell is only valid when the probe is looking at the actual
  // first screen. A probe that has scrolled (out-of-process iframes can leave Chrome scrolled)
  // reads a 380px hero as a 2039px overflow and every section as held-invisible. Gate them.
  const SCROLLED = window.scrollY > 8

  // ---- colour maths. The metric has to match the question:
  //      legibility against a background -> contrast ratio
  //      "are these two colours different?" -> relative channel distance (green and red
  //      can share a luminance, so a ratio there is meaningless)
  //      "which element is quietest?" -> chroma
  const named = { white:[255,255,255], black:[0,0,0], red:[255,0,0], orange:[255,165,0], yellow:[255,255,0],
    green:[0,128,0], blue:[0,0,255], navy:[0,0,128], purple:[128,0,128], teal:[0,128,128], gray:[128,128,128],
    grey:[128,128,128], silver:[192,192,192], ivory:[255,255,240] }
  const toBytes = v => Math.max(0, Math.min(255, Math.round(v)))
  function parseColor(input) {
    if (!input) return null
    const s = String(input).trim().toLowerCase()
    if (s === 'transparent' || s === 'none' || s === '' || s === 'currentcolor') return null
    if (named[s] !== undefined) { const n = named[s]; return n ? { r:n[0], g:n[1], b:n[2], a:1 } : null }
    let m = s.match(/^#([0-9a-f]{3,8})$/)
    if (m) {
      const h = m[1]
      const exp = h.length <= 4 ? h.split('').map(c => c + c).join('') : h
      return { r: parseInt(exp.slice(0,2),16), g: parseInt(exp.slice(2,4),16), b: parseInt(exp.slice(4,6),16),
        a: exp.length >= 8 ? parseInt(exp.slice(6,8),16)/255 : 1 }
    }
    m = s.match(/^rgba?\(([^)]+)\)$/)
    if (m) {
      const p = m[1].split(/[,\s\/]+/).filter(Boolean)
      const ch = p.slice(0,3).map(x => x.endsWith('%') ? parseFloat(x)/100*255 : parseFloat(x))
      const a = p[3] === undefined ? 1 : (p[3].endsWith('%') ? parseFloat(p[3])/100 : parseFloat(p[3]))
      return { r: toBytes(ch[0]), g: toBytes(ch[1]), b: toBytes(ch[2]), a }
    }
    m = s.match(/^hsla?\(([^)]+)\)$/)
    if (m) {
      const p = m[1].split(/[,\s\/]+/).filter(Boolean)
      const h = ((parseFloat(p[0]) % 360) + 360) % 360 / 360
      const sat = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100
      const a = p[3] === undefined ? 1 : (p[3].endsWith('%') ? parseFloat(p[3])/100 : parseFloat(p[3]))
      const q = l < 0.5 ? l*(1+sat) : l+sat-l*sat, pp = 2*l-q
      const f = t => { t = (t+1)%1
        return toBytes(255*(t<1/6?pp+(q-pp)*6*t:t<1/2?q:t<2/3?pp+(q-pp)*(2/3-t)*6:pp)) }
      return { r:f(h+1/3), g:f(h), b:f(h-1/3), a }
    }
    // Chrome 154 serialises COMPUTED oklch() colours as lab() (CIE Lab, D50 white point, per CSS Color 4) and
    // wide-gamut ones as color(srgb ...). Without these branches the parser returned null for every token
    // authored in oklch, the ground fell back to white, and every downstream metric was garbage (2026-09-30).
    m = s.match(/^lab\(([^)]+)\)$/)
    if (m) {
      const p = m[1].split(/[,\s\/]+/).filter(Boolean)
      const L = parseFloat(p[0]), A = parseFloat(p[1]) || 0, B = parseFloat(p[2]) || 0
      const a = p[3] === undefined ? 1 : (p[3].endsWith('%') ? parseFloat(p[3])/100 : parseFloat(p[3]))
      const eps = 216/24389, kap = 24389/27
      const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200
      const xr = fx**3 > eps ? fx**3 : (116*fx - 16) / kap
      const yr = L > kap*eps ? fy**3 : L / kap
      const zr = fz**3 > eps ? fz**3 : (116*fz - 16) / kap
      const X = xr * 0.96422, Y = yr, Z = zr * 0.82521
      const X65 = 0.9555766*X - 0.0230393*Y + 0.0631636*Z
      const Y65 = -0.0282895*X + 1.0099416*Y + 0.0210077*Z
      const Z65 = 0.0122982*X - 0.0204830*Y + 1.3299098*Z
      const lin = [ 3.2404542*X65 - 1.5371385*Y65 - 0.4985314*Z65,
                   -0.9692660*X65 + 1.8760108*Y65 + 0.0415560*Z65,
                    0.0556434*X65 - 0.2040259*Y65 + 1.0572252*Z65 ]
      const enc = c => toBytes(255 * (c <= 0.0031308 ? 12.92*c : 1.055*Math.pow(Math.max(c,0), 1/2.4) - 0.055))
      return { r:enc(lin[0]), g:enc(lin[1]), b:enc(lin[2]), a }
    }
    m = s.match(/^color\(srgb\s+([^)]+)\)$/)
    if (m) {
      const p = m[1].split(/[,\s\/]+/).filter(Boolean)
      const a = p[3] === undefined ? 1 : (p[3].endsWith('%') ? parseFloat(p[3])/100 : parseFloat(p[3]))
      return { r: toBytes(parseFloat(p[0])*255), g: toBytes(parseFloat(p[1])*255), b: toBytes(parseFloat(p[2])*255), a }
    }
    m = s.match(/^oklch\(([^)]+)\)$/)
    if (m) {
      const p = m[1].split(/[,\s\/]+/).filter(Boolean)
      const L = p[0].endsWith('%') ? parseFloat(p[0])/100 : parseFloat(p[0])
      const C = parseFloat(p[1]) || 0
      const Hdeg = parseFloat(p[2]) || 0
      const H = Hdeg * Math.PI / 180
      const a = p[3] === undefined ? 1 : (p[3].endsWith('%') ? parseFloat(p[3])/100 : parseFloat(p[3]))
      const Aa = C * Math.cos(H), Bb = C * Math.sin(H)
      const l_ = L + 0.3963377774*Aa + 0.2158037573*Bb
      const m_ = L - 0.1055613458*Aa - 0.0638541728*Bb
      const s_ = L - 0.0894841775*Aa - 1.2914855480*Bb
      const l3 = l_**3, m3 = m_**3, s3 = s_**3
      const lin = [ +4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3,
                    -1.2684380046*l3 + 2.6097574011*m3 - 0.3413193965*s3,
                    -0.0041960863*l3 - 0.7034186147*m3 + 1.7076147010*s3 ]
      const enc = c => toBytes(255 * (c <= 0.0031308 ? 12.92*c : 1.055*Math.pow(Math.max(c,0), 1/2.4) - 0.055))
      return { r:enc(lin[0]), g:enc(lin[1]), b:enc(lin[2]), a, oklchH: Hdeg }
    }
    return null
  }
  const lum = c => { const s = [c.r,c.g,c.b].map(v => v/255).map(v => v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4))
    return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2] }
  const ratio = (a, b) => { if (!a || !b) return null
    const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05) }
  const chromaOf = c => { if (!c) return 0
    const mx = Math.max(c.r,c.g,c.b), mn = Math.min(c.r,c.g,c.b); return mx === 0 ? 0 : (mx-mn)/mx }
  const hueOf = c => { if (!c) return 0
    const r = c.r/255, g = c.g/255, b = c.b/255
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn
    if (d === 0) return 0
    const h = mx === r ? ((g-b)/d + (g<b?6:0)) : mx === g ? (b-r)/d + 2 : (r-g)/d + 4
    return (h * 60 + 360) % 360 }
  const chanDist = (a, b) => Math.max(Math.abs(a.r-b.r), Math.abs(a.g-b.g), Math.abs(a.b-b.b)) / 255
  const over = (c, ground) => { if (!c) return null
    const a = c.a === undefined ? 1 : c.a
    if (a >= 1 || !ground) return c
    return { r: toBytes(c.r*a + ground.r*(1-a)), g: toBytes(c.g*a + ground.g*(1-a)), b: toBytes(c.b*a + ground.b*(1-a)), a: 1 } }

  const SLOP_FONTS = ['inter','roboto','open sans','poppins','lato','system-ui','-apple-system','arial','helvetica','segoe ui','geist']
  const GENERIC_HUES = [262, 255, 275, 240]

  // ---- sweep computed styles
  const all = A(document.querySelectorAll('body *')).filter(el => !isCtl(el)).slice(0, 4000)
  const body = document.body
  const htmlBg = parseColor(getComputedStyle(document.documentElement).backgroundColor)
  const bodyBg = parseColor(getComputedStyle(body).backgroundColor)
  const ground = bodyBg && bodyBg.a > 0.5 ? bodyBg : (htmlBg && htmlBg.a > 0.5 ? htmlBg : { r:255, g:255, b:255, a:1 })
  const groundChroma = chromaOf(ground)

  // The surface a text node is actually read against, resolved by walking UP the ancestor chain and
  // compositing each background over the page ground. bgEff (the element's OWN background over the
  // ground) is the right model for "is this control indistinguishable from its container" but the
  // wrong one for contrast: white text inside a painted band was compared against the page ground and
  // reported as 1.05:1, manufacturing a critical contrast failure out of correct styling.
  const csCache = new Map()
  const csOf = n => { let c = csCache.get(n); if (!c) { c = getComputedStyle(n); csCache.set(n, c) } return c }
  const surfaceUnder = node => {
    const stack = []
    let n = node
    while (n && n.nodeType === 1 && stack.length < 40) {
      const c = parseColor(csOf(n).backgroundColor)
      if (c && c.a > 0.01) { stack.push(c); if (c.a >= 0.999) break }
      n = n.parentElement
    }
    let acc = null
    for (let i = stack.length - 1; i >= 0; i--) acc = acc ? over(stack[i], acc) : stack[i]
    return acc ? over(acc, ground) : ground
  }

  const el = [], nodes = []
  // Text scrolled out of view inside an overflow:auto/hidden panel still has a rect. Measured as if visible, the
  // hidden rows of a sticky catalogue sat "beside" a page heading and failed gate 54 (2026-09-30).
  const clippedOut = (node, r) => {
    for (let p = node.parentElement; p && p !== document.body; p = p.parentElement) {
      const ov = getComputedStyle(p)
      if (/(auto|scroll|hidden|clip)/.test(ov.overflowX + ov.overflowY)) {
        const pr = p.getBoundingClientRect()
        if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) return true
      }
    }
    return false
  }
  for (const node of all) {
    const cs = getComputedStyle(node)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const rect = node.getBoundingClientRect()
    const bgc = parseColor(cs.backgroundColor)
    const fgRaw = cs.color
    const fgParsed = parseColor(fgRaw)
    const fg = fgParsed && fgParsed.a > 0 ? fgParsed : { r:0, g:0, b:0, a:1 }
    const hasText = A(node.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0)
    const blw = parseFloat(cs.borderLeftWidth) || 0
    const btw = parseFloat(cs.borderTopWidth) || 0
    const o = {
      tag: node.tagName.toLowerCase(),
      cls: typeof node.className === 'string' ? node.className : '',
      txt: hasText ? node.textContent.trim().slice(0, 90) : '',
      clipped: hasText ? clippedOut(node, rect) : false,
      x: rect.x, y: rect.y, w: rect.width, h: rect.height,
      area: Math.max(0, rect.width) * Math.max(0, rect.height),
      top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY, left: rect.left, right: rect.right,
      fg: fgParsed && fgParsed.a > 0 ? fgParsed : null, fgRaw, bg: bgc, bgEff: over(bgc, ground), bgSurf: surfaceUnder(node),
      size: parseFloat(cs.fontSize) || 16,
      weight: cs.fontWeight,
      family: (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim(),
      lh: parseFloat(cs.lineHeight) || 0,
      radius: parseFloat(cs.borderTopLeftRadius) || 0,
      bw: btw,
      stripe: blw >= 3 && blw > btw * 1.6 && chromaOf(parseColor(cs.borderLeftColor)) > 0.25,
      // WCAG exempts inactive controls from the contrast requirement, so they must not be counted
      // as failures. A disabled button reading 2.5:1 is correct behaviour, not a defect.
      dis: !!node.closest('[disabled],[aria-disabled="true"],.disabled,[data-disabled]'),
      bgImage: cs.backgroundImage || 'none',
      opacity: parseFloat(cs.opacity),
      align: cs.textAlign,
      cols: cs.gridTemplateColumns,
      gap: parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0,
      pos: cs.position,
      tt: cs.textTransform,
      ls: parseFloat(cs.letterSpacing) || 0,
    }
    el.push(o)
    nodes.push(node)
  }
  const idx = new Map()
  nodes.forEach((n, i) => idx.set(n, i))

  // ---- a CONTROL painted the same colour as the surface it sits on (the invisible-button family).
  //      Deliberately not "any two siblings share a colour": a uniform card grid is legitimate and
  //      tripping on it would make the tell useless. The failure mode is a control indistinguishable
  //      from its own container.
  const isCtlNode = n => /^(button|a|input|select|textarea)$/.test(n.tagName.toLowerCase()) || n.getAttribute('role') === 'button'
  let twinPairs = 0, twinSame = 0, twinWorst = null
  for (let i = 0; i < el.length; i++) {
    const node = nodes[i], o = el[i]
    if (!node || !o.bgEff) continue
    const pi = node.parentElement ? idx.get(node.parentElement) : undefined
    if (pi === undefined) continue
    const p = el[pi]
    if (!p.bgEff) continue
    if (!isCtlNode(node) && !isCtlNode(node.parentElement)) continue
    twinPairs++
    if (chanDist(p.bgEff, o.bgEff) < 0.02) {
      // A transparent control sitting on its own container is the most common false positive: nav
      // links and text buttons are meant to inherit the surface and signal with colour/underline.
      // The real defect is a FILLED control indistinguishable from its own surface. Those are the
      // only pairs counted, so the reported total reads as filled pairs, not every transparent link.
      if (!(o.bg && o.bg.a >= 0.5)) continue
      twinSame++
      if (!twinWorst) twinWorst = (o.txt || node.tagName.toLowerCase()) + ' on ' + node.parentElement.tagName.toLowerCase()
    }
  }

  // ---- identity
  const title = (document.title || '').trim()
  const lang = document.documentElement.getAttribute('lang') || ''
  const families = [...new Set(el.map(o => o.family).filter(Boolean))]
  const weights = [...new Set(el.map(o => o.weight).filter(Boolean))]
  const radii = [...new Set(el.map(o => o.radius).filter(Boolean))]

  // ---- sections
  // top-level sections only. A naive "body > * > section" catches every section nested under main,
  // and allowing MAIN itself made "the hero" the whole main element (2039px of it). Sections are
  // leaf-ish blocks: <section>/<article>/<footer>/<aside>, or a wrapper div that holds no section.
  const rawSections = A(document.querySelectorAll('body > *, main > *'))
    .filter(n => n !== document.body && n !== document.documentElement && !isCtl(n))
    .filter(n => ['SECTION', 'ARTICLE', 'FOOTER', 'ASIDE'].includes(n.tagName)
      || (n.tagName === 'DIV' && n.children.length > 0 && n.getBoundingClientRect().height > 120))
    .filter(n => n.getBoundingClientRect().height > 80 && !n.querySelector('section, article'))
  const sectionEls = []
  for (const n of rawSections) {
    if (sectionEls.some(p => p.contains(n) || n.contains(p))) continue
    sectionEls.push(n)
  }
  const sections = sectionEls.map((n, i) => ({
    i, tag: n.tagName.toLowerCase(),
    cls: typeof n.className === 'string' ? n.className : '',
    txt: (n.textContent || '').trim().slice(0, 160),
    top: n.getBoundingClientRect().top + window.scrollY,
    bottom: n.getBoundingClientRect().bottom + window.scrollY,
    h: n.getBoundingClientRect().height,
    padTop: parseFloat(getComputedStyle(n).paddingTop) || 0,
    padBottom: parseFloat(getComputedStyle(n).paddingBottom) || 0,
    bgImage: getComputedStyle(n).backgroundImage || 'none',
    children: n.children.length,
  }))

  // ---- declared tokens
  const tokenColors = {}, tokenFamilies = {}
  const styleRules = []
  let cssText = ''
  for (const sheet of A(document.styleSheets)) {
    let rules = null
    try { rules = sheet.cssRules } catch { continue }
    for (const rule of A(rules)) {
      cssText += (rule.cssText || '').replace(/\s+/g, ' ') + '\n'
      if (rule.selectorText) styleRules.push({ sel: rule.selectorText, css: rule.cssText || '' })
      if (rule.selectorText && /:root|\[data-theme/.test(rule.selectorText) && rule.style) {
        for (const p of A(rule.style)) {
          const v = rule.style.getPropertyValue(p).trim()
          if (p.startsWith('--') && /color|bg|surface|ink|paper|accent|line|border|text/i.test(p) && parseColor(v)) tokenColors[p] = v
          if ((p.startsWith('--font') || p.startsWith('--type')) && v) tokenFamilies[p] = v
        }
      }
    }
  }
  cssText += '\n' + A(document.querySelectorAll('style')).map(s => s.textContent || '').join('\n')
  const outerHtml = document.documentElement.outerHTML

  const source = {
    transitionAll: /transition\s*:\s*all/i.test(cssText),
    hoverScale: /:hover[^{]*\{[^}]*scale\(\s*(1\.[0-9]{2,}|1\.[1-9])\s*\)/i.test(cssText) || /hover:scale-\[?1\.0[5-9]/.test(outerHtml),
    bouncyEasing: /cubic-bezier\(\s*0?\.\d+,\s*1\.[1-9]/.test(cssText),
    animatesLayout: /transition[^;}]*:[^;}]*\b(width|height|top|left|right|bottom|margin|padding)\b/i.test(cssText),
    gradientText: /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/i.test(cssText),
    gradientAnywhere: /(linear|radial|conic)-gradient/i.test(cssText),
    transitionOnOutline: /transition[^;}]*:[^;}]*outline/i.test(cssText),
    textWrap: /text-wrap\s*:\s*(pretty|balance)/i.test(cssText),
    tabularNums: /tabular-nums|font-variant-numeric/i.test(cssText),
    overflowXClip: /overflow-x\s*:\s*(clip|hidden)/i.test(cssText),
    reducedMotion: /prefers-reduced-motion/i.test(cssText),
    focusVisible: /:focus-visible/i.test(cssText),
    radiusPill: /border-radius\s*:\s*(9999|999|100px|50%)/i.test(cssText),
    hardcodedHex: (cssText.match(/#[0-9a-f]{6}\b/gi) || []).length,
    macrostructure: ((cssText.match(/macrostructure:\s*([^·*]+)/i) || [])[1] || '').trim() || null,
    svgCount: document.querySelectorAll('svg').length,
    iconLibs: [...new Set((A(document.querySelectorAll('svg')).map(s => (s.getAttribute('class') || '') + ' ' + (s.getAttribute('data-icon') || '')).join(' ').match(/(lucide|heroicons|feather|tabler|phosphor|radix|material)/gi) || []))],
    sectionBgImages: sections.filter(s => s.bgImage && s.bgImage !== 'none').length,
  }

  // ---- interactive element census (eight states per the gate)
  const interactive = A(document.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'))
  const stateChannels = interactive.map(n => {
    const cs = getComputedStyle(n)
    const r = n.getBoundingClientRect()
    return {
      tag: n.tagName.toLowerCase(),
      txt: ((n.textContent || '').trim().slice(0, 40)) || n.getAttribute('placeholder') || n.getAttribute('aria-label') || '',
      cls: typeof n.className === 'string' ? n.className : '',
      cursor: cs.cursor, w: r.width, h: r.height,
      hover: 0, focus: 0, active: 0,
      disabledChannels: (n.disabled !== undefined && n.disabled) || n.getAttribute('aria-disabled') === 'true' ? 1 : 0,
      focusInstant: true,
    }
  })
  // ':focus-visible' must be stripped BEFORE ':focus' or the base selector stays ':focus-visible'
  // and matches nothing: a detector that can never match reads exactly like a page with no ring.
  const stripPseudo = (s, pseudo) => s
    .replace(new RegExp(':' + pseudo + '-[a-z-]+', 'gi'), '')
    .replace(new RegExp(':' + pseudo + '\\b', 'gi'), '')
  const channelFor = (n, pseudo, re) => {
    for (const r of styleRules) {
      if (!r.sel.includes(pseudo)) continue
      const body = r.css.slice(r.css.indexOf('{'))
      if (!re.test(body)) continue
      const bases = r.sel.split(',').map(s => stripPseudo(s.trim(), pseudo))
      for (const b of bases) {
        try { if (b && n.matches(b)) return 1 } catch {}
      }
    }
    return 0
  }
  // the tell is several DIFFERENT effects firing at once on hover (translate + scale + shadow +
  // colour), not the mere existence of a hover AND an active state — that is just normal CSS.
  const hoverEffectKinds = n => {
    let kinds = 0
    for (const r of styleRules) {
      if (!r.sel.includes('hover')) continue
      const bases = r.sel.split(',').map(s => s.trim().replace(/:hover(?![-\\w])/g, ''))
      let hit = false
      for (const b of bases) { try { if (b && n.matches(b)) { hit = true; break } } catch {} }
      if (!hit) continue
      const body = r.css.slice(r.css.indexOf('{'))
      const groups = [/transform\s*:/, /box-shadow\s*:/, /background/, /(^|[;{\s])color\s*:/, /border/, /opacity\s*:/, /filter\s*:/]
      kinds = Math.max(kinds, groups.filter(g => g.test(body)).length)
    }
    return kinds
  }
  let disableable = 0
  for (let i = 0; i < stateChannels.length; i++) {
    const n = interactive[i]
    if (!n) continue
    const sc = stateChannels[i]
    sc.hover = channelFor(n, 'hover', /(background|color|border|transform|box-shadow|opacity|text-decoration)/i)
    sc.focus = channelFor(n, 'focus', /(outline|box-shadow|background|border)/i)
    sc.active = channelFor(n, 'active', /(transform|scale|background|opacity|translate)/i)
    sc.hoverKinds = hoverEffectKinds(n)
    sc.focusInstant = !styleRules.some(r => r.sel.includes('focus') && /transition[^;}]*:[^;}]*(outline|box-shadow)/i.test(r.css))
    // The channels are read from the rules that actually MATCH this control. A page-wide scan of
    // every :disabled rule credited a nav link with three disabled channels the moment any button
    // on the page had a :disabled rule — the term then counted controls that cannot be disabled at all.
    const selfDis = n.matches && n.matches(':disabled')
    const canDisable = selfDis || n.getAttribute('aria-disabled') !== null
      || /^(button|input|select|textarea)$/.test(n.tagName.toLowerCase())
    if (!canDisable) sc.disabledChannels = 0
    else {
      disableable++
      const disRules = styleRules
        .filter(r => /:disabled|\[disabled\]|\[aria-disabled/.test(r.sel))
        .filter(r => r.sel.split(',').some(s => {
          const b = stripPseudo(stripPseudo(s.trim(), 'disabled').replace(/\[disabled\]/g, '').replace(/\[aria-disabled[^\]]*\]/g, ''), 'focus')
          try { return b ? n.matches(b) : false } catch { return false }
        }))
        .map(r => r.css).join(' ')
      // the DOM property AND the styling are separate channels. A native control with no
      // [disabled] styling is unmistakably disabled anyway; requiring CSS channels alone scored
      // "7/7 controls express disabled in 3+ channels" on a page with one disabled button.
      let ch = selfDis || n.getAttribute('aria-disabled') === 'true' ? 1 : 0
      if (/opacity/.test(disRules)) ch++
      if (/background|color|border/.test(disRules)) ch++
      if (/cursor/.test(disRules)) ch++
      sc.disabledChannels = ch
    }
  }

  // ---- focus rings, actually measured by focusing each control
  // Focus-ring measurement, two channels, best wins.
  //   (a) real focus() — catches a plain :focus rule. NOTE: programmatic focus does NOT match
  //       :focus-visible (Chrome's heuristic requires keyboard modality), so a build whose whole
  //       ring lives in :focus-visible reads as ringless here. Verified on the clean fixture: three
  //       :focus-visible rules, 0 outlines visible to (a).
  //   (b) a deterministic MIRROR: every :focus/:focus-visible rule is re-emitted with the pseudo
  //       swapped for an attribute, appended after the page's own sheet so the cascade and every
  //       var() resolve for real. Measured by setting that attribute.
  // (b) is what makes the term honest; (a) stays because it catches inline and shadow-DOM styling
  // the mirror cannot see. Rules nested inside @media are missed by the mirror (styleRules only
  // holds top-level rules) — a ring declared only inside a media query reads as absent.
  const mirrorCss = []
  for (const r of styleRules) {
    if (!/:focus(-visible)?\b/.test(r.sel)) continue
    const sel = r.sel.replace(/:focus-visible\b/gi, '[data-__uiscorefv]').replace(/:focus\b/gi, '[data-__uiscorefv]')
    mirrorCss.push(sel + ' ' + r.css.slice(r.css.indexOf('{')))
  }
  const mirrorStyle = document.createElement('style')
  mirrorStyle.setAttribute('data-__uiscorefv-style', '')
  mirrorStyle.textContent = mirrorCss.join('\n')
  document.head.appendChild(mirrorStyle)
  const focusRulesMirrored = mirrorCss.length

  const readRing = n => {
    const cs = getComputedStyle(n)
    const ringColor = parseColor(cs.outlineColor)
    // A transparent background computes to rgba(0,0,0,0) — a fully transparent BLACK. Using it raw
    // as the comparison surface measured every ring on the clean fixture against black (2.68:1)
    // instead of against the paper it is drawn on (7.31:1). Composite it over the ground first.
    const ownFill = over(parseColor(cs.backgroundColor), surfaceUnder(n.parentElement || n)) || ground
    // ISO 2.4.11 is about contrast against the colours ADJACENT to the indicator. With an
    // outline-offset the ring is drawn outside the control, so the ground is what it sits on; at
    // offset 0 it straddles the edge, so the honest reading is the worse of the two.
    const off = parseFloat(cs.outlineOffset) || 0
    const vsGround = ratio(ringColor, surfaceUnder(n.parentElement || n))
    const vsOwn = ratio(ringColor, ownFill)
    const adj = off > 0 ? vsGround : Math.min(vsGround ?? 99, vsOwn ?? 99)
    const shadow = (cs.boxShadow && cs.boxShadow !== 'none') ? cs.boxShadow : null
    let w = parseFloat(cs.outlineWidth) || 0
    let style = cs.outlineStyle
    let via = 'outline'
    if (style === 'none' || w === 0) {
      // a box-shadow ring is indistinguishable from a small blur at this distance, so it may only
      // substitute for an outline when a colour is actually stated in the shadow
      const m = shadow && shadow.match(/rgba?\([^)]+\)/)
      if (m) { w = 2; style = 'box-shadow'; via = 'box-shadow' }
    }
    return { w, style, via, offset: off, contrast: adj, shadow: shadow ? shadow.slice(0, 60) : null }
  }
  const focusRings = []
  let focusAttempts = 0
  for (const n of interactive.slice(0, 40)) {
    // A disabled control cannot take focus, so it is not evidence either way about focus styling. It is
    // excluded from the CENSUS below, not counted as a control that failed to draw a ring — otherwise a
    // page is penalised precisely for correctly disabling something.
    if (n.disabled) continue
    focusAttempts++
    const plain = (() => { try { n.focus({ preventScroll: true }) } catch {} return readRing(n) })()
    n.setAttribute('data-__uiscorefv', '')
    const mirrored = (() => { try { n.focus({ preventScroll: true }) } catch {} return readRing(n) })()
    n.removeAttribute('data-__uiscorefv')
    // Compare VISIBLE width. With no ring, Chrome computes outline-width to the 3px 'medium' default beside
    // outline-style:none, so a raw width compare let that invisible 3px beat a real 2px solid ring and the
    // term read 0 rings on a page where every control had one (2026-09-30).
    const vis = r => (r.style !== 'none' ? r.w : 0)
    const best = vis(mirrored) >= vis(plain) ? { ...mirrored, via: ':focus-visible' } : { ...plain, via: ':focus' }
    focusRings.push({ tag: n.tagName.toLowerCase(), ...best })
  }
  try { document.activeElement && document.activeElement.blur && document.activeElement.blur() } catch {}
  try { mirrorStyle.remove() } catch {}

  // ---- accent census: rendered area of genuinely chromatic surfaces.
  //      The planted control is pushed through the SAME filter and clustering the page goes
  //      through — that is the only way the assertion can prove the census is not blind — and
  //      is dropped again before the page's own accent is chosen.
  const viewportArea = window.innerWidth * window.innerHeight
  const accentCandidate = o => !!(o.bg && o.bg.a > 0.5 && chromaOf(o.bg) > 0.22 && o.area > 200
    && !(o.w > window.innerWidth * 0.9 && o.h > window.innerHeight * 0.6))
  const ctlElB = document.getElementById('__uiScoreCtlB')
  let ctlCand = null
  if (ctlElB) {
    const cb = ctlElB.getBoundingClientRect()
    const cand = { bg: parseColor(getComputedStyle(ctlElB).backgroundColor), area: cb.width * cb.height,
      w: cb.width, h: cb.height, txt: '', cls: '', tag: 'div', ctl: true }
    if (accentCandidate(cand)) ctlCand = cand
  }
  const accentCand = el.filter(accentCandidate).concat(ctlCand ? [ctlCand] : [])
  const clusters = []
  for (const o of accentCand) {
    let cl = clusters.find(c => chanDist(c.color, o.bg) < 0.08)
    if (!cl) { cl = { color: o.bg, area: 0, ev: [], hue: hueOf(o.bg), chroma: chromaOf(o.bg), ctl: !!o.ctl }; clusters.push(cl) }
    if (o.ctl) cl.ctl = true
    cl.area += Math.min(o.area, viewportArea)
    if (cl.ev.length < 4) cl.ev.push(o.ctl ? '#__uiScoreCtlB' : o.tag + (o.cls ? '.' + o.cls.split(/\s+/)[0] : ''))
  }
  clusters.sort((a, b) => b.area - a.area)
  // a profit/loss PAIR is quarantined only when both halves actually exist on the page
  const reddish = clusters.filter(c => !c.ctl && (c.hue < 25 || c.hue > 340) && c.chroma > 0.4)
  const greenish = clusters.filter(c => !c.ctl && c.hue > 90 && c.hue < 175 && c.chroma > 0.4)
  const directionPair = reddish.length > 0 && greenish.length > 0
  if (directionPair) for (const c of [...reddish, ...greenish]) c.direction = true
  const real = clusters.filter(c => !c.direction && !c.ctl && c.area > viewportArea * 0.0005)
  const accent = real[0] || null
  const accentBudget = accent ? Math.min(1, accent.area / viewportArea) : 0

  // ---- contrast, measured over every text pair
  // 1.2rem catches a serif face's high shoulder on a descender-free margin, which the original
  // 0.75rem factor read as "opaque ink" on a page at 3.6:1.
  const TRANSPARENT = /^(transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|none)$/i
  const effectiveBg = o => (o.bg && o.bg.a > 0.01) ? o.bgEff : null
  const textEls = el.filter(o => o.txt.length > 1 && o.size < 200)
  const contrasts = [], transparentText = [], disabledPairs = []
  for (const o of textEls) {
    // color: transparent (a gradient-clipped heading) has no measurable contrast — the instrument
    // cannot read it, so it must not report a number for it. Counting it as black produced a 1:1
    // "worst pair" on the slop fixture: a real page defect described by a number that is wrong.
    // The gradient-text tell carries that failure instead, and these are counted separately.
    if (!o.fg || TRANSPARENT.test(String(o.fgRaw || ''))) { transparentText.push({ tag: o.tag, cls: o.cls, txt: o.txt.slice(0, 44) }); continue }
    // Measured against the surface the text sits on, not the element's own fill over the page ground.
    const surf = o.bgSurf || ground
    const fg = over(o.fg, surf)
    const c = { r: ratio(fg, surf), tag: o.tag, cls: o.cls,
      txt: o.txt.slice(0, 44), size: o.size, weight: o.weight, dis: o.dis }
    if (c.r === null || !isFinite(c.r)) continue
    // WCAG exempts inactive controls from the contrast requirement, and this census is the one that
    // decides the score. Counting them made a correctly-styled disabled button LOWER the page's
    // contrast term — punishing the exact behaviour the disabled-states term rewards. They are kept
    // for the record, not scored.
    if (o.dis) { disabledPairs.push(c); continue }
    contrasts.push(c)
  }
  contrasts.sort((a, b) => a.r - b.r)
  // 24px is the WCAG large-text boundary, not 18.66px — the old body filter moved every
  // 19-23px display heading into the 4.5:1 bucket.
  const bodyPairs = contrasts.filter(c => c.size < 24 && !/^(600|700|800|900|bold|bolder)$/.test(c.weight))
  const failAA = bodyPairs.filter(c => c.r < 4.5)
  const failAAA = bodyPairs.filter(c => c.r < 3)

  // ---- geometry for the eyebrow / heading rule (gate 54)
  const geom = textEls.filter(o => o.size <= 40 && !o.clipped).slice(0, 400).map(o => ({
    tag: o.tag, cls: o.cls.slice(0, 40), txt: o.txt.slice(0, 40), size: o.size, weight: o.weight,
    x: Math.round(o.left), y: Math.round(o.top), align: o.align,
  }))

  // ---- tells
  const tells = []
  const addTell = (id, sev, evidence) => tells.push({ id, sev, evidence })
  const displayEl = el.filter(o => o.txt.length > 3).sort((a, b) => b.size - a.size)[0]
  const displayFamily = displayEl ? displayEl.family : (families[0] || '')
  const df = (displayFamily || '').toLowerCase()
  const slopFace = SLOP_FONTS.some(f => df === f || df.startsWith(f))
  if (slopFace) addTell('slop-display-font', 'critical', 'display face is ' + (displayFamily || 'unset'))
  if (families.length === 1) addTell('one-font-page', 'major', 'one family for the whole page: ' + families[0])
  if (source.gradientText) addTell('gradient-text', 'critical', 'background-clip: text in the CSS')
  if (el.some(o => o.area > window.innerWidth * window.innerHeight * 0.3 && /gradient/.test(o.bgImage)))
    addTell('gradient-hero', 'critical', 'a gradient covers a surface larger than 30% of the viewport')
  if (source.gradientAnywhere && !el.some(o => /gradient/.test(o.bgImage)))
    addTell('gradient-in-declaration-only', 'minor', 'a gradient is declared but not rendered')
  if (ground.r < 6 && ground.g < 6 && ground.b < 6) addTell('pure-black-base', 'critical', 'body background is ' + ground.r + ',' + ground.g + ',' + ground.b)
  if (ground.r > 250 && ground.g > 250 && ground.b > 250) addTell('pure-white-base', 'major', 'body background is #fff — tint it')
  if (groundChroma === 0 && ground.r <= 250) addTell('zero-chroma-ground', 'major', 'the ground carries no hue — tint the neutrals')
  const equalGrids = el.filter(o => {
    const m = (o.cols || '').match(/(\d+(?:\.\d+)?)px/g)
    if (!m || m.length !== 3) return false
    const v = m.map(parseFloat)
    return Math.max(...v) - Math.min(...v) < 2
  })
  if (equalGrids.length) addTell('three-equal-columns', 'critical', equalGrids.length + ' three-equal-column grid(s)')
  if (el.some(o => o.stripe)) addTell('side-stripe-card', 'critical', 'a thick one-edge border on a card')
  const bordered = el.filter(o => o.bw > 0 && o.area > 4000 && o.radius > 4)
  // Nested means contained on BOTH axes. The horizontal-only test flagged stacked siblings (buttons under a
  // textarea, two empty-state boxes) as "nested" because they share a horizontal extent (2026-09-30).
  const nested = bordered.filter(o => bordered.some(p => p !== o && p.area > o.area * 1.6
    && p.left <= o.left + 2 && p.right >= o.right - 2
    && p.top <= o.top + 2 && p.bottom >= o.bottom - 2))
  if (nested.length) addTell('card-in-card', 'critical', nested.length + ' bordered box(es) nested inside a bordered box')
  const foldH = window.innerHeight
  const inFold = el.filter(o => o.top < foldH && o.bottom > 0 && o.area > 0)
  const heroTexts = inFold.filter(o => o.txt.length > 2 && o.size >= 14).sort((a, b) => a.top - b.top).slice(0, 6)
  const centred = heroTexts.filter(o => o.align === 'center' || Math.abs((o.left + o.right) / 2 - window.innerWidth / 2) < window.innerWidth * 0.06)
  if (heroTexts.length >= 3 && centred.length >= 3)
    addTell('centred-everything-hero', 'critical', centred.length + ' of ' + heroTexts.length + ' fold text blocks sit on the centre axis')
  // the first section-like block on the page is the hero
  const nav = document.querySelector('header, nav')
  const heroEl = sections[0] && sections[0].top < foldH * 0.5 ? sections[0] : null
  const fc = nav ? nav.getBoundingClientRect().bottom : 0
  // the fold is measured from the nav's own bottom edge, per gates 42-45: on a sticky-nav build a
  // hero that merely fills the viewport puts its CTA under the bar. Measured now instead of deferred.
  if (heroEl && !SCROLLED) {
    const foldB = fc + foldH
    const overflowPx = Math.round(Math.max(0, heroEl.bottom - foldB))
    if (overflowPx > 140) addTell('hero-overflows-fold', 'major', 'the hero runs ' + overflowPx + 'px past the fold (hero ends ' + Math.round(heroEl.bottom) + ', fold ends ' + Math.round(foldB) + ')')
  }
  if (nav && !isCtl(nav) && !SCROLLED) {
    const nr = nav.getBoundingClientRect()
    const links = nav.querySelectorAll('a').length
    const sticky = ['sticky', 'fixed'].includes(getComputedStyle(nav).position)
    if (sticky && links >= 4 && links <= 6 && nr.width >= window.innerWidth * 0.98 && nr.top < 8)
      addTell('ai-nav', 'critical', 'sticky full-width nav with ' + links + ' inline links')
  }
  const footer = document.querySelector('footer')
  if (footer && !isCtl(footer)) {
    const uls = footer.querySelectorAll('ul').length
    const li = footer.querySelectorAll('li').length
    if (uls >= 3 && li >= 12 && footer.textContent.length < 1400)
      addTell('ai-footer', 'critical', uls + ' link columns and ' + li + ' items in the footer')
  }
  const statRe = /\d+(?:[.,]\d+)?\s*(?:[×x%]|M\+|k\+|B\+|\+)/
  const stats = el.filter(o => o.txt.length < 26 && o.size >= 28 && statRe.test(o.txt))
  const placeholders = el.filter(o => /(to confirm|to be confirmed|tbc|placeholder|metric pending)/i.test(o.txt))
  if (stats.length) addTell('invented-metric', 'critical', stats.length + ' oversized stat(s): ' + stats.slice(0, 3).map(s => s.txt).join(' | '))
  if (placeholders.length) addTell('honest-metric-placeholder', 'good', placeholders.length + ' stat slot(s) hold a labelled placeholder instead of a number')
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2B00}-\u{2BFF}]/u
  const emojis = el.filter(o => o.txt.length < 8 && emojiRe.test(o.txt))
  if (emojis.length) addTell('emoji-feature-icon', 'major', emojis.length + ' emoji element(s): ' + emojis.slice(0, 4).map(e => e.txt).join(' '))
  // ---- template chrome (frontend-design's fifth default cluster). Each is fine once, on purpose; the
  //      tell is the habit, so every check counts repeats and none is an auto-fail.
  const capsLabels = el.filter(o => o.txt && o.txt.length >= 3 && o.txt.length < 40 && o.size <= 15 && o.tt === 'uppercase' && o.ls >= o.size * 0.06)
  if (capsLabels.length >= 3) addTell('allcaps-eyebrows', 'major', capsLabels.length + ' tracked ALL-CAPS label(s): ' + capsLabels.slice(0, 3).map(o => o.txt).join(' | '))
  const middots = el.filter(o => o.txt && (o.txt.match(/\s\u00b7\s/g) || []).length >= 1 && o.txt.length < 90)
  if (middots.length >= 3) addTell('middot-meta-strings', 'minor', middots.length + ' "A \u00b7 B" meta string(s): ' + middots.slice(0, 2).map(o => o.txt).join(' | '))
  const arrows = stateChannels.filter(c => /[\u2192\u2197\u203a\u00bb]\s*$/.test(c.txt || ''))
  if (arrows.length >= 2) addTell('arrow-suffix-cta', 'minor', arrows.length + ' control label(s) end in an arrow: ' + arrows.slice(0, 3).map(c => c.txt).join(' | '))
  const numbered = el.filter(o => /^0[1-9][.)]?$/.test(o.txt))
  if (numbered.length >= 3) addTell('numbered-markers', 'minor', numbered.length + ' 01/02/03 marker(s): keep them only if the content is a real sequence')
  const monoRe = /mono|courier|consolas|menlo|code/i
  const monoLabels = el.filter(o => o.txt && o.txt.length >= 2 && o.size <= 13 && monoRe.test(o.family))
  if (monoLabels.length >= 4 && !monoRe.test(displayFamily || '')) addTell('mono-label-chrome', 'minor', monoLabels.length + ' small monospace label(s) on a non-mono page')
  // a heading that paints one word or phrase differently from the rest (colour, italic or gradient)
  let accentHeads = 0, accentEg = ''
  for (const h of A(document.querySelectorAll('h1, h2'))) {
    if (isCtl(h)) continue
    const hcs = getComputedStyle(h), hfg = parseColor(hcs.color)
    const words = (h.textContent || '').trim().split(/\s+/).filter(Boolean).length
    for (const c of A(h.querySelectorAll('em, i, strong, b, span, mark'))) {
      const t = (c.textContent || '').trim()
      const n = t.split(/\s+/).filter(Boolean).length
      if (!t || n > 3 || n * 2 > words) continue
      const ccs = getComputedStyle(c), cfg = parseColor(ccs.color)
      const recolored = cfg && hfg && chanDist(cfg, hfg) > 0.08
      const italic = ccs.fontStyle === 'italic' && hcs.fontStyle !== 'italic'
      const clipped = /text/.test(ccs.webkitBackgroundClip || ccs.backgroundClip || '')
      if (recolored || italic || clipped) { accentHeads++; accentEg = accentEg || (h.textContent || '').trim().slice(0, 60); break }
    }
  }
  if (accentHeads) addTell('one-word-accent-headline', 'major', accentHeads + ' heading(s) accent a single word or phrase: "' + accentEg + '"')
  // the two default palettes (frontend-design clusters 1 and 2), measured on the rendered ground + accent
  const creamGround = ground.r >= 236 && ground.g >= 228 && ground.b >= 212 && ground.r - ground.b >= 8 && ground.r - ground.b <= 40
  if (creamGround && accent && accent.hue >= 8 && accent.hue <= 36 && accent.chroma > 0.35)
    addTell('cream-clay-default', 'major', 'cream ground with a terracotta/clay accent (hue ' + Math.round(accent.hue) + ') is the default warm look')
  const nearBlack = Math.max(ground.r, ground.g, ground.b) <= 26
  if (nearBlack && accent && accent.chroma > 0.6 && ((accent.hue >= 60 && accent.hue <= 150) || accent.hue <= 20 || accent.hue >= 345))
    addTell('acid-on-black', 'major', 'near-black ground with one acid/vermilion accent (hue ' + Math.round(accent.hue) + ') is the default dark look')
  if (source.transitionAll) addTell('transition-all', 'major', 'transition: all in the CSS')
  if (source.hoverScale) addTell('universal-hover-scale', 'major', 'a hover scale on unrelated elements')
  if (source.bouncyEasing) addTell('bouncy-easing', 'major', 'an overshoot cubic-bezier on UI state')
  if (source.animatesLayout) addTell('animates-layout-property', 'major', 'width/height/margin in a transition')
  if (source.transitionOnOutline) addTell('focus-ring-transitions-in', 'major', 'outline is transitioned')
  const multi = stateChannels.filter(s => (s.hoverKinds || 0) >= 3).length
  if (stateChannels.length && multi / stateChannels.length > 0.5) addTell('multiple-hover-effects', 'major', multi + '/' + stateChannels.length + ' controls fire 3+ effect groups in one :hover rule')
  const noHover = stateChannels.filter(s => !s.hover).length
  if (stateChannels.length && noHover / stateChannels.length > 0.4) addTell('missing-hover-state', 'minor', noHover + '/' + stateChannels.length + ' controls have no hover styling')
  const noFocus = stateChannels.filter(s => !s.focus).length
  // only a failure when NEITHER channel exists: :focus-visible is the modern correct answer and this
  // probe's :focus-rule census cannot see it.
  if (stateChannels.length && noFocus / stateChannels.length > 0.3 && !source.focusVisible)
    addTell('missing-focus-state', 'major', noFocus + '/' + stateChannels.length + ' controls have no :focus rule and the CSS has no :focus-visible either')
  if (source.radiusPill && radii.length <= 2) addTell('radius-collapsed', 'minor', 'every radius has collapsed to a pill')
  if (!source.reducedMotion) addTell('no-reduced-motion', 'major', 'no prefers-reduced-motion block')
  if (!source.overflowXClip) addTell('no-overflow-clip', 'minor', 'no overflow-x: clip on html/body')
  if (!source.textWrap) addTell('no-text-wrap', 'minor', 'no text-wrap: pretty|balance anywhere')
  if (!source.tabularNums) addTell('no-tabular-nums', 'minor', 'numbers are not tabular')
  if (!source.macrostructure) addTell('no-macrostructure-stamp', 'major', 'no macrostructure stamp — this build cannot be de-duplicated against the last one')
  if (source.iconLibs.length > 1) addTell('mixed-icon-libs', 'major', source.iconLibs.join(' + '))
  if (!title) addTell('no-title', 'major', 'the document has no title')
  if (!lang) addTell('no-lang', 'minor', '<html> has no lang attribute')
  if (source.svgCount > 14) addTell('svg-sprawl', 'minor', source.svgCount + ' inline SVGs')
  const imgs = A(document.querySelectorAll('img'))
  const foldImgs = SCROLLED ? [] : imgs.filter(i => i.getBoundingClientRect().top < foldH && i.getBoundingClientRect().bottom > -40)
  const lazyFold = foldImgs.filter(i => (i.getAttribute('loading') || '') === 'lazy')
  if (lazyFold.length) addTell('lcp-lazy-loaded', 'critical', lazyFold.length + ' above-fold image(s) with loading="lazy"')
  const held = SCROLLED ? [] : el.filter(o => o.opacity < 0.05 && o.top < foldH * 1.2 && o.bottom > 0 && o.area > 2500)
  if (held.length) addTell('content-held-invisible', 'major', held.length + ' block(s) at opacity<0.05 inside the first viewport')
  if (accent && GENERIC_HUES.some(h => Math.abs(((accent.hue - h + 540) % 360) - 180) < 22) && accent.chroma > 0.3)
    addTell('default-tech-hue-accent', 'critical', 'the accent hue ' + Math.round(accent.hue) + ' is the indigo/violet default')
  if (real.length >= 3) addTell('multiple-accents', 'major', real.length + ' chromatic accents: ' + real.slice(0, 4).map(c => c.ev[0]).join(', '))
  // token NAMES are a naming convention, not a measurement. An on-accent ink (--accent-ink) is the
  // text colour that sits on the accent, not a second accent, so counting it reported a false second
  // accent on every correct build. Only count tokens whose tail is a saturated surface/accent word.
  const accentTokens = Object.keys(tokenColors).filter(k => /(accent|brand|primary)(-\d+)?$/i.test(k))
  if (accentTokens.length >= 2) addTell('two-accent-tokens', 'minor', 'accent tokens declared: ' + accentTokens.join(', '))
  const greyTokens = Object.entries(tokenColors).filter(([, v]) => { const c = parseColor(v); return c && chromaOf(c) === 0 })
  if (greyTokens.length > 2) addTell('untinted-neutral-tokens', 'major', greyTokens.length + ' zero-chroma tokens: ' + greyTokens.slice(0, 3).map(g => g[0]).join(', '))
  if (failAAA.length) addTell('contrast-fail-3', 'critical', failAAA.length + ' text pair(s) below 3:1 — worst ' + failAAA[0].r.toFixed(2) + ':1')
  else if (failAA.length) addTell('contrast-fail-4.5', 'major', failAA.length + ' body pair(s) below 4.5:1 — worst ' + failAA[0].r.toFixed(2) + ':1')
  if (twinSame > 0) addTell('sibling-same-colour', 'critical', twinSame + ' control(s) are painted the same colour as the surface they sit on'
    + (twinWorst ? ' — e.g. ' + twinWorst : '') + ' (of ' + twinPairs + ' control/surface pair(s))')

  // ---- the planted controls
  const ctl = {}
  const a = document.getElementById('__uiScoreCtlA')
  const b = document.getElementById('__uiScoreCtlB')
  if (a) {
    const cs = getComputedStyle(a)
    ctl.contrast = ratio(parseColor(cs.color), parseColor(cs.backgroundColor))
    ctl.family = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim()
  }
  if (b) {
    const cs = getComputedStyle(b)
    const c = parseColor(cs.backgroundColor)
    const r = b.getBoundingClientRect()
    const found = clusters.find(cl => chanDist(cl.color, c) < 0.05)
    ctl.accent = { plantedPx: Math.round(r.width * r.height), foundPx: found ? Math.round(found.area) : 0, clusters: clusters.length, candidateAccepted: !!ctlCand }
  }

  return {
    url: location.href, title, lang,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    scrolledAtProbe: SCROLLED, scrollY: Math.round(window.scrollY),
    ground, groundChroma,
    families, weights, radii, displayFamily,
    bodyFamily: (getComputedStyle(body).fontFamily || '').split(',')[0].replace(/["']/g, '').trim(),
    tokenColors, tokenFamilies, accentTokens,
    interactiveCount: interactive.length, stateChannels, focusRings, focusRulesMirrored, focusAttempts, disableable,
    contrasts: contrasts.slice(0, 40), textCount: contrasts.length, transparentText: transparentText.slice(0, 6),
    disabledTextPairs: disabledPairs.map(c => ({ r: Math.round(c.r * 100) / 100, txt: c.txt })).slice(0, 6),
    passAA: contrasts.filter(c => c.r >= 4.5).length, failAA: failAA.length, failAAA: failAAA.length,
    accent: accent ? { color: accent.color, hue: accent.hue, chroma: accent.chroma, area: Math.round(accent.area), ev: accent.ev } : null,
    accents: real.map(c => ({ color: c.color, hue: c.hue, chroma: c.chroma, area: Math.round(c.area), ev: c.ev })),
    accentBudget, directionPair,
    tells, sections, geom, source,
    twins: { pairs: twinPairs, same: twinSame },
    control: ctl,
    elementCount: el.length,
  }
})()`

// ─── source scan: what only the filesystem knows ─────────────────────────────────
function sourceScan(targetPath) {
  const out = { files: [], guards: {}, counters: {}, baseline: {}, note: null }
  const abs = resolve(targetPath)
  const root = /\.html?$/.test(abs) ? dirname(abs) : abs
  const exts = ['.html', '.htm', '.css', '.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte']
  const skip = /(node_modules|\.next|dist|build|\.git|coverage|\.output)/
  const walk = (dir, depth) => {
    if (depth > 6 || out.files.length > 700) return
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (skip.test(p)) continue
      if (e.isDirectory()) walk(p, depth + 1)
      else if (exts.some(x => e.name.endsWith(x))) out.files.push(p)
    }
  }
  walk(root, 0)
  out.fileCount = out.files.length
  if (out.fileCount === 0 || out.fileCount > 700) {
    // an unmeasurable source tree must be visibly unavailable, never silently zero
    out.note = 'source tree not measurable (' + out.fileCount + ' files) — source terms report unknown'
    return out
  }
  let blob = ''
  const tokenBlob = [], otherBlob = []
  for (const f of out.files) {
    let text = ''
    try { text = readFileSync(f, 'utf8') } catch {}
    blob += text + '\n'
    // the discipline question is whether LITERALS leak into files that should address a token, not
    // whether a tokens file contains literals — a token file's whole job is to hold them.
    if (/(^|[\\/])tokens?\.(css|ts|js|json)$/i.test(f) || /design-tokens/i.test(f)) tokenBlob.push(text)
    else otherBlob.push(text)
  }
  const tokensBlob = tokenBlob.join('\n'), restBlob = otherBlob.join('\n')
  const count = re => (blob.match(re) || []).length
  out.counters = {
    hardcodedColors: count(/#[0-9a-f]{3,8}\b/gi),
    cssVarUses: count(/var\(--/g),
    cssVarDecls: count(/^\s*--[\w-]+\s*:/gm),
    fontFamilyDecls: count(/font-family\s*:/gi),
    reducedMotion: count(/prefers-reduced-motion/g),
    focusVisible: count(/:focus-visible/g),
    ariaLabels: count(/aria-label=/g),
    imgTags: count(/<img\b/g),
    altAttrs: count(/\balt=/g),
    tabularNums: count(/tabular-nums/g),
    loadingLazy: count(/loading=["']lazy["']/g),
    clickableDivs: count(/<div[^>]*onClick/g),
    macrostructureStamps: count(/macrostructure:\s*/gi),
    placeholderCopy: count(/lorem ipsum|placeholder text|todo:|tbd/gi),
  }
  out.guards = {
    prefersReducedMotion: out.counters.reducedMotion > 0,
    focusVisibleStyling: out.counters.focusVisible > 0,
    hasTokensFile: out.files.some(f => /tokens?\.(css|ts|js|json)$/i.test(f)),
    hasDesignMd: out.files.some(f => /design\.md$/i.test(f)),
    hasScoreLoopLog: out.files.some(f => /SCORE-LOOP\.md$/i.test(f)),
  }
  out.fontFamiliesDeclared = [...new Set((blob.match(/font-family\s*:\s*([^;}\n]+)/gi) || [])
    .map(m => m.split(':')[1].trim().split(',')[0].replace(/["';]/g, '').trim()))].slice(0, 12)
  out.baseline = {
    files: out.fileCount,
    filesOutsideTokens: otherBlob.length,
    hexesOutsideTokens: (restBlob.match(/#[0-9a-f]{3,8}\b/gi) || []).length,
    hexesInTokens: (tokensBlob.match(/#[0-9a-f]{3,8}\b/gi) || []).length,
    hardcodedHexPerFile: +(out.counters.hardcodedColors / Math.max(1, out.fileCount)).toFixed(2),
    cssVarUsesPerFile: +(out.counters.cssVarUses / Math.max(1, out.fileCount)).toFixed(2),
  }
  return out
}

// ─── scoring ─────────────────────────────────────────────────────────────────────
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const on = (n, lo, hi) => clamp((n - lo) / (hi - lo), 0, 1)
const off = (n, good, bad) => 1 - clamp((n - good) / (bad - good), 0, 1)
const R = n => Math.round(n * 100) / 100

// gate 54: an eyebrow may stack above its heading in the same column, never sit beside it
function eyebrowGeometry(geom) {
  // Gate 54 fails on an eyebrow BESIDE its heading. Absence passes, because the gate's default
  // is eyebrow-off \u2014 so an empty result is the passing state, not a free point. Say which one
  // happened: a pass-by-absence reported as a measurement is a number answering a neighbouring question.
  if (!geom || geom.length < 2) return { got: 4, prov: 'measured', detail: 'gate 54 vacuous \u2014 no text to pair (eyebrow default is off)' }
  const headings = geom.filter(g => g.size >= 24)
  let beside = 0, stacked = 0
  for (const h of headings) {
    const near = geom.filter(g => g !== h && g.size <= 14
      && /^[\s\u00b7\u2014\u2013\-0-9A-Z/|.]+$/.test(g.txt)
      && Math.abs(g.y - h.y) < h.size * 1.6)
    for (const g of near) {
      if (Math.abs(g.x - h.x) < 24) stacked++
      else beside++
    }
  }
  if (beside > 0) return { got: 0, prov: 'measured', detail: beside + ' eyebrow(s) sit beside their heading instead of stacked above it' }
  if (stacked > 0) return { got: 4, prov: 'measured', detail: stacked + ' eyebrow(s) stack above the heading in the same column' }
  return { got: 4, prov: 'measured', detail: 'no eyebrow beside any heading \u2014 passes by absence (gate 54 default is eyebrow-off)' }
}

function scorePage(m, src) {
  const parts = []
  const P = (key, cap, got, prov, detail) => parts.push({ key, cap, got: R(clamp(got, 0, cap)), prov, detail })

  const worst = m.contrasts.length ? m.contrasts[0] : null
  const aaRatio = m.textCount ? m.passAA / m.textCount : 0
  P('textContrast', 20, 20 * (0.6 * aaRatio + 0.4 * (worst ? on(worst.r, 3, 7) : 0)), 'measured',
    worst ? 'worst ' + R(worst.r) + ':1 · ' + m.passAA + '/' + m.textCount + ' pairs at AA' + (m.failAAA ? ' · ' + m.failAAA + ' below 3:1' : '') : 'no text pair measured')

   const rings = m.focusRings.filter(r => r.w >= 2 && r.style !== 'none')
  // Denominator is the controls the probe actually focused, not every interactive node on the page: a
  // disabled control cannot receive focus and must not count as a ring that failed to appear.
  const focusable = m.focusAttempts == null ? m.interactiveCount : m.focusAttempts
  const ringVisible = focusable ? Math.min(1, rings.length / Math.min(40, focusable)) : 1
  const ringOk = rings.length ? rings.filter(r => r.contrast === null || r.contrast >= 3).length / rings.length : 1
  P('focusRing', 8, 8 * ringVisible * ringOk, 'measured',
    rings.length + ' control(s) draw a ring ≥2px · ' + Math.round(ringOk * 100) + '% of those clear 3:1'
    + (m.focusRulesMirrored ? ' · ' + m.focusRulesMirrored + ' focus rule(s) mirrored to make :focus-visible measurable' : ''))

  const three = m.stateChannels.filter(s => s.disabledChannels >= 3).length
  // Denominator is the controls that CAN be disabled. Dividing by every interactive node scored a page
  // on whether its nav links had disabled styling, which they cannot have.
  const disableable = m.disableable == null ? m.stateChannels.length : m.disableable
  P('disabledStates', 5, disableable ? 5 * (three / disableable) : 3, 'measured',
    three + '/' + disableable + ' disableable control(s) express disabled in 3+ channels')

  const b = m.accentBudget
  const noHue = !m.accent && m.accents.length === 0
  P('accentBudget', 10, noHue ? 3 : 10 * off(b, 0.05, 0.3), 'measured',
    m.accent ? (b * 100).toFixed(1) + '% of the viewport carries the accent (target <5%)' : 'no chromatic accent surface found — colour is not doing any work')

  //   accentCount  — how many accent SURFACES the page renders (a colour question, measured)
  //   twoAccentTokens — how many accent TOKENS it declares (a naming question, source-read).
  // Only the measured one carries weight; the source tier holds one 4/4 term (tokenDiscipline).
  P('accentCount', 4, m.accents.length === 1 ? 4 : m.accents.length === 0 ? 2 : m.accents.length === 2 ? 1 : 0, 'measured',
    m.accents.length + ' chromatic accent surface(s) above the 0.05% area floor')

  const nf = m.families.length
  P('typeFamilies', 5, nf <= 3 ? 5 : nf === 4 ? 2 : 0, 'measured', nf + ' families: ' + (m.families.slice(0, 4).join(', ') || 'none'))

  const df = (m.displayFamily || '').toLowerCase()
  const isSlopFace = ['inter','roboto','open sans','poppins','lato','system-ui','-apple-system','arial','helvetica','segoe ui'].some(f => df === f || df.startsWith(f))
  P('displayFace', 8, isSlopFace ? 0 : nf === 1 ? 3 : 8, 'measured',
    'display face "' + (m.displayFamily || 'none') + '"' + (isSlopFace ? ' is a default/slop face' : nf === 1 ? ' — but the page has only one family' : ''))

  const eb = eyebrowGeometry(m.geom)
  P('eyebrowGeometry', 4, eb.got, eb.prov, eb.detail)

  const badStat = m.tells.find(t => t.id === 'invented-metric')
  const goodStat = m.tells.find(t => t.id === 'honest-metric-placeholder')
  P('honestMetrics', 6, badStat ? 0 : goodStat ? 6 : 5, 'measured',
    badStat ? badStat.evidence : goodStat ? goodStat.evidence + ' — the honest state is present' : 'no oversized stat block either way')

  const lazyFold = m.tells.find(t => t.id === 'lcp-lazy-loaded')
  P('lcpNotLazy', 4, lazyFold ? 0 : 4, 'measured', lazyFold ? lazyFold.evidence : 'no above-fold image is lazy-loaded')

  const emoji = m.tells.find(t => t.id === 'emoji-feature-icon')
  P('noEmojiIcons', 3, emoji ? 0 : 3, 'measured', emoji ? emoji.evidence : 'no emoji used as an icon')

  const mv = m.tells.find(t => t.id === 'content-held-invisible')
  P('contentVisible', 5, mv ? 2.5 : 5, 'measured', mv ? mv.evidence : 'nothing sits at opacity<0.05 in the first viewport')

  const failVp = Object.entries(m.overflow || {}).filter(([, v]) => v && v.scrollW > v.clientW + 1)
  P('horizontalOverflow', 6, 6 - 2 * failVp.length, 'measured',
    failVp.length ? 'overflow at ' + failVp.map(([k, v]) => k + ' (' + v.scrollW + '>' + v.clientW + ')').join(', ') : 'clean at every viewport')

  const gaps = []
  for (let i = 1; i < m.sections.length; i++) gaps.push(Math.max(0, m.sections[i].top - m.sections[i - 1].bottom))
  const spread = gaps.length > 2
    ? (Math.max(...gaps) - Math.min(...gaps)) / Math.max(1, gaps.reduce((a, x) => a + x, 0) / gaps.length) : 0
  P('sectionRhythm', 4, gaps.length > 2 ? 4 * on(spread, 0.15, 0.7) : 2, 'measured',
    gaps.length > 2 ? 'gap spread ' + R(spread) + ' across ' + m.sections.length + ' sections (uniform whitespace = templated)' : 'too few sections to judge rhythm')

  P('macrostructureStamp', 3, m.source.macrostructure ? 3 : 0, 'measured',
    m.source.macrostructure ? '"' + m.source.macrostructure + '"' : 'no macrostructure stamp — this build cannot be de-duplicated against the last one')

  const s = src && src.fileCount ? src : null
  P('tokenDiscipline', 8, s ? (() => {
    if (!s.guards.hasTokensFile) return 2   // a single-file build has no token file; the floor is 2
    const leak = s.baseline.hexesOutsideTokens
    if (leak <= 3) return 8
    if (leak <= 10) return 5
    if (s.counters.cssVarUses > 40 && leak < 30) return 4
    return s.counters.cssVarUses > 0 ? 2 : 0
  })() : 4, s ? 'source-inferred' : 'unknown',
    s ? s.counters.cssVarUses + ' var() uses vs ' + s.baseline.hexesOutsideTokens + ' colour literal(s) OUTSIDE the token file ('
      + s.baseline.hexesInTokens + ' inside it, which is where they belong)' + (s.guards.hasTokensFile ? '' : ' · no tokens file — capped at 2/8')
      : 'no source tree measured')

  P('stateCoverage', 4, s ? (s.guards.prefersReducedMotion ? 2 : 0) + (s.guards.focusVisibleStyling ? 2 : 0) : 2, s ? 'source-inferred' : 'unknown',
    s ? 'reduced-motion ' + s.counters.reducedMotion + '× · :focus-visible ' + s.counters.focusVisible + '× · loading="lazy" ' + s.counters.loadingLazy + '×'
      : 'no source tree measured')

  if (m.fixture && m.fixture.asserted) {
    const a = m.fixture.asserted
    P('fixtureCheckedItems', 3, a.every ? 3 * (a.passed / a.every) : 0, 'fixture-asserted',
      a.passed + '/' + a.every + ' fixture check(s) pass' + (a.failed && a.failed.length ? ' · failing: ' + a.failed.join(', ') : ''))
  }

  const cap = parts.reduce((a, p) => a + p.cap, 0)
  const got = parts.reduce((a, p) => a + p.got, 0)
  return { parts, cap, got: R(got), score: Math.round(100 * got / cap) }
}

// ─── round log + keep-best ───────────────────────────────────────────────────────
const GUARDED = /contrast|focus|disabled|lcp/i

function readRounds(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => /^r\d+.*\.json$/.test(f))
    .map(f => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch { return null } })
    .filter(Boolean)
    .sort((a, b) => a.round - b.round)
}

function keepBest(dir, label) {
  const rounds = readRounds(dir)
  // A round is only KEEPABLE if its controls passed AND it fired no auto-fail tell. A higher total
  // with a critical tell is a regression wearing a better number — keeping it on score alone would
  // hand back a build the gate explicitly rejects.
  const scorable = rounds.filter(d => !d.controlFailed && d.score && d.score.total !== null)
  const valid = scorable.filter(d => !d.autoFail)
  const guardedOf = d => (d.score ? d.score.parts.filter(p => GUARDED.test(p.key)).reduce((a, p) => a + p.got, 0) : 0)
  // A total is not a verdict, and neither is a total's ranking: a round that buys aesthetic points by
  // spending contrast, focus ring, disabled or LCP is refused outright. This is the rule the report
  // below has always claimed; it is enforced here rather than asserted.
  let winner = null
  for (const d of valid) {
    if (!winner) { winner = d; continue }
    if (d.score.total <= winner.score.total) continue
    if (guardedOf(d) < guardedOf(winner)) { d.refused = 'guarded-regression'; continue }
    winner = d
  }
  if (!winner) {
    const why = !scorable.length
      ? 'No round produced a valid score: every round returned CONTROL_FAILED. Fix the harness before re-running.'
      : 'No round is keepable: every scored round fired at least one auto-fail tell. Fix the tells before re-running — a total is not a verdict.'
    writeFileSync(join(dir, 'SCORE-LOOP.md'), '# score loop — keep-best\n\n' + why + '\n')
    return { winner: null, rounds: rounds.length }
  }
  const lines = [
    '# score loop — keep-best' + (label ? ' (' + label + ')' : ''),
    '',
    '| round | score | Δ vs previous | guarded terms | auto-fail tells | verdict |',
    '|---|---|---|---|---|---|',
  ]
  rounds.forEach((d, i) => {
    const prev = i > 0 ? rounds[i - 1] : null
    const delta = prev && prev.score && prev.score.total !== null && d.score && d.score.total !== null && !d.controlFailed
      ? (d.score.total - prev.score.total >= 0 ? '+' : '') + (d.score.total - prev.score.total) : '—'
    const guarded = d.controlFailed ? '—' : R(guardedOf(d)) + '/50'
    lines.push('| ' + d.round + (d.label ? ' (' + d.label + ')' : '') + ' | '
      + (d.controlFailed ? 'CONTROL_FAILED' : d.score.total) + ' | ' + delta + ' | ' + guarded + ' | '
      + (d.autoFail || 0) + ' | ' + (d.verdict || '') + (d.refused ? ' · **refused: ' + d.refused + '**' : '') + ' |')
  })
  const lowestGuardedRound = scorable.reduce((a, d) => (a === null || guardedOf(d) < guardedOf(a) ? d : a), null)
  lines.push('',
    '**Kept: round ' + winner.round + (winner.label ? ' (' + winner.label + ')' : '') + ' at ' + winner.score.total + '/100.**',
    '',
    'The kept visual state is round ' + winner.round + '. A later round is kept only where it raises its own term without lowering a guarded term — contrast · focus ring · disabled · LCP.',
    '',
    'The per-term table is the authority, not the total: a later round that lifted the total while dropping a guarded term is a regression, not a win. Lowest guarded total across all rounds: round '
      + (lowestGuardedRound ? lowestGuardedRound.round + ' at ' + R(guardedOf(lowestGuardedRound)) + '/50' : '—') + '.',
    '',
    'A round that fires an auto-fail tell is never kept, however high its total — a total is not a verdict.',
    '',
    "Each round's artifact is snapshotted beside its JSON as r<N>[-label]/. To compare rounds under a",
    'changed rubric, re-run the instrument against those snapshot directories — never against the',
    'current tree, which is a different page wearing the same round number.',
    '',
    'Rejected rounds on a variant axis may still be right for the artifact — record the reason in the label, never in silence.')
  writeFileSync(join(dir, 'SCORE-LOOP.md'), lines.join('\n') + '\n')
  return { winner, rounds: rounds.length }
}

// ─── main ────────────────────────────────────────────────────────────────────────
const main = async () => {
  const wsUrl = await devtoolsUrl()
  if (!wsUrl) { console.error('ui-score: Chrome did not expose a devtools endpoint'); process.exit(1) }
  const cdp = await connect(wsUrl)

  const { targetInfos } = await cdp.send('Target.getTargets')
  const page = targetInfos.find(t => t.type === 'page')
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true })

  await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Network.enable', {}, sessionId)

  const { w, h } = viewports[0]
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId)
  await cdp.send('Page.navigate', { url }, sessionId)
  await sleep(1200)
  await new Promise(r => {
    const t = setTimeout(r, 9000)
    const iv = setInterval(() => {
      if (cdp.events.some(e => e.method === 'Page.loadEventFired')) { clearInterval(iv); clearTimeout(t); r() }
    }, 150)
  })
  await sleep(400)
  await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      await Promise.all(Array.from(document.images).filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 2500) })))
      if (document.fonts && document.fonts.ready) await document.fonts.ready
      return true
    })()`, awaitPromise: true,
  }, sessionId)

  // Fold-derived terms are only meaningful at the requested viewport, from the top of the page.
  // A page that reports a different height silently turns a hero into a 2000px "overflow" and every
  // section into held-invisible content, so refuse rather than score it.
  await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)', returnByValue: true }, sessionId)
  const vpRes = await cdp.send('Runtime.evaluate', {
    expression: '({ w: window.innerWidth, h: window.innerHeight, y: window.scrollY })', returnByValue: true }, sessionId)
  const vpv = vpRes.result.value
  if (Math.abs(vpv.h - h) > 8 || vpv.y > 4) {
    shutdown()
    console.error('ui-score: the page is not at the requested viewport (asked ' + w + '×' + h + ' at scroll 0, got '
      + vpv.w + '×' + vpv.h + ' at scroll ' + vpv.y + '). Fold-derived terms would be meaningless, so no score was produced.')
    process.exit(1)
  }

  // plant the controls, then read
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      if (document.getElementById('__uiScoreCtlA')) return 'already'
      const st = document.createElement('style')
      st.textContent = [
        '#__uiScoreCtlA{position:fixed;left:0;bottom:0;width:88px;height:56px;background:rgb(248,247,244)!important;color:rgb(246,245,242)!important;font-family:"Probe Sans"!important;font-size:44px;line-height:56px;z-index:2147483647!important;transition:none!important;outline:none!important}',
        '#__uiScoreCtlB{position:fixed;right:0;bottom:0;width:64px;height:64px;background:rgb(245,158,11)!important;z-index:2147483647!important;transition:none!important;outline:none!important}'
      ].join('\\n')
      document.head.appendChild(st)
      const a = document.createElement('div'); a.id = '__uiScoreCtlA'; a.setAttribute('data-__uiscorectl','a'); a.textContent = 'Ctl'
      const b = document.createElement('div'); b.id = '__uiScoreCtlB'; b.setAttribute('data-__uiscorectl','b')
      document.body.append(a, b)
      return 'planted'
    })()`,
  }, sessionId)
  await sleep(120)

  const r = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, sessionId)
  if (r.exceptionDetails) throw new Error('probe threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  const m = r.result.value

  // overflow census — each viewport is its own round item in the loop
  const overflow = {}
  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false }, sessionId)
    await sleep(320)
    const rr = await cdp.send('Runtime.evaluate', {
      expression: `({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
        wide: Array.from(document.querySelectorAll('body *'))
          .filter(n => !n.hasAttribute('data-__uiscorectl') && getComputedStyle(n).position !== 'fixed')
          .filter(n => n.getBoundingClientRect().right > window.innerWidth + 2)
          .slice(0, 6).map(n => n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '')) })`,
      returnByValue: true,
    }, sessionId)
    overflow[vp.label] = rr.result.value
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId)
  m.overflow = overflow
  m.overflowOffenders = [...new Set(Object.values(overflow).flatMap(v => (v && v.wide) || []))].slice(0, 6)

  // fixture sidecar (offline self-check)
  let fixture = null
  if (!isRemote) {
    const abs = resolve(String(target))
    const fp = /\.html?$/.test(abs) ? join(dirname(abs), 'fixture.json') : join(abs, 'fixture.json')
    if (existsSync(fp)) { try { fixture = JSON.parse(readFileSync(fp, 'utf8')) } catch { fixture = null } }
  }

  // ── the control report runs before any score is written
  const ctl = m.control || {}
  const controls = [
    { name: 'contrast sampler reads a planted near-identical pair below 1.5:1', ok: typeof ctl.contrast === 'number' && ctl.contrast < 1.5,
      saw: typeof ctl.contrast === 'number' ? R(ctl.contrast) + ':1' : 'no reading' },
    { name: 'geometry+clustering finds the planted 64×64 accent block', ok: !!(ctl.accent && ctl.accent.plantedPx > 3000 && ctl.accent.foundPx >= 0.9 * ctl.accent.plantedPx && ctl.accent.candidateAccepted),
      saw: ctl.accent ? ctl.accent.foundPx + 'px found of ' + ctl.accent.plantedPx + 'px planted across ' + ctl.accent.clusters + ' cluster(s)'
        + (ctl.accent.plantedPx <= 3000 ? ' — the planted block was CLIPPED, so the assertion would pass vacuously' : '')
        + (ctl.accent.candidateAccepted ? '' : ' — the census filter rejected the planted block outright') : 'no reading' },
    { name: 'font resolver answers with a family', ok: !!(ctl.family && ctl.family.length), saw: ctl.family || 'empty' },
  ]
  const controlFailed = controls.some(c => !c.ok)

  const src = isRemote ? null : sourceScan(String(target))
  m.fixture = fixture
  const sc = scorePage(m, src)

  // published verdict thresholds. A new threshold may only make the gate stricter.
  const AUTOFAIL = ['gradient-text','gradient-hero','pure-black-base','three-equal-columns','side-stripe-card',
    'card-in-card','centred-everything-hero','ai-nav','ai-footer','invented-metric','default-tech-hue-accent',
    'contrast-fail-3','sibling-same-colour','emoji-feature-icon','slop-display-font','lcp-lazy-loaded']
  const fired = m.tells.filter(t => t.sev !== 'good')
  const hardFail = fired.filter(t => t.sev === 'critical' && AUTOFAIL.includes(t.id))
  const verdict = hardFail.length ? 'ships as slop — ' + hardFail.length + ' auto-fail tell(s)'
    : sc.score >= 85 ? 'passes the gate'
    : sc.score >= 70 ? 'close — fix the majors'
    : 'reads as AI-generated'

  const record = {
    round, label, url: m.url, title: m.title, scoredAt: new Date().toISOString(),
    controlFailed, controls,
    score: { total: controlFailed ? null : sc.score, got: sc.got, cap: sc.cap, parts: sc.parts },
    autoFail: controlFailed ? null : hardFail.length,
    autoFailTells: controlFailed ? [] : hardFail.map(t => t.id),
    verdict: controlFailed ? 'CONTROL_FAILED — score withheld' : verdict,
    tells: fired, good: m.tells.filter(t => t.sev === 'good'),
    accent: m.accent ? { color: m.accent.color, hue: R(m.accent.hue), chroma: R(m.accent.chroma), area: Math.round(m.accent.area) } : null,
    accentBudget: R(m.accentBudget), accents: m.accents, directionPair: m.directionPair,
    ground: m.ground, groundChroma: R(m.groundChroma),
    fonts: { families: m.families, display: m.displayFamily, body: m.bodyFamily, weights: m.weights },
    contrasts: { worst: m.contrasts[0] || null, failing: m.contrasts.filter(c => c.r < 4.5).slice(0, 8),
      failAA: m.failAA, failAAA: m.failAAA, textPairs: m.textCount, passAA: m.passAA,
      unmeasurableTransparent: m.transparentText || [],
      exemptInactive: m.disabledTextPairs || [] },
    interactive: m.interactiveCount, focusable: m.focusAttempts, disableable: m.disableable,
    focusRulesMirrored: m.focusRulesMirrored,
    focusRings: m.focusRings.slice(0, 12),
    overflow, overflowOffenders: m.overflowOffenders,
    sections: m.sections.length, elements: m.elementCount,
    source: src, fixture: fixture ? { asserted: fixture.asserted || null } : null,
    rubric: { version: 1, caps: Object.fromEntries(sc.parts.map(p => [p.key, p.cap])) },
  }

  mkdirSync(outDir, { recursive: true })
  const name = 'r' + round + (label ? '-' + label.replace(/[^\w-]/g, '') : '') + '.json'

  // Each round's artifact is copied aside before the next mutation overwrites it. Without this the
  // loop is not reproducible: re-scoring a changed rubric against the current tree returns a fresh
  // number for a DIFFERENT page, and the size of the edit quietly lands inside the delta you are
  // reading. Skipped for remote targets and when the snapshot would nest inside the target.
  let snapshot = null
  if (!isRemote && !argv.includes('--no-snapshot')) {
    const snapDir = join(outDir, name.replace(/\.json$/, ''))
    const tgt = resolve(String(target))
    if (!snapDir.startsWith(tgt + sep) && !tgt.startsWith(snapDir + sep)) {
      const file = /\.html?$/.test(tgt) ? tgt : join(tgt, 'index.html')
      const isSingleFile = /\.html?$/.test(tgt)
      if (isSingleFile) { mkdirSync(snapDir, { recursive: true }); cpSync(file, join(snapDir, 'index.html')) }
      else cpSync(tgt, snapDir, { recursive: true })
      snapshot = snapDir
    }
  }
  record.snapshot = snapshot

  writeFileSync(join(outDir, name), JSON.stringify(record, null, 2))

  const C = { r: '\x1b[0m', d: '\x1b[2m', b: '\x1b[1m', red: '\x1b[31m', yel: '\x1b[33m', grn: '\x1b[32m' }
  console.log('\n' + C.b + 'ui-score · round ' + round + (label ? ' (' + label + ')' : '') + C.r + '  ' + m.url)
  console.log(C.d + (m.title || '(no title)') + ' · ' + m.elementCount + ' elements · ' + m.textCount + ' text pairs · ' + m.interactiveCount + ' controls' + C.r)
  for (const c of controls) console.log('  ' + (c.ok ? C.grn + '✓' : C.red + '✗') + C.r + ' control: ' + c.name + ' ' + C.d + '→ ' + c.saw + C.r)

  if (controlFailed) {
    console.log('\n' + C.red + C.b + 'CONTROL_FAILED' + C.r + ' — a detector is blind. The score is withheld: an empty scan and a broken scanner look identical from inside.\n')
  } else {
    console.log('\n' + C.b + 'SCORE ' + sc.score + '/100' + C.r + '  ' + C.d + '(' + sc.got + '/' + sc.cap + ') · ' + verdict + C.r)
    for (const p of sc.parts) {
      const fill = Math.round(8 * p.got / p.cap)
      console.log('  ' + '█'.repeat(fill) + '·'.repeat(8 - fill) + ' ' + String(p.got).padStart(5) + '/' + String(p.cap).padEnd(3) + ' '
        + p.key.padEnd(20) + ' ' + C.d + p.prov + ' · ' + p.detail + C.r)
    }
    if (fired.length) {
      console.log('\n' + C.b + 'fired tells (' + fired.length + ')' + C.r)
      for (const t of fired.slice(0, 24)) console.log('  ' + (t.sev === 'critical' ? C.red : C.yel) + '[' + t.sev + ']' + C.r + ' ' + t.id + ' — ' + C.d + t.evidence + C.r)
    }
    const g = sc.parts.filter(p => GUARDED.test(p.key))
    console.log('\n' + C.b + 'guarded terms' + C.r + ' (a later round may not lower these) ' + C.d
      + g.map(x => x.key + ' ' + x.got + '/' + x.cap).join(' · ') + C.r)
  }
  console.log('\n' + C.d + '→ ' + join(outDir, name) + C.r + '\n')

  if (argv.includes('--keep-best')) {
    const kb = keepBest(outDir, label)
    console.log(C.b + 'keep-best' + C.r + ' → ' + (kb.winner
      ? 'kept round ' + kb.winner.round + (kb.winner.label ? ' (' + kb.winner.label + ')' : '') + ' at ' + kb.winner.score.total + '/100'
      : 'no valid round (every round returned CONTROL_FAILED)'))
    console.log(C.d + '→ ' + join(outDir, 'SCORE-LOOP.md') + C.r + '\n')
  }

  cdp.close()
  chrome.kill()
  process.exit(controlFailed ? 2 : 0)
}

main().catch(err => { console.error('ui-score:', err.message); shutdown(); process.exit(1) })
