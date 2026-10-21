# The lane gate, and judge conversion

**Provenance (2026-09-24).** Mined from a peer builder's hackathon doctrine —
`github.com/Blockchain-Oracle/sahil-skills-bundle` → `skills/sahil-ui-mining/references/hackathon-playbook.md`
(496 lines, 16 sections), read alongside `sahil-visual-loop`, `sahil-anti-slop-audit` and
`sahil-hackathon-orchestrator` in the same bundle. **The bundle ships no LICENSE file**, so per our own rule
(no licence = all-rights-reserved) the doctrine below is **summarised and re-expressed in our own words, not
copied** — go to the URL for the original text. Hygiene note observed while reading it, not used:
that repo publicly commits X/Twitter session state (`skills/sahil-x/state/cookies.json`,
`state/accounts/*.json`), which is a live reminder of the pre-publication secret scan in
`defi-security-research/references/artifact-authorship-and-publication.md`.

**What this adds to what we already have.** The `winsznx` import (`repo-anatomy-and-idea-engine.md`) is about
idea *generation* — how to build the concept and the README. This file is about what happens *before* that:
**which fight to enter, and whether the lane is already owned.** Run them in sequence:
**event filter → lane gate → idea formula → build → package.**

---

## 1. The LANE GATE (green / yellow / red) — the pre-idea check we lacked

Our existing viability gate asks *"can this event be entered and built?"* (who pays for runtime,
credentials, platform ceilings, eligibility, spent qualifying rules). It does **not** ask *"is the lane
already owned?"* — and a perfectly enterable event can be an unwinnable lane. That is the gap this closes.

**Before committing to an idea, inspect the lane for:** existing winner-shaped projects; strong open-source
repos that could be adapted fast (by someone else); mature startup-grade builds already aligned with the
theme; previously-submitted adjacent projects that will crowd the lane; and obscure ecosystem-native projects
that are quiet but dangerous.

**Where to look:** prior winners in similar themes; public repos with most components already built; npm /
package releases signalling prior maturity; existing docs, demos, dashboards, MCP servers, SDKs, mobile apps
or contracts; and public traction claims (users, transactions, volume, mainnet beta, pilots).

| Lane | Signals | Decision |
|---|---|---|
| **GREEN** | no dominant incumbent; no obvious mature repo; room for a fresh wedge | okay to build |
| **YELLOW** | some strong adjacent projects exist | still winnable, but **requires narrower scope and cleaner framing** |
| **RED** | an obvious mature incumbent exists; forks/adaptations likely to crowd it; our idea will read as redundant, late, or overbuilt | **pivot or skip** |

**The rule, verbatim in spirit: if the lane is red, do not emotionally force it.** This is a kill decision
made on evidence about other people's repos — the cheapest possible loss, since it happens before any build
time. Log the lane colour and the incumbent you found; that log is what stops the same lane being re-entered
next month.

## 2. The event-selection filter (run BEFORE the viability gate)

Which events to spend real time on at all. Weak: broad consumer categories with no strong wedge; gaming-first
events unless the build is unmistakably game-native; vague open-theme events where polished startup demos
dominate and category fit is weak. Strong: agent infra, payment rails, devtools, ZK / compliance / identity
primitives, on-chain coordination tools, and chain-native infra with obvious sponsor value.

Five questions, each cheap: Does this theme match our strongest building style? Does the sponsor reward
practical infra or flashy demos? Is there a concrete ecosystem-native primitive to build around? Are prior
winners close to our strengths or far away from them? **Is the judge table likely to understand the product in
under 20 seconds?**

## 3. The pre-commit checklist (the last gate before build time)

| Group | Questions |
|---|---|
| **Theme & rules** | What is the exact theme? Are prior components or old repos allowed? Are forks/adaptations culturally normal here? What are the explicit judging criteria? |
| **Field intelligence** | What are the top 5 adjacent winners from similar events? Which incumbents already sit in this lane? Which obscure repos already own the obvious angle? Is the lane green/yellow/red? |
| **Idea quality** | Can it be explained in one line? Does it map directly to sponsor value? Is it **narrower than our natural tendency**? Would a tired judge understand it in 15 seconds? Is there already a stronger visible version? |
| **Decision** | **build · pivot narrower · switch lane · skip event** — four outcomes, and "build" is not the default |

## 4. Judge conversion

> "Judges are usually not rewarding the deepest project. They reward the **fastest-converting narrative**."

**What judges consistently like:** a clear title; one obvious user pain; one sharp use case; strong
sponsor-native fit; real proof that it works now; a clean, low-explanation demo.
**What loses points fast:** broad platform stories; too many features; multiple product identities;
philosophical framing before practical framing.

**Required framing rule — the default shape of an entry:**
> **1 user · 1 pain · 1 action · 1 wow moment · 1 sponsor-native reason it belongs here.**

**First-sentence rule.** The one-liner is a *sentence about a user doing something*, not a vision:
*"Private voting for KYC-verified users on HashKey"*, *"Agents pay per API call on Stellar"*, *"Bitcoin users
pay Brazilian bills using sBTC"*, *"Subscription billing infrastructure for Casper dApps"*. **Not** a broad
ecosystem vision, a stack description, or a long architecture story. Test it by reading it as someone who has
15 seconds and no context.

**The five named anti-patterns** (each one observed in the source author's own work):
1. **Overbuilding** — app + docs + bot + MCP + CLI + SDK + dashboard instead of one thing that works.
2. **Wedge too wide** — "infra + app + protocol + agent layer + distribution layer" rather than one primitive.
3. **Competing in ambiguous lanes too early** — the lane gate in §1 exists because of this one.
4. **Repeating adjacent project shapes** — agents / payment rails / governance / AI-x-chain, again.
5. **Optimising for builder respect over judge conversion** — depth that no judge will reach in the demo
   window. This is the most seductive one for us, because it feels like quality.

## 5. Submission shaping

**Must-have assets:** brutally clear title; one-sentence pitch; **3 key features maximum** on the submission
page; live demo if possible; public repo; clean README; one simple architecture diagram; and **concrete
proof** — transactions, users, beta, contracts, volume, integrations, or a working flow.

**Demo rule:** the demo must show the core action fast. **If the wow moment takes too long to reach, the
project is too bloated or the demo is weak** — treat that as a build defect, not a recording problem.

**README rule:** the README is **a sales document for judges first, a technical document second.** (This sits
comfortably next to our existing "the README is an AI-judge artifact" rule and the `CLAIMS.md` ledger: sell
the mechanism in the top third, prove every claim in the ledger, and never assert what the ledger cannot
support.) The section skeleton is in `repo-anatomy-and-idea-engine.md`.

## 6. The UI rule, and the honesty rules

**UI — agents are bad at UI by default.** The doctrine's own workflow when a build needs UI is: pin
references *before* building, mine open-source premium components rather than hand-rolling, and run an
anti-slop audit before submission. That is exactly the method now vendored as the `premium-ui` skill
(select author-built components, lock tokens in a `DESIGN.md` first, never hand-build a coverable section) —
its `references/blocklist.md` is the slop-tell list. Where the house language fits, `warm-calm-ui` is the
default direction.

**Correction (2026-09-30):** `premium-ui` and `warm-calm-ui` no longer exist. The whole UI chain was deleted on
his instruction and replaced by `ui-studio` (frontend-design, then Hallmark, then rendered verification with
planted controls). Hallmark's 58-gate slop test is now the slop-tell list.
*(Correction 2026-10-04: the slop test has 60 gates, and ui-studio now runs many skills, not Hallmark only: see
`ui-studio/references/toolbox.md`.)* Start a UI pass with
`ui-studio/references/starter-prompt.md`.

**Honesty gates — hard rules, with the source's own framing:**
- **No mocked core integrations.** A label ("demo data") is acceptable; a fake integration is not.
- **No hardcoded value pretending to be dynamic.**
- **No single-engine / single-provider build behind a multi-backend README.** The source calls this "the most
  common dishonest framing in agent-infra hackathons" and the fix is to **pick a narrower, honest pitch**.
- **Acceptable shortcuts, stated:** labelled demo data, testnet/RPC instead of mainnet, no tests/metrics/
  multi-region. Say which ones you took.
- **Pre-submit grep** for `mock|fake|dummy|lorem|0x0000|picsum|randomuser|example.com` — every hit gets a
  written justification or a fix.
- Genuine iteration matters: **multiple commits showing progress**; a single "Initial commit" reads as
  scaffolded-by-agent. Pre-submit, check for `0x0000…` addresses in the frontend, a default favicon/title, and
  a test file with one `describe` and three placeholder `it()`s.

## 7. Role separation and cleanup (how the source avoids self-inflicted failure)

- **The research agent NEVER writes, builds or runs code in the hackathon repo.** It produces briefings and
  handoff messages; coding agents own the runtime. Handoffs carry **Repo / Goal / Scope / Acceptance /
  References / Out-of-scope** — the same contract shape our own `delegate_task` briefs use, which is why this
  maps cleanly onto our fan-out convention.
- **Cloning for analysis is encouraged; deleting the clone afterwards is mandatory.** The source's reason is
  the right reason: *the clone is reproducible from `git clone`, the notes are not.* Keep the notes, drop the
  copies — and it also means a competitor's repo is never left half-mined in a scratch dir.
