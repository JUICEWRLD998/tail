# UI toolbox: which skill, at which phase

`ui-studio` is the spine. Every other UI skill is a specialist it calls at a named phase. **MUST** means the
phase does not exit until that skill has run and its result is recorded. **WHEN** means it runs when its
trigger is present. Do not run two skills that do the same job, and do not invoke a specialist outside its
phase. If a skill is missing, say so; never rebuild its rules from memory. No subagents unless he says so.

**Rewritten 2026-10-04.** The old table listed every specialist as optional, so passes ran Hallmark alone.
Now each phase names what must run.

**User-invoke-only skills** (`prototype`, `variant`, `break`, `interface-review`, `review-animations`,
`pick-ui-library`, `explain-interface`) have `disable-model-invocation: true`, so the Skill tool refuses them.
Read `~/.claude/skills/<name>/SKILL.md` and the references it names, then follow it inline.

## By phase

| Phase | MUST | WHEN | Do not use |
|---|---|---|---|
| 1 Ground | `frontend-design` (direction, vocabulary, token plan, default-cluster review); `ecc:frontend-design-direction` (cross-check: app's first screen is the product; one memorable detail) | `pick-ui-library` when the screen needs numbers, OTP, command menu, drag-drop, charts; context7 for the chosen library's current API; studying a reference he admires (learn why, never clone) | `ecc:taste*` (music-video direction, not UI); Tailwind |
| 2 Explore | `prototype`: 3 different directions for the wow screen (and landing) | `variant` on the one component that carries the signature moment | Building one version and calling it explored |
| 3 Structure | `frontend-design` (plugin, bespoke direction) | `ecc:frontend-design-direction` | `hallmark` (retired 2026-10-17); stock themes (rivals share them); `ecc:liquid-glass-design` (no glass, house rule) |
| 4 Build | `emil-design-eng` (craft bar, loaded before components); `ecc:make-interfaces-feel-better` (detail checklist per component) | `mobile-native` (any touch screen); `apple-design` (gesture, drag, sheet, spring); `ask-sonner` (toasts); `dataviz` (before any chart); `ecc:dashboard-builder` (monitoring or ops dashboards); `ecc:frontend-patterns`, `ecc:react-patterns`, `ecc:nextjs-turbopack` (React and Next idiom or build trouble) | `ecc:ui-to-vue`, `ecc:vue-patterns`, `ecc:nuxt4-patterns` (not his stack) |
| 5 Motion | `animate` builds the signature moment; `review-animations` judges it | `ecc:motion-foundations`, `ecc:motion-patterns`, `ecc:motion-advanced` (Motion for React specifics); `animation-vocabulary` (name an effect he describes); `find-animation-opportunities` (once, on finished screens) | `animate-expo` (archived, React Native) |
| 5 Imagery | `references/imagery-ladder.md` | `excalidraw` or `architecture-diagram` for diagrams; `ecc:fal-ai-media` only if he supplies a key (R3) | Stock atmosphere |
| 6 Verify | `scripts/ui-score.mjs`; frontend-design default-cluster review; `break` on each core component; `ecc:click-path-audit` on the primary journey; `ecc:browser-qa` (console, Core Web Vitals, axe); CDP or Playwright screenshots at 8 widths | `ecc:e2e-testing` for a regression suite that must survive the build | Reading class names or build exit codes as proof |
| 7 Review | `better-interface` per key screen (routes to the six `better-*` domains); `ecc:design-system` audit mode (10 dimensions, slop detection); one blind critic | `interface-review` when the request names a diff, branch or PR; `ecc:frontend-a11y` or `ecc:accessibility` as a second accessibility check; `improve-animations` for a whole-codebase motion audit | Running all six `better-*` one by one on the same screen: `better-interface` already does that |
| 7 Copy | `better-writing` on in-product text | `humanizer` for READMEs, reports, submission text | |
| Reverse-engineer | | `explain-interface` (how a site was built) | Cloning its grammar (house rule) |

## Directly invoked, outside the pipeline

- Slides or a pitch deck: `ecc:frontend-slides`.
- A screen recording of the finished app: `ecc:ui-demo`.
- A published page or shareable artifact: `artifact-design` first, then the `Artifact` tool.
- An autonomous build-and-evaluate loop: `ecc:gan-style-harness` (`ecc:gan-design`). It spawns agents, so only
  when he says "fan out".

## Overlaps resolved (so they stop competing)

- `frontend-design` exists as a plugin and as an installed skill. Same Anthropic skill; use the one that loads,
  never both. `ecc:frontend-design-direction` is a different, shorter skill used only as a cross-check.
- `frontend-design` (plugin) owns structure and the slop review. `ecc:design-system` audit is a second slop detector with a different
  checklist: run both, decide disagreements from the screenshot. `ecc:design-system` generate mode is not used:
  the house tokens come from phase 1.
- `emil-design-eng` and `ecc:make-interfaces-feel-better` are the craft bar during the build. `better-ui` checks the
  same domain at review time. Build to the first two, review with the third.
- `break` stresses one component in isolation. `ecc:click-path-audit` traces handlers across a journey.
  `ecc:browser-qa` measures the page. Three different failure classes, no overlap.
- `better-interface` vs `interface-review`: screen vs change. Pick by whether the request names a diff.
- `animate` builds, `review-animations` judges one diff, `improve-animations` audits everything,
  `find-animation-opportunities` proposes. Four verbs, no overlap.
- `prototype` explores whole pieces behind a picker; `variant` iterates one component in place on the real page.
- SIGNAL DECK (`tokens.css`) is his house system. It sits in the "near-black + one acid accent" cluster, so on a
  product with its own subject, surface the collision in one line and let him choose.

## Archived on 2026-10-01 (in `~/.claude/skills-archive/`, restore by moving back)

`animate-expo` (React Native), `write-swift`, `reproduce-bug-report` (needs Oz cloud agents), `research`
(spawns a background agent; `ecc:deep-research` replaces it).
