---
name: hackathon-strategy
description: The hackathon engine. Use when he pastes a hackathon, asks for a winning idea, a first-place plan, a pitch, or a build-and-ship pass for an event. Runs a lean, evidence-first DECIDE (gate, intake with the WANT MAP, an evidence bank of real pain and sponsor asks, the modal wall, slop-checked cards, one score table, the top two deepened with targeted research, a blind-card pick), stops for his GO, then BUILD & SHIP. Names the exact skill or tool to use at each step.
---

# Hackathon engine

One number is optimised: **P(1st place)** at this event. First place means beating the best entry in the field,
not the average one. The ideation method is `references/idea-forge.md`; the build rules are
`references/build-and-ship.md` (read only after GO). Old lessons and evidence: `references/doctrine-archive.md`.

**Rebuilt lean on 2026-10-20** at his request: strong ideas, not slop, without burning tokens, and deeper research
only where an idea needs it. The 2026-10-15 forge spent most of its tokens on in-context persona tournaments and
long reports, cued cards with invented people, and its three picks all hit their deadlines unbuilt. The previous
files are in `~/.claude/skills-archive/hackathon-strategy-pre-2026-10-20/`.

## Standing rules (all from him, none negotiable)

1. **No subagents unless he says so in this session** (2026-10-01). Every step runs inline. If he says "fan out",
   one agent per disjoint job, and say what each does.
2. **Days left is never a gate, budget or scope limit.** Record the deadline as a dated fact. Never shrink the idea.
3. **Idea firewall.** The idea comes from the event (judges, sponsor, users, pain), never from his
   security-researcher profile. More than 2 finalists in the security, audit or verifier family is a bias alarm.
4. **Hard STOP between decide and build.** Nothing is built, posted, emailed or submitted without "GO <name>".
5. **Honest odds.** Tag every claim VERIFIED (URL, file:line, live response) or UNVERIFIED (plus the 2-minute
   check). Never invent an endpoint, SDK method, judge, prize or past winner. "4/10" is a useful answer.
6. Strategy files live outside the public repo: `<workdir>/<event-slug>/strategy/`.
7. **Token discipline** (2026-10-20). Tokens go to inputs, not ceremony: real quotes, data, platform truth and the
   field are worth tokens; persona votes, re-scored tables and long reports are not. This limits tokens, never
   thinking time or quality (rule 2 still holds).

## The thesis

Every team has a capable model and the same event page, so the modal idea is free and worthless. An idea is
differentiated only by inputs the other teams did not give their model: **I1** field telemetry (what exists now),
**I2** platform truth (the sponsor's repo, changelog, real limits), **I3** the panel's own work, **I4** an unfair
advantage (event-derived, never his profession), **I5** a measured number that falsifies something the field
believes. A card with none of the five is modal. The engine gathers those inputs first (the evidence bank) and
makes every card stand on one.

Every idea clears five bars: **not on the wall** (L0-L3: what judges have seen and what rivals' models suggest),
**wanted** (serves a quoted WANT), **a real product with a payer today** (never a demo; G14, every event),
**needs this sponsor** (G2), and **retellable** ("the one where <person> <did> and <result>"). Every finalist holds
two moats a rival's model cannot produce (`references/rival-simulation.md`). There is no house genre: the shape
comes from the event's users.

## STAGE A: DECIDE

| Step | Job | Run this |
|---|---|---|
| A0 Gate | Who pays the runtime; eligibility and obligations **per prize** (the rules page governs the overview); qualifying rules; platform ceilings and free-tier limits on the feature the demo needs. NO-GO is under 15 lines: blockers, evidence, cheapest fix. "I must confirm" goes in line one and the pass continues | WebFetch with a question, or firecrawl_scrape `formats: ["query"]`, `mode: "directQuote"`; `references/lane-gate-and-judge-conversion.md` only when eligibility is unclear; `blocked-page-recovery` when walled; `references/event-platform-extraction.md` and `dorahacks-scraping.md` for DoraHacks, Superteam Earn, Colosseum |
| A1 Intake | `INTAKE.md`, at most 80 lines: rubric with weights (quoted, or ASSUMED), prize map and track pick (prize count x amount vs expected entrants), panel type (VC, sponsor devrel, academic, community), judges and what they built, the primitive being judged, the sponsor's overlap (what it already ships), **WANT-1..5** each quoted with its source, winner DNA (past winners of this event or sponsor, at most 3 searches; "not findable" is a legal answer), deadlines as dated facts, open questions | `references/intake-dossier-and-overlap-audit.md` the first time; context7 or `ecc:documentation-lookup` for sponsor docs |
| A2 Evidence + wall | F1: the evidence bank, 8-15 one-line items with URLs (at least 4 real PAIN quotes, 2 sponsor ASKs, NEW primitives, a DATA source, the FIELD). F2: the modal wall (L1-L3 written once, before any card) and L0 judge memory on its 3-5 domains | `references/idea-forge.md` F1-F2; firecrawl_search / WebSearch highlights; `scripts/judge-memory.mjs`; `scripts/rival-run.mjs --selftest` once (NOT READY is normal) |
| A3 Cards | F3-F6: 10-12 six-line cards, each on an E-item and a WANT, 5+ cue families, 3+ shapes, the slop check; kill on hard gates in one line each; score the survivors once; a second round only when a trigger fires | `references/idea-forge.md` F3-F6; `product-brainstorming` (Provoke) and `generate-creative-ideas` (one technique) only in round 2 |
| A4 Deepen | F7: the top two (different mechanisms), same steps for each: startup, real product, wow beats, moats, kill shots, targeted research, P(1st) with its weakest factor. The access spike (one live call per load-bearing API) runs here | the research trigger table in `idea-forge.md` F7: `ecc:exa-search`, `ecc:market-research`, `ecc:deep-research`, context7, `ecc:product-lens`, `attacker` (one pass, on the pick only) |
| A5 Pick | F8: `CATALOGUE.md` (at most 200 lines: evidence bank, wall, every card and its fate, the score table) and `PICK.md` (at most 150 lines, below). Chat reply at most 15 lines plus the paths | `humanizer` on PICK.md prose |

**PICK.md**, in order: the blind cards (X, Y, Z); the verdict ("clear winner <name>" or "your pick needed" and
why); then for the pick: name, one-liner, tagline; the 20-second wow beat by beat and a 90-second demo outline; how
it works in five lines with the exact sponsor API that is load-bearing; the moats with evidence; the company (payer,
price, first 10 users and channel, competitor and edge, why now); the build contract (MVP, stretch, NOT BUILDING,
thin path first); the top 5 risks with fallbacks; the decisive unknown with both branches; side tracks that pass
the removal test (G15: delete the integration and a user notices); the P(1st) decomposition; the runner-up, its
switch trigger and the last date to switch.

Then **STOP and wait for "GO <name>"**. Say "deep" for up to 4 forge rounds.

## STAGE B: BUILD & SHIP (only after GO; read `references/build-and-ship.md`)

| Step | Job | Run this |
|---|---|---|
| B1 Proof first | Write the build plan, then build outward from the proof: the deterministic core, the thin end-to-end path, the model, the UI, breadth. Day-one `README.md`, `CLAIMS.md`, `DECISIONS.md` | `plan`; `ecc:blueprint` for a long build; `test-driven-development` for the core; `references/live-platform-integration.md`; `references/repo-anatomy-and-idea-engine.md` for the README skeleton |
| B2 Milestones | Thin path, feature-complete, demo freeze, packaging. No calendar. A TRACTION track for VC or accelerator panels | Packaging is its own milestone |
| B3 Two judged paths | Scripted path deterministic; unscripted path (the judge's own input) hardened first; failure beats on cue | `product-hardening`; `systematic-debugging`; `ecc:security-review` before key or wallet code ships |
| B4 UI | The wow screen first | `ui-studio`; verify in a real browser with `ecc:browser-qa` or Playwright MCP |
| B5 Judge funnel | Gallery card, the video's first 20 seconds, README top third, live URL, the judge's own input | `demo-video` from the deployed link; `ecc:frontend-slides` when a deck is required |
| B6 Submission hardening | README scoring map, LIVE / NEXT / NOT LIVE, the pre-submit grep, the judge's path run live from a clean browser | `ecc:verification-loop`; `ecc:e2e-testing`; `humanizer` on all copy. **He presses submit.** |
| B7 After | If the build must survive the event | `product-hardening` |

`ecc:content-engine` and `ecc:article-writing` draft launch content only when he asks; `ecc:social-publisher` and
`ecc:crosspost` publish, so never without his go.

## Pitfalls (one line each; the evidence and dates are in `doctrine-archive.md`)

- **An unbuilt pick scores zero.** 8 of 9 picks to 2026-10-10 and all 3 of 2026-10-15/16 stopped at "waiting for
  GO". Keep DECIDE short so the session has room to build; say this when he asks why he has not won.
- **An invented persona is slop.** The user and the pain come from an E-item a real person wrote.
- **A sweep is evidence only when recorded**: query, date, platform, blind spot, and a positive control beside
  every zero. Search the mechanism's implementation words as well as the pain's.
- **Search cannot see private repos.** Read the sponsor's own registry (integrations page, inventory, marketplace)
  before calling a cell empty.
- **The locale reflex.** 5 of 9 picks were Nigerian or diaspora money; run L0 before trusting a local empty cell.
- **The verifier reflex.** "An engine that checks X" is a habit from the fexx corpus, not a judge preference.
- **M3 alone is a trap.** Every strong rival read the same changelog.
- **"Provably fair" needs verifiability, not privacy.** Ask whether public commit-reveal already solves it.
- **A pooled data finding needs a within-subject test** before it becomes the hook.
- **Read the win-cap before planning a prize stack** (DEV: one entry per person, the first one is judged).
- **"Unrecoverable" is a claim about your toolkit.** Enumerate installed tools first.
- **The name must not explain the product.** Short, ownable, from the users' own world (Derica); the tagline
  carries the meaning; no -ify, -hub, -verse or enforcement suffix by default.
- **No mocked core, no hardcoded value posing as dynamic.** Declare shortcuts. Ship a live URL even when thin.
- **Complexity is not innovation.** Fewer moving parts, sharper insight. Correct wrong claims in place, marked.

## Files

- `references/idea-forge.md`: A2-A5. Evidence bank, wall, card format, cue families, slop check, kill gates, score
  table, round-2 triggers, deepen steps, research trigger table, the pick, the outside JUDGE brief.
- `references/starter-prompt.md`: the short paste-in kickoff (constraints plus event material).
- `references/build-and-ship.md`: Stage B in full. Read after GO only.
- `references/rival-simulation.md`: the four wall layers, paste-ready blocks for outside models, the six moats.
- `scripts/judge-memory.mjs`: L0, Devpost archive counts and a 30-project sample per 1-2 word domain, with
  controls. The kill is 3+ same-mechanism projects in the sample, never the total.
- `scripts/rival-run.mjs`: optional outside samples and judge votes through a READY CLI; `--selftest` first.
- `references/lane-gate-and-judge-conversion.md`: event filter, lane colours, judge psychology, README honesty.
- `references/intake-dossier-and-overlap-audit.md`: the INTAKE.md pattern and the sponsor-overlap audit.
- `references/event-platform-extraction.md`, `dorahacks-scraping.md`: data from JS-rendered event platforms.
- `references/repo-anatomy-and-idea-engine.md`: README skeleton, naming, demo and submission-day checklists.
- `references/live-platform-integration.md`: a worked example of platform claims failing verification.
- `references/somnia-event-contracts-stack.md`, `stellar-stack-facts.md`, `tempo-stack-facts.md`: chain facts,
  only for those events.
- `references/forge-attack-2026-10-15.md`: the attack on the superseded tournament forge (history).
- `references/doctrine-archive.md`: the v1 skill, the detailed pitfalls, build conventions.
- Companions: `fexx-idea-engine` is background method (do not load it during DECIDE), `ui-studio`, `attacker`,
  `product-hardening`, `product-brainstorming`, `generate-creative-ideas`, `humanizer`.
