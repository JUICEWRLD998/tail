// A "video" scene: a recorded clip (a screen recording of Telegram, a phone capture) placed under the voice-over.
// Pure: builds the ffmpeg filter graph, so it is testable without running ffmpeg. See references/plan-schema.md.
//
//   { "type": "video", "src": "assets/tg.mp4",
//     "segments": [[35, 44.5], [50, 57]],      // seconds of the source to keep, in order (or "start"/"end")
//     "crop": { "x": 345, "y": 92, "w": 1021, "h": 632 },   // the part of the frame to show (hide other chats, tabs)
//     "blur": [{ "x": 1062, "y": 640, "w": 270, "h": 50 }], // rectangles to remove from the source (watermarks)
//     "label": "A caller posts a call", "speed": "fit" }
//
// The scene lasts as long as its voice needs (`target`). `speed: "fit"` (default) plays the kept footage at the speed
// that makes it exactly that long, never below 1x: footage that is too short holds its last frame, footage that would
// need more than `maxSpeed` (default 2.4x) is reported, so the fix is to keep less footage or say more.
import path from 'node:path';

const hex = (c, fallback) => `0x${String(c || fallback).replace('#', '')}`;
const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019").replace(/%/g, '\\%');

export function segmentsOf(v) {
  const segs = v.segments || (v.start != null && v.end != null ? [[v.start, v.end]] : null);
  if (!segs?.length) throw new Error('a video scene needs "segments" or "start" and "end"');
  for (const [a, b] of segs) if (!(b > a) || a < 0) throw new Error(`bad segment [${a}, ${b}]`);
  return segs;
}

export function videoPlan(v, target, { dir, theme = {}, font } = {}) {
  const segs = segmentsOf(v);
  const sourceSeconds = segs.reduce((t, [a, b]) => t + (b - a), 0);
  const warnings = [];
  const maxSpeed = v.maxSpeed ?? 2.4;
  let speed = v.speed === undefined || v.speed === 'fit' ? sourceSeconds / target : Number(v.speed);
  if (!Number.isFinite(speed) || speed <= 0) throw new Error(`bad speed ${v.speed}`);
  if (speed < 1) speed = 1; // footage shorter than the voice holds its last frame instead of slowing down
  if (speed > maxSpeed) {
    warnings.push(`needs ${speed.toFixed(2)}x to fit ${target.toFixed(1)}s (max ${maxSpeed}x): keep less footage or add words`);
    speed = maxSpeed;
  }
  const W = 1920, H = 1080;
  const crop = v.crop;
  const box = { w: v.boxW ?? 1380, y: v.boxY ?? 78 };
  const ratio = crop ? crop.w / crop.h : 16 / 9;
  box.h = Math.round(box.w / ratio / 2) * 2;
  box.x = Math.round((W - box.w) / 2);
  const bg = hex(theme.bg, '0b1220');
  const line = hex(theme.line, '2a3a52');
  const accent = hex(theme.accent, '5fe0c2');
  const fontFile = font || '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf';
  const r = v.radius ?? 18;

  const parts = [];
  segs.forEach(([a, b], i) => parts.push(`[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[s${i}]`));
  const cat = segs.length > 1 ? `${segs.map((_, i) => `[s${i}]`).join('')}concat=n=${segs.length}:v=1:a=0[cat]` : '[s0]null[cat]';
  parts.push(cat);
  let chain = `[cat]fps=30,setpts=PTS/${speed.toFixed(4)}`;
  for (const b of v.blur || []) chain += `,delogo=x=${b.x}:y=${b.y}:w=${b.w}:h=${b.h}`;
  if (crop) chain += `,crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`;
  chain += `,scale=${box.w}:${box.h}:flags=lanczos,format=yuva420p,tpad=stop_mode=clone:stop_duration=${Math.max(0, target + 1).toFixed(2)}`;
  // Rounded corners: an alpha mask computed per pixel.
  chain += `,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(gt(abs(X-${box.w / 2})-${box.w / 2 - r},0)*gt(abs(Y-${box.h / 2})-${box.h / 2 - r},0)*gt(hypot(abs(X-${box.w / 2})-${box.w / 2 - r},abs(Y-${box.h / 2})-${box.h / 2 - r}),${r}),0,255)'[vid]`;
  parts.push(chain);
  parts.push(`color=c=${bg}:s=${W}x${H}:r=30:d=${(target + 1).toFixed(2)}[bg]`);
  // A hairline frame behind the clip, then the clip.
  parts.push(`[bg]drawbox=x=${box.x - 2}:y=${box.y - 2}:w=${box.w + 4}:h=${box.h + 4}:color=${line}@0.9:t=2[fr]`);
  parts.push(`[fr][vid]overlay=${box.x}:${box.y}:shortest=1[o]`);
  let last = 'o';
  if (v.label) {
    parts.push(`[${last}]drawtext=fontfile='${fontFile}':text='${esc(v.label)}':fontsize=30:fontcolor=${accent}:x=${box.x}:y=${Math.round(box.y / 2 - 20)}[lab]`);
    last = 'lab';
  }
  if (v.source) {
    parts.push(`[${last}]drawtext=fontfile='${fontFile}':text='${esc(v.source)}':fontsize=22:fontcolor=${hex(theme.muted, '9aa7b8')}:x=${box.x + box.w}-text_w:y=${box.y + box.h + 14}[src]`);
    last = 'src';
  }
  parts.push(`[${last}]format=yuv420p[v]`);
  return {
    inputs: ['-i', path.resolve(dir, v.src)],
    graph: parts.join(';\n'),
    speed, sourceSeconds, warnings, box,
  };
}
