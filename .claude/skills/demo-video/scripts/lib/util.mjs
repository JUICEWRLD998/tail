// Shared helpers: plan/timeline IO and ffmpeg/ffprobe wrappers.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function demoDir(arg) {
  const dir = path.resolve(arg || 'demo');
  if (!fs.existsSync(path.join(dir, 'plan.json'))) throw new Error(`no plan.json in ${dir}`);
  return dir;
}

export const readJSON = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
export const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2)); };

export function loadPlan(dir) {
  const plan = readJSON(path.join(dir, 'plan.json'));
  const ids = new Set();
  for (const s of plan.scenes) {
    if (!s.id) throw new Error('every scene needs an id');
    if (ids.has(s.id)) throw new Error(`duplicate scene id ${s.id}`);
    ids.add(s.id);
  }
  return plan;
}

export function loadTimeline(dir) {
  return readJSON(path.join(dir, 'build', 'timeline.json'), { scenes: {} });
}
export function saveTimeline(dir, tl) { writeJSON(path.join(dir, 'build', 'timeline.json'), tl); }

export function run(cmd, args, { cwd, quiet = true } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    const tail = (r.stderr || '').split('\n').filter(Boolean).slice(-12).join('\n');
    throw new Error(`${cmd} failed (${r.status}):\n${tail}`);
  }
  if (!quiet) process.stdout.write(r.stdout || '');
  return r;
}

/** The ffmpeg arguments that read a filter graph from a file. ffmpeg 7+ spells it `-/filter_complex file`; 6 and older
 *  use `-filter_complex_script file` (which ffmpeg 9 removed). Detected once from `ffmpeg -version`. */
let graphFlag;
export function filterFile(file) {
  if (!graphFlag) {
    const major = Number(/version\s+n?(\d+)/.exec(run('ffmpeg', ['-version']).stdout)?.[1] ?? 7);
    graphFlag = major >= 7 ? '-/filter_complex' : '-filter_complex_script';
  }
  return [graphFlag, file];
}

export const ffmpeg = (args, opts) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], opts);

export function duration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(r.stdout.trim());
}

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const wordCount = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
