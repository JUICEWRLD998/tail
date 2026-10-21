# Instrument traps — when the probe is wrong, not the page

Moved verbatim out of `SKILL.md` on 2026-09-29, so the skill body stays a procedure and this stays the evidence.
Every entry here reported a **confident, wrong verdict on a page that was fine**. The tell in each case was a
**contradiction inside the probe's own output**. Read the two numbers against each other before believing either.

## Metric-choice traps (the quantity does not match the question)

- **"Are these two colours different?" → CIE Lab ΔE, never the contrast ratio.** Ratio measures legibility
  against a *background*. Green and red can share a luminance and still be obviously distinct (ΔE 65.8 read as
  "1.04:1, nearly identical", and nearly caused a working palette to be rebuilt).
- **"Which element is quietest?" → chroma, not luminance.** A mid-grey with no hue is quieter than a muted amber
  despite out-contrasting it (chroma 3.2 vs 23.5–73.4; readable at 4.62:1).

## Six ways the instrument was wrong (2026-09-29)

- **`overflow-x: clip` blinds an overflow probe and its control together.** With `clip` on `html, body`,
  `documentElement.scrollWidth > clientWidth` is impossible, so a scroll-based overflow check and its planted
  900px control both report clean and the check is decorative. Measure **per-element rects**
  (`el.getBoundingClientRect().right - clientWidth`) and, for a second opinion, inject
  `html,body{overflow-x:visible !important}`, read `scrollWidth`, then remove the style.
- **An SVG `<path>` rect is transformed geometry, not layout.** `getBoundingClientRect()` on a path inside an
  `<svg>` ignores the ancestor's clipping, so a wave drawn to `x=360` in a 320-unit `viewBox` reported 27px of
  overflow on five pages while the unclipped scroll measure said `375/375`. Skip any element with
  `el.parentElement.closest("svg")`.
- **A `ch` cap resolves against each element's own font size; a pixel cap does not.** A 640px column is 86ch at
  17px, 78ch at 14px and 91ch at 12px. So capping the *column* in px passes the body and lets captions run
  newspaper-wide. Cap in `ch`, per element: `:where(p, li, dd, blockquote) { max-width: 68ch }` with specificity
  zero so components can still win.
- **"Widest rendered line" is not a container measure.** `range.getClientRects()` **fragments a line at inline
  boundaries** (`<strong>`, badges), and the last line of every paragraph is short by construction, so a
  correctly capped 68ch paragraph measures 27–42ch and *fails a 45ch floor*. Measure the **box width in the
  element's own `ch`**, which is what the gate asks.
- **A control selector that omits a control type is a blind spot that reports PASS.** Gate 39's census listed
  `button, select, input[type=checkbox], input[type=radio]`, so `input[type=range]` was invisible. It printed "0
  controls measured" on four pages and "1" on the page with five, and it passed while four 24px sliders sat under
  the 44px floor. **The fix found a real defect.** Enumerate controls generously and require a non-zero census
  somewhere in the sweep.
- **Gate 39 means the control's box, not its visible track.** "Share one base height, 44px floor" is about the tap
  target. A range input's box should be the 44px target with the thin track centred inside it
  (`padding-block: calc((var(--target) - var(--track)) / 2)`), rather than growing the track itself.

## Browser-driving traps

- **Kill CSS transitions before a synchronous `getComputedStyle` read.** A 160ms `color` transition returns the
  *previous* colour in the same tick, so a planted 1:1 control applied nothing and read as "probe is blind".
  Set `transition: none !important`, read, then restore.
- **A stale server serving dead asset hashes makes a working page look unstyled.** Diff the asset hashes in the
  *served* HTML against what is on disk before believing any "CSS is broken" reading. On Windows,
  `pkill -f "next start"` never matches (the process is `node.exe`), so kill by PID from `netstat -ano`.
- **CSS Modules hash class names at build time.** A DOM probe must select `[class*="railLabel"]`. `.railLabel`
  silently matches an empty set.
- **Headless Chrome defaults to `prefers-color-scheme: dark`.** An unqualified light-mode assertion fails
  against a good page.
- **A probe that plants a control must exclude that control from its own sample.**
- **A probe asserts a mechanism, and when the mechanism changes it lies instead of failing.** Probe the app's own
  self-reported state word (`Terminal: Ready`) rather than a structural guess, and re-verify a driver after any
  new screen is added to the flow.

## JavaScript and shell traps (confident wrong answers, not errors)

- **A backtick inside a template literal** terminates it (six occurrences in one session). Write the comment
  without backticks; never escape and hope.
- **A DOM number probe must skip `SCRIPT / STYLE / NOSCRIPT / TEMPLATE`**, because the framework's serialised
  payload lives in a `<script>` tag and carries the page's percentage literals verbatim.
- **Git Bash (MSYS) rewrites a leading `/` in an argument into a Windows path**, and **collapses `\\d` inside
  heredocs**, even quoted `<<'EOF'` ones. Write complex regexes with the Write tool, and give every extractor a
  positive control that must reproduce a known count.

## One invented rule worth keeping

**An `<output>` bound to a live control is a readout, not a claim.** A percentage beside a slider the reader is
holding is the position of that slider, and badging it "Model output" is a category error. The honest assertion
is not a badge but a **checkable binding**: a `for` attribute that resolves to a real form control. That binding
still fails a bare number dropped into an unbound `<output>`.

## Scoring a local directory returns a confident wrong score (2026-09-30, cost four wrong fixes)

`ui-score.mjs <dir>` opens the page over `file://`, where `sheet.cssRules` throws for linked stylesheets. The scorer
catches that and carries on with **zero CSS**, so it reports `no-reduced-motion`, `missing-focus-state`,
`no-text-wrap`, `no-tabular-nums` and `no-macrostructure-stamp` against a page that has all of them. Nothing errors.
**Serve the directory over HTTP** (any static server) and pass the `http://` URL. Consequences of URL mode: the source
tree is not measured (`tokenDiscipline` / `stateCoverage` cap at half), so compare rounds only within one mode.
The macrostructure stamp is read from computed CSS text, where comments do not survive: declare it as a custom
property (`:root { --macrostructure: 19 Map / Diagram; }`), not only as a comment.
Also: on dark grounds the accent census counts any saturated navy surface as "the accent" (88% of viewport on a
`C 0.03` blue-black). Keep dark surfaces near-neutral (`C <= 0.008`) or the accent budget reads as blown.

## Chrome 154 returns computed oklch() as lab(); the scorer went blind (2026-09-30, cost an hour of false findings)

`getComputedStyle(el).backgroundColor` for a colour authored in `oklch()` comes back as `lab(L a b)` (CIE Lab, **D50**
white point), not `oklch(...)` and not `rgb(...)`. `ui-score.mjs` parsed only hex, rgb, hsl and oklch, so every token
authored in oklch returned `null`, the ground fell back to white, and the run reported `0 text pairs`, `pure-white-base`,
`textContrast 0/20` and an accent budget of 79% against a dark page. **All three planted controls still passed**, because
they use their own colours: a control proves the sampler can read *its* probe, not *your* stylesheet. Fixed 2026-09-30:
`parseColor` now reads `lab()` (Lab D50 to XYZ, Bradford to D65, to sRGB) and `color(srgb ...)`. The conversion was
checked against Chrome's own canvas on 13 real tokens, maximum channel difference 0, with a planted control first
(`scripts/probe-color.mjs` in the memgate repo). **Tell:** when a dark, carefully-tokened page scores as white with zero
text pairs, print `getComputedStyle(document.body).backgroundColor` before believing anything else.

Two more scorer faults from the same pass:
- **"Card in card" tested horizontal containment only**, so stacked siblings (buttons under a textarea, two empty-state
  boxes side by side) were reported as nested. It now requires containment on both axes. Proof: a fixture with a real
  nested card is flagged, a fixture with stacked boxes is not (`evidence/ui/fixtures/` in memgate).
- **The accent budget reads HSV saturation**, which is enormous for any tinted near-black (`rgb 6,12,18` = 0.67), so a
  blue-black deck counts as "the accent" (79% of the viewport). Measure accent area yourself with Lab chroma > 30 on the
  computed backgrounds, with a planted 100x100 accent block that must read exactly 10000 px2. The scorer's own number is
  an instrument artifact on tinted dark grounds.

**`scrollWidth` cannot see overflow that `overflow-x: clip` hides.** A 1 px overflow at 320 px passed the
`scrollWidth > clientWidth` check because `html, body { overflow-x: clip }` (Hallmark's own requirement) clips it. Measure
element edges instead: every visible element's `getBoundingClientRect().right` must be <= `clientWidth + 1`, with a planted
2000 px block that must be reported. The real cause was a `white-space: nowrap` button 1 px wider than a stretched grid
track; give page grids `grid-template-columns: minmax(0, 1fr)`.

**The macrostructure stamp must be a custom property.** The scorer reads computed CSS text, where comments do not survive
(already noted above); `:root { --macrostructure: Name; }` is read, a `/* Hallmark */` comment is not.
