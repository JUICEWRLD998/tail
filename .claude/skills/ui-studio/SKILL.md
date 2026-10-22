---
name: ui-studio
description: The one UI pipeline, built from many skills, not one. Grounds the design in the product's subject (frontend-design), explores three real directions before committing (prototype, variant), takes structure and the slop review from the `frontend-design` plugin (Hallmark retired 2026-10-17), builds to the craft bar of emil-design-eng and make-interfaces-feel-better on the house stack, choreographs one signature moment (animate, review-animations), stress-tests every core component (break), traces the journey (click-path-audit), reviews every key screen (better-interface, design-system audit), then verifies the RENDERED page in a real browser with a scorer that plants its own controls. Use for any new page, app screen, redesign or full UI rebuild, and run its quick anti-slop pass on any smaller UI change (a component, a section, a restyle, "make it look better").
---

# UI Studio

**2026-10-17: Hallmark is retired from this pipeline on his instruction** (he prefers the `frontend-design` plugin, installed from `claude-code-plugins`). Do NOT load `hallmark` in any phase. Where older notes below or in `references/` say "Hallmark", read it as `frontend-design` (plugin); its 60-gate slop test is replaced by the frontend-design default-cluster review + `ui-score.mjs` + `ecc:design-system` audit. Where Hallmark gate numbers or `--dur-*`/`--ease-*` names are cited, keep the idea but use our own `tokens.css` names.

**Rewritten 2026-10-04.** The previous version had two owners, `frontend-design` and `hallmark`, and listed
every other UI skill as optional. In practice that meant Hallmark only: its 21-theme catalog picked the look
silently, and the polish, stress and review skills never ran. Two problems with that. Rivals install the
same anti-slop skills, so a catalog theme is a look other entries share. And no single skill catches
everything: Hallmark catches slop, not a broken empty state, a jumpy number, a toast behind a modal, or a
button whose handler undoes itself. Each phase now has a named owner, named specialists that MUST run, and
an exit gate.

**Kickoff:** paste `references/starter-prompt.md`. **Who does what:** `references/toolbox.md`.
**What reads as generated:** `references/slop-tells.md` (one page, each tell with its fix and its `ui-score` id).
No subagents unless he says so.

## Quick pass (any UI change too small for the full pipeline)

Slop gets in through the small jobs: a new section, one component, a restyle, a "make it look better". Those
never run the eight phases, so they run this instead. It takes minutes, and none of its steps is optional.

1. **Name the subject and the one job of the screen** in one line each. Pick type, colour and the one bold
   element from the subject's world, not from "modern SaaS".
2. **Read `references/slop-tells.md` before writing code.** For any tell you are about to use on purpose,
   write the reason in a code comment.
3. **Build to the craft bar:** every control has hover, focus-visible, active and disabled states; numbers
   that change are tabular; headings balance; motion is transform/opacity, ≤ 250 ms, with a reduced-motion
   path.
4. **Render it and look.** Screenshot at 1280 and 375 and read both. Run
   `node <this skill>/scripts/ui-score.mjs <url|dir> --round 1 --out <tmp>`. Zero auto-fail tells. Fix every
   `major` tell from the template-chrome and palette groups, or name why it stays.
5. **Five-second test** (bottom of `slop-tells.md`) on the first viewport. Then report what changed, the
   score and any tell you kept on purpose.

Escalate to the full pipeline below when the change touches a key route's hierarchy, adds a new screen, or
the quick pass finds more than three tells.

**Invoking the skills.** Some skills are user-invoke only (`prototype`, `variant`, `break`, `interface-review`,
`review-animations`, `pick-ui-library`, `explain-interface`): the Skill tool will not load them. Read their
`SKILL.md` (and the reference files it names) with Read, and follow it inline. Never rebuild a skill's rules from
memory; if a skill is missing, say so and give the install line.

| Phase | Owner | Specialists that must run | Exit gate |
|---|---|---|---|
| 1 Ground | `frontend-design` | `ecc:frontend-design-direction` (cross-check), `pick-ui-library`, `better-colors` (palette) | Vocabulary sheet, hierarchy contract, measured palette (§1a), image plan per screen, token plan that survives the default-cluster review |
| 2 Explore | `prototype` | `variant` for the one component that carries the wow | 3 directions rendered and screenshotted; one picked with a written reason |
| 3 Structure | `frontend-design` (plugin) | `ecc:frontend-design-direction` | Pre-flight, macrostructure named, locked custom tokens, preview block |
| 4 Build | this skill | `emil-design-eng`, `ecc:make-interfaces-feel-better`, `better-ui`, `mobile-native`, `apple-design` (gesture or spring work), `ask-sonner` (toasts), `dataviz` (charts) | Every control has 8 states; every screen has its 8 content states |
| 5 Motion and imagery | this skill | `animate` (builds), `review-animations` (judges), `find-animation-opportunities` | Signature moment beat sheet, filmstrip, reduced-motion run |
| 6 Verify | this skill | `scripts/ui-score.mjs`, frontend-design default-cluster review, `break` per core component, `ecc:click-path-audit`, `ecc:browser-qa` | All gates in the QUALITY BAR below |
| 7 Review and polish loop | this skill | `better-interface` per key screen, `ecc:design-system` audit mode, blind critic, `better-writing` | Plateau or bar met; open items named |
| 8 Hand off | this skill | | One summary |

## 1. Ground (frontend-design)

- Name the subject, the audience and the ONE job each key screen does. Pull the visual vocabulary from the
  subject's own world (materials, documents, instruments, vernacular), never from "tech" in general.
- Write the plan before code: 4–6 named colours, type roles, an ASCII wireframe per key screen, 3 principles.
  Run the frontend-design review: any line you would produce for any similar brief (cream + serif + terracotta;
  near-black + one acid accent; broadsheet hairlines; the SaaS card kit; eyebrow / middot / mono-label / arrow
  chrome) gets revised, with the reason stated. Check the plan row by row against `references/slop-tells.md`.
- Cross-check with `ecc:frontend-design-direction`: for an app, the first screen is the usable product, not a
  marketing page; name the ONE memorable detail.
- Write the **hierarchy contract** for each key screen's first viewport: where am I, what matters most, what
  can I do, what just happened, what next. The blind critic in phase 7 is scored against it.
- Pick parts with `pick-ui-library` before building them by hand (number inputs, OTP, command menu, drag-drop,
  charts). Confirm the chosen library's current API with context7.
- His standing taste (SIGNAL DECK, in `~/.claude/CLAUDE.md`) is an input, not a template. It sits inside the
  "near-black + one acid accent" cluster, so for any product with its own subject, surface the collision in one
  line and let him decide.

### 1a. Colour, imagery and motion floors (2026-10-04, his request)

He asked for "images and beautiful colors and clean motion so the UI doesn't look like AI slop". Our builds kept
shipping as a grey shell with one accent, no pictures, and fades. These three floors are set in phase 1 and
checked on the rendered page in phase 6. A miss is named in the hand-off, never waved through.

**Colour floor.** Load `better-colors`. Build the palette in OKLCH from the subject's own materials (the stuff
the vocabulary sheet names), not from "dark mode SaaS".
- Roles, each a named token: ground, raised surface, ink, muted ink, ONE accent, and 2–3 **support hues** with
  jobs (status, data series, illustration, category). One accent still means one *call to action* colour; it
  never means a monochrome app.
- Surfaces are **tinted toward the palette's hue** (OKLCH chroma 0.008–0.03), never neutral #111/#fafafa grey.
- Measured, not eyeballed (`references/instrument-traps.md`): text pairs ≥ 4.5:1 (large ≥ 3:1); every pair of
  role hues ΔE76 ≥ 20 so they read as different; accent chroma clearly above every surface (≥ 4× surface
  chroma). Write the table of numbers in the plan.
- Both themes designed. Dark is not inverted light: lower the support-hue chroma about 15% and lift lightness.
- Bans: violet-to-blue gradients, rainbow gradients, gradient text, glass, glow on more than one element.

**Image floor.** Every key route carries at least one real image, chosen by the ladder in
`references/imagery-ladder.md` (R1 product output first). The landing hero always has one. An app screen whose
data fills the viewport may skip, with the reason written in the plan. Empty states get an R2 illustration
from the vocabulary sheet. Images are graded to the palette tokens so they belong to the page.

**Motion floor** (`references/motion-system.md`). Clean means: every state change gets feedback (≤ 200ms,
transform/opacity only, house curve tokens), layout changes animate instead of jumping (`layout` in Motion),
lists stagger at most once on first load, ONE choreographed signature moment, nothing loops on idle except a
media loop with a pause control, and reduced motion lands on the same end state. Scattered fades on scroll are
the slop tell, not the cure.

## 2. Explore (prototype, variant)

The first direction a model commits to is the modal one. Rivals' agents commit to the same one.

- Run `prototype` on the WOW screen (and the landing, if there is one): **three genuinely different directions**
  behind its picker, each from the vocabulary sheet but differing in structure, type voice and where the boldness
  goes. Not three colour swaps. Screenshot each at 1280 and 375.
- Pick with a written reason, scored against the hierarchy contract. Offer him the three screenshots when he is
  present; otherwise pick and record the runner-up.
- Run `variant` on the single component that carries the signature moment (the card that flips, the ledger that
  settles), in place, on the real page.

## 3. Structure (frontend-design plugin)

Load `frontend-design:frontend-design`. Commit to a bespoke aesthetic direction from the subject's own world,
never a stock theme or the model's default look (rivals share defaults). Structure rules to keep:

- Pre-flight block with file:line citations before anything else.
- Macrostructure, nav archetype and footer archetype stated out loud, loaded one file each.
- A preview block (macrostructure, type roles, token table, wireframe per key screen) before any code. For an existing app, preserve routes, component ownership and information architecture while redesigning.
- Locked tokens: every colour and font in page CSS is `var(--…)`. No raw hex/OKLCH outside `tokens.css`.
- No italic headings, no eyebrows by default, no hanging tag-left headers, no invented metrics, no drawn
  browser/phone/IDE chrome.

## 4. Build: house stack plus the craft bar

- **Next.js App Router + CSS Modules + one `styles/tokens.css`.** No Tailwind. Motion for React (`motion`,
  imported from `motion/react`) is the only animation library.
- Append-only rule for `app/globals.css`: never delete framework directives.
- **Craft bar while building, not after.** Load `emil-design-eng` before writing components and apply its rules.
  Apply the `ecc:make-interfaces-feel-better` checklist to every component as it lands: concentric radius,
  optical alignment of icons, `text-wrap: balance` on headings and `pretty` on short body, `tabular-nums` on every
  number that updates, layered shadows that work on the surface colour, hit areas at least 40px, no layout shift
  on state change. `better-ui` owns the same domain at review time.
- Every interactive control ships 8 states (default, hover, focus-visible, active, disabled, loading, error,
  success). Focus ring instant, ≥3:1.
- Every screen ships 8 content states: empty, loading, partial, error, success, long content, first run,
  returning. No sample or filler text in an empty state: real data, or say plainly there is none.
- Touch and phone behaviour from `mobile-native` (safe areas, 100dvh, 16px inputs, no sticky hover, tap delay).
  Gesture, drag, sheet and spring work follows `apple-design`. Toasts follow `ask-sonner`. Charts load `dataviz`
  first.
- CSS Modules hash class names, so probes select `[class*="name"]`, never `.name`.

## 5. Motion and imagery: earned, never sprinkled

- **Motion** (`references/motion-system.md`): feedback, continuity, functional motion, at most one entrance per
  page, and **exactly one signature moment per product**: the mechanism acting, choreographed over about
  600–1200ms, with a beat sheet written before the code. It is the shot the demo video is cut around.
  `animate` builds it (its decision order: whether, purpose, tool, properties, curve, interruption, exit).
  `review-animations` judges the result. `find-animation-opportunities` runs once on the finished screens and
  proposes; reject anything that is decoration.
- **Imagery** (`references/imagery-ladder.md`): decide per screen whether an image is needed at all, then take the
  highest honest rung: R1 the product's own output, R2 graded hand-built SVG, R3 generated only through a generator
  we have, R4 licensed and self-hosted photography, R5 Lottie/Rive/3D only on his OK. For hackathon builds, cut the
  packaging set (OG card, icon, thumbnail, README hero, video poster) from the signature moment's frame.

## 6. Verify: nothing is done until it is seen

A gate you ran in your head did not run.

1. **Serve over HTTP** (`next start` on a fresh port). Never `file://`. Diff the asset hashes in the served HTML
   against `.next/` on disk: a stale server on the port serves dead hashes and makes a good build look unstyled.
2. **Drive Chrome over CDP** (Node 22+, zero deps; Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`,
   `--headless=new --remote-debugging-port=<p> --user-data-dir=<tmp>`), or Playwright MCP. Screenshot every route
   at 320, 375, 414, 768, 1024, 1280, 1440 and 1920, each colour scheme set explicitly (headless defaults to dark).
   Click the primary journey by visible text. READ the screenshots.
3. **Machine score:** `node <this skill>/scripts/ui-score.mjs <url> --round N --label <l> --out <dir>`. Exit 2 =
   a planted control failed; the score is withheld and never reported.
4. **frontend-design slop review**: run its default-cluster review against the rendered page (screenshots, not source): fonts, palette, layout, card kit, chrome tells. Each hit fixed or named. `ui-score` measures most of them now (`allcaps-eyebrows`, `middot-meta-strings`, `arrow-suffix-cta`, `numbered-markers`, `mono-label-chrome`, `one-word-accent-headline`, `cream-clay-default`, `acid-on-black`); the eye-only rows in `slop-tells.md` are checked on the screenshots.
5. **Stress every core component with `break`**: each component on the wow screen and the primary journey,
   rendered under its real worst cases (long text, empty, huge numbers, many items, slow network, error). Fix
   every visible break.
6. **Trace the journey with `ecc:click-path-audit`**: every button on the primary journey, its handler's state
   writes in order, and whether the final state matches the label. Catches handlers that undo each other.
7. **`ecc:browser-qa`**: console errors, Core Web Vitals (LCP, CLS, INP) and an axe pass.
8. **Measure, don't eyeball** (`references/instrument-traps.md`): WCAG ratio for text on its background; CIE ΔE for
   "are these two colours different"; chroma for "which is quietest". Kill transitions before a synchronous
   `getComputedStyle` read. Every DOM probe gets a planted positive control that must fail on purpose first.
9. **Motion and imagery probes** (`motion-system.md` §4, `imagery-ladder.md` §5): the filmstrip of the signature
   moment that you actually look at, a reduced-motion run whose end state must match, frame times, broken images,
   alt text, oversize, the LCP element, layout shift. Each with a planted control first.

## 7. Review and polish loop

1. **`better-interface` on each key screen.** It routes to the six `better-*` domains (accessibility, colours,
   layout, typography, UI polish, writing). Fix every finding ranked high; name why for any left.
2. **`ecc:design-system` in audit mode (Mode 2 and 3 only).** Its 10 dimensions, each with file:line. It is a
   second, independent slop detector; where it disagrees with frontend-design, look at the screenshot and decide.
3. **One blind critic** on anonymised screenshots, plan hidden. Inline: a clean section that sees only the
   screenshots, labelled SEMI-BLIND; a true blind subagent only if he says so. It sees the first viewport at 1280
   and 375 first and states what the product does, the primary action and what matters most. Score that against
   the hierarchy contract. Then it critiques the full set, starting with "does this look generated?".
4. **Loop.** Fix, re-render, re-score. Stop when the QUALITY BAR is met, or when the ui-score moves less than 2
   points across two rounds: write the plateau and its reason so it is not reopened. Re-check gains from earlier
   rounds each time; a late fix can regress them.
5. **Copy:** `better-writing` on every in-product string. Submission prose goes through `humanizer`.

## THE QUALITY BAR (all must hold, or the failure is named in the hand-off)

- ui-score: a KEEPABLE round (controls passed, zero auto-fail tells) on every key route.
- frontend-design slop review: no open default-cluster hit, or each named with its reason.
- `break`: no visible break left on any core component.
- `ecc:click-path-audit`: every primary-journey button ends in the state its label promises.
- `ecc:browser-qa`: zero console errors; zero serious or critical axe violations; CLS under 0.1.
- `better-interface`: no open high-impact finding.
- `ecc:design-system` audit: no dimension under 7/10.
- Blind critic: names the product, the primary action and the most important thing as the hierarchy contract does.
- Every screen composed at all eight widths, 320 to 1920.
- Colour floor (§1a): the measured table holds on the rendered page (contrast, ΔE between role hues, tinted
  surfaces), in both themes.
- Image floor (§1a): every key route shows a real image, or its written skip reason; zero broken images; LCP image
  sized and prioritised.
- Motion floor (§1a): every primary-journey state change has feedback motion; the signature moment's filmstrip was
  looked at; the reduced-motion run ends in the same state; CLS under 0.1 while animating.

## 8. Hand off

One summary: routes touched, the three explored directions and the pick, the aesthetic direction, the boldness and the
signature moment, ui-score per route, slop-review result, break and click-path results, browser-qa numbers,
design-system scores, filmstrip path, image weight per route, critic verdict, and every open failure by name.
If something could not be seen, say it was not verified.

## Pitfalls

- `innerText` applies CSS `text-transform`: an uppercase kicker reads back as "BUILDER FEE" and a text probe for
  "Builder fee" fails while the page is fine. Read page text with `textContent` and assert on what the DOM says.
- A replay that reveals items one by one shows the empty state in between. If the empty state is a sentence ("No one has
  taken this call yet"), it is false mid-replay. Drive empty-state copy from the real total, not from what is visible.
- `[class*="chip"]` also matches the list `.chips`. Scope count probes to the element (`li[class*="chip"]`).

- **One skill only** (2026-10-04, Hallmark retired 2026-10-17). One skill's checklist is one set of blind spots. Run the specialists in the table; never a stock theme.
- **Committing to the first direction.** It is the modal one. Explore three before structure.
- **Cloning a reference's grammar** instead of learning why it reads well. Derive from the subject.
  "Terminal / CRT / neon" is the default trap for any hacking, forensics or data brief.
- **Glow everywhere.** One boldness per screen, spent deliberately.
- **Vector "photographs" read as clip art** until graded: soften edges, light from the practical source, use shadow
  forms instead of drawn features.
- **Headless `--virtual-time-budget` against `next dev` never settles** (HMR socket). Use `next start`.
- **Never `git worktree remove --force` a worktree holding a junctioned `node_modules`**: it deletes through the
  junction into the real one (2026-09-30). Unlink first: `(Get-Item <wt>\node_modules).Delete()`. `cmd //c mklink /J`
  from Git Bash fails silently; use PowerShell.
- **A probe that parses `rgb()` goes blind on `oklch()` tokens.** Resolve colours through a canvas pixel
  (`ui-score.mjs` already handles oklch).
- **Git Bash mangles `/regex/` arguments and backslashes in heredocs.** Write probe scripts with the Write tool.
- **Headless Chrome profiles fill the disk** (~60-70 MB each in `%TEMP%`; `ENOSPC` mid-write on 2026-10-01). Delete
  the profile on exit, write filmstrip frames as JPEG, check free space before a long verify pass.
- **The user-invoke-only skills look missing to the Skill tool.** They are installed; read their SKILL.md.
- **Chrome as root needs `--no-sandbox`** (Linux containers and CI). `ui-score.mjs` reads `CHROME_PATH`; point it at
  a two-line wrapper script that runs `chrome --no-sandbox "$@"`. Without it the scorer exits with "Chrome did
  not expose a devtools endpoint".
- **Fixtures:** `scripts/fixtures/slop` must fire the auto-fail tells, `chrome` must fire every template-chrome
  and palette tell, and `clean` must fire none. Re-run all three after any change to the scorer.
