// Runs the parser over the unseen-call fixtures and prints a table. Used to record the baseline BEFORE any fix.
import { check, loadFixtures } from "../test/unseen-support.js";

const fx = loadFixtures();
let pass = 0;
const rows = fx.map((f) => {
  const r = check(f);
  if (r.pass) pass++;
  const e = f.expected;
  const want = e.outcome === "card" ? `card ${e.draft.side} ${e.draft.symbol} @${e.draft.entry} tp ${e.draft.tp} sl ${e.draft.sl}` : e.outcome === "ask" ? `ask(${e.field})` : "ignore";
  const d = r.got.detail as any;
  const got = r.got.outcome === "card" ? `card ${d.side} ${d.symbol} @${d.entry} tp ${d.tp} sl ${d.sl}` : r.got.outcome === "ask" ? `ask(${d.field}): ${d.question}` : r.got.outcome === "not_listed" ? `not_listed(${d})` : r.got.outcome;
  return `${r.pass ? "PASS" : "FAIL"}  ${f.id.padEnd(40)} want ${want}${r.pass ? "" : `\n      got  ${got}`}`;
});
console.log(rows.join("\n"));
console.log(`\n${pass} of ${fx.length} behave as specified`);
process.exit(pass === fx.length ? 0 : 1);
