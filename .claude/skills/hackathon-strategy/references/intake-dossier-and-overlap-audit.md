# Intake dossier + sponsor-overlap audit (from Blockchain-Oracle, measured 2026-09-29)

Provenance: `github.com/Blockchain-Oracle` — 100+ repos pushed in ~6 months (API caps at 100; true total
unknown). Read in full: `keeperhub-agents-onchain-research`, `abu-context-engineering`, `silentwitness`, and
READMEs of 14 others. Tree statistics for this account were NOT obtained (unauthenticated GitHub API rate
limit hit). Hackathon RESULTS for this account were not checked, so nothing below says these builds won.

## The pattern (observed in `keeperhub-agents-onchain-research`)

Before choosing any idea, the builder produced a *research handoff, not a preselected project*:

| File | Job |
|---|---|
| `docs/CONTEXT_DOSSIER.md` | event, tech, sources, competitors, risks, eligibility — one audit |
| `docs/DECISION_AND_EXECUTION_GATES.md` | stage gates that block ideation and unsafe writes until evidence exists |
| `docs/SAFETY_OVERLAP_AUDIT.md` | what the sponsor ALREADY provides; rejects a generic duplicate harness |
| `docs/OPEN_QUESTIONS.md` | unresolved organizer/access questions |
| `AGENTS.md` + `prompts/MASTER_AGENT_PROMPT.md` | the operating rules handed to the building agent |

Concrete habits worth stealing:
1. **Timestamp the dossier and say which facts decay** ("assembled 3 Aug 2026 ... marketplace counts,
   deadlines are time-sensitive. Always refresh").
2. **Count the sponsor's surface before choosing** (442 action schemas, 35 categories, 6 triggers, 22 chains,
   9 anonymous vs 35 authenticated tools) — then build in the gap, not on what is already shipped.
3. **The overlap audit.** List each control the sponsor already offers (spend caps, allowlists, approvals).
   If your idea is one of them, it is a duplicate however well built. This is the cheap version of the
   LANE GATE for a *sponsor's own* features, and none of our current gates ask it.
4. **"Do not select a project until user/job evidence, field differentiation, and access feasibility have been
   demonstrated"** — access feasibility = one legitimate testnet call, before design (matches the credential
   check in the viability gate; here it is a hard prerequisite of selection).
5. **Hard-coded safety rules for agent-built products**: never let an LLM invent a chain, contract, selector,
   recipient, token or amount; simulate + policy-check before broadcast; never retry an ambiguous write with a
   fresh idempotency key; never call a tx "successful" before receipt + postcondition check.

## Do this at intake (adds to the viability gate, does not replace it)

1. Write `INTAKE.md` with a date. Sections: surface counts, what the sponsor already provides, cliche list,
   open questions **each with an owner and a date**, facts that decay.
2. For every candidate: one sentence "which sponsor feature does this NOT duplicate?" If none, kill it.
3. Access spike before selection: one real call with your own credentials; record the output.
4. Only then run `fexx-idea-engine` Phase 0 (empty-cell sweep) and the sponsor-primitive worksheet.

## README measurements (n = 34 READMEs: winsznx 20, Blockchain-Oracle 14; keyword probes, not judgement)

Script + planted controls: `Desktop/research-system/data/patterns.mjs`. A probe hit means the phrase appears
somewhere in the README, nothing more.

| Probe | winsznx | Blockchain-Oracle |
|---|---|---|
| verify / replay / receipt / witness vocabulary | 16/20 | 11/14 |
| judge-path / "see the result in a minute" / demo | 15/20 | 9/14 |
| status / pending / limitations ledger | 14/20 | 5/14 |
| says what the product is NOT | 13/20 | 8/14 |
| names an unaudited / trust seam | 9/20 | 6/14 |
| deterministic-engine-vs-LLM ownership language | 7/20 | 4/14 |
| explicit "unknown / inconclusive / not verified" verdict state | **3/20** | **0/14** |

**Correction to a prior assumption.** `fexx-idea-engine` treats a tri-state `unknown` verdict as a defining
trait. In THESE two accounts it is rare (3/20 and 0/14 by keyword). It is a fexx301 trait and a Refut/Kyrve/THEN
trait, not a universal one — do not present it as a field norm. What IS common is the verify-yourself artifact
and the honest status ledger. (Probe is lexical; a builder could use other words. Treat 3/20 as an upper-ish
bound on the vocabulary, not a proof of absence.)

Structural facts (winsznx, 18 repos with trees read): every one has tests; 83% have `docs/`; 72% CI; 72% have
a contracts directory; median 422 files and ~55 commits. Cadence: the 100 most recent repos were all pushed
since 2026-05-29 (~4 months) — roughly one shipped-looking project every 1-2 days across many sponsor
ecosystems (Stellar, Starknet, Somnia, X Layer, Celo, Nimiq, Casper, Story...). *Inference, not observed:*
this needs a reusable scaffold and a fast sponsor-primitive-to-product loop; the repos do not show how.

## Limits

No claim here about hackathon placements, prize money, or the authors' reasoning. The two accounts' ecosystem
mix is what the public list shows on 2026-09-29.
