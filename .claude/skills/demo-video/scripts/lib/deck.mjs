// Pitch-deck support for card scenes: (1) any item in a card may carry `onWord` (and `occurrence`), which becomes
// `at`, the second it appears, so a slide reveals each point as the narrator says it; (2) the chapter rail and the
// progress line across the whole video. Pure functions, tested by test-deck.mjs.
import { BEATS, CHAPTERS } from './story.mjs';

const clean = (s) => String(s).toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * Returns a copy of `data` where every `onWord` is resolved to `at` (seconds after the card's go()), and every
 * `<key>OnWord` to `<key>At`. `goLead` is how long go() runs before capture starts (record.mjs: 0.25 s).
 * Unknown words keep their default timing and are reported in `missed`.
 */
export function resolveCues(data, entry, goLead = 0.25) {
  const missed = [];
  const words = entry?.words || [];
  const lead = entry?.lead ?? 0;
  const timeOf = (word, occurrence = 0) => {
    const w = words.filter((x) => clean(x.text) === clean(word))[occurrence];
    if (!w) { missed.push(word); return undefined; }
    return +(lead + w.start + goLead).toFixed(3);
  };
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = walk(val);
    if (typeof v.onWord === 'string') { const t = timeOf(v.onWord, v.occurrence); if (t !== undefined) out.at = t; }
    for (const [k, val] of Object.entries(v)) {
      const m = /^(.+)OnWord$/.exec(k);
      if (m && typeof val === 'string') { const t = timeOf(val, v[`${m[1]}Occurrence`]); if (t !== undefined) out[`${m[1]}At`] = t; }
    }
    return out;
  };
  return { data: walk(data), missed };
}

/** Chapter rail and progress for scene `index`: chapters present in the plan, the current one, and percent of runtime. */
export function deckProgress(plan, index, starts, total) {
  const present = BEATS.filter((b) => CHAPTERS[b] && plan.scenes.some((s) => s.beat === b));
  const scene = plan.scenes[index];
  const current = present.indexOf(scene.beat);
  const pct = (t) => Math.max(0, Math.min(100, +((t / Math.max(total, 0.001)) * 100).toFixed(1)));
  return { chapters: present.map((b) => CHAPTERS[b]), current, from: pct(starts[index] ?? 0), to: pct(starts[index + 1] ?? total) };
}
