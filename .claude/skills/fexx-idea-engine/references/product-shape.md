# Product shape — proposer · adjudicator · approver

The architecture all ten of the source's builds share. It is the reason they demo well *and* survive
scepticism: **the thing that decides is not the thing that generates.**

Source: `fexx-levelproof` (`core/verifier.ts`, `core/level.ts`, `ui/check-strip.tsx`,
`docs/movement-model.md`), and the same shape in GroundTruth, OathCast, Winnow, ThesisGate.

## Contents

- [The three roles](#the-three-roles)
- [Build the adjudicator first](#build-the-adjudicator-first)
- [One shared source of truth for determinism](#one-shared-source-of-truth-for-determinism)
- [Tri-state verdict vocabulary](#tri-state-verdict-vocabulary)
- [Answer-text mapping: show the answer, not the status](#answer-text-mapping-show-the-answer-not-the-status)
- [Honest-hedge copy as a UI primitive](#honest-hedge-copy-as-a-ui-primitive)
- [Invert the AI's default verb](#invert-the-ais-default-verb)
- [Disclose the seam](#disclose-the-seam)
- [Checklist](#checklist)

---

## The three roles

```
┌─────────────┐     proposes      ┌──────────────────┐    verdict     ┌───────────┐
│  PROPOSER   │ ────────────────► │   ADJUDICATOR    │ ─────────────► │ APPROVER  │
│  the LLM    │                   │ deterministic,   │                │ the human │
│             │                   │ replayable,      │                │           │
│ suggests,   │                   │ offline          │                │ applies / │
│ drafts,     │                   │                  │                │ rejects   │
│ phrases      │                   │ owns: evidence,  │                │ owns: the │
│             │                   │ scores, verdicts,│                │ commitment│
│ NEVER owns  │                   │ amounts          │                │           │
│ a verdict   │                   │                  │                │           │
└─────────────┘                   └──────────────────┘                └───────────┘
```

> **"The deterministic engine owns evidence, scores, verdicts, amounts, and commitments."**

An LLM may never own a score, a verdict, an amount, or a commitment. This is not a purity preference —
it is what makes the demo *answerable* when a judge asks "how do I know that's right?" You answer by
running the engine again, offline, in front of them.

**State in the README which role owns the verdict.** A reader should never have to guess whether the
model or the engine decided.

## Build the adjudicator first

The ordering rule:

1. **Build the deterministic adjudicator before wiring the model**, so the demo works with the model
   unplugged.
2. Then wire the proposer.
3. Then the approval UI.

LevelProof's log shows the payoff: the core engine landed on Sep 11 with strict schemas, a versioned
catalog, connectivity derivation, a movement engine, and a bounded search verifier — *"the single
`transitions`/`step` movement engine shared by player, ghost, verifier, and search"* — with
**28 tests green** and no model involved. The model arrived two entries later.

A second payoff: when a model *fails*, the product still shows something true. An unwinnable level is
detected by the engine, labelled, and returned to the draft — *"a twist that breaks recovery is the
product working, not failing."*

## One shared source of truth for determinism

> Prefer a single documented source of truth for determinism — one `step()` / `transitions()`
> **shared by player, ghost, verifier, and search** — over duplicated logic in each surface.

Four consumers, one implementation:

```
                 ┌──────────────────┐
   player  ──────►│                  │
   ghost   ──────►│  step() /        │
   verifier──────►│  transitions()   │
   search  ──────►│                  │
                 └──────────────────┘
```

Why it matters: the ghost replay, the automated check and the human's manual play **cannot disagree**
about what happened. That is also a demo feature — *"Manual play … walks the same core `step` — one
transition per input — and calls out 'You reproduced the failure' when the player's exact state
matches the dead-end witness state."*

Write the contract down (`docs/movement-model.md` is a *"determinism contract that names the single
source of truth"*).

## Tri-state verdict vocabulary

```ts
export type Status = 'pass' | 'fail' | 'unknown' | 'not_applicable';

// The answer to the question, not the raw status.
export function answerText(kind: CheckKind, status: Status): string {
  if (status === 'unknown')        return 'Check incomplete';
  if (status === 'not_applicable') return kind === 'requirements' ? 'No rules set' : 'Not applicable';
  if (kind === 'recovery')         return status === 'pass' ? 'Never' : 'Yes';
  return status === 'pass' ? 'Yes' : 'No';
}
```

Rules:

1. **At least one `unknown` state**, and prose stating that **unknown is not a negative result.**
2. **Log a reason for every excluded candidate.** Winnow's version: *"a reason for each candidate that
   was excluded"*; GroundTruth's: *"confirmed / unknown / conflicting"*.
3. **Render status as text plus colour — never colour alone.** The shell states this outright:
   *"Color never carries a verdict alone; every status also renders as text."*
4. **Name the limits of the guarantee at the point of the claim:**
   > *"Exhaustive bounded exploration — one successful route never proves no bypasses or dead ends."*
   In `--text-xs` muted, beside the control. Never a docs page, never a generic disclaimer — branch the
   sentence on the actual outcome.

## Answer-text mapping: show the answer, not the status

The check strip's visible headline is the **question**, and its status slot holds the **answer** to
that question. The technical term is demoted to a `title` and a `visually-hidden` span.

```tsx
/** Plain-language questions, each backed by the named exhaustive check. */
export const CHECK_QUESTIONS: Record<CheckKind, { question: string; technical: string }> = {
  solution:     { question: 'Can it be won?',            technical: 'Solution' },
  requirements: { question: 'Does it follow your rules?', technical: 'Design requirements' },
  recovery:     { question: 'Can a player get stuck?',   technical: 'Recovery' },
};
```

Rendered:

```
Can it be won?                  Yes
Does it follow your rules?      Yes
Can a player get stuck?         Never
```

Not `PASS / PASS / PASS`. The word PASS never appears as a visible headline. This single change does
more for perceived quality than any visual polish — it converts a status readout into an answer.

## Honest-hedge copy as a UI primitive

The product's own uncertainty appears **in the interface**, next to the claim it qualifies:

| Situation | Copy |
|---|---|
| cached result | `Cached result · no new model call` |
| cost unknown | `cost unavailable` (never `$0.00000`) |
| a bound, not a proof | `Exhaustive bounded exploration — one successful route never proves no bypasses or dead ends.` |
| model phrasing an engine verdict | `The engine's verdict and explanation above always stand on their own — this adds narrative, never authority.` |
| proof source unreachable | a degraded label instead of a caption: *"the caption never appears without a working link"* |
| still running | `Streamed live · nothing changes until you apply` |

The pattern: **place the hedge where the claim is made**, branch it on the actual outcome, and never
write a generic disclaimer elsewhere in the app.

## Invert the AI's default verb

Where the field asks a model to **approve**, make it **refute** — and pay it for the inverted action so
the incentive cannot contradict the product.

- GroundTruth: adversarial verification of condition reports.
- OathCast: a *"transparent calibration court"* — forecasters are scored on calibration, which requires
  them to be wrong publicly and often.
- Winnow: *"deterministic sybil clustering"* — the machine's job is to exclude, not to admit.

The reason this matters commercially: an AI that approves everything cannot be differentiated, because
approval is the field's default and the default is what you are negating (Phase 1 of the skill).

## Disclose the seam

Determinism in a demo is bought, and the purchase must be visible:

- Prewarm the cache exactly as the UI sends it (`scripts/prewarm.ts` *"warms every chip exactly as the
  editor sends it"*), then label the state: `Cached result · no new model call`.
- Disclose cache retention: *"Entries hold prompt text for 7 days (disclosed)."*
- **The cache is instance-local — a cold start means fresh calls, never stale verdicts.**
- If a model response is unavailable, **label the seeded fallback as deterministic in the demo
  script**: *"If a model response is not available, label the seeded scene/ghost playback as a
  deterministic backup; do not present it as live generation."*
- Streaming progress card copy must **refuse to over-claim**:
  *"Streamed live · nothing changes until you apply"*, with the model's own plan headlines shown
  separately from the operations actually written.

## Checklist

- [ ] Three named roles, and the README says which owns the verdict.
- [ ] The adjudicator was built before the model, and the demo runs with the model unplugged.
- [ ] One shared deterministic core consumed by every surface (player, replay, checker, search).
- [ ] Verdict enum has an `unknown`, and prose says unknown ≠ negative.
- [ ] Every exclusion carries a logged reason.
- [ ] The visible check headline is a **question**; the slot holds the answer; the technical term is
      demoted to `title` + `visually-hidden`.
- [ ] Status is text **and** colour.
- [ ] The guarantee's limit is stated at the point of the claim, branched on the outcome.
- [ ] Absent values render `unavailable` / `—`, never a zero.
- [ ] The AI's verb is inverted (refute, exclude, score) and the incentive matches.
- [ ] Every bought determinism is disclosed in the UI and named in the demo script.
- [ ] The determinism contract is written down and cites the single source of truth.
