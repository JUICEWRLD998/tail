// Injected into every recorded page (Page.addScriptToEvaluateOnNewDocument).
// Draws a presenter cursor and click ripple, finds elements by visible text,
// and runs eased scrolls. Exposes window.__demo for the recorder.
(() => {
  if (window.__demo) return;
  const easeInOut = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  let cursor, ring, pos = { x: -60, y: -60 };

  function mount() {
    if (cursor || !document.documentElement) return;
    const style = document.createElement('style');
    style.textContent = `
      html{scrollbar-width:none} ::-webkit-scrollbar{display:none}
      #__demo_cursor{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;
        transform:translate(-60px,-60px);filter:drop-shadow(0 3px 6px rgba(0,0,0,.35));transition:opacity .3s}
      #__demo_cursor.press svg{transform:scale(.86)} #__demo_cursor svg{transition:transform .12s ease;transform-origin:4px 3px}
      #__demo_ring{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
        z-index:2147483646;pointer-events:none;opacity:0;border:2.5px solid var(--__demo-accent,#3ee0c0)}
      #__demo_ring.go{animation:__demo_ripple .55s cubic-bezier(.22,1,.36,1)}
      @keyframes __demo_ripple{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(1.5)}}
      .__demo_spot{outline:3px solid var(--__demo-accent,#3ee0c0)!important;outline-offset:6px!important;
        transition:outline-offset .4s cubic-bezier(.22,1,.36,1)!important}
      #__demo_focus{position:fixed;z-index:2147483645;pointer-events:none;opacity:0;border-radius:12px;
        box-shadow:0 0 0 200vmax rgba(8,10,12,.58),0 0 0 2px var(--__demo-accent,#3ee0c0);
        transition:opacity .45s cubic-bezier(.22,1,.36,1),left .6s cubic-bezier(.22,1,.36,1),top .6s cubic-bezier(.22,1,.36,1),width .6s cubic-bezier(.22,1,.36,1),height .6s cubic-bezier(.22,1,.36,1)}
      #__demo_focus.on{opacity:1}
      #__demo_chip{position:fixed;left:28px;top:24px;z-index:2147483646;pointer-events:none;display:flex;align-items:center;gap:10px;
        padding:9px 16px 9px 14px;border-radius:999px;font:600 15px/1.2 system-ui,sans-serif;letter-spacing:.01em;
        color:var(--__demo-chip-fg,#f3f5f4);background:var(--__demo-chip-bg,rgba(16,20,22,.86));
        box-shadow:0 8px 24px -10px rgba(0,0,0,.5);opacity:0;transform:translate3d(0,-8px,0);
        transition:opacity .4s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1)}
      #__demo_chip::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--__demo-accent,#3ee0c0)}
      #__demo_chip.on{opacity:1;transform:none}`;
    document.documentElement.appendChild(style);
    cursor = document.createElement('div');
    cursor.id = '__demo_cursor';
    cursor.innerHTML = '<svg width="30" height="30" viewBox="0 0 30 30"><path d="M4 3 L4 24 L9.5 18.6 L13.2 27 L17 25.4 L13.4 17.2 L21 17.2 Z" fill="#111" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    ring = document.createElement('div');
    ring.id = '__demo_ring';
    document.documentElement.appendChild(ring);
    document.documentElement.appendChild(cursor);
    place(pos.x, pos.y);
  }
  function place(x, y) {
    pos = { x, y };
    if (cursor) cursor.style.transform = `translate(${x - 4}px,${y - 3}px)`;
  }

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
  };
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const label = (el) => el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '';

  function find(spec) {
    if (spec.selector) {
      const all = [...document.querySelectorAll(spec.selector)].filter(visible);
      return all[spec.nth || 0] || null;
    }
    if (spec.text) {
      const want = norm(spec.text);
      const clickable = 'button,a,[role=button],[role=tab],[role=menuitem],[role=option],input,textarea,label,summary,select,[onclick],[tabindex]';
      // Rank across ALL elements: exact text first, then clickable, then smallest. Searching clickables
      // first let <main tabindex=-1> (which contains every word) beat the exact <h2> it wraps.
      const cands = [...document.querySelectorAll('body *')].filter((el) => visible(el) && norm(label(el)).includes(want));
      const score = (el) => (norm(label(el)) === want ? 0 : 2) + (el.matches(clickable) ? 0 : 1);
      cands.sort((a, b) => {
        const d = score(a) - score(b);
        if (d) return d;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return ra.width * ra.height - rb.width * rb.height;
      });
      return cands[spec.nth || 0] || null;
    }
    return null;
  }

  function rect(spec) {
    const el = find(spec);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, left: r.left };
  }

  async function moveTo(x, y, ms = 700) {
    mount();
    const from = { ...pos };
    if (from.x < 0) { from.x = innerWidth * 0.62; from.y = innerHeight * 0.78; }
    const t0 = performance.now();
    // Slight arc so the path reads as a hand, not a robot.
    const bend = Math.min(80, Math.hypot(x - from.x, y - from.y) * 0.12);
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const k = easeInOut(t);
      place(from.x + (x - from.x) * k, from.y + (y - from.y) * k - Math.sin(Math.PI * k) * bend);
      if (t >= 1) break;
      await raf();
    }
  }

  async function press() {
    mount();
    cursor.classList.add('press');
    ring.style.left = pos.x + 'px';
    ring.style.top = pos.y + 'px';
    ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
    await new Promise((r) => setTimeout(r, 140));
    cursor.classList.remove('press');
  }

  async function scrollTo(target, ms = 1100, block = 0.3) {
    let y;
    if (typeof target === 'number') y = target;
    else {
      const el = find(target);
      if (!el) return false;
      y = scrollY + el.getBoundingClientRect().top - innerHeight * block;
    }
    y = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, y));
    const y0 = scrollY, t0 = performance.now();
    document.documentElement.style.scrollBehavior = 'auto';
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      window.scrollTo(0, y0 + (y - y0) * easeInOut(t));
      if (t >= 1) break;
      await raf();
    }
    return true;
  }

  function spotlight(spec, on = true) {
    document.querySelectorAll('.__demo_spot').forEach((e) => e.classList.remove('__demo_spot'));
    if (!on) return true;
    const el = find(spec);
    if (el) el.classList.add('__demo_spot');
    return !!el;
  }

  // Dim everything except one element, so the eye lands on the result the voice is naming.
  // The cutout is a fixed box with a huge spread shadow; it glides if focus moves to another target.
  function focus(spec, on = true) {
    mount();
    let box = document.getElementById('__demo_focus');
    if (!on || !spec) { if (box) box.classList.remove('on'); return true; }
    const el = find(spec);
    if (!el) return false;
    if (!box) { box = document.createElement('div'); box.id = '__demo_focus'; document.documentElement.appendChild(box); }
    const r = el.getBoundingClientRect(), pad = 10;
    const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    Object.assign(box.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px', borderRadius: rad + pad + 'px' });
    void box.offsetWidth;
    box.classList.add('on');
    return true;
  }

  // A small chapter label (top-left, clear of the captions) that tells the viewer where the story is.
  let chipTimer;
  function chip(text, ms = 2800, theme = {}) {
    mount();
    let el = document.getElementById('__demo_chip');
    if (!el) { el = document.createElement('div'); el.id = '__demo_chip'; document.documentElement.appendChild(el); }
    clearTimeout(chipTimer);
    if (!text) { el.classList.remove('on'); return true; }
    if (theme.fg) document.documentElement.style.setProperty('--__demo-chip-fg', theme.fg);
    if (theme.bg) document.documentElement.style.setProperty('--__demo-chip-bg', theme.bg);
    el.textContent = text;
    void el.offsetWidth;
    el.classList.add('on');
    if (ms > 0) chipTimer = setTimeout(() => el.classList.remove('on'), ms);
    return true;
  }

  function setAccent(c) { document.documentElement.style.setProperty('--__demo-accent', c); }
  function hideCursor(h = true) { mount(); cursor.style.opacity = h ? '0' : '1'; }

  window.__demo = { find, rect, moveTo, press, scrollTo, spotlight, focus, chip, setAccent, hideCursor, place, mount, get pos() { return pos; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
