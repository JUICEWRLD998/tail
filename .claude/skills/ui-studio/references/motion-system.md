# Motion system: the signature moment, the house implementation, and proof

**Added 2026-09-30,** when he asked for "fancy" UI with animation where it is needed. Hallmark's
`references/motion.md` (principles, easings, durations, bans) and `references/microinteractions.md` (the
per-interaction recipes) already hold the language and the vocabulary of motion. This file adds three things
they leave out: **the one signature moment**, **how the house stack implements motion**, and **how to prove
motion on a rendered page**. Where they overlap, Hallmark's timing and easing canon wins and is not restated here.

API facts below were checked on 2026-09-30 against motion.dev and Next.js 16.2 docs (via Context7). Re-check
them if the major version has moved.

## 1. The four kinds, and the budget

| Kind | Job | Duration | How many | Owner |
|---|---|---|---|---|
| Feedback | answers an action: press, submit, toggle, copy | 100–150ms | every control | CSS transitions |
| Continuity | shows where something went: expand, reorder, layout change, shared element | 200–420ms | where state moves | Motion `layout` / `layoutId` / `AnimatePresence` |
| **Signature moment** | the mechanism acting: the verdict landing | ~600–1200ms to settle | **exactly one per product** | Motion, choreographed |
| Functional | progress, streaming, live ticks | until the work is done, then stop | as needed | CSS or Motion |
| Entrance | one orchestrated page load | stagger capped near 500ms | at most one per page | CSS `--i` stagger (Hallmark) or Motion `staggerChildren` |

**Budget rule.** On any screen, at most one thing moves without being asked, either the entrance or the
signature moment, never both at once. If a motion could be removed without the user losing information,
remove it.

## 2. The signature moment

**Finding it.** It is the moment the product's mechanism acts, usually the adjudicator's verdict. In a
hackathon build it is the wow moment in `strategy/RANKED_REPORT.md`. It should show cause becoming effect:
the input goes in, the verdict comes out, and the eye can follow the path between them. Draw it from the
vocabulary sheet: a stamp landing on the exhibit, a ledger reconciling row by row, redaction tape sweeping
across a line. A glow, a particle burst or a confetti shower is not a signature. It is the default.

**Write the beat sheet before any code:**

```
Signature moment: <name>
Trigger:        <the user action or system event>
Beats:          t=0      <what moves, and from where>
                t=180ms  <...>
                t=600ms  <the verdict becomes readable>
                settle by <= 1200ms
The eye follows: <element A> -> <element B> -> <the verdict>
End state:      <what is on screen as TEXT once it settles>
Reduced motion: <the crossfade version, which still states the verdict>
Thumbnail frame: t=<ms>, the most legible frame, and the source of the video poster, OG card and thumbnail
```

**Rules.**
- **It carries information.** Once it settles, the verdict is on screen as text, not only as motion, and it
  is announced through an `aria-live="polite"` region.
- **It is the loudest motion in the app,** and everything else is quieter by design. That is the "one boldness"
  rule applied to time.
- **It never blocks input.** A click during it jumps straight to the end state.
- **It is deterministic.** The same input gives the same choreography, so a video retake matches the last one.
- **Overshoot is allowed here only, and only when the subject's real object does it** (a rubber stamp hits
  and settles by a pixel or two). State the exception out loud in the hand-off. Controls never overshoot.

## 3. Implementation (Motion for React on Next.js App Router)

- **Package.** `npm install motion`, imported from `motion/react`. It is the library formerly published as
  `framer-motion`; if an old project still uses that, uninstall it and install `motion`.
- **Client leaves only.** Motion components are client components. Put `"use client"` on the smallest animated
  leaf and keep the page a server component.
- **Reduced motion at the root.** Wrap the app in `<MotionConfig reducedMotion="user">` inside a client
  provider in the root layout. When the user's setting is on, Motion disables transform and layout animations
  but keeps opacity and colour, so the reduced version becomes a crossfade on its own. Design that crossfade
  to still tell the story.
- **Bundle.** Use `LazyMotion` with `m` (`import * as m from "motion/react-m"`). `domAnimation` covers
  animations, variants, exit animations and press/hover/focus gestures. `domMax` adds pan/drag and **layout
  animations**, so any use of `layout` or `layoutId` needs `domMax`. (motion.dev's figures: about 34kb for the
  full `motion` component against about 6kb initial with `LazyMotion`.)
- **Who owns what.** CSS transitions own hover, focus and press, which are cheap and work before hydration.
  Motion owns enter and exit (`AnimatePresence` with keyed direct children and an `exit` prop), layout and
  shared elements (`layout`, `layoutId`), orchestration (variants with `staggerChildren`), and the signature
  moment.
- **One set of values.** Durations and easings live in `tokens.css` as Hallmark's `--dur-*` and `--ease-*`,
  mirrored in exactly one file so Motion and CSS never drift:

  ```ts
  // lib/motion.ts: mirrors tokens.css. Change both together.
  // Motion takes SECONDS; CSS takes milliseconds.
  export const dur = { micro: 0.12, short: 0.22, long: 0.42 }
  export const ease = {
    out: [0.16, 1, 0.3, 1],
    in: [0.7, 0, 0.84, 0],
    inOut: [0.65, 0, 0.35, 1],
  } as const
  ```

- **Tween or spring.** Tweens with the token easings for UI state. Springs only for direct manipulation (drag,
  a thumb that follows the finger), with `bounce: 0` on controls; `visualDuration` sets when a spring
  *looks* finished, which makes it easier to sync with the tweens around it.
- **Transform and opacity only.** `layout` animations are transform-based (FLIP), so they keep that rule.
  Never animate width, height, top, left, margin or padding, and never animate the focus ring.
- **Never fade in the LCP element.** An element that starts at `opacity: 0` does not count as painted until it
  becomes visible, so an entrance on the hero headline or hero image delays Largest Contentful Paint.
  Animate the supporting elements and let the hero arrive at once.

## 4. Proving it on the rendered page

A static screenshot cannot show motion, and a motion you only imagined is not verified. Write every probe
with the Write tool: Git Bash mangles regexes and backslashes (`instrument-traps.md`).

1. **Filmstrip.** Over CDP, start `Page.startScreencast` (`everyNthFrame: 1`), acknowledge every frame with
   `Page.screencastFrameAck`, keep each frame's `metadata.timestamp`, trigger the moment, and stop after the
   settle time. Headless screencast frames only arrive when something paints and can be sparse. If a beat from
   the beat sheet is missing, slow the document timeline with `Animation.setPlaybackRate({ playbackRate: 0.1 })`.
   That slows CSS and Web Animations, but **not** animation driven by `requestAnimationFrame`, so compare frame
   counts at rates 1 and 0.1 to know which kind you filmed. Tile the frames into one contact sheet with ffmpeg
   (installed): `ffmpeg -i frame-%03d.png -vf "scale=480:-1,tile=6x4" -frames:v 1 sheet.png`.
   **Then look at every frame.** Does the eye path match the beat sheet? Is any frame illegible, overlapping,
   or a flash of unstyled state?
2. **Reduced motion.** `Emulation.setEmulatedMedia({ features: [{ name: "prefers-reduced-motion", value:
   "reduce" }] })`, trigger the moment again, and screenshot the end state. It must match the full-motion end
   state, and the verdict text must be present.
3. **Frame times, with a planted control.** Inject a `requestAnimationFrame` loop that records frame
   intervals during the moment, and report the count over 33ms and the maximum. First run a control that
   busy-waits 80ms inside one frame: the sampler must report at least one long frame, or its result is
   withheld. Label every result with its conditions. Headless Chrome on a software rasteriser is not a GPU and
   not a phone, so it never becomes "smooth on devices".
4. **Static guard.** Search the CSS modules for transitions or keyframes on width, height, top, left, margin or
   padding, and the components for Motion props animating them. Fix or justify every hit.

## 5. Pitfalls

- **Scattered motion is the tell.** Fade-up on every section and a lift on every card read as generated
  before anyone reads a word. One signature moment beats ten small effects.
- **Seconds versus milliseconds.** `duration: 220` in Motion is 220 *seconds*. Import from `lib/motion.ts`
  instead of typing numbers.
- **`layoutId` under `LazyMotion` with `domAnimation` does not animate.** Layout animations need `domMax`.
- **`AnimatePresence` needs keyed direct children** with an `exit` prop, or nothing animates out.
- **A fade-in on the hero costs LCP.** See section 3.
