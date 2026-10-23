#!/usr/bin/env node
// Checks for lib/video-scene.mjs, including a real ffmpeg render of a generated clip. Plants a failing case first.
// Run: node test-video.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { filterFile } from './lib/util.mjs';
import { segmentsOf, videoPlan } from './lib/video-scene.mjs';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-'));
const v = (o) => ({ type: 'video', src: 'x.mp4', start: 0, end: 10, ...o });

let caught = false;
try { assert.equal(videoPlan(v({}), 5, { dir }).speed, 99); } catch { caught = true; }
assert.ok(caught, 'control: a wrong expectation must fail');
console.log('ok  CONTROL a wrong expectation fails');

t('fit: 10 s of footage into 5 s of voice plays at 2x', () => assert.equal(videoPlan(v({}), 5, { dir }).speed, 2));
t('footage shorter than the voice never slows down: speed is 1 and the last frame holds', () => assert.equal(videoPlan(v({ end: 4 }), 8, { dir }).speed, 1));
t('segments are summed and skipped parts do not count', () => {
  const p = videoPlan(v({ segments: [[0, 3], [10, 12]] }), 5, { dir });
  assert.equal(p.sourceSeconds, 5);
  assert.equal(p.speed, 1);
});
t('more than maxSpeed is reported and capped, never silently sped up', () => {
  const p = videoPlan(v({ end: 30 }), 5, { dir });
  assert.equal(p.speed, 2.4);
  assert.match(p.warnings[0], /needs 6\.00x/);
});
t('an explicit speed is respected', () => assert.equal(videoPlan(v({ speed: 1.5 }), 5, { dir }).speed, 1.5));
t('bad segments are refused', () => {
  assert.throws(() => segmentsOf({ segments: [[5, 5]] }), /bad segment/);
  assert.throws(() => segmentsOf({}), /needs/);
});
t('the crop sets the box aspect, and the box is centred', () => {
  const p = videoPlan(v({ crop: { x: 0, y: 0, w: 1000, h: 500 } }), 5, { dir });
  assert.equal(p.box.w / p.box.h, 2);
  assert.equal(p.box.x * 2 + p.box.w, 1920);
});
t('the graph trims every segment, removes watermarks before cropping, and labels', () => {
  const p = videoPlan(v({ segments: [[1, 2], [3, 4]], blur: [{ x: 5, y: 6, w: 7, h: 8 }], crop: { x: 1, y: 2, w: 300, h: 200 }, label: 'Hello: world' }), 2, { dir });
  assert.match(p.graph, /trim=start=1:end=2/);
  assert.match(p.graph, /trim=start=3:end=4/);
  assert.ok(p.graph.indexOf('delogo') < p.graph.indexOf('crop='));
  assert.match(p.graph, /text='Hello\\: world'/);
});

// real render: a 6 s test clip, two segments, fitted to 3 s
const src = path.join(dir, 'x.mp4');
const gen = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1366x724:rate=30:duration=6', '-pix_fmt', 'yuv420p', src]);
assert.equal(gen.status, 0, 'ffmpeg must be available');
t('a real render comes out 1920x1080 at the voice length', () => {
  const p = videoPlan(v({ segments: [[0, 2], [3, 5]], crop: { x: 100, y: 50, w: 1000, h: 600 }, label: 'Test', speed: 'fit' }), 3, { dir });
  fs.writeFileSync(path.join(dir, 'g.txt'), p.graph);
  const out = path.join(dir, 'o.mp4');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...p.inputs, ...filterFile('g.txt'), '-map', '[v]', '-t', '3', '-pix_fmt', 'yuv420p', out], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const pr = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout;
  assert.match(pr, /1920,1080/);
  assert.ok(Math.abs(parseFloat(pr.split('\n').find((l) => /^\d+\.\d+$/.test(l))) - 3) < 0.1, pr);
});
console.log(`${n} checks passed`);
