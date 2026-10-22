#!/usr/bin/env node
// Checks for lib/deck.mjs. Run: node test-deck.mjs (exit 1 on a failure). Plants a wrong expectation first.
import assert from 'node:assert/strict';
import { deckProgress, resolveCues } from './lib/deck.mjs';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };
const entry = { lead: 0.6, words: [{ text: 'Callers', start: 0.2 }, { text: 'post,', start: 0.9 }, { text: 'tap', start: 2.0 }, { text: 'tap', start: 3.5 }, { text: 'Strike.', start: 4.4 }] };

// planted control: the checker must be able to fail
let caught = false;
try { assert.equal(resolveCues({ onWord: 'tap' }, entry).data.at, 999); } catch { caught = true; }
assert.ok(caught, 'control: a wrong expectation must fail');
console.log('ok  CONTROL a wrong expectation fails');

t('onWord becomes at = lead + word start + go lead', () => {
  assert.equal(resolveCues({ onWord: 'tap' }, entry).data.at, 2.85);
});
t('occurrence picks the later time the word is said', () => {
  assert.equal(resolveCues({ onWord: 'tap', occurrence: 1 }, entry).data.at, 4.35);
});
t('punctuation and case do not matter', () => {
  assert.equal(resolveCues({ onWord: 'strike' }, entry).data.at, 5.25);
  assert.equal(resolveCues({ onWord: 'POST' }, entry).data.at, 1.75);
});
t('nested items in arrays are resolved, other fields untouched', () => {
  const r = resolveCues({ template: 'flow', steps: [{ label: 'A', onWord: 'callers' }, { label: 'B' }, { label: 'C', onWord: 'strike' }] }, entry);
  assert.deepEqual(r.data.steps.map((s) => s.at), [1.05, undefined, 5.25]);
  assert.equal(r.data.steps[1].label, 'B');
});
t('<key>OnWord sets <key>At', () => {
  assert.equal(resolveCues({ tallyOnWord: 'strike' }, entry).data.tallyAt, 5.25);
});
t('an unknown word keeps default timing and is reported', () => {
  const r = resolveCues({ rows: [{ text: 'x', onWord: 'nowhere' }] }, entry);
  assert.equal(r.data.rows[0].at, undefined);
  assert.deepEqual(r.missed, ['nowhere']);
});
t('does not mutate the plan', () => {
  const d = { steps: [{ onWord: 'tap' }] };
  resolveCues(d, entry);
  assert.equal(d.steps[0].at, undefined);
});
t('deck progress: chapters present, current chapter, from/to percent of runtime', () => {
  const plan = { scenes: [{ beat: 'hook' }, { beat: 'problem' }, { beat: 'problem' }, { beat: 'solution' }, { beat: 'demo' }, { beat: 'close' }] };
  const starts = [0, 8, 20, 30, 40, 90];
  const p = deckProgress(plan, 2, starts, 100);
  assert.deepEqual(p.chapters, ['The problem', 'The solution', 'Live demo']);
  assert.equal(p.current, 0);
  assert.equal(p.from, 20);
  assert.equal(p.to, 30);
  assert.equal(deckProgress(plan, 0, starts, 100).current, -1);
});
console.log(`${n} checks passed`);

// ---- story gate rules for deck slides
const { checkStory } = await import('./lib/story.mjs');
const base = (extra) => ({
  product: { name: 'Tail' },
  scenes: [
    { id: 'hook', beat: 'hook', vo: 'This is Tail. Tap a call, and Strike holds the trade.', visual: { type: 'card', template: 'title', name: 'Tail' } },
    ...extra,
    { id: 'sol', beat: 'solution', vo: 'Tail turns a channel call into a Strike order in one tap.', visual: { type: 'card', template: 'flow', steps: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] } },
    { id: 'd1', beat: 'demo', vo: 'Tap Tail on the card.', visual: { type: 'page', actions: [{ do: 'click', text: 'Tail', onWord: 'tap' }] } },
    { id: 'd2', beat: 'demo', vo: 'Confirm the size.', visual: { type: 'page', actions: [{ do: 'zoom', text: 'Size', onWord: 'size' }] } },
    { id: 'end', beat: 'close', vo: 'Tail. Try it today.', visual: { type: 'card', template: 'end', name: 'Tail', url: 'x' } },
  ],
});
const has = (r, re) => [...r.fails, ...r.warns].some((m) => re.test(m));
t('an evidence row with a number and no source FAILS', () => {
  const r = checkStory(base([{ id: 'p', beat: 'problem', vo: 'It takes six steps.', visual: { type: 'card', template: 'problem', head: 'Copying calls loses trades', rows: [{ value: '6 steps', text: 'to place an order' }] } }]));
  assert.ok(r.fails.some((m) => /no source/.test(m)), r.fails.join('\n'));
});
t('the same row with a source passes that rule', () => {
  const r = checkStory(base([{ id: 'p', beat: 'problem', vo: 'It takes six steps.', visual: { type: 'card', template: 'problem', head: 'Copying calls loses trades', rows: [{ value: '6 steps', text: 'to place an order', source: 'Counted in the app' }] } }]));
  assert.ok(!r.fails.some((m) => /no source/.test(m)), r.fails.join('\n'));
});
t('a quote without who or source FAILS', () => {
  const r = checkStory(base([{ id: 'q', beat: 'problem', vo: 'One follower said it plainly.', visual: { type: 'card', template: 'quote', text: 'I miss calls.' } }]));
  assert.ok(has(r, /quote needs "who" and "source"/));
});
t('a flow slide with five steps FAILS, and a flow outside the solution beat WARNS', () => {
  const r = checkStory(base([{ id: 'f', beat: 'problem', vo: 'Here is the old way.', visual: { type: 'card', template: 'flow', steps: [1, 2, 3, 4, 5].map((i) => ({ label: String(i) })) } }]));
  assert.ok(has(r, /2 to 4 steps/));
  assert.ok(has(r, /belongs in the solution beat/));
});
t('six slides before the demo WARN', () => {
  const p = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, beat: 'problem', vo: 'It is slow.', visual: { type: 'card', template: 'statement', lines: ['It is slow.'] } }));
  assert.ok(has(checkStory(base(p)), /slides before the demo/));
});
t('a problem shown on a problem slide counts as on screen', () => {
  const r = checkStory(base([{ id: 'p', beat: 'problem', vo: 'Copying calls by hand loses trades.', visual: { type: 'card', template: 'problem', head: 'Copying calls loses trades', rows: [] } }]));
  assert.ok(!has(r, /no problem slide/));
});
console.log(`${n} checks passed in total`);
