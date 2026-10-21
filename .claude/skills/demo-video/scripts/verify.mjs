#!/usr/bin/env node
// Step 4: check the cut, never trust it. Measures duration, loudness, black frames, long freezes
// and dead air, then writes a contact sheet and one still per scene to build/verify/ for a human
// (or Claude, via Read) to look at. Exit 1 on a hard failure.
// usage: node verify.mjs [demoDir]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { demoDir, duration, ffmpeg, loadPlan, loadTimeline, slug } from './lib/util.mjs';

const dir = demoDir(process.argv[2]);
const plan = loadPlan(dir);
const tl = loadTimeline(dir);
const out = path.join(dir, 'out', `${slug(plan.product?.name || 'product')}-demo.mp4`);
const vdir = path.join(dir, 'build', 'verify');
fs.rmSync(vdir, { recursive: true, force: true });
fs.mkdirSync(vdir, { recursive: true });

// kind: '-vf' or '-af'. Detectors report on stderr. Positive-control them with --selftest.
const probe = (file, kind, filter) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, kind === '-vf' ? '-an' : '-vn', kind, filter, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr;
// A span that runs to end-of-file gets a *_start line and no *_end line: close it at the file end.
const spans = (log, key, file) => {
  const s = [...log.matchAll(new RegExp(`${key}_start: ?([\\d.]+)`, 'g'))].map((m) => +m[1]);
  const e = [...log.matchAll(new RegExp(`${key}_end: ?([\\d.]+)`, 'g'))].map((m) => +m[1]);
  return s.map((a, i) => [a, e[i] ?? duration(file)]);
};
const detect = {
  black: (f) => [...probe(f, '-vf', 'blackdetect=d=0.4:pix_th=0.06').matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [+m[1], +m[2]]),
  freeze: (f) => spans(probe(f, '-vf', 'freezedetect=n=0.002:d=6'), 'freeze', f),
  silence: (f) => spans(probe(f, '-af', 'silencedetect=noise=-40dB:d=2.2'), 'silence', f),
  loudness: (f) => parseFloat(probe(f, '-af', 'ebur128=peak=true').match(/Integrated loudness:\s+I:\s+(-?[\d.]+)/)?.[1]),
};

// Planted controls: a clip with a known black gap, a frozen stretch and silence. Every detector
// must fire on it, or its clean result on the real video means nothing.
{
  const ctl = path.join(vdir, 'control.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=4', '-f', 'lavfi', '-i', 'color=black:s=320x180:r=30:d=1.5', '-f', 'lavfi', '-i', 'color=gray:s=320x180:r=30:d=7',
    '-f', 'lavfi', '-i', 'sine=f=440:d=4', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=8.5',
    '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v];[3:a]aresample=48000[s];[s][4:a]concat=n=2:v=0:a=1[a]', '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ctl]);
  const miss = ['black', 'freeze', 'silence'].filter((k) => !detect[k](ctl).length);
  if (!(detect.loudness(ctl) < 0)) miss.push('loudness');
  if (miss.length) { console.log(`FAIL  detector blind on planted control: ${miss.join(', ')}`); process.exit(1); }
}
const hard = [], soft = [];

const dur = duration(out);
const max = plan.targetSeconds || 120;
if (dur > max + 0.5) hard.push(`duration ${dur.toFixed(1)}s exceeds ${max}s`);
if (dur < max * 0.75) soft.push(`duration ${dur.toFixed(1)}s is short for a ${max}s slot`);

const st = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', out], { encoding: 'utf8' }).stdout).streams;
const v = st.find((s) => s.codec_type === 'video');
if (!v || v.width !== 1920 || v.height !== 1080) hard.push(`video is ${v?.width}x${v?.height}, want 1920x1080`);
if (!st.some((s) => s.codec_type === 'audio')) hard.push('no audio stream');

const I = detect.loudness(out);
if (!(I > -17 && I < -11)) soft.push(`integrated loudness ${I} LUFS, want about -14`);

for (const [a, b] of detect.black(out)) hard.push(`black frames ${a.toFixed(1)}s-${b.toFixed(1)}s`);

// A screen that does not move for 6s while the voice talks is dead video.
for (const [a, b] of detect.freeze(out)) soft.push(`static picture ${a.toFixed(1)}s-${b.toFixed(1)}s (${(b - a).toFixed(1)}s): add motion (scroll, zoom, cursor) or cut words`);

for (const [a, b] of detect.silence(out)) if (a > 1 && b < dur - 1) soft.push(`dead air ${a.toFixed(1)}s-${b.toFixed(1)}s`);

// Hook check: the product name must be spoken inside the first 8 seconds.
const T = plan.transition ?? 0.5;
let t = 0;
const starts = plan.scenes.map((s, i) => { const s0 = i === 0 ? 0 : t - T; t = s0 + (tl.scenes[s.id]?.dur || 0); return s0; });
const nameWord = String(plan.product?.name || '').split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '');
const spoken = plan.scenes.some((s, i) => {
  const e = tl.scenes[s.id];
  return (e?.words || []).some((w) => w.text.toLowerCase().replace(/[^a-z0-9]/g, '').includes(nameWord) && starts[i] + e.lead + w.start < 8);
});
if (nameWord && !spoken) hard.push(`product name "${plan.product.name}" is not spoken in the first 8 seconds`);

ffmpeg(['-i', out, '-vf', `fps=${(30 / dur).toFixed(4)},scale=384:-1,tile=6x5:padding=6:margin=6:color=0x111111`, '-frames:v', '1', path.join(vdir, 'contact-sheet.png')]);
plan.scenes.forEach((s, i) => {
  const mid = starts[i] + (tl.scenes[s.id]?.dur || 0) * 0.6;
  ffmpeg(['-ss', mid.toFixed(2), '-i', out, '-frames:v', '1', '-vf', 'scale=960:-1', path.join(vdir, `${String(i + 1).padStart(2, '0')}-${s.id}.png`)]);
});

console.log(`file      ${out}\nduration  ${dur.toFixed(2)}s (max ${max}s)\nloudness  ${I} LUFS\nstills    ${vdir}`);
for (const h of hard) console.log(`FAIL  ${h}`);
for (const s of soft) console.log(`WARN  ${s}`);
if (!hard.length && !soft.length) console.log('clean: no black frames, freezes or dead air detected');
process.exitCode = hard.length ? 1 : 0;
