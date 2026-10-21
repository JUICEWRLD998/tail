# The measured decision log

`DECISIONS.md` is the artifact that makes a build's quality **reproducible** rather than lucky.
Source: `fexx-levelproof/DECISIONS.md` (889 lines, entries from Sep 11 → Sep 26).

## Contents

- [The contract](#the-contract)
- [Entry anatomy](#entry-anatomy)
- [Three real entries](#three-real-entries)
- [The measurement-instrument trap](#the-measurement-instrument-trap)
- [Honest regression notes](#honest-regression-notes)
- [Confidence and sample size](#confidence-and-sample-size)
- [The gates model](#the-gates-model)
- [Honest-forcing on model/config choice](#honest-forcing-on-modelconfig-choice)
- [Why this beats a changelog](#why-this-beats-a-changelog)
- [Template](#template)

---

## The contract

```markdown
# DECISIONS

Build-window decisions and measured evidence, newest first. Dates are 2026.
```

That single line states the four rules: it is a **decision** log (not a changelog), it carries
**evidence** (not descriptions), it is **newest-first** (so the reader sees current state), and it is
**dated**.

- **Start it before the first commit.** The first entries are repo setup and plan amendments.
- **Prepend** every entry.

## Entry anatomy

`## <date> (<pass name>)` — **one entry per thematic pass**, not per commit and not per day. Multiple
entries may share a date; the pass name scopes it, so a reader can find "the pass where we fixed the
camera" without a date range.

Inside, each bullet:

```
- **<Bold claim naming the decision>**: <the measurement, with its instrument>.
  <The rejected alternative, by name and reason.> <The commit / file.> <The test that pins it.>
```

Every bullet must answer: **what was decided, what measured it, what was rejected, and what now
prevents regression.**

## Three real entries

**1. A decision with its rejected alternative named:**

> - **Asset**: "Characters Matt" by Quaternius (CC0 1.0, via poly.pizza), one 666 KB GLB with Idle,
>   Run, Jump, Wave, Yes, and No clips; its knife is removed at runtime. This is the one imported 3D
>   asset — everything else stays procedural, and nothing is AI-generated. **Chosen over** Quaternius'
>   realistic "Animated Men" (too thin to read at diorama scale) and the RobotExpressive sample (less
>   fitting for an explorer).

Note what it contains: the licence, the byte size, the clip list, the scope constraint (*"the one
imported asset"*), and **two named rejections with the reason each was refused**.

**2. A measured bug fix, end to end:**

> - **Held keys run without a hitch** (reported: a split-second halt every few seconds). Measured with
>   a frame probe: rendering held 60 fps, but at every landing a held key stood the character still
>   for 1–2 frames (31–48 ms) until the next OS key-repeat arrived, and the follow camera moved the
>   whole view with it. Landings now continue in the direction of the key physically held (tracked by
>   keydown/keyup, cleared on blur)… **zero still frames at 33, 60, and 90 ms repeat rates**, and
>   releasing mid-move still stops at that move's landing.

The shape to copy: **reported symptom → the instrument → the root cause it revealed → the fix → the
verification across conditions.** The instrument is what separates this from a bugfix commit message.

**3. A gate pass with its own caveat attached:**

> - **Unfamiliar layout gate (§8.4, held out from all prompt work):** the seed verifies green; …
>   **Honest caveat:** it took several attempts and finally explicit cell coordinates plus the
>   fallback model; flash-lite's unaided spatial composition on novel layouts is not demo-grade,
>   consistent with `docs/model-eval.md`.

The caveat goes in the same bullet as the success. There is no separate "limitations" section a reader
might skip.

## The measurement-instrument trap

> **When a number looks bad, first ask what it actually measured.**

The log documents its own instances:

| Bad-looking number | What it actually measured |
|---|---|
| `0/6` passes | a measurement artifact, corrected later — and the `0/6` was **kept in the log** |
| poor throughput | sample fresh vs **cached** |
| a stutter | mid-animation vs **settled** |
| low fps | **SwiftShader** (software rasteriser), not a GPU |
| a broken reduced-motion behaviour | **browser media emulation**, not an OS setting |
| a layout failure | **viewport resize**, not a real device |

Rule: **log the artifact and the root cause together.** A number that answers a neighbouring question
is the most dangerous kind, because it is real.

## Honest regression notes

Keep a dedicated bullet shape for your own shipped bugs:

> **Honest regression note** — what shipped wrong, how it was caught, the fix, and **the one check
> that would have caught it earlier**.

And quote the process failures too, not just the product ones:

> the `;`-chain that reported success while lint had four errors

That last one is a shell-quoting bug in the verify script — a humiliating entry. **It is in the log.**
That is exactly what makes the rest of the log believable.

## Confidence and sample size

Label inline at the claim, never in a footnote:

```
(small samples)          (n=8, one run)           (not yet on a real phone)
Status: not conducted    ✅ measured on Apple M4 Pro via Metal, ❌ not on SwiftShader
```

Every evidence doc ends with a **Known gaps** block. LevelProof's model-eval doc is the model to
copy: it keeps the **defective configuration** with the mechanism that made it fail, and keeps a
retraction rather than deleting the wrong wording:

> Recorded in `docs/model-eval.md` **rather than forced** — invalid output is never accepted to hit a
> target.

## The gates model

Order gates as **tiers with no promotion between them**:

```
1. automated tests              (fastest, mechanical)
2. fixture-backed browser journeys
3. live-backend journeys
4. blocked / unavailable        (explicitly listed, left unchecked)
```

Hard rules:

- **A fixture success may never tick a live box.**
- **Emulation is not a device. Resize is not a real-device test.**
- **Unchecked items stay visibly unchecked.** The source's readiness checklist is *"split by evidence
  tier, with unchecked items left unchecked."*
- **End the checklist with the literal commands that define done** — `npm run verify`,
  `git diff --check` — not with a prose definition.

## Honest-forcing on model/config choice

The strongest single decision in the log:

> **§10.1 evaluation complete; no model meets the full bar.** Six models evaluated through the real
> gateway (12 fixtures × 2 uncached runs each, deterministic grading)… Best first-try semantic
> correctness is 50% against the 90% bar; best final is 67%. Recorded in `docs/model-eval.md` rather
> than forced — **invalid output is never accepted to hit a target.**

And then, instead of picking the top scorer:

> **Chosen configuration: `gemini-2.5-flash-lite` primary, `gemini-3.7-flash` fallback** … Flash-lite
> is the only model passing both absolute safety gates … **its failure classes (spatial placement,
> placeholder ids) are the fallback's strengths.** Rejected: deepseek models (quality and 55 s
> latency), gpt-oss-120b (2/4 ambiguity), qwen-plus (3/4 ambiguity after the final prompt iteration).

**Pick by complementary failure classes, not by top score.** A configuration is a *system*: what
matters is that the fallback's strengths cover the primary's weaknesses.

Also note the coupled-change discipline:

> **Model**: `gemini-3.8-flash` … replaces 3.7-flash as primary … **Production needs `LLM_MODEL`
> changed together with the deploy.**

A config change and the code change that requires it ship in one step, and the log says so.

## Why this beats a changelog

| Changelog | This log |
|---|---|
| "Improved camera framing" | "geometry-aware camera fit … measured 52% fill vs 71%+ after" |
| "Fixed a bug in ghost playback" | "the ghost's progress note emitted the move index before incrementing (one-move lag) — caught by browser-driving the controls" |
| "Switched models" | "50% against the 90% bar … recorded rather than forced" |
| Clean history | failures, artifacts, and regressions kept |

The log's value is that a stranger can **re-derive your conclusions**. A changelog only lets them
trust you.

## Template

```markdown
# DECISIONS

Build-window decisions and measured evidence, newest first. Dates are 2026.

## <date> (<pass name — what this pass was about>)

- **<Decision>**: <measurement + instrument>. <Rejected alternative, by name and reason>.
  <commit/file>. <The test that pins it>.
- **<Decision>**: <measurement>. Honest caveat: <what it did not prove / what condition it was
  measured under / the sample size>.
- **Honest regression note**: <what shipped wrong>, <how it was caught>, <the fix>, <the one check
  that would have caught it earlier>.
- **Process failure**: <your own mistake, quoted, with what it cost>.

## Known gaps

- <thing not measured, stated plainly> — Status: not conducted
- <thing measured under one condition only> — <which condition>
```

**Discipline:** a bullet that reports only *that* something shipped is not accepted. Nothing is
quietly amended after the fact — wrong entries stay and corrections append.
