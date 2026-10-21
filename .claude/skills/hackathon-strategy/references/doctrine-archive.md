# Doctrine archive: pitfalls, live-integration and build lessons

Moved out of SKILL.md on 2026-10-01 when the skill was rewritten lean. Nothing here was dropped. SKILL.md holds the order of work and the toolkit; this file holds the evidence and the lessons behind it. Where the two disagree, SKILL.md wins (it carries the no-subagent rule and the current tool mapping).

---


# Hackathon Strategy (winning-idea generation)

## When to use
- User asks for a hackathon idea that can win first place / a prize.
- User provides a hackathon link or brief and wants a winning concept, pitch, or architecture.
- User wants to turn a hackathon project into a post-hackathon startup narrative.

## Core principle
A winning hackathon idea is NOT a clever idea — it is the project that maximizes the event's actual scoring function while being technically deep on the sponsor's unique stack. Generic AI-generated ideas lose, because hundreds of competitors will produce them. Two prefilters run
BEFORE the research pass and before anything in the workflow below: the **event-selection filter** (is this
the right fight?) and the **LANE GATE** (green/yellow/red — is the lane already owned, and the rule is *if the
lane is red, do not emotionally force it*). Both are in `references/lane-gate-and-judge-conversion.md`.

## The viability gate — run this BEFORE the research pass

A full winning-idea pass costs hours and can produce a beautiful plan for an event the user should
never enter. Gate first; the gate decides whether the pass happens at all. Check in this order and
stop at the first hard blocker:

**DAYS LEFT IS NEVER A GATE, A BUDGET OR A SCOPE LIMIT (2026-09-30, his standing instruction).** He builds
fast with Claude Code, so the calendar is not a constraint. Record the deadline as a dated FACT in the intake
and nothing more. Never NO-GO an event on time, never shrink an idea to fit the days left, never cap the
thinking time, never pick the "safer" idea because it ships sooner. The only question is which idea wins
first place, and the pass spends as long as that needs. Hard-deadline mechanics that are not about days (a
start-date rule, a video-length cap) still count under item 6.

1. **Who pays to run it.** Does the event supply the runtime credentials and costs the app needs (model
   credits, API keys, hosting, gas)? If the entrant funds them, price it before designing. "No credits
   are provided" is a build constraint, not a footnote.
2. **Credential validity, not presence.** An env var being SET is not evidence it WORKS. Validate every
   required key with one live call before planning around it. (A session was lost to two vars holding the
   same stale placeholder — both looked present, both returned 401.)
3. **Platform ceilings that break the concept.** Verify the load-bearing capability against the
   platform's OWN source — CLI `--help`, repo, schema constants, OpenAPI — never against the event page's
   summary. Event pages describe what sponsors want to be true; `--help` describes what is. (One event
   page told builders to publish the frontend to a `convex.site` URL; `convex deploy --help` has no such
   flag, and that domain serves HTTP actions only.)
4. **Third-party free-tier limits on the required feature.** Check the FREE tier of every sponsor tool the
   concept leans on. A capability marked ✗ on Free (custom domains, branded sending, rate ceilings) is a
   blocker when the demo's credibility rests on it.
5. **Eligibility and region exclusions.** OFAC-sanctioned countries, Quebec, age, student-only rules,
   employer conflicts. Cheap to check, fatal to miss. State the result in the first line of the pass; do
   not stop the pass for it unless the answer is certainly "no".
6. **Qualifying mechanics already spent.** "New apps only, started on or after <date>", public repo
   required, live URL required, video length cap. A start-date rule that disqualifies him is a hard NO-GO;
   the number of days remaining is not.

### The NO-GO output contract

When the gate fails, the deliverable is **under 15 lines**: the blockers, each with its evidence, and the
cheapest fix if one exists. No cliché list, no candidate set, no weighted scoring, no demo script, no
build plan. Say plainly that the event is a NO-GO — or enterable only with an explicit tradeoff the user
accepts. Phases 0–6 run at full length only after the gate passes.

## Workflow (in this order)
0. Clear the viability gate above. A NO-GO ends the pass here — do not research an event you have not
   first established is worth entering.
1. Research the event exhaustively BEFORE ideating. Extract:
   - Judging criteria AND their numeric weights (this is the scoring function you optimize).
   - The exact technology/primitive being judged (the product the sponsor wants builders to use).
   - The sponsor's UNIQUE capabilities (the moat: what only this platform can do).
   - Prize tracks, example use-cases, timeline, and submission requirements (demo video length, GitHub repo, testnet).
   - THE CLICHE LIST for this specific event: given these sponsors and this rubric, name the 5-10 concrete projects 80% of teams will build. Nothing on it gets submitted, and nothing adjacent survives gating.
   - State explicitly which of these you could NOT verify, with the 2-minute check that would confirm it. An unstated assumption hardens silently into an architecture.
2. Reverse-engineer what "winning" means: map each criterion to what a project must demonstrate, and weight your concept choices by those percentages. When the weights are not published, label your inferred weights ASSUMED and rank the survivors TWICE — under the assumed vector and under equal weights — flagging every candidate whose rank flips. The flip candidates are the fragile picks, and the one that only wins under invented weights is the one to drop.
3. Brainstorm in layers; aggressively kill Layer-1/2 ideas — the track's own example bullets, wrappers, clones, ChatGPT-wrappers, CRUD apps.
4. Pick the ONE concept that is "only possible on this stack": a composition of the sponsor's unique primitives that no other chain/platform can replicate.
5. Deliver the full winning-idea brief (see Output structure below), NOT a list of mediocre ideas.

## The sponsor-primitive idea engine (imported 2026-09-24)

Reverse-engineered from a repeat-hackathon entrant's repo account (26 repos read in depth — evidence, worked
examples, counter-examples and sampling limits in `references/repo-anatomy-and-idea-engine.md`). This is the
missing formalization of step 3 above ("brainstorm in layers"), so run it BEFORE ideating, per track:

> **F = (sponsor primitive P that is new or under-used) × (domain D where P answers a question nobody could
> previously ask) → exactly ONE named mechanism M, plus an artifact A a judge can verify with one command or
> one click, plus an explicit statement of what M is NOT.**

Fill a worksheet, one row per track, and **kill any row where the primitive is decorative**:

| Track | The new primitive P | The sentence P makes possible | 3 domains D | The ONE mechanism M (noun-phrase) | What M is NOT | The one-command proof A |
|---|---|---|---|---|---|---|

Four constraints, each visible across the source repos and each a scoring lever rather than a style choice:

1. **P must be load-bearing and get its own section** — `## Why this only works on <sponsor>`. Four different
   repos in the sample do exactly this. Test: if the concept still works with P swapped for another platform,
   the track is wrong.
2. **M is one noun-phrase, written together with its negation.** One repo states it outright: *"Dominant
   mechanism: cross-agent portfolio admission + atomic reservation + post-trade reconciliation. Not an AI
   trader, not a prediction-market terminal."* If the negation cannot be written, the idea is a feature list.
3. **M should emit a refusal or a verdict, not only a success path.** A visible rejection — a correlation-limit
   refusal, a blocked release, a `PAY / REFUND / SLASH` verdict, an `APPROVED` — is the cheapest possible proof
   that real logic exists. Our own rubrics keep asking for non-happy-path evidence; this is how to get one that
   reads as a *feature* instead of a failure beat.
4. **D is a pain a stranger already has**: payroll, bills, savings, release safety, pay-per-call APIs.

**Sequencing consequence — choose the proof artifact first and build outward from it.** This inverts the usual
"build the app, then demo it" order and is what makes the claim checkable by a judge in under a minute.

**Deployment-first corollary.** A one-command verifiable artifact and a live URL are part of the idea, not
packaging to add later: in the source sample every shipped-looking repo carries a live deployment and an
evidence folder, and the also-rans do not.

**Intake before ideation (2026-09-29).** Write a dated `INTAKE.md`, run the sponsor-overlap audit ("which
sponsor feature does this NOT duplicate?") and one real access spike BEFORE the worksheet above. Pattern, files
and README measurements: `references/intake-dossier-and-overlap-audit.md`.

## Pitfalls
- **A LANE SWEEP IS EVIDENCE, AND AN UNRECORDED ONE IS UNFALSIFIABLE (2026-09-29).** "No entry found" is the
  load-bearing claim of an empty-cell idea, and it is worthless without the literal query, the date, the
  platform, and the blind spot. Our own first pass on this found the field counted at 29 public repos against a
  memo that had listed 13 — the cell structure survived, the density was understated, and an unrecorded sweep
  could not have caught it. Two mechanical rules ride along: **every zero needs a planted positive control**
  (a companion query that *would* have returned hits had the lane been occupied — `pharmaceutical+stream+hackathon`
  = 0 only means something beside `oneaquahealth` = 29), and **an empty cell needs a warrant** for *why* it is
  empty (nobody thought of it vs. the data does not exist vs. it is not judge-aligned vs. it is infeasible),
  because those four cases look identical from the outside. Protocol and a worked run:
  `fexx-idea-engine/references/field-saturation-and-bet-shaping.md`.
- **SWEEP THE MECHANISM BY ITS IMPLEMENTATION WORDS, NOT THE PAIN'S WORDS (2026-09-30).** A favourite idea (a
  rotating spoken family code against voice-clone scams) looked empty after one query phrased around the pain
  ("family safe word app"). A second query phrased around the mechanism ("rotating ... time-based ... spoken
  words ... verify caller") found three shipped versions (a store app released four weeks earlier, an npm
  library, an open protocol), and a third found a hackathon winner using the same demo hook. Run at least one
  query in the vocabulary of how it would be *built* before calling a cell empty, and treat a first-pass zero as
  a blind spot until a differently-worded query agrees. Then let the RED lane kill the favourite.
- **"UNRECOVERABLE" IS A CLAIM ABOUT YOUR TOOLKIT, NOT ABOUT THE DOCUMENT (2026-09-29).** A pass concluded a
  paper's per-compound table was text-unreadable and asked for a rasteriser to be installed. `pdftotext`
  (poppler) was **already on PATH** at `/mingw64/bin/pdftotext` and read that same document — tables and body —
  cleanly, first try. The earlier verdict was true only about the tools that had been tried (pdftoppm,
  ghostscript, mutool — all *rasterisers*), and it had been written down as a property of the source. Before
  reporting a source as unavailable, **enumerate what is actually installed** (`for c in pdftotext pdftoppm
  mutool gs tesseract; do command -v $c; done`) and separate "this format defeats my tools" from "this value is
  not published". Two sibling failures from the same hunt, both the same shape: **a matcher's shape assumption
  is a blind spot** — requiring a `%` *inside* a table row missed the commonest layout, `Removal (%)` in the
  header with bare `0-70` ranges in the rows, and widening to caption-plus-header found the data immediately;
  and **an unsupported API field returns empty, not an error** (`FULL_TEXT:` is not a Europe PMC field — it
  yields `0 hits` silently, which reads exactly like "nothing published"). An empty scan and a broken scanner
  are indistinguishable from inside; the planted positive control is the only thing that tells them apart.
- **RUN THE LANE GATE BEFORE THE IDEA, AND THE EVENT FILTER BEFORE THE GATE (2026-09-24).** The viability gate
  asks whether an event is *enterable*; it does not ask whether the lane is already owned, and a perfectly
  enterable event can be an unwinnable lane. Inspect the field (prior winners in the theme, mature repos, npm
  releases, shipped docs/dashboards, traction claims), colour it green/yellow/red, and **on red: pivot or
  skip.** The pre-commit checklist has four legal outcomes and "build" is not the default.
- **THE README IS A SALES DOCUMENT FIRST, A TECHNICAL DOCUMENT SECOND (2026-09-24).** Which is consistent with,
  not a licence to violate, the AI-judge-artifact rule and the `CLAIMS.md` ledger: sell the mechanism in the
  top third, prove every claim in the ledger, and never assert what the ledger cannot support.
- **NO MOCKED CORE INTEGRATION, NO HARDCODED VALUE PRETENDING TO BE DYNAMIC, AND NO SINGLE-ENGINE BUILD BEHIND
  A MULTI-BACKEND README (2026-09-24).** The last one is the standard dishonest framing in agent-infra events;
  the fix is a narrower honest pitch. Run the pre-submit grep (`mock|fake|dummy|lorem|0x0000|picsum|randomuser|example.com`)
  and justify or fix every hit; declare the shortcuts you took (labelled demo data, testnet, no tests) rather
  than implying you did not take them.
- Do NOT present a list of ideas. The user's recurring brief explicitly asks for "one extraordinary idea after serious elimination," not 50 mediocre ones.
- Do NOT build something that is literally an example bullet in the track (e.g. "AI trading agent"). If your concept overlaps an example, differentiate on HOW (architecture/implementation), not WHAT — and prepare a judge-attack answer for it in advance.
- Do NOT clone the sponsor's own flagship demo (e.g. Somnia's "prompt→market" Prophecy Social). Check what the sponsor already ships before committing.
- A generic GPT prompt can produce "AI trading bot for crypto." The differentiator must be a non-obvious synthesis of the sponsor's primitives, ideally with an honest "why now" (three things that just converged).
- Keep the demo controllable: script or replay the trigger so the Before→Action→After is deterministic on camera — do not depend on the live market moving during the recording.
- **WRITE THE README BEFORE THE CODE, WITH A CLAIMS LEDGER (2026-09-24).** In the source sample the README is
  a first-class artifact in a fixed order (thesis → why-this-sponsor → how it works → live deployments →
  verify-in-60-seconds → demo → evidence → what-this-is-not → built-for), targeting **200–270 lines, not
  700**, and it may not assert anything that a `CLAIMS.md` / `evidence/claims.json` ledger does not support
  with a reproduction command. Our rule that the README is an AI-judge artifact already says this — the ledger
  is the mechanism that keeps it honest in both directions. Skeleton: `references/repo-anatomy-and-idea-engine.md`.
- **SHIP A LIVE URL EVEN WHEN THE PRODUCT IS THIN (2026-09-24).** One URL plus one explorer-linked transaction
  beats a complete local demo with no deployment.
- **PACKAGING IS A PHASE, NOT A LEFTOVER (2026-09-24, re-based 2026-09-30).** Hero image, OG card, brand
  lockup, video and thread are built after the core is done and before submission, as their own milestone.
  Packaging is the first thing teams cut when they run long, and it is what the next judge actually sees.
  Sequence by milestones (thin path, feature-complete, demo freeze, packaging), never by days remaining.
- **THE NAME MUST NOT EXPLAIN THE PRODUCT (2026-09-24).** Short (≤10 lowercase chars), drawn from the
  mechanism's industry vocabulary, then mangled for uniqueness; the tagline carries the meaning instead.
- **CALIBRATE THE SOURCE BEFORE GENERALISING FROM IT (2026-09-24).** The account has 251 repos but 85 are forks
  (166 originals), 102 originals have zero stars, and **one repo holds 72% of all stars** — the model on display
  is *distribution plus repetition*, not viral hits. Its profile README claims "nine hackathon placements" while
  the owner's own site claims "13× winner"; neither is corroborated. Take the METHOD (visible and checkable in
  the code) and treat the win count as an unverified claim — the standing rule that no unverified number enters
  doctrine applies to other people's numbers too.
- Research the platform page directly with curl/parse when web_extract returns only a truncated hero/timeline (see references/dorahacks-scraping.md).
- **Run the viability gate before the research pass, and stop on a NO-GO.** Who pays for runtime, credential validity, platform ceilings, free-tier limits, eligibility, spent qualifying rules. A NO-GO costs 15 lines; meeting the same blocker after a full 14-section brief costs the whole session. Some hackathons are not worth diving into — say so early and bluntly rather than delivering a plan of beautiful detail for an event that cannot work.

## Output structure (the user's expected deliverable)
1. The Winning Idea — name, one-liner, problem, insight, solution, why different, why now, why this hackathon.
2. The Magic Moment — the 30–60s Before → Action → After demo, including the "wait, you can do THAT?" beat.
3. How It Actually Works — architecture, components, data flow, key mechanisms (impressive but realistic to build).
4. MVP — Must Have / Should Have / If Time Allows; keep it minimal, do not overload.
5. Startup Potential — target users, wedge/initial customer, business model, market, distribution, expansion, moat.
6. Competitive Landscape — honest overlap: name real competitors, where they fall short, the real gap.
7. Judge Attack — the 10 hardest questions + strong answers (novelty, feasibility, security, scaling, business model, existing competitors, AI reliability, why the required tech is necessary).
8. Winning Pitch — 60 seconds, founder voice, no corporate buzzwords.
9. Final Verdict — win probability /10 + blunt why-win / why-lose / biggest weakness / the one move that strengthens it most.

## Idea-selection tests (from the user's brief — apply before committing)
(a) If another team copied this tomorrow, would judges still consider our implementation exceptional? (b) Could a strong AI generate this exact idea from a generic prompt — reject if yes. (c) Will people still care after the hackathon? (d) Can the whole concept be stated in one unforgettable sentence?

## Pre-submission hardening (late-stage — applies once the build exists)

- **The README is an AI-judge artifact.** More judges now run repos through AI graders, so
  the README must be self-contained and criteria-mapped: problem → insight → architecture →
  safety rails → deployed contracts/addresses → REAL receipts (tx hashes, windows, P&L) → an
  explicit "how this is scored" section mapping the event's weighted criteria to shipped
  features. No fake claims — AI graders cross-check against the repo.
- **Test EVERYTHING yourself before handing back** — don't stop at green typecheck/lint:
  run the contract suite, the production build, a prod-server smoke test (curl every route,
  grep new content), AND the headline on-chain path (fund the account, execute the flagship
  tx — arm/hedge/redeem — verify with the receipt + decoded event). The demo must run live,
  not mocked.
- **The UI must not look generic.** Hundreds of entries ship violet-glass crypto templates;
  a distinctive, cohesive system (one non-generic accent, flat surfaces, real hierarchy, a
  decluttered dashboard) is a measurable part of the UX score. Research, pick a lane,
  commit — and if the user says it looks generic ("be creative", "it's cluttered"), throw
  out the system and re-theme rather than polishing it harder.
- **Find the failing button BEFORE the demo.** If a headline control (arm/connect/approve)
  "won't let me send", the cause is usually wallet-side state (wrong owner, insufficient
  balance, wrong chain) — diagnose the on-chain preconditions and bake the preflight into
  the UI so the failure is explained, not silent.

## Integrating against a live platform (mid-build, before the demo)

The plan written on day 1 is built on docs. The platform will contradict them, and every
contradiction found late is a demo that cannot run. These are the checks that paid off:

- **Verify a capability claim against the platform's own source BEFORE designing around it.**
  A doc sentence ("fires when a payment arrives at a watched address") can describe a
  chain-specific feature. Confirm the required fields, the allowed chain IDs and the enum value
  in the platform repo or its OpenAPI, and cite file:line in your notes. In one session the
  plan's centrepiece node turned out to be pinned to two chain IDs — unusable on the chain the
  integration settled on — found by reading `workflow-schema-constants.ts` and a UI
  `allowedChainIds` line, not by building it. Finding that at design time costs an edit;
  finding it at demo time costs a rebuild.
- **Re-verify every third-party claim the plan inherited, with a real credential.** "Created
  programmatically via POST /v1/x" and "the secret is shown once" were both wrong in the same
  document: the stored spec showed cookie-only auth on all 24 routes, and a live GET re-listed
  the secret. A 401 is evidence, not a setback — and a fix that makes the client fail with the
  real reason beats one that returns a misleading 401.
- **Check the demo's numbers against the platform's limits before rehearsing them.** A
  per-transaction cap, or a wallet balance, can make every seeded amount unpayoutable: a
  flawless build rendering three refusals on camera, with nothing failing in CI. Prove it with a
  dry run, scale the fixtures, then **encode the fixture invariants as tests** — each amount
  under the cap, the parts summing to the whole, the expected verdict — so a later re-scale
  fails a test instead of a recording.
- **Rehearse for free, then pay once.** Count what one live take will spend, because it may
  consume the whole balance and leave no second take. Build a dry-run mode that exercises the
  real path (the SDK's own simulation call, the real limit check, the real classification) while
  writing nothing — and make "writes nothing" assertable with a test, because the bug that
  matters is a dry run that mutates state and leaves the real run with nothing to do. Print the
  before/after of any state the rehearsal must not touch, and fail if it changed.
- **Make the failure beats deterministic.** The rubric asks about non-happy paths and no provider
  will redeliver on demand. Sign the payload yourself with the same secret and replay the exact
  bytes: identical body = duplicate delivery, one altered byte with the original signature =
  forgery. Same code path, on cue, in seconds. Interlock it — read the service's own readiness
  output and refuse to send a value-moving request unless explicitly told it is live.
- **Put the platform's own quirks in the limits doc, with evidence.** "X is capped at N per
  transaction (enforced at <file:line>; verified live: HTTP 400 + the exact message)" is far
  stronger than a vague caveat, and it turns a surprise into a demonstration of depth. Where the
  design changed because the platform could not do what the plan assumed, say so plainly **and
  correct the plan doc itself** — a plan still asserting a falsified assumption will mislead the
  next session that reads it.

## Build execution (once the idea is chosen)
- In devrel bounties where "time to submit" is a scored criterion, treat Phase 0 (scaffold) as a scoring lever: clean the working dir of research scratch, set git identity, scaffold the repo layout, commit, and push to a public repo on day one — visible velocity, and the bug-log/docs phases build on a real repo.
- Use the user's fan-out convention: orchestrator does the shared foundation FIRST (env/toolchain kickoff, git identity, branch, scratch cleanup), then one subagent per disjoint file set with exact file specs + self-verification; orchestrator re-verifies everything, then commits → merges → pushes.
- Verify remote pushes (ls-remote / repo API) — never trust push exit code alone.
- Document environment gaps (missing toolchains/linkers) in the plan doc and hand the user the exact fix command: elevated installs can't run from a non-elevated agent shell (they exit 0 without installing).
- Keep research dossiers in the repo (docs/research/) as citation material for the bug-report phase; delete scratch dumps.

## References
- references/starter-prompt.md — the paste-in HACKATHON ENGINE kickoff, rewritten 2026-09-30. Two stages: DECIDE (viability gate → intake → winner DNA → measured convergence map → generate from five inputs → kill gates → evolve → P(1st) decomposition → blind attack → the pick) ends in a hard STOP; BUILD & SHIP runs only on his "GO <name>". It carries a table of the failure each block prevents. Use it to open every campaign.
- references/dorahacks-scraping.md — how to extract full hackathon details (criteria, tracks, description) from JS-rendered DoraHacks/Nuxt pages.
- references/event-platform-extraction.md — the same for Superteam Earn (`/api/hackathon/<slug>`, listing `__NEXT_DATA__`) and Colosseum (rules PDF, FAQ judging factors, `__data.json`, analytics, Copilot). WebFetch reports "not present" on these JS pages when the data is there.
- references/somnia-event-contracts-stack.md — verified Somnia/DreamDEX technical stack (Event Contracts SDK, Somnia Agents, on-chain reactivity) + the Event Contracts Hackathon judging criteria.
- references/lane-gate-and-judge-conversion.md — the pre-idea layer: the **lane gate** (green/yellow/red,
  with the field-intelligence to gather first), the event-selection filter and its five questions, the
  pre-commit checklist with its four outcomes (build / pivot narrower / switch lane / **skip event**), judge
  psychology + the 1·1·1·1·1 framing rule + the first-sentence rule, the five named anti-patterns
  (overbuilding, wedge too wide, ambiguous lanes, repeated adjacent shapes, builder-respect over judge
  conversion), submission shaping, the no-mocking / no-hardcoding / no-single-engine-behind-a-multi-backend
  README honesty gates with the pre-submit grep, and the research-agent-never-codes role rule.
- references/repo-anatomy-and-idea-engine.md — the reusable artefact template from a repeat entrant's repo
  account: the README skeleton in their section order, the naming procedure, the 60-second-demo checklist and the
  submission-day checklist (provenance + sampling limits at the top of the file).
- references/live-platform-integration.md — worked example of a live-platform integration: capability claims that failed verification, per-transaction caps proven from source + a live 400, cookie-only auth, and a deterministic webhook replay harness.

## When the build must survive past the demo

Winning the event and being a real product are different bars, and judges and users both notice
the gap. If the user asks "is this a real product or just a demo?" — or the build is about to
touch real data, real balances, or a real operator — switch to the `product-hardening` skill. Its
seam taxonomy (parent-blind lookups, fixture-only input paths, fixture data that fails the
product's own schema, unauthenticated operator routes, silent no-ops) is the checklist to run
against a demo-shaped build, and its `references/demo-seam-audit.md` is a worked example whose
worst seam would have paid the wrong party while every test stayed green.

## Kickoff amendment history (moved out of starter-prompt.md on 2026-10-04)

**Amended 2026-10-01 (b): PRIZE STACK, PANEL TYPE, ORGANISER CORPUS.** First run against a startup-competition
event with a second prize platform (Colosseum Crypto World's Fair: 8 ecosystem tracks, plus 35 Superteam Earn
side tracks with residency, attendance and social-posting rules). The prompt had no way to choose among tracks,
to stack side tracks without bolting them on, or to score a VC panel that weighs founder-market fit and traction
over the demo. Added: per-prize eligibility in A0, the track pick and the prize-stack matrix in A2, the panel-type
lens, the organiser's own submission archive as the first field source in A4b, gates G14 and G15, the prize-stack
section in A10, a traction milestone in B2, and side-track packaging in B6. Extraction recipes for the two
platforms are in `event-platform-extraction.md`.

**Amended 2026-10-01: IDEA FIREWALL.** Passes kept reaching for security-researcher ideas because the
I4 default said "adversarial and security depth" and the mutation/G10/wow wording leaned on refusal and
verdict. He wants the best idea for the event, not an idea that fits his profession. I4 now has no
default, the firewall block bans the profile from idea making, and the security-flavoured wording is
neutralised. Do not re-add a profession default anywhere in this file.

**Rewritten 2026-09-30.** Merged three sources: the previous kickoff (gate 0 → phases 0–6), a
ChatGPT-drafted "strategy partner" prompt (whose best parts were the evolution loop, the AI-convergence
question and the wow anatomy), and the doctrine written after the previous kickoff: `fexx-idea-engine`
(empty cell, negation, three roles, the unscripted path), the lane gate and the intake/overlap audit.
Nothing from the previous kickoff was dropped. The table at the bottom maps every block to the failure it
prevents.

## Pitfalls moved out of SKILL.md (2026-10-20, verbatim from the 2026-10-15 SKILL.md)

SKILL.md now keeps one line per pitfall; the evidence and dates are here.

- **A sweep is evidence only when recorded**: literal query, date, platform, blind spot, a positive control
  beside every zero, and a warrant for every empty cell. Sweep the mechanism in its implementation words as well
  as the pain's words.
- **An empty org search cannot see private repos** (2026-10-10, Mergetober). "No OpenAI Agents issue, PR or code in
  any topoteretes repo" was true, and the integration still existed, in a private repo listed in the monorepo's
  `inventory.yml`. Before calling a cell empty, read the sponsor's own registry (inventory, integrations page,
  docs sidebar, marketplace listing). A search only covers public repos.
- **"Unrecoverable" is a claim about your toolkit.** Enumerate installed tools before calling a source unreadable.
- **The README is a sales document first and an AI-judge artifact second.** Every claim is backed by `CLAIMS.md`.
- **No mocked core integration, no hardcoded value posing as dynamic, no single-engine build behind a
  multi-backend README.** Declare shortcuts instead of implying none.
- **Ship a live URL even when the product is thin.** One URL plus one explorer-linked transaction beats a
  complete local demo.
- **The name must not explain the product.** Short and ownable, best taken from the users' own world (Derica: the
  market's tomato-tin measure). The tagline carries the meaning. No enforcement suffix by default.
- **The locale reflex and the local empty cell** (2026-10-15). After the firewall removed his profession, his
  location became the default: 5 of 9 picks were Nigerian or diaspora money, and Upkeep and Alert were both
  remittance. Each looked like an empty cell because the sweep only saw that event. Run L0 judge memory
  (`scripts/judge-memory.mjs`) before trusting any empty cell, and apply the locale alarm in the kickoff.
- **The idea is not the only gap** (2026-10-15). Of those 9 picks, memory records only Cue as built; the other 8
  were last recorded at "waiting for GO" (memory can be stale). An entry that is never built and submitted has
  P(1st) = 0 whatever its idea scored. When he asks why he has not won, say this alongside any idea critique.
- **The verifier reflex** (2026-10-04). The fexx corpus is ten verification tools, so its method kept bending ideas
  into "an engine that checks X". That is a genre, not a law. Spread shapes in A4; a checker must win on the
  event's users, not on habit.
- **M3 alone is a trap.** A fresh primitive feels novel to us, but every strong rival read the same changelog.
  Tab (Arc, 2026-10-01) held only M3 and M4, and its own report said a rival could copy it in a weekend.
- **"Provably fair" needs verifiability, not privacy** (2026-10-15, Midnight). Before claiming ZK is load-bearing for a
  fairness idea, ask whether public commit-reveal already solves it. Korea gacha was killed by this check (G2): item
  odds are public by law, so a published table plus commit-reveal suffices. The idea survived only where the thing
  to hide (the sealed pool's contents) is genuinely secret and must still be proven.
- **Complexity is not innovation.** Fewer moving parts, sharper insight. Correct a wrong claim in place, mark it.
- **A cohort M2 finding needs a within-subject test before it becomes the hook** (2026-10-04, Bitget S2). Pooled
  over 30 real traders, weekend entries won 10 points less and revenge entries 12 less; shuffling the label
  *inside each trader* gave p = 0.69 and 0.29. The pooled gap measured who trades that way, not what the habit
  does. Permute within subject (trader, wallet, user); when the gap vanishes, the vanishing can be the
  negation (it became Blotter's thesis: habits are personal, so rules must be proven per trader).
- **Read the win-cap before planning a prize stack** (2026-10-03, DEV HF26). Some platforms cap wins per entry or per person. DEV challenges allow one Entry per participant, judge only the first one, and let each person win once per challenge. On those platforms, extra categories are extra *chances* to win, not extra *wins*, and a test post carrying the tag becomes your Entry. For DEV, the field is fully measurable: `dev.to/api/articles/latest?tag=<tag>` plus `/api/articles/{id}` gives every rival's "Prize Categories" section. Count real claims, and drop "not entering X" false positives by hand.

## Why each kickoff block existed (2026-10-15 starter prompt)

The full table is in `~/.claude/skills-archive/hackathon-strategy-pre-2026-10-20/starter-prompt.md`, section "Why each block exists".
