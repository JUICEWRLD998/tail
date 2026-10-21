# The empty-cell sweep, and bet shaping

**Provenance (2026-09-29).** Extracted from a peer's hackathon decision note (`DECISION.md`, v5, OneAquaHealth
IEEE Global Hackathon 2026 — a 67-line compressed selection memo written before any code). The note was read
in full and its method reverse-engineered; §9 below is a live re-run of its central claim, performed by us on
the same day, which both **confirmed** the claim and exposed a hole in how it was made. Sections marked
**ADDED BY US** are improvements this extraction makes on the source method, each with the failure it
prevents. The source is one document, not a corpus — treat this as a strong prior from a single good
operator, not a law.

**What this adds to what we already have.** `repo-anatomy-and-idea-engine.md` is about *building* the idea
(README skeleton, naming, demo checklist). `lane-gate-and-judge-conversion.md` says *check whether the lane is
owned* and colour it green/yellow/red. This file is the missing operational layer between them: **how to
sweep a field, name the one cell that is empty, and price the bet before you commit build time to it.** The
source did all of this in under 70 lines, which is the point — it is a *selection* artifact, not a plan.

---

## 1. The core move (the whole method in one paragraph)

**Do not ask "what should I build?" Ask "what is everyone else building, grouped by approach — and which cell
of that taxonomy has nobody in it?"** The source enumerates its field's entrants **as a taxonomy of
approaches**, not a list of competitors:

```
Report → triage/risk → FHIR → clinicians:  StreamReach, StreamLink, Tributary, Rill, Riffle,
                                           AquaGuard, AquaSentinel
Dashboards/maps:                           Insight Hub, StreamPulse
Macroinvertebrates:                        Bahari, Riffle
Birdsong:                                  Murmur
Mosquitoes:                                BiteCast
Wellbeing/gamification:                    StreamLens, Aqua Quest
Pharmaceuticals / AMR:                     no entry found          ← the empty cell
```

Then it commits to the empty cell. That is the generative act: **the idea is the named absence in a crowded
field**, not a brainstorm of features. Which is why it beats "an AI tool for X" — the latter is a cell that
already has seven occupants, and you cannot see that until you draw the taxonomy.

**Perfunctory AI-generated ideas lose at this step, every time**, because a model asked for ideas produces the
*modal* idea — it samples the same region of the space every other team sampled. The empty cell is invisible
from inside the model's default distribution. It is only visible from **field telemetry**: what repos exist,
right now, sorted by approach.

---

## 2. The protocol (the source's 8 steps, in its own order)

Run in this order. Steps 1–3 are cheap and can kill the campaign before any design work.

### Step 1 — Record the deadline as a fact; do not price the bet in days
> *"Deadline: <date, named timezone>. Gates nothing."*

**Overridden 2026-09-30 (his standing instruction).** The source capped selection at the hours left. Mustapha
builds fast with Claude Code, so days left is never a budget, a gate or a scope limit for him, and selection
takes as long as finding the first-place idea takes. Write the deadline down as a dated fact and go on to
Step 2. The source's cap is kept here only as the reason for the override: a capped search is how a modal
idea gets chosen.

### Step 2 — Eligibility as a gated task with a named owner and a cutoff
> *"§1 Eligibility — PENDING, owner Femi, cutoff Sep 30."*

Every unknown that could disqualify the entry is written as a **task, with an owner and a date**, and tracked
in its own section. An unresolved eligibility question is the highest-severity open risk in the document —
above any technical risk, because it can zero the entire entry.

**Worked example of why this matters (ours, 2026-09-29).** The source recorded the Devpost overview's box:
*"Students only · Team required · Companies excluded."* The **rules page** says the opposite: *"Open to
individuals or teams"*, no student restriction, the only individual requirement being *"Participants must meet
the legal age requirement in their country of residence."* Two pages of the same event contradicted each
other. **The rules page governs.** Had the overview been trusted, an eligible team would have withdrawn or
scrambled to recruit teammates it did not need.

### Step 3 — Get the weighted rubric, and the judge table
> *"Rubric (verified, rules page): Impact & Alignment 30 · Innovation 20 · Technical 20 · UX 15 · Feasibility/Scale 15"*
> *"Judges include Maria João Feio (Program Coordinator, Coimbra), …"*

Take the weights from the page that governs (rules), not the summary page, and quote the source. Then build
the **judge table with affiliations** — and use it in step 6.

### Step 4 — The empty-cell sweep
Enumerate the field, group by approach, count, and name the cell with no occupants. §3 below is the protocol,
§9 is a worked run.

### Step 5 — The rubric-mapped pitch
> *"Why it can win:*
> *- Impact/Alignment (30): built directly on Rodrigues & Feio 2025 … The coordinator judge will recognize her own data.*
> *- Innovation (20): no competing entry found in this lane.*
> *- Technical (20): real data plus a transparent mass-balance …*
> *- UX (15): one flow and one action, mobile-first, readable in plain language.*
> *- Scale (15): works in any EU city with NORMAN EMPODAT data; pharmacies act as the distribution channel."*

**One bullet per weighted criterion, with the weight shown, in descending weight order.** This is not
decoration: a criterion with no bullet is a criterion you have silently decided to lose, and writing the list
forces that decision into the open. Note that the pitch is *reordered by the rubric*, not by the product's own
architecture — the 30% criterion leads.

### Step 6 — Judge-alignment check (usually free, often decisive)
The highest-leverage line in the whole note: the idea is built on **the paper of the judge who owns the
heaviest criterion**. The Program Coordinator of the consortium is an author of the study the product uses as
its dataset. That converts "Impact & Alignment 30%" from a claim into a demonstration, and it costs nothing
but attention — the data is the consortium's own published output and it is open access.

**The generalised move: find the panel's own work — its papers, datasets, standards, previous products,
published position — and make your entry a continuation of it.** Then say so in the submission, plainly and
without flattery: *"we built directly on the consortium's own 2025 study."*

### Step 7 — The decisive-question block, time-boxed, with branches pre-written
> *"Q: Is real, citable pharmaceutical data available for the case-study sites? → PASS (partial) …*
> *Still open (60-min cap, Sep 30 AM): do the supplementary tables give site- or city-level concentrations?*
> *- If yes: use real per-city values.*
> *- If no: use the paper's reported medians and detection frequencies, plus NORMAN EMPODAT, labeled 'published summary' in the UI."*

This is the best structural idea in the source. The one question the whole product depends on is written down,
**capped at a stated number of minutes**, with **both outcomes and both resulting designs already decided**.
The builder then executes rather than deliberates, and the branch is chosen by evidence instead of by mood at
hour 30.

### Step 8 — Build contract, cut order, and a pre-committed switch date
```text
Build contract
Pitch:            (one paragraph)
Single workflow:  the one path the product has
Completion evidence:  what "done" concretely means
Out of scope:     named, so it cannot creep back in
Cut first:        an ORDERED list
Reconsider only if: the one condition that flips the decision
Owner · thin path by <date> · freeze <date> · submit <date>
Pending:          <task> (<owner>, <date>)
```
Plus the milestone that most notes lack: *"Oct 2, 12:00 — last point to switch to the fallback."* A **fallback
with a switch DATE**, not a wish.

---

## 3. The sweep protocol (ours; the source did not record how it searched)

**ADDED BY US.** The source's central claim — "no entry found" — was made without a recorded query, date,
scope, or method. A lane claim is load-bearing (the whole idea is *the empty cell*), and an unrecorded one is
unfalsifiable: it cannot be re-run, checked, or contradicted. **A lane sweep is evidence and gets the same
treatment as any other evidence.**

Record, for every sweep:

```markdown
## Lane sweep — <YYYY-MM-DD>, <agent>
Platform: <Devpost gallery | GitHub repo search API | npm | arXiv | ...>
Query:    <the literal query string>
Result:   <count>  (+ the hits, grouped by approach)
Verdict:  <lane> = GREEN | YELLOW | RED
Blind spots: <what this query structurally cannot see>
Re-check: <the cheap command to re-run, and the date to re-run it>
```

Rules:
1. **Group hits by approach, never list them flat.** The taxonomy *is* the finding; the count is secondary.
   Ten repos doing one thing is one occupied cell, not ten competitors.
2. **Query the field from more than one angle.** A single query that returns 0 owes you a second query that
   *would* have returned hits if the lane were occupied — otherwise the 0 may be a broken probe. (Our
   `pharmaceutical+stream+hackathon: 0` is only meaningful beside `oneaquahealth: 29`. The second number is
   the **planted positive control** for the first.)
3. **Declare the blind spot.** Devpost does not publish project galleries until judging, so *no search can
   prove absence in this lane* — only that it is not publicly discoverable today. Write that sentence down
   rather than implying the absence is proven.
4. **Set the re-check.** Lane occupancy is the fastest-decaying fact in the document. Re-run before freeze.

---

## 4. Why an empty cell is empty — the warrant

**ADDED BY US.** This is the check that turns the method from clever into sound. **Zero occupants is a
finding, but not yet a reason.** A cell can be empty because:

| Why it is empty | Is it a green light? |
|---|---|
| Nobody thought of it | Yes — the good case |
| The data does not exist / is unobtainable | No — you will discover this at hour 30 |
| It is not judge-aligned, or is out of scope for the theme | No — you will score badly and not know why |
| It is technically infeasible in the sprint | No — you will cut it at freeze and have nothing |
| It is socially awkward / needs an operator you do not have | Usually no |

**Rule: for any empty cell you commit to, write the warrant — why it is empty, and the evidence that rules out
each alternate reason.** In the source's own case the warrant is real and strong: the cell is empty because
**the consortium's pharmaceutical study is recent (Sept 2025) and the data is open access but requires reading
a paywalled-adjacent paper's supplementary tables** — i.e. it is empty for the *good* reason (the field had
not noticed the data) while carrying one live failure mode (the data may be unreachable), which the source
handled correctly by making it step 7's pre-branched decisive question.

That is the pattern: **an empty cell whose warrant names a data risk must carry a pre-written branch for that
risk.** If it does not, you have chosen the cell for luck.

---

## 5. Add the falsification layer (fexx Phase 1 × the empty-cell sweep)

**ADDED BY US — the synthesis this file exists for.** The source's pitch is a *positioning* ("nobody else is
here"). `fexx-idea-engine` Phase 1 asks for something stronger and orthogonal: a **negation** — the field's own
default belief, falsified with a number. The two compose:

> **The empty cell tells you WHERE to build. The falsification tells you WHAT to say.**

An idea that only has the empty cell is defensible but inert — it explains why it is *uncontested*, not why it
is *true*. Adding the negation converts the pitch from "we noticed a gap" into "the field is wrong about
something, and here is the number."

Worked instance (ours): the received wisdom in this domain is *"return unused medicines to the pharmacy and
you are solving pharmaceutical river pollution."* The honest mass-balance model shows that for most of the
detected compounds this lever moves the stream concentration very little, because **human excretion dominates
the load** and treatment plants remove carbamazepine-family compounds poorly. The real levers are treatment
upgrades, prescribing volume, and riparian condition. **That is a falsification of the field's own advice, it
is quotable, and it is exactly what makes the artifact honest rather than promotional.**

**Rule: a pitch needs both halves — the empty cell (why we can win) and the negation (why we are right).**
If you can write one and not the other, the idea is not finished.

---

## 6. The judge-attack block, applied to the *idea* not the build

**ADDED BY US.** `hackathon-strategy` §Output-structure requires a 10-question "Judge Attack" before
submission; the source omitted it at *selection* time. Run a 3-question version before committing:

1. **"Why you and not the incumbent?"** If the empty cell is adjacent to a crowded one, a strong team can
   pivot into it on day 3. Answer with the thing that takes longest to copy (the reading of the primary
   source, the data pipeline, the domain model) — not the UI.
2. **"Would a tired judge understand this in 15 seconds?"** If the opening sentence needs the taxonomy to make
   sense, the pitch is written for you, not for them.
3. **"What is the one fact that, if false, kills this?"** That fact is step 7's decisive question. If you
   cannot name it, you have not found the load-bearing assumption.

---

## 7. The honesty clause as a design feature

> *"Honesty is a feature: the tool says when returning pills barely helps (excretion dominates) and points to
> the real lever (WWTP upgrades, prescribing, riparian restoration)."*

The source does not treat the uncomfortable result as a limitation to hide. It **ships the finding that
undercuts its own call to action**, and flags it as a scoring asset. This is the same instinct as fexx's
"adversarial verification" and the rubric's own preference for non-happy-path evidence: a product that
volunteers its adverse result reads as *instrumentation*, while one that only shows favourable results reads
as *marketing*. Design the honest result in, in plain language, on the primary path.

---

## 8. Anti-patterns

- **Asking a model for ideas instead of sweeping the field.** Produces the modal idea; the empty cell is not
  in the model's default distribution.
- **A lane claim with no recorded query, date, or platform.** Unfalsifiable, and stale within days.
- **Trusting the event's summary page over its rules page.** They contradict each other; rules govern.
- **Committing to an empty cell without a warrant for why it is empty.**
- **A pitch with a positioning but no negation** — "we are first here" with no "they are wrong about this".
- **Leaving eligibility as an assumption.** It is the only risk that can zero the entry outright.
- **A fallback named but with no switch date**, which in practice means no fallback.
- **An uncapped selection phase.** The note is the cap.
- **Reordering the pitch by product architecture** instead of by rubric weight.

---

## 9. Worked run — the live re-run of the source's central claim (2026-09-29)

The source asserted, from a public-GitHub inspection on Sep 29: *"Pharmaceuticals / AMR: no entry found."*
We re-ran it, recorded, in the project's own `research/lane/` folder.

```markdown
## Lane sweep — 2026-09-29
Platform: GitHub REST repo search  (https://api.github.com/search/repositories)
Query:    q=oneaquahealth          -> total_count = 29
          Filed in the source's taxonomy:
            report→triage→FHIR→clinicians  StreamLink, StreamReach, StreamFhir, StreamProof,
                                           AquaSentinel (x2), StreamSentinel, StreamVitals,
                                           Freshwater-Sentinel, StreamCheck
            dashboards/maps                OneAqua-Insight-Hub, Aqua-Signal
            macroinvertebrates/photos      AquaPlot, Neer, catchment-oneaquahealth
            birdsong                       Murmur
            mosquitoes                     BiteCast
            gamification                   Aqua-Quest-Water-Memory, StreamKeepers
            other                          AquaLinks, AquaSentinel-AI, StreamVitals, Rill
          NOT in the source's list, found today: catchment-oneaquahealth (same author as Rill),
            streamcheck, streamvitals, streamsentinel, streamkeepers, streamfhir, StreamProof,
            AquaLinks, AquaPlot, Neer, Aqua-Signal, Freshwater-Sentinel
Verification queries: q=pharmaceutical+stream+hackathon        -> 0
                      q=medicine+stream+hackathon              -> 0
                      q=antibiotic+resistance+stream+citizen   -> 0
                      q=amr+river+citizen+science              -> 0
                      q=medicine+cabinet+disposal              -> 0
                      q=pharmaco+stream                        -> 2  (both unrelated academic repos)
                      q=pharmaceutical+wastewater+treatment+plant -> 3 (all unrelated, none a hackathon entry)
Verdict:  general citizen-stream → FHIR → One Health lane = RED (29 repos, ~10 occupied cells)
          pharmaceuticals / AMR lane                      = GREEN (0 relevant, 7 queries)
Blind spots: the Devpost project gallery for this event is EMPTY and unpublished until judging
          ("the hackathon managers haven't published this gallery yet"), so no search can prove
          absence in this lane — only that it is not publicly discoverable. The source's original
          absence claim has this same hole and did not state it.
Re-check: re-run the 7 queries above before feature freeze; if the gallery opens, sweep it too.
```

**What the re-run establishes.** (1) The source's competitor taxonomy was **accurate** — every repo it named
exists, and the lane really is crowded exactly where it said. (2) Its empty-cell claim **survives** seven
independent angles. (3) Its count of the field was **an undercount** — at least 12 further entrants it did not
name, several sharing its exact approach; the cell structure holds, but "1,164 participants" understates the
density. (4) The absence claim **was not falsifiable as written** — and now is.

That last point is why this section exists: the method is good, and the evidence discipline around it is the
part worth improving.
