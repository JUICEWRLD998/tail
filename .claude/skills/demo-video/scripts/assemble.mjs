#!/usr/bin/env node
// Step 3: cut the final video. Crossfades the scene clips, places each voice-over at its scene
// start + lead, ducks optional music under the voice, burns captions from the TTS word timings,
// normalises loudness to -14 LUFS, and writes out/<slug>-demo.mp4 + .srt + thumbnail.png.
// usage: node assemble.mjs [demoDir] [--no-captions]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoDir, duration, ffmpeg, loadPlan, loadTimeline, slug } from './lib/util.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = demoDir(process.argv.slice(2).find((a) => !a.startsWith('--')));
const plan = loadPlan(dir);
const tl = loadTimeline(dir);
const build = path.join(dir, 'build');
const outDir = path.join(dir, 'out');
fs.mkdirSync(outDir, { recursive: true });
const T = plan.transition ?? 0.5;

const scenes = plan.scenes.map((s) => {
  const e = tl.scenes[s.id];
  if (!e?.dur || !fs.existsSync(path.join(dir, e.clip))) throw new Error(`scene ${s.id} not recorded: run record.mjs`);
  return { s, e };
});

// Scene k starts where the previous one ends minus the crossfade.
let t = 0;
for (const [i, sc] of scenes.entries()) {
  sc.start = i === 0 ? 0 : t - T;
  t = sc.start + sc.e.dur;
}
const total = t;

// ---------- captions ----------
const captionsOn = plan.captions !== false && !process.argv.includes('--no-captions');
const cues = [];
for (const { s, e, start } of scenes) {
  const v = s.visual || {};
  const def = !(v.type === 'card' && ['title', 'end'].includes(v.template));
  if (!(s.captions ?? def) || !e.words?.length || !s.vo) continue;
  const tokens = s.vo.replace(/\*/g, '').split(/\s+/).filter(Boolean);
  const ws = e.words;
  // Display the written script; take timing from the TTS words (proportional if counts differ).
  const timed = tokens.length === ws.length
    ? tokens.map((tok, i) => ({ text: tok, start: ws[i].start, end: ws[i].end }))
    : tokens.map((tok, i) => {
        const a = ws[0].start, b = ws.at(-1).end;
        return { text: tok, start: a + ((b - a) * i) / tokens.length, end: a + ((b - a) * (i + 1)) / tokens.length };
      });
  let cur = [];
  const flush = () => { if (cur.length) cues.push({ words: cur, base: start + e.lead }); cur = []; };
  for (const w of timed) {
    cur.push(w);
    const text = cur.map((x) => x.text).join(' ');
    if (cur.length >= 7 || text.length >= 38 || (/[.?!;:,—]$/.test(w.text) && cur.length >= 3)) flush();
  }
  flush();
}
const cueTimes = cues.map((c, i) => {
  const a = c.base + c.words[0].start;
  let b = c.base + c.words.at(-1).end + 0.35;
  const next = cues[i + 1];
  if (next) b = Math.min(b, next.base + next.words[0].start - 0.02);
  return { a, b, text: c.words.map((w) => w.text).join(' ') };
});
const fmt = (sec, sep) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return sep === ','
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0').replace('.', ',')}`
    : `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};
const name = slug(plan.product?.name || 'product');
fs.writeFileSync(path.join(outDir, `${name}-demo.srt`), cueTimes.map((c, i) => `${i + 1}\n${fmt(c.a, ',')} --> ${fmt(c.b, ',')}\n${c.text}\n`).join('\n'));
const cap = { font: 'Segoe UI Semibold', size: 46, ...(plan.captionStyle || {}) };
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${cap.font},${cap.size},&H00FFFFFF,&H00FFFFFF,&H50101010,&H50101010,0,0,0,0,100,100,0.4,0,3,14,0,2,200,200,64,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${cueTimes.map((c) => `Dialogue: 0,${fmt(c.a)},${fmt(c.b)},Cap,,0,0,0,,{\\fad(120,100)}${c.text.replace(/[{}]/g, '')}`).join('\n')}
`;
fs.writeFileSync(path.join(build, 'captions.ass'), ass);

// ---------- music ----------
const libDir = path.join(here, '..', 'assets', 'music');
const library = fs.existsSync(libDir) ? fs.readdirSync(libDir).filter((f) => /\.(mp3|m4a|wav)$/i.test(f)).map((f) => path.join(libDir, f)) : [];
const music = plan.music === false ? null
  : [plan.music && path.resolve(dir, plan.music), path.join(dir, 'assets', 'music.mp3'), ...library].find((f) => f && fs.existsSync(f));

// ---------- filtergraph ----------
const args = [];
for (const { e } of scenes) args.push('-i', path.join(dir, e.clip));
const vo = scenes.filter(({ e }) => e.voFile);
for (const { e } of vo) args.push('-i', path.join(dir, e.voFile));
if (music) args.push('-stream_loop', '-1', '-i', music);

const f = [];
let last = '0:v';
for (let i = 1; i < scenes.length; i++) {
  const tr = scenes[i].s.transition || plan.transitionStyle || 'fade';
  f.push(`[${last}][${i}:v]xfade=transition=${tr}:duration=${T}:offset=${scenes[i].start.toFixed(3)}[x${i}]`);
  last = `x${i}`;
}
f.push(captionsOn && cueTimes.length ? `[${last}]subtitles=captions.ass[vout]` : `[${last}]null[vout]`);
vo.forEach(({ e, start }, j) => {
  const ms = Math.round((start + e.lead) * 1000);
  f.push(`[${scenes.length + j}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${j}]`);
});
f.push(`${vo.map((_, j) => `[v${j}]`).join('')}amix=inputs=${vo.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)}[voice]`);
if (music) {
  const mi = scenes.length + vo.length;
  f.push('[voice]asplit=2[voA][voKey]');
  f.push(`[${mi}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${total.toFixed(3)},volume=${plan.musicVolume ?? 0.16},afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(3)}:d=3[mus]`);
  f.push('[mus][voKey]sidechaincompress=threshold=0.04:ratio=6:attack=30:release=500[duck]');
  f.push('[voA][duck]amix=inputs=2:normalize=0:dropout_transition=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
} else {
  f.push('[voice]loudnorm=I=-14:TP=-1.5:LRA=11[aout]');
}
fs.writeFileSync(path.join(build, 'graph.txt'), f.join(';\n'));

const out = path.join(outDir, `${name}-demo.mp4`);
console.log(`assembling ${scenes.length} scenes, ${total.toFixed(1)}s, music: ${music ? path.basename(music) : 'none'}, captions: ${captionsOn ? cueTimes.length : 0}`);
// ffmpeg 7+ reads an option value from a file with the "-/" prefix (-filter_complex_script is gone in 9).
ffmpeg([...args, '-/filter_complex', 'graph.txt', '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', total.toFixed(3), out], { cwd: build });

ffmpeg(['-ss', String(plan.thumbnailAt ?? Math.min(2.6, total / 2)), '-i', out, '-frames:v', '1', path.join(outDir, 'thumbnail.png')]);
console.log(`\n${out}\n  duration ${duration(out).toFixed(2)}s`);
