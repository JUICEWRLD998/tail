# Verification discipline

The chain that gates shipping, and how proof is produced, dated and bounded. Sources:
`fexx-levelproof` (package.json, playwright.config.ts, scripts/, docs/) and `masayume`
(pnpm-workspace.yaml, scripts/invariants, scripts/spike, contracts/test).

## Contents

- [One verify verb](#one-verify-verb)
- [Ordered gates with no promotion](#ordered-gates-with-no-promotion)
- [E2E against the production bundle](#e2e-against-the-production-bundle)
- [Fixture the nondeterministic seams](#fixture-the-nondeterministic-seams)
- [Answer-text selectors and state probes](#answer-text-selectors-and-state-probes)
- [Machine-checked architecture rules](#machine-checked-architecture-rules)
- [Spike scripts](#spike-scripts)
- [Measure perf and cost as tests](#measure-perf-and-cost-as-tests)
- [Gate live third-party calls](#gate-live-third-party-calls)
- [The deterministic eval suite](#the-deterministic-eval-suite)
- [Reproducibility: pin in three places](#reproducibility-pin-in-three-places)
- [Secrets and planning hygiene](#secrets-and-planning-hygiene)
- [Checklist](#checklist)

---

## One verify verb

```json
"verify": "set -o pipefail && npm run typecheck && npm run lint && npm test && npm run build"
```

- **Ordered cheapest-signal-first** with `&&` short-circuit: mechanical failures die in a second, not
  after a 90-second browser suite.
- **`set -o pipefail`** so a piped stage failing is not masked by the last command's exit code.
- **CI calls the script, never its constituent commands** — otherwise the two drift and CI stops
  testing what a human runs.
- Add `git diff --check` as the final check (whitespace errors, conflict markers).

**Make `verify` the easy path, not a discipline.** If verifying correctly takes more steps than
verifying quickly, people verify quickly.

## Ordered gates with no promotion

```
1. automated tests                  ← fastest, mechanical
2. fixture-backed browser journeys
3. live-backend journeys
4. blocked / unavailable            ← listed explicitly, left unchecked
```

- **A fixture success may never tick a live box.**
- **Emulation is not a device. Resize is not a real-device test.**
- Unchecked items **stay visibly unchecked** — the readiness checklist is *"split by evidence tier."*
- The submission checklist records **which tier each item was verified in**, and the doc states what
  the run did *not* prove.

## E2E against the production bundle

```
✗ browser suite → next dev / vite dev
✓ browser suite → `next build` + `next start` (or `vite build` + `vite preview`) on a fixed strict port
```

- Bind a **strict, fixed port** so a stray server can never be silently reused.
- Keep `reuseExistingServer: false` under CI.
- Reason: dev-server HMR sockets mean the page never settles, and a dev-only success can hide a
  production bundle failure (missing chunk, minifier-mangled name, dropped asset).

**Related trap:** an old production server still holding the port will serve freshly-built HTML whose
CSS chunk hashes no longer exist on disk — the page renders completely unstyled and looks like a CSS
bug. Diagnose it by diffing the asset hashes in the *served* HTML against what is on disk. If they
differ, you are looking at a ghost process, not a CSS problem.

## Fixture the nondeterministic seams

A network call, a clock, or a random seed inside a test is a future flake. Intercept it **at its own
boundary** and **label the fixture**.

- Record real responses once, replay them in the suite.
- Name the fixture so a reader knows it is a recording, not a live call.
- The **live** verification is a separate, clearly-labelled run with its own credentials and budget.

## Answer-text selectors and state probes

Two techniques that make browser suites robust:

1. **Select by accessibility tree** (role + accessible name), not by CSS class. Class names are not a
   contract; accessible names are.
2. **Read coarse UI state from `data-*` attributes**, not from structural guesses.

```js
await page.getByRole('button', { name: 'Compile' }).click();
const state = await page.locator('[data-slot="check-strip"]').getAttribute('data-state');
```

### The lying-probe rule

> **A probe asserts a mechanism; when the mechanism changes, it lies instead of failing.**

Two recorded examples: a probe asserted an `iframe` that the editor had stopped using (reported "never
mounted" against a terminal that mounted in 1.1s), and a probe clicked a control before the required
state existed (reported NOT FOUND).

- **A stale probe is worse than no probe** — it manufactures failures and buries real ones.
- When a check fails, first ask *is this the app or is this my check?*
- **Probe the app's own self-reported state word** (`Terminal: Ready`) rather than a structural guess.
- **Re-verify a driver against the current flow after any new screen is added.**

### The planted-positive-control rule

> **Every DOM probe needs a planted positive control.** Write the control, make it fail on purpose,
> and only then trust the pass.

An empty scan and a broken scanner look identical from inside. This applies to scanners, contrast
samplers, and browser probes alike.

Two corollaries that have bitten:

- **Kill CSS transitions before a synchronous `getComputedStyle` read.** A 160ms `color` transition
  means reading in the same tick returns the *previous* colour — your planted 1:1 control applies
  nothing and reads as "probe is blind" while the probe is fine and the *control* is lying.
- **Exclude a control you planted from your own sample.** A census that counted an injected element as
  page content reported a stray value that existed only because the probe put it there.

## Machine-checked architecture rules

Review comments do not enforce architecture. A rule table does.

```js
// scripts/invariants/rules.mjs — exits non-zero, wired into the build
export const RULES = [
  { id: 'design-literals', exts: ['.ts', '.tsx'], pattern: /(#[0-9a-fA-F]{3,8}\b|\b\d+(\.\d+)?px\b)/ },
  { id: 'file-length',     /* MAX_FILE_LINES = 400 */ },
  { id: 'no-cross-import', /* package A may not import package B */ },
];
```

Checks worth having on day one:

- **No style literals in component code** — forces values into a stylesheet.
- **File-length cap** — a 400-line cap is what keeps a design system reviewable.
- **Import boundaries** — a monorepo boundary is a rule, or it is a suggestion.

**Verify the generated artifact, not just the source that made it.** A codegen'd file can be stale, a
build output can be missing, and a source-level test will not notice.

## Spike scripts

Throwaway live probes, used to answer a question before committing to a design.

- A **shared harness** so every spike is 30 lines, not 300.
- A **guaranteed exit** so a hung probe cannot wedge CI.
- **Machine-readable output that lands in the docs** — the spike's evidence becomes the decision log's
  bullet, not a chat message that evaporates.

The progression the source uses:

```
spike (throwaway, answers one question)
  → invariant (the answer, pinned as a test)
  → test suite (regression protection)
  → docs (the measurement, dated)
```

A spike that is not written down did not happen.

## Measure perf and cost as tests

Attach the measurement as a **test artifact** so a regression is visible, not anecdotal.

- Record the **harness** for every performance number and **mark incomparability explicitly**
  (SwiftShader vs Metal; emulated vs real device; cached vs fresh).
- Keep a **"still to measure" list** rather than rounding up.
- Every model/provider call records **timestamp, config, latency, cost, cache status, repeat count** —
  *"Do not run the live battery without"* them.
- Keep a **dated run log** where each row carries cost, latency, and the rollback target.

## Gate live third-party calls

Anything that costs money or hits a third party needs three things:

1. **An explicit flag** — opt-in, never run by default.
2. **A declared budget** — a stated cap, tracked against actual spend.
3. **An unknown-cost kill switch** — if the cost cannot be determined, the run stops rather than
   proceeding blind.

The source's model-eval entry is the worked example: a $0.25 cap, *"Evaluation spend: $0.225 of the
$0.25 cap, including two defective-configuration runs and diagnostics, all disclosed in the eval doc."*

## The deterministic eval suite

When a component is probabilistic (a model, a heuristic), build a **deterministic oracle** for it:
fixed fixtures, deterministic grading, a **non-zero exit** on failure.

- Grade through the *real* pipeline (`applyOperations` + `verify`), not a re-implementation.
- Fix the fixtures, not the bar.
- Bad results are recorded as findings, not made to pass.

## Reproducibility: pin in three places

- **Pin the dependency version in three places and fail on drift** — lockfile, the manifest, and any
  runtime version check.
- **Pin every reused upstream by full commit SHA.** *"Measure the overlap with a stated method rather
  than using the word 'adapted'."*
- **Pin the fork block number** for on-chain work.

## Secrets and planning hygiene

- A three-layer ignore discipline: `.gitignore` (commits), a deploy-ignore (`.vercelignore` /
  `.dockerignore`), and a **deployment-content check on every gate** — because a private planning file
  in the working directory can still ship if only one ignore layer exists.
- **Presence-check secrets without ever printing the value.**
- Keep per-key spend limits enforced on provider keys.
- **A tool that must not act says so in the file.** The operations checklist carries an explicit
  *"does not authorize deployment"* clause and no item authorizes deployment by itself.

## Checklist

- [ ] `verify` is one pipefail chain, cheapest-first, and CI calls the script.
- [ ] Gates are tiered; no fixture success ticks a live box.
- [ ] Browser suites run against a production build on a fixed strict port.
- [ ] Nondeterministic seams are fixtured at their boundary, and the fixture is labelled.
- [ ] Selectors use the accessibility tree; state reads from `data-*`.
- [ ] Every probe has a planted positive control that was made to fail once.
- [ ] Architecture rules are a checked-in table wired into the build.
- [ ] Spikes use a shared harness, always exit, and emit machine-readable output into the docs.
- [ ] Perf/cost numbers name their harness and are marked incomparable when they are.
- [ ] Live third-party calls are flag-gated, budgeted, and kill-switchable.
- [ ] Probabilistic components have a deterministic eval suite with a non-zero exit.
- [ ] Dependencies pinned in three places; reused upstreams pinned by SHA.
- [ ] Three-layer secret hygiene with a deployment-content check per gate.
