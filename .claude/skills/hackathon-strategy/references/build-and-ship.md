# STAGE B: build and ship (read only after "GO <name>")

Moved out of `starter-prompt.md` on 2026-10-20 so the build rules are not loaded, and paid for, during DECIDE.
The text is the 2026-10-15 Stage B, unchanged in substance.

First action after GO: write the build plan with `plan` (or `ecc:blueprint` for a long multi-step build) from
PICK.md's build contract. Never before GO.

## B1 Proof first

Build outward from the proof artifact, in this order: the core logic that owns the product's numbers or decisions
(deterministic where the user relies on it), the proof, the thin end-to-end path, the model (if any), the UI, then
breadth. Where a model is used, the demo must still work with the model unplugged. Before designing around any
inherited capability, confirm it against the platform's source and cite file:line or the live response.

Build the PRODUCT, not a demo (G14): real data, real money or real users in the core path, a live deployment,
accounts and state that persist, and the first real users onboarded through the channel named in PICK.md. The demo
video is a recording of the product working, never a separate scripted toy.

Day-one files: README.md written before the code (thesis, why only on <sponsor>, how it works, live deployments,
verify in 60 seconds, demo, evidence, what this is NOT, built for; about 200-270 lines), CLAIMS.md (every README
claim mapped to the command that reproduces it), and DECISIONS.md (newest first; every entry carries a measurement,
the rejected alternative and the file or commit). README skeleton: `repo-anatomy-and-idea-engine.md`.

## B2 Milestones (no calendar)

Four ordered milestones: thin path running end to end, feature-complete, demo freeze, packaging and submission.
Packaging is its own milestone and is never skipped or borrowed from. For an accelerator or VC panel add a fifth
track from the thin path onward: TRACTION. Put the live product in front of real users through the named channel,
log every user and transaction as measured (never self-generated), and post the event's progress updates when they
are scored. Fan-out only if he says "fan out": agents on disjoint file sets once the shared foundation lands.

## B3 The two judged paths

- Scripted path (the video): deterministic on camera. No live market, no third-party timing, no provider
  redelivering on cue. Disclose pre-warmed caches in the UI ("Cached result, no new model call").
- Unscripted path (the judge's own input): harden this one first, because it is the one that gets judged. A cold
  visitor reaches the wow in one click, from any state.
- Failure beats on cue: replay signed payloads (identical bytes = duplicate delivery, one changed byte = forgery), a
  dry-run mode that provably writes nothing, and fixture invariants as tests (every amount under the real caps, parts
  summing to the whole, the expected verdict).
- Rehearse for free, pay once: count what one live take spends before rehearsing anything that costs money or burns
  a one-shot credential.
- Resilience: an offline mode or local build, and a recorded backup of the full demo.

## B4 UI

Run `ui-studio` with its kickoff (`ui-studio/references/starter-prompt.md`). Design the wow screen first, because the
video, the thumbnail and the OG card are all cut from it. Rivals use the same anti-slop skills, so ui-studio explores
3 directions and builds a theme from the users' own world. Verify in a real browser.

## B5 The judge funnel

Every stage loses judges, so design each one: gallery card (title, tagline, thumbnail), the video's first 20
seconds, the README's top third, the live URL, the judge's own input.

Video: under the cap, about 2 minutes when allowed. Open on the user's pain as a concrete moment, not a logo. The wow
lands by 0:30. Real product, no slides after 0:15. Burned-in captions. No dead air: cut the waits, never fake a
result. End on the proof (tx hash, verify command, live URL). `demo-video` makes it from the deployed link. In-person
events: the 60-second pitch, a rehearsed 20-second answer to each kill-shot question, and a plan B for dead wifi.

## B6 Submission hardening (inside the last 20%)

- README scoring map: each weighted criterion mapped to the shipped feature and its evidence.
- One status vocabulary in every artifact: LIVE / NEXT / NOT LIVE.
- Pre-submit grep: `mock|fake|dummy|lorem|0x0000|picsum|randomuser|example.com`. Justify or fix every hit. No mocked
  core integration, no hardcoded value posing as dynamic, no single-engine build behind a multi-backend README.
  Declare the shortcuts taken.
- Run the judge's path yourself, live, on the deployed URL, from a clean browser. A green typecheck is not a demo. If
  something could not be run, say so.
- Real commit history, no default favicon or title, a live URL even if the product is thin.
- The final polish that turns near-wins into wins: the first-run experience, the copy, and one "they thought of
  that" detail a judge will mention.
- Where a Stage A assumption proved false, correct the strategy doc in place and mark it.
- Side tracks: one checklist per track (its form fields, attribution text, required posts and follows, the main
  submission link). Main submission first, because most side tracks ask for its link.
- Submission copy goes through `humanizer`. Prepared is not submitted: he presses submit.

## Honesty rules

- Complexity is not innovation. Fewer moving parts, sharper insight.
- Correct a wrong claim in place and mark the correction; never quietly rewrite it.
- A hypothesis is not evidence, a simulated persona is not a user, and our own activity is not adoption.
- Record metrics as measured, unavailable or zero, and never collapse unavailable into zero.
- Never claim we will win. Say why we are competitive, what supports it, and what could still beat us.
