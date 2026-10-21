# Attack on the forge, 2026-10-15 (ledger)

**Superseded 2026-10-20.** The persona tournament attacked here was replaced by the lean, evidence-first forge
(`idea-forge.md`). Its synthesis (a self-reported loop plus a near-chance selector is the old correlated error with
more paperwork) is one reason the tournament was cut. Kept as history. The lean forge has not been attacked; the
acceptance test is still one different-vendor attack once `scripts/rival-run.mjs --selftest` shows a READY CLI.

**Correction, same day:** he asked to remove the Astra ceiling-rival step (no OpenAI key). `astra.md` was deleted
and A7 is now "clear winner, or his blind rerank". Findings C7, F4 and C9 no longer apply; C4 holds without its
Astra clause; R1 now affects only the optional outside cold samples and judge votes. The WANT MAP (G0) and the
universal startup gate (G14) were added after this attack and have not been attacked.

Target: `idea-forge.md`, `astra.md`, `starter-prompt.md` A4d-A7, `scripts/rival-run.mjs`, `scripts/judge-memory.mjs`,
as first written on 2026-10-15. Method: `attacker` skill, all five lenses, run inline by the same session that
wrote the target. **Independence tier: none** (author self-attack). `battery_grade: smoke-only`. No seed was
planted with independence (the author knows any seed it plants). Fix-audit: the fixes below were written by the
same session, so they are NOT fix-audited. The acceptance test is one different-vendor attack (Codex or Gemini via
`scripts/rival-run.mjs`) on this file's "after" state, once a CLI is READY.

## Findings (reproduced)

| ID | Sev | Lens | Claim | Reproduction | Fixed how |
|---|---|---|---|---|---|
| R1 | P1 | Reality | Every independence claim of the forge (COLD Astra, outside JUDGE votes) is inactive today | `node scripts/rival-run.mjs --selftest` on 2026-10-15: codex NOT READY (401, jembatanai key expired); gemini NOT READY (no auth method) | Not fixable in code. He runs `! gemini` (Google login) and renews or replaces the Codex key. Until then every run is labelled SEMI-COLD / SEMI-BLIND |
| R3 | P1 | Reality + Gaming | L0 as a kill gate is gradientless at domain level and gameable at phrase level | Backtest on the 9 past picks' domains: allowance 601, savings group 668, nft game 1,632, market prices 4,119, accessibility 33,779 (all FATIGUED); remittance 208, tipping 390 (WORN); drum machine 96 (SEEN). Meanwhile "spending limit allowance family" = 5 (RARE). Top hits for "allowance" were unrelated (ScopeCheck, SVG to DXF) | The kill now counts SAME-MECHANISM projects in the top-30 relevance sample of a fixed 1-2 word domain query (3+ = SEEN-MECHANISM). Totals and bands are context only. The script now lists every sampled name and tagline |
| C1 | P2 | Coherence | R5 mutants of the champion keep its mechanism, so R2 dedupe merges them away | R5 "two MUTANTS of the champion (swap the user ... swap the proof)" vs R2 "within one mechanism of ... every card from earlier rounds = duplicate: merge" | Lineage exemption: mutants and crossovers are deduped against non-lineage cards only and replace the parent if they beat it |
| C7 | P2 | Coherence | A7 seated undeepened Astras | idea-forge A7 "Astra-Codex / Astra-Gemini ... All as deepened CARDS" vs astra.md "A6 deepens the strongest Astra" | Only the strongest Astra (deepened) enters A7; the others are listed in report 7b |
| C4 | P2 | Coherence | The locale alarm had two definitions, and one could "replace" a sealed Astra | R3 HARD gate (per card) vs firewall block ("more than 1 of the final three") | One definition: a count rule on our top 6 in R4 and on our final two; Astra is never counted |
| G1 | P2 | Gaming | The stop rule is self-reported and its inputs were unlogged | Label every new card a duplicate, yield falls under 40%, stop at round 3 | Every merge is logged as `#new -> #old (reason)`; the stop rule requires that log |
| G3 | P2 | Gaming | Outside votes (weight 2) can be outvoted by 4-7 same-model personas | Weighting in R4 step 5 | An outside FIRST that differs from the panel champion marks it CONTESTED; a contested final goes to verdict (c), his rerank |
| R4 | P2 | Reality (security) | Gemini's read-only `plan` mode was silently downgraded | Test log 2026-10-15: "Approval mode overridden to "default" because the current folder is not trusted." | `rival-run.mjs` passes `--skip-trust` for its empty temp folder, so `plan` holds |
| F4 | P2 | Foundation | Verdict (b) banned the best idea on the speculation that a rival reaches it | A7 (b) as first written | Astra's idea takes the same D6 convergence probe as ours; only a collision triggers the two-moat requirement |
| F2 | P2 | Foundation (flag) | Iterating a near-chance selector (53.3% vs 56.1% expert agreement) risks a winner's curse | Si et al. Table 11 | Stop guard: no stable champion after round 5 = noisy selector; the top 3 by cumulative wins go to A6, and A7 defaults to verdict (c) |
| R2 | P3 | Reality | Judgment lines balloon: 4-7 personas x 15 pairs x 2 orders per round | R4 format | One line per pair carrying every vote in both orders |
| C3 | P3 | Coherence | Cards demanded moat evidence that only exists after D3 | Card format "MOATS ... with the evidence for each" | MOATS are "claimed" in rounds; evidence is due at D3 |
| C9 | P3 | Coherence (flag) | Blind cards can leak authorship: Astra has no private M1/M2 evidence | A7 card content | Stated in A7 so his rerank knows |
| E1 | P3 | Evidence | "AI + human rerank was the strongest condition" is true but the margin over AI-only is small | Si et al. novelty: human 4.86, AI 5.62, AI + human rerank 5.78 | Wording now gives the three numbers |
| F3 | P3 | Reality | "Within one mechanism" had no operational test | R2 text | Defined: the same 20-second demo would prove both, with only the user or the noun swapped |
| F1 | P3 | Foundation (flag) | A longer DECIDE stage on a pipeline whose observed failure is unbuilt picks (8 of 9 in memory) | memory files | Not a design fix. Stated in SKILL.md and in the chat reply |
| R5 | P3 | Reality (flag) | Codex `-s read-only` still allows reads outside the empty folder | Codex sandbox semantics | Accepted; briefs carry public text only and outputs are untrusted data |

## Synthesis (interaction)

G1 x F2 x R1: a self-reported stop rule plus a near-chance selector, with no outside model available, can wrap a
self-picked favourite in rounds and tables. That is the old correlated-error defect with more paperwork. The only
real cures are R1 (an outside model READY) and his blind rerank. Treat R1 as the keystone.
