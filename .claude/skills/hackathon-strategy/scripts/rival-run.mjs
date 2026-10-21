#!/usr/bin/env node
// rival-run.mjs: run one sealed brief through every outside-model CLI that works, and save each answer.
//
// Optional. Used by the idea forge for the L1-L3 cold samples (references/rival-simulation.md) and the
// JUDGE brief (references/idea-forge.md). An outside model is a real independent sample: it has not seen our
// notes, our candidates or his profile. When no CLI is READY, those steps run inline, labelled SEMI-COLD.
// Gemini needs only a free Google login (`gemini` once); no OpenAI key is required.
//
// Usage:
//   node rival-run.mjs --selftest                      positive control: which CLIs answer right now
//   node rival-run.mjs <brief.md> <out-dir> [--only codex|gemini] [--web] [--timeout 900]
//
// Each CLI runs in a fresh EMPTY temp directory, read-only, with the brief on stdin, so it cannot read
// his files or our strategy folder. A CLI that fails (expired key, no login, empty answer) is recorded as
// NOT RUN with the reason. An empty or failed run never becomes a "sample".
//
// Zero dependencies. Node 18+.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i > -1 && args[i + 1] ? args[i + 1] : dflt;
};

function globalRoot() {
  const r = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
  return (r.stdout || '').trim();
}

const ROOT = globalRoot();
const CLIS = {
  codex: {
    entry: join(ROOT, '@openai', 'codex', 'bin', 'codex.js'),
    pkg: join(ROOT, '@openai', 'codex', 'package.json'),
    // -o writes only the final message; read-only sandbox; never ask for approval.
    argv: (outFile, web) => [
      'exec', '-s', 'read-only', '--skip-git-repo-check',
      '-c', 'approval_policy=never',
      '-c', `web_search=${web ? 'live' : 'disabled'}`,
      '-o', outFile, '-',
    ],
    readsOutFile: true,
  },
  gemini: {
    entry: join(ROOT, '@google', 'gemini-cli', 'bundle', 'gemini.js'),
    pkg: join(ROOT, '@google', 'gemini-cli', 'package.json'),
    // plan = read-only approval mode; the brief arrives on stdin and -p is appended to it.
    // --skip-trust: without it Gemini downgrades `plan` to `default` in an untrusted folder (seen 2026-10-15),
    // and every temp folder is untrusted. Trusting the empty temp folder for one session keeps `plan` in force.
    argv: () => ['--skip-trust', '--approval-mode', 'plan', '-o', 'text', '-p', 'Follow the brief above exactly. Answer in the format it asks for.'],
    readsOutFile: false,
  },
};

// Failure signatures seen live (2026-10-15): codex 401 from an expired proxy key, gemini exit 41 with no auth.
const FAIL = /401|unauthori[sz]ed|auth method|not logged in|please (log|sign) ?in|quota|rate.?limit|api key|expired|ECONNREFUSED|ENOTFOUND/i;

function version(cli) {
  try { return JSON.parse(readFileSync(CLIS[cli].pkg, 'utf8')).version; } catch { return 'unknown'; }
}

function runOne(cli, brief, { web = false, timeoutSec = 900 } = {}) {
  const c = CLIS[cli];
  if (!existsSync(c.entry)) return { status: 'NOT RUN', reason: `not installed (${c.entry})`, text: '' };
  const cwd = mkdtempSync(join(tmpdir(), `rival-${cli}-`)); // empty: nothing of his to read
  const outFile = join(cwd, 'answer.txt');
  const r = spawnSync(process.execPath, [c.entry, ...c.argv(outFile, web)], {
    cwd, input: brief, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' },
  });
  let text = '';
  if (c.readsOutFile && existsSync(outFile)) text = readFileSync(outFile, 'utf8');
  if (!c.readsOutFile) text = r.stdout || '';
  const log = `${r.stdout || ''}\n${r.stderr || ''}`;
  rmSync(cwd, { recursive: true, force: true });
  if (r.error) return { status: 'NOT RUN', reason: `spawn error: ${r.error.message}`, text: '' };
  if (r.status !== 0) {
    const m = log.match(FAIL);
    const line = m ? log.split('\n').find((l) => FAIL.test(l)).trim().slice(0, 240) : `exit ${r.status}`;
    return { status: 'NOT RUN', reason: line, text: '' };
  }
  if (text.trim().length === 0) return { status: 'NOT RUN', reason: 'empty answer (exit 0)', text: '' };
  if (text.trim().length < 400 && FAIL.test(text)) return { status: 'NOT RUN', reason: text.trim().slice(0, 240), text: '' };
  return { status: 'RAN', reason: '', text };
}

if (flag('--selftest')) {
  // Planted positive control: a working CLI must echo the token back. Anything else is NOT READY.
  const token = `PONG-${Date.now().toString(36)}`;
  let ready = 0;
  for (const cli of Object.keys(CLIS)) {
    const r = runOne(cli, `Reply with exactly ${token} and nothing else. Do not run any commands.`, { timeoutSec: 180 });
    const ok = r.status === 'RAN' && r.text.includes(token);
    if (ok) ready++;
    console.log(`${cli.padEnd(7)} v${version(cli).padEnd(9)} ${ok ? 'READY' : 'NOT READY'}${ok ? '' : `  (${r.reason || 'token missing from answer'})`}`);
  }
  console.log(ready ? `${ready} outside model(s) ready.` : 'No outside model ready. Cold samples and judge votes run inline, labelled SEMI-COLD.');
  process.exit(ready ? 0 : 3);
}

const [briefPath, outDir] = args.filter((a) => !a.startsWith('--') && a !== opt('--only') && a !== opt('--timeout'));
if (!briefPath || !outDir) {
  console.error('usage: node rival-run.mjs <brief.md> <out-dir> [--only codex|gemini] [--web] [--timeout 900]\n       node rival-run.mjs --selftest');
  process.exit(1);
}
const brief = readFileSync(resolve(briefPath), 'utf8');
const sha = createHash('sha256').update(brief).digest('hex').slice(0, 16);
mkdirSync(resolve(outDir), { recursive: true });
const only = opt('--only');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const summary = [];
for (const cli of Object.keys(CLIS)) {
  if (only && only !== cli) continue;
  const r = runOne(cli, brief, { web: flag('--web'), timeoutSec: Number(opt('--timeout', 900)) });
  const file = join(resolve(outDir), `${stamp}_${cli}.md`);
  const header = [
    `<!-- rival-run: cli=${cli} v${version(cli)} | utc=${new Date().toISOString()} | brief=${briefPath} sha256:${sha} | status=${r.status} -->`,
    r.status === 'RAN' ? '' : `NOT RUN: ${r.reason}`,
    '',
  ].join('\n');
  writeFileSync(file, header + r.text, 'utf8');
  summary.push(`${cli.padEnd(7)} ${r.status.padEnd(8)} ${r.status === 'RAN' ? file : r.reason}`);
}
console.log(`brief sha256:${sha}`);
console.log(summary.join('\n'));
process.exit(summary.some((s) => s.includes(' RAN ')) ? 0 : 3);
