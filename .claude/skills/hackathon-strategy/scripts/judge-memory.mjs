#!/usr/bin/env node
// judge-memory.mjs: how many times have hackathon judges already seen this idea?
//
// The field sweep (A4b) only sees THIS event's entrants. Judges carry memory of every event they have
// judged. An idea can sit in an empty cell of this event and still be the 300th version a judge has seen
// (remittance, carbon credits, mental-health chatbot). This probe measures that L0 layer on Devpost's
// public archive: total matching projects, and the winner share in a sample.
//
// Usage:
//   node judge-memory.mjs "remittance" "drum machine" [--pages 5] [--md out.md]
//
// The protocol (idea-forge.md R3): query the DOMAIN in one or two words with --pages 5, then read the 30
// listed names and taglines and count projects with the SAME MECHANISM as the card. 3+ = SEEN-MECHANISM.
// The total and its band are context only. Backtest 2026-10-15: every past pick's one-word domain was WORN or
// FATIGUED (gradientless), and long phrases come back RARE whatever the idea ("spending limit allowance
// family" = 5), so neither number can be the test.
//
// Devpost search is keyword AND (measured 2026-10-15: "mental health" 13,608; "mental health chatbot"
// 2,110). Do not wrap phrases in quotes: quoted queries returned MORE hits (5,797), so quoting is broken.
// Every run starts with two controls. If the positive control comes back low, the probe is broken and
// nothing is reported, because a zero from a broken probe looks exactly like an empty lane.
//
// Blind spots (write them next to every number): Devpost only. Web3 events live mostly on DoraHacks,
// ETHGlobal and Colosseum ("remittance" is only 208 on Devpost). Keyword match, not mechanism match.
// The winner flag marks a prize of any size at any event, including sponsor side prizes.
//
// Zero dependencies. Node 18+.

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i > -1 && args[i + 1] ? args[i + 1] : dflt;
};
const PAGES = Math.max(1, Math.min(40, Number(opt('--pages', 5))));
const MD = opt('--md', '');
const queries = args.filter((a, i) => !a.startsWith('--') && !['--pages', '--md'].includes(args[i - 1]));
if (!queries.length) {
  console.error('usage: node judge-memory.mjs "<keywords>" ["<keywords>" ...] [--pages 5] [--md out.md]');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(q, p = 1) {
  const url = `https://devpost.com/software/search?query=${encodeURIComponent(q)}&page=${p}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'judge-memory/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function probe(q, pages) {
  const first = await page(q, 1);
  const total = first.total_count ?? 0;
  const sample = [...(first.software || [])];
  const maxPage = Math.min(pages, Math.ceil(total / 6));
  for (let p = 2; p <= maxPage; p++) {
    await sleep(350);
    sample.push(...((await page(q, p)).software || []));
  }
  const winners = sample.filter((s) => s.winner);
  return { q, total, n: sample.length, w: winners.length, sample, winners: winners.slice(0, 5) };
}

// Controls, measured 2026-10-15: "chatbot" 25,771; nonsense 0.
const POS = 'chatbot';
const NULLQ = 'qzxv flurble wombat';
const pos = await probe(POS, 1);
const nul = await probe(NULLQ, 1);
if (pos.total < 1000 || nul.total > 50) {
  console.error(`PROBE BROKEN: positive control "${POS}" = ${pos.total} (want > 1000), null control = ${nul.total} (want ~0). No result reported.`);
  process.exit(2);
}

const rows = [];
for (const q of queries) {
  await sleep(350);
  rows.push(await probe(q, PAGES));
}

const band = (t) => (t >= 500 ? 'FATIGUED' : t >= 100 ? 'WORN' : t >= 20 ? 'SEEN' : 'RARE');
const out = [];
out.push(`## Judge memory (L0), Devpost archive, ${new Date().toISOString().slice(0, 10)}`);
out.push(`Controls: "${POS}" = ${pos.total}, null = ${nul.total} (probe OK). Sample = first ${PAGES} page(s) by relevance, 6 per page.`);
out.push('');
out.push('| keywords | total projects | band | sampled | winners in sample | winner share |');
out.push('|---|---:|---|---:|---:|---:|');
for (const r of rows) {
  const share = r.n ? `${Math.round((100 * r.w) / r.n)}%` : 'n/a';
  out.push(`| ${r.q} | ${r.total} | ${band(r.total)} | ${r.n} | ${r.w} | ${share} |`);
}
out.push('');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim().slice(0, 160);
for (const r of rows) {
  out.push(`### ${r.q}: the ${r.n} sampled projects (count the ones with the SAME MECHANISM as the card)`);
  r.sample.forEach((s, i) => out.push(`${i + 1}. ${s.winner ? '[WINNER] ' : ''}${clean(s.name)}: ${clean(s.tagline)}`));
  out.push('');
}
out.push('Blind spots: Devpost only (Web3 lives on DoraHacks, ETHGlobal, Colosseum); keyword not mechanism; winner = any prize at any event.');
out.push('Bands: RARE < 20, SEEN 20-99, WORN 100-499, FATIGUED 500+. Context only. The kill is 3+ same-mechanism projects in the sample (SEEN-MECHANISM).');
const text = out.join('\n');
console.log(text);
if (MD) writeFileSync(MD, text + '\n', 'utf8');
