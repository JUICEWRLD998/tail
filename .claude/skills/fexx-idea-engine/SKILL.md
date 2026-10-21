---
name: fexx-idea-engine
description: "Generate and defend hackathon-grade product ideas: the empty-cell field sweep, the pitch formula, the naming system, the proposer/adjudicator/approver product shape, judge-fidelity, and a measured decision log. Extracted from fexx301's ten winning-build repos."
version: 1.0.0
author: Mustapha Fadhlullah
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [product, ideation, hackathon, pitch, naming, decisions, evidence, verification]
    related_skills: [hackathon-strategy, product-hardening, ui-studio, plan, spike]
---

# fexx-idea-engine

The generation method behind ten consistently-shaped, consistently-placed hackathon builds by
**fexx301** (`github.com/fexx301`) — LevelProof, AccessPing, Winnow, PegShield, GroundTruth, Embargo,
ThesisGate, MandateX, OathCast, Veto.

This is not a repo summary. It is the **repeatable formula** those ten repos share, extracted so you
can run it on an idea that does not exist yet.

**Take the method, not the genre (2026-10-04).** All ten repos are the same genre: verification and
enforcement tools (veto, embargo, gate, proof, shield). That is one builder's taste, not what judges reward.
The transferable parts are the empty-cell sweep, the measured negation, the unscripted path, the decision
log and the claims discipline. The genre-bound parts are the enforcement naming set (Phase 3) and the
proposer/adjudicator/approver shape (Phase 4): use them only when the event's users need a verdict. Copying
the genre is the same mistake as cloning a rival's UI grammar (the 2026-09-15 rebuild). For beating rivals
who also use AI, the companion is `hackathon-strategy/references/rival-simulation.md`.

**The thesis: an idea is not differentiated until you can say what it negates.** Every pitch here is a
*falsification of the field's default belief*, plus two imperatives that say what to do instead. If you
cannot write the negation, you have a feature, not an idea.

## When to Use

- Scoping a hackathon build, a bounty target, or a product in the first 48 hours.
- The user has a vague idea ("an AI tool for X") and needs it to become *differentiated*.
- You need a name that carries a verb, a one-line pitch that survives a judge's first ten seconds,
  or a demo that cannot be accused of faking.
- You are about to write a plan and want the order right — what the judge sees first, not what is
  technically first.
- **Don't use for:** executing an already-chosen idea (use `plan`, `spike`, `product-hardening`);
  judging criteria mechanics (use `hackathon-strategy`); visual craft (use `ui-studio`).

---

## Phase 0 · Sweep the field, name the empty cell

Before finding the negation, find the **named absence**. You are not asking *"what should I build?"* —
you are asking **"what is everyone else building, grouped by approach, and which cell has nobody in it?"**

```
report → triage → FHIR → clinicians   StreamReach, StreamLink, Tributary, Rill, Riffle, AquaGuard, …
dashboards / maps                     Insight Hub, StreamPulse
macroinvertebrates                    Bahari, Riffle
birdsong                              Murmur
mosquitoes                            BiteCast
wellbeing / gamification              StreamLens, Aqua Quest
pharmaceuticals / AMR                 no entry found        ← the empty cell
```

**The idea is the empty cell.** A model asked for ideas returns the *modal* idea — the same region of the
space every other team sampled — so the empty cell is visible only from **field telemetry**, never from
brainstorming. Three rules make the sweep evidence instead of a hunch:

- **Group by approach; the taxonomy is the finding.** Ten repos doing one thing is one occupied cell, not ten
  competitors, and the count alone is not the insight.
- **Always run a positive control.** A query returning 0 is meaningless unless a second query *would* have
  returned hits had the lane been occupied. `pharmaceutical+stream+hackathon` = 0 means nothing beside
  `oneaquahealth` = 29; the second number is what proves the first is a real absence.
- **Write the warrant.** Zero occupants is a finding, not yet a reason — a cell can be empty because the data
  does not exist, because it is not judge-aligned, or because it is infeasible in the sprint. And a lane claim
  with no recorded query, date, platform or blind spot is unfalsifiable and stale within days.

Then compose the two halves: **the empty cell says WHERE to build; Phase 1's negation says WHAT to say.**
Full protocol — the warrant table, the judge-alignment move, the time-boxed decisive question with branches
pre-written, the 3-question pre-commit attack, and a live worked run — in
[`references/field-saturation-and-bet-shaping.md`](references/field-saturation-and-bet-shaping.md).

---

## Phase 1 · Find the negation

Before anything else, answer: **what does the field believe that is wrong, and what is the number
that proves it?**

The source's method is concrete and brutal: **falsify the field's headline metric using the field's
own public data, then publish three rows — the headline number, the corrected number, and the count of
exclusion reasons.**

```
Headline claim        | 100,000 transactions
Corrected (deduped)   |   1,240
Excluded              |  98,760   (42 reason buckets, all listed)
```

Rules:

1. **Measure it before you build.** The falsification is the product's reason to exist.
2. **Publish the exclusion reasons, not just the corrected total.** A correction you cannot audit is
   an opinion.
3. **Write the negation as the pitch's first half.**

## Phase 2 · Write the pitch (the formula)

```
<Antithesis — what the field does, negated>
<Imperative 1> · <Imperative 2>          (each ≤ 4 words)
```

Real examples from the source's repos, verbatim:

| Repo | Pitch |
|---|---|
| LevelProof | *"Build a puzzle with AI. Watch how it breaks. Fix it without losing the idea."* |
| GroundTruth | *"Stop tokenising assets. Start tokenising the evidence."* |
| Veto | *"Approve the exact code your agent's wallet may call."* |
| Winnow | *"Reward-integrity agent for Base campaigns."* → antithesis is in the mechanism, not the line |
| ThesisGate | *"Test whether source evidence supports a trading thesis."* |
| Embargo | *"Confidential bug bounties verified with Flare Confidential Compute."* |

Structure to imitate:

- **An antithesis** — *Stop tokenising assets* / **Build with AI, watch it break**.
- **An imperative pair** — *Start tokenising the evidence* / *Fix it without losing the idea*.
- **A verb the user performs**, not a category noun. *"A platform that helps you…"* is banned.

**Hard rule:** if the one-liner cannot be written, the idea is not differentiated yet — go back to
Phase 1 and find the number.

## Phase 3 · Name it

**Default: a word from the users' own world** that they already say or hold, short, ownable, and not a
description (Derica, the Nigerian market's tomato-tin measure). The source's enforcement-morpheme system
below fits only enforcement products. Never a marketing suffix in either case.

The source's system, for enforcement products only: a **domain noun + one enforcement morpheme**.

```
-proof   levelproof,                              (the artifact proves itself)
-shield  pegshield,                               (protect a peg)
-gate    thesisgate,                              (an evidence threshold)
-cast    oathcast,                                (publish a calibrated forecast)
-ping    accessping,                              (probe and report)
veto · embargo · winnow · mandate · groundtruth   (single enforcement verbs)
```

Three tests a name must pass:

1. **Two morphemes, one of which enforces.** `winnow` (separate grain from chaff) and `embargo`
   (hold back) are enforcement verbs, not product nouns.
2. **It must carry a verb in the README's first sentence.** *"Veto the call."* *"Winnow the sybils."*
   If the name can only be *described*, not *acted with*, rename it.
3. **No invented suffix.** No `-ify`, `-ly`, `-hub`, `-verse`, no startup bingo
   (Acme, Nexus, Seamless, Unleash, Supercharge).

## Phase 4 · Architect the product shape (when the product owns a number or verdict)

Apply this when the product outputs a score, amount, verdict or commitment a user relies on. A game, a
creative tool, a social product or a marketplace does not need an adjudicator; do not force one in.
Every one of the ten builds is the same machine with different nouns:

```
Proposer      — the LLM. Suggests, drafts, phrases. NEVER owns a verdict.
Adjudicator   — deterministic, replayable, offline. Owns evidence, scores, verdicts, amounts.
Approver      — the human. Applies or rejects. Owns the commitment.
```

Rules that make this the strongest part of the method:

1. **"The deterministic engine owns evidence, scores, verdicts, amounts, and commitments."**
   An LLM may never own a score, a verdict, an amount, or a commitment.
2. **Build the adjudicator BEFORE wiring the model**, so the demo works with the model unplugged.
3. **State in the README which role owns the verdict.** A reader should never have to guess.
4. **Invert the AI's default verb** (only where the field's model approves things). Where it asks a model to *approve*, make it *refute* —
   and attach payment to the inverted action so the incentive cannot contradict the product.
   (GroundTruth's adversarial verification; OathCast's calibration court.)
5. **Verdict vocabulary gets at least one `unknown` state** (confirmed / unknown / conflicting), with
   a reason logged for every excluded candidate. *"`not_assessed` … It is not a negative verdict."*
   Binary pass/fail is a tell that no adjudicator was built.

Working code for the three-role skeleton, the tri-state enum, and the decide-what-to-log pattern:
[`references/product-shape.md`](references/product-shape.md).

## Phase 5 · Aim at what the judge actually tests

The single highest-value insight in the whole extraction:

> **Harden and open the UNSCRIPTED path, because that is the path judged.**

LevelProof's own decision log records the failure precisely: a judge-style prompt produced *"an
accepted but beige walkway — the world ignored the words"*, and a second prompt came back unwinnable.
*"Judges test with their own prompts (terms §9), so the free-prompt path, not the scripted vault, is
what gets judged."*

Consequences:

- **Re-order the plan by judge attention, not technical dependency.** Impressions form in the opening
  seconds of the video; the original plan deferred world visuals past that point and was amended.
- **Instrument the product's thesis as a one-click, STATE-AWARE path** for a cold visitor. If a
  visitor must read docs to reach the moment that proves the idea, the moment does not exist.
- **Script discovery to BREAK the thing.** Define the product's thesis as *the moment the checker
  surprises its author.* LevelProof's creator-session protocol is designed to find failure, not to
  demo — and moderator hints explicitly do not count as success.
- **Front-load the irreversible cascade into one spike week**, and if a gate fails there, **record the
  missed bar rather than moving the bar.** *(LevelProof: "no model meets the full bar" was recorded in
  `docs/model-eval.md` "rather than forced — invalid output is never accepted to hit a target.")*
- **Design the demo so it cannot be accused of faking:**
  - buy determinism *physically* (prewarmed cache) and **disclose the seam in the UI**
    (*"Cached result · no new model call"*);
  - never fabricate a state transition — rehearse, excerpt, or revisit an existing receipt rather than
    generating a duplicate transaction for a retake;
  - carry a **CLAIMS-TO-AVOID list inside the demo artifact itself**;
  - label any fallback as deterministic *in the script*: *"do not present it as live generation."*

## Phase 6 · Run the critic loop on rendered output

An external critic loop, with the stopping rule built in:

1. Score the **rendered** output against a fixed multi-axis rubric — never the source, never intent.
2. Each round gets **fresh measured evidence** (computed styles, pixel statistics, live flows).
3. Implement → browser-verify → deploy, *then* run the next critique.
4. **Calibrate against your own best surface.** LevelProof scored the shell ~9.5 and the 3D scenes
   3.7/10 — the gap between them *was* the punch list.
5. **Re-verify the gains an earlier round won.** A late fix can regress them: the final critique round
   *"discovered a mobile regression introduced by an earlier round's fix."*
6. **Stop at the contract boundary.** Score trajectory 6.4 → 9.2 → 9.4 → 9.3 → 9.3 → 9.6 → 9.6 → 9.6
   → 9.6 → 9.4: the loop asymptotes at ~9.5, and the last 0.1–0.2 is *"a long tail of increasingly
   theoretical items"*. When the score moves < 0.2, **write the plateau and its reason** so it is not
   reopened.
7. **When the grader encodes the wrong intent, fix the grader and say why — do not tune to it.**

Related: **run the critique against your own product's bar, and record honestly when a gap is outside
the contract.** *"the remaining deductions (bevels, textures, AO, character rigs) are outside §15's
design contract — the kit is three primitive templates by specification. On the product's own bar the
transformation is complete."*

## Phase 7 · Keep the measured decision log

This is what makes the method *repeatable* rather than lucky. Full protocol in
[`references/decision-log.md`](references/decision-log.md). The essentials:

- `DECISIONS.md` starts **before the first commit**. Header: *"Build-window decisions and measured
  evidence, newest first."* Prepend every entry.
- **One entry per thematic pass**, headed `## <date> (<pass name>)` — not per commit, not per day.
- **Every bullet: a bold label, then the measurement, the rejected alternative, the commit/file, and
  the test that pins it.** A bullet that reports only *that* something shipped is not accepted.
- **Never a quality adjective without its instrument and number.** No instrument → write *unmeasured*.
  Not "faster", not "cleaner UI", not "smooth".
- **Name the rejected alternative and why:**
  *"Chosen over Quaternius' realistic 'Animated Men' (too thin to read at diorama scale)"*.
- **Wrongness is an entry, not an edit.** Keep `Honest regression note` bullets; append corrections,
  never rewrite the old entry. *"the initial 0/6 was a measurement artifact"* rather than deleting it.
- **Quote your own process failures.** The log earns trust by indicting itself.
- **Label sample size and conditions inline** — `(small samples)`, `(n=8, one run)`,
  `(not yet on a real phone)`. Keep a **Known gaps** block at the end of every evidence doc.

## Phase 8 · Verify like you will be audited

Full chain in [`references/verification-discipline.md`](references/verification-discipline.md).
The load-bearing parts:

- **Make `verify` the easy path, not a discipline.** One pipefail chain, cheapest signal first:
  ```json
  "verify": "set -o pipefail && npm run typecheck && npm run lint && npm test && npm run build"
  ```
- **Ordered gates with no promotion between them:** automated tests → fixture-backed browser journeys
  → live-backend journeys → blocked/unavailable. *"A fixture success may never tick a live box;
  emulation is not a device; resize is not a real-device test."*
- **No measurement under one condition stands in for another.** fixture ≠ live model,
  SwiftShader ≠ GPU, browser media emulation ≠ an OS reduced-motion change.
- **Delegate pass/fail to a deterministic oracle** wherever one can be built. Never the generating
  model, never a human eyeball.
- **Every number carries timestamp, config, latency, cost, cache status, repeat count.**
- **Label the tiers of evidence differently** and leave unearned boxes unchecked.

## The claims discipline (applies to every artifact)

Borrow this vocabulary wholesale — it is the reason these projects read as trustworthy rather than
promotional:

- **LIVE / NEXT / NOT LIVE** — one vocabulary across README, deck, roadmap and social copy, so no two
  artifacts describe different products.
- **prepared ≠ submitted ≠ acknowledged.** Only the acknowledgement artifact (id, timestamp with
  timezone, revision) permits the word *submitted*.
- **Record metrics as measured, unavailable, or zero — never collapse an absent field into zero.**
  *"If a field is unavailable, record 'not available,' not zero."*
- **Never count self-generated activity as adoption:** *"Never count test-trading volume, generated
  accounts or repeated self-visits as organic adoption."*
- **Label every mock/concept DEMO at creation time**, and write the reuse prohibition into the doc
  that references it.
- **A produced artifact is not a completed release.** *"Rendering alone does not establish release
  readiness, anonymous source access, upload success or hackathon submission."*
- **State anti-ownership where it applies:** the contract defines what a thing IS, never what the
  caller should do about it.
- **Hypotheses are not evidence, and a simulated persona is not a participant.** LevelProof writes it
  plainly: *"No unfamiliar outside tester was available for this implementation pass. The following
  are hypotheses, not completed acceptance evidence."*

## The anti-patterns

- **Asking a model for ideas instead of sweeping the field (2026-09-29).** Produces the modal idea; the empty
  cell is not in the model's default distribution. Sweep first, then negate — see Phase 0.
- **A lane claim with no recorded query, date, platform or blind spot.** Unfalsifiable, and it decays within
  days: the competitor you did not find is the one that pivots into your cell on day 3.
- **Trusting the event's summary page over its rules page.** They contradict each other on eligibility; rules
  govern. An unresolved eligibility question is the only risk that zeroes the entry outright — track it as a
  task with an owner and a date.
- **A pitch that only has a positioning and no negation** — "we are first here" with no "and they are wrong
  about this". The empty cell says where to build; Phase 1 says what to say. You need both.
- Writing the feature list before the one-line pitch.
- Naming the product after its category, or with a marketing suffix.
- Copying the corpus genre: turning every domain into a checker, gate or refusal engine.
- Letting the LLM own a score, verdict, amount or commitment.
- Shipping binary pass/fail with no `unknown` state.
- Hardening the scripted demo path while the unscripted path — the judged one — stays soft.
- Moving a bar instead of recording a missed one.
- A "decision" entry with no measurement in it.
- Retro-editing a decision log so the history reads clean.
- Presenting the unmeasurable as measured, or the absent as zero.
- Treating a produced artifact as a released one.

Related references: [`references/field-saturation-and-bet-shaping.md`](references/field-saturation-and-bet-shaping.md)
(Phase 0 — the empty-cell sweep, the warrant for why a cell is empty, the judge-alignment move, and the
rubric-mapped pitch), [`references/product-shape.md`](references/product-shape.md),
[`references/decision-log.md`](references/decision-log.md), and
[`references/verification-discipline.md`](references/verification-discipline.md).

Then hand the build to `ui-studio` for the visual gate (kickoff: `ui-studio/references/starter-prompt.md`),
and `product-hardening` for the demo-to-product gap. The whole sequence, from event to submission, is the
two-stage kickoff in `hackathon-strategy/references/starter-prompt.md`.
