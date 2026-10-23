// The story gate: checks plan.json tells a clear story before any voice is generated.
// Every scene carries a `beat`; beats run in order hook -> problem -> solution -> demo -> proof -> close.
// Returns { fails, warns, outline }. A FAIL stops tts.mjs; a WARN is reported and may stay with a reason.
import { wordCount } from './util.mjs';

export const BEATS = ['hook', 'problem', 'solution', 'demo', 'proof', 'close'];
export const CHAPTERS = { problem: 'The problem', solution: 'The solution', demo: 'Live demo', proof: "What's real" };

const HYPE = /\b(leverag\w*|utiliz\w*|seamless\w*|robust|revolutionar\w*|revolutioniz\w*|game[- ]chang\w*|empower\w*|cutting[- ]edge|supercharg\w*|unlock\w*|next[- ]gen\w*|state[- ]of[- ]the[- ]art|synerg\w*|world[- ]class|best[- ]in[- ]class|innovative)\b/i;
const BAD_OPEN = /^\s*(introducing|in today's world|in today’s world|have you ever wondered|meet the future|welcome to)\b/i;

const sentences = (t) => String(t || '').replace(/\*/g, '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const lineText = (l) => (typeof l === 'string' ? l : l?.text || '').replace(/\*/g, '');

export function checkStory(plan) {
  const fails = [], warns = [];
  const scenes = plan.scenes || [];
  const name = String(plan.product?.name || '').toLowerCase();
  const nameWord = name.split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '') || '';
  const by = Object.fromEntries(BEATS.map((b) => [b, []]));

  // ---- every scene has a beat, and beats only move forward
  let last = -1;
  for (const s of scenes) {
    const i = BEATS.indexOf(s.beat);
    if (i < 0) { fails.push(`${s.id}: "beat" must be one of ${BEATS.join(', ')} (got ${JSON.stringify(s.beat)})`); continue; }
    if (i < last) fails.push(`${s.id}: beat "${s.beat}" comes after "${BEATS[last]}". The story only moves forward: ${BEATS.join(' -> ')}`);
    last = Math.max(last, i);
    by[s.beat].push(s);
  }
  if (fails.length) return { fails, warns, outline: [] };
  for (const b of ['hook', 'problem', 'solution', 'demo', 'close']) if (!by[b].length) fails.push(`no "${b}" beat: the story needs hook, problem, solution, demo and close`);
  if (scenes[0]?.beat !== 'hook') fails.push('the first scene must be the hook');
  if (scenes.at(-1)?.beat !== 'close') fails.push('the last scene must be the close');

  const words = (list) => list.reduce((a, s) => a + wordCount(s.vo), 0);
  const total = Math.max(1, words(scenes));

  // ---- hook: name in the first scene's voice-over, no throat-clearing opener
  const hook = by.hook[0];
  if (hook) {
    if (nameWord && !String(hook.vo || '').toLowerCase().includes(nameWord)) fails.push(`${hook.id}: the hook must say the product name ("${plan.product.name}")`);
    if (BAD_OPEN.test(hook.vo || '')) fails.push(`${hook.id}: do not open with "${(hook.vo || '').match(BAD_OPEN)[1]}". Lead with the name and the outcome`);
  }

  // ---- problem: shown on screen as a statement, short, one person in one moment
  if (by.problem.length) {
    const onScreen = by.problem.filter((s) => s.visual?.type === 'card' && ['statement', 'problem', 'quote', 'compare'].includes(s.visual.template));
    if (!onScreen.length) warns.push('no problem slide: put the problem on screen (a statement, problem, quote or compare card), not only in the voice-over');
    const cards = by.problem.filter((s) => s.visual?.type === 'card' && s.visual.template === 'statement');
    for (const c of cards) {
      const lines = c.visual.lines || [];
      if (lines.length > 2) warns.push(`${c.id}: problem statement has ${lines.length} lines; keep it to two`);
      for (const l of lines) if (wordCount(lineText(l)) > 10) warns.push(`${c.id}: problem line "${lineText(l)}" is ${wordCount(lineText(l))} words; 10 max reads at a glance`);
    }
    const share = words(by.problem) / total;
    if (share > 0.25) warns.push(`the problem takes ${Math.round(share * 100)}% of the words; keep it under 25% so the demo gets the time`);
    if (by.problem.length > 3) warns.push(`${by.problem.length} problem scenes; one or two land harder`);
  }

  // ---- solution: one plain sentence that names the product and what it does
  if (by.solution.length) {
    const s = by.solution[0];
    const first = sentences(s.vo)[0] || '';
    if (nameWord && !first.toLowerCase().includes(nameWord)) warns.push(`${s.id}: the solution's first sentence should name the product ("${plan.product.name} lets you ...")`);
    if (wordCount(first) > 20) fails.push(`${s.id}: the solution sentence is ${wordCount(first)} words; say it in 20 or fewer`);
    if (by.solution.length > 2) warns.push(`${by.solution.length} solution scenes; one sentence and straight into the product`);
    const onScreen = s.visual?.type === 'page' || (s.visual?.type === 'card' && ['solution', 'flow', 'compare'].includes(s.visual.template));
    if (!onScreen) warns.push(`${s.id}: show the solution as the product itself, a "solution" card or a "flow" card, not a plain statement`);
  }

  // ---- demo: the live product, with the cursor on the word and one signature moment
  if (by.demo.length) {
    // The demo is the product itself: a live page, or a real recording of it (a "video" scene, for example Telegram).
    const cardsInDemo = by.demo.filter((s) => !['page', 'video'].includes(s.visual?.type));
    for (const s of cardsInDemo) fails.push(`${s.id}: the demo is the live product; a card cannot stand in for it`);
    if (by.demo.length < 2) fails.push(`only ${by.demo.length} demo scene; show at least two beats (three is the target)`);
    else if (by.demo.length < 3) warns.push('two demo beats; three (action, result, why it matters) is the target');
    const share = words(by.demo) / total;
    if (share < 0.4) warns.push(`the demo has ${Math.round(share * 100)}% of the words; give it at least 40%`);
    let zooms = 0, focuses = 0;
    for (const s of by.demo) {
      const acts = s.visual?.actions || [];
      const z = acts.filter((a) => a.do === 'zoom').length;
      zooms += z;
      focuses += acts.filter((a) => a.do === 'focus' && !a.off).length;
      if (z > 1) warns.push(`${s.id}: ${z} zooms in one scene; one per beat`);
      if (acts.length && !acts.some((a) => a.onWord || a.at != null)) warns.push(`${s.id}: no action is timed with onWord; the click should land on the word that names it`);
      if (!acts.length && s.visual?.type === 'page') warns.push(`${s.id}: a demo scene with no actions is a static screen; move the cursor to what the voice names`);
    }
    const marked = by.demo.filter((s) => s.signature).length;
    if (!zooms && !focuses && !marked) fails.push('no signature moment: zoom or focus on the result once, or mark the scene that lands it with "signature": true');
    const sig = by.demo.filter((s) => s.signature);
    if (sig.length > 1) warns.push(`${sig.length} scenes marked signature; there is one`);
  }

  // ---- pitch-deck slides: sourced, short, and never standing in for the product
  const deckBeats = ['hook', 'problem', 'solution'];
  const slides = scenes.filter((s) => deckBeats.includes(s.beat) && s.visual?.type === 'card');
  if (slides.length > 5) warns.push(`${slides.length} slides before the demo; a deck act of 3 to 5 keeps the product on screen sooner`);
  const deckShare = words(scenes.filter((s) => deckBeats.includes(s.beat))) / total;
  if (deckShare > 0.4) warns.push(`hook, problem and solution take ${Math.round(deckShare * 100)}% of the words; keep the deck act under 40% so the live demo leads`);
  for (const s of scenes) {
    const v = s.visual || {};
    if (v.type !== 'card') continue;
    if (v.template === 'problem') {
      if (!v.head) fails.push(`${s.id}: a problem slide needs a "head" (the pain in one line)`);
      else if (wordCount(String(v.head).replace(/\*/g, '')) > 12) warns.push(`${s.id}: problem head is ${wordCount(v.head)} words; 12 max reads at a glance`);
      if ((v.rows || []).length > 3) warns.push(`${s.id}: ${v.rows.length} evidence rows; three at most`);
      for (const [i, row] of (v.rows || []).entries()) {
        if (/\d/.test(`${row.value || ''} ${row.text || ''}`) && !row.source) fails.push(`${s.id}: evidence row ${i + 1} has a number and no source; add "source" or cut the number`);
      }
    }
    if (v.template === 'quote') {
      if (!v.source || !v.who) fails.push(`${s.id}: a quote needs "who" and "source": real words from a real place, or no quote`);
      if (s.beat !== 'problem') warns.push(`${s.id}: a quote belongs in the problem beat`);
    }
    if (v.template === 'compare') {
      if (!['problem', 'solution'].includes(s.beat)) warns.push(`${s.id}: a compare slide belongs in the problem or solution beat`);
      if (!(v.before?.steps?.length && v.after?.steps?.length)) fails.push(`${s.id}: a compare slide needs before.steps and after.steps`);
    }
    if (v.template === 'flow') {
      if (s.beat !== 'solution') warns.push(`${s.id}: a flow slide (how it works) belongs in the solution beat`);
      const n = (v.steps || []).length;
      if (n < 2 || n > 4) fails.push(`${s.id}: a flow slide has 2 to 4 steps (got ${n})`);
    }
  }

  // ---- close: name, link
  const close = by.close.at(-1);
  if (close) {
    const v = close.visual || {};
    if (!(v.type === 'card' && v.template === 'end' && v.url)) warns.push(`${close.id}: close on the end card with the link`);
    if (nameWord && !String(close.vo || '').toLowerCase().includes(nameWord)) warns.push(`${close.id}: say the name once more at the close`);
  }

  // ---- voice: plain words, short sentences, sourced numbers
  for (const s of scenes) {
    const hype = String(s.vo || '').match(HYPE);
    if (hype) fails.push(`${s.id}: hype word "${hype[0]}". Say what it does instead`);
    for (const sen of sentences(s.vo)) if (wordCount(sen) > 18) warns.push(`${s.id}: "${sen.slice(0, 50)}..." is ${wordCount(sen)} words; split it (15 max reads aloud well)`);
    const v = s.visual || {};
    if (v.type === 'card' && v.template === 'stat' && !v.source) fails.push(`${s.id}: a stat card needs a source, or cut the stat`);
  }

  const outline = BEATS.filter((b) => by[b].length).map((b) => ({ beat: b, scenes: by[b].map((s) => s.id), words: words(by[b]), share: Math.round((words(by[b]) / total) * 100) }));
  return { fails, warns, outline };
}

export function printStory({ fails, warns, outline }) {
  if (outline.length) {
    console.log('story');
    for (const o of outline) console.log(`  ${o.beat.padEnd(9)} ${String(o.words).padStart(4)} words ${String(o.share).padStart(3)}%  ${o.scenes.join(', ')}`);
  }
  for (const f of fails) console.log(`FAIL  ${f}`);
  for (const w of warns) console.log(`WARN  ${w}`);
  if (!fails.length && !warns.length) console.log('story is clean');
}
