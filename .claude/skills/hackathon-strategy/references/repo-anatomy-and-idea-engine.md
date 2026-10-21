> **Provenance (imported 2026-09-24).** Derived from a repeat-hackathon entrant's public repo account
> (`github.com/winsznx` — 251 repos, of which 26 were read in depth and all 251 were metadated). Full
> evidence, counter-examples and sampling limits: `Desktop/audit2/research/C-winsznx-playbook.md`. The README
> skeleton reproduces the section order shared by the shipped-and-starred repos in that sample; the naming
> procedure and the two checklists are generalised from the same set, so treat this as a strong prior rather
> than a law — the sample is roughly 10% of the account.

# Hackathon repo anatomy — a reusable template

Distilled from a 26-repo close read of github.com/winsznx (see `research/C-winsznx-playbook.md`).
Four parts: the README skeleton, the naming procedure, the 60-second-demo checklist, and the
submission-day checklist. Copy the skeleton verbatim and fill the brackets.

---

## 1. README skeleton

Order matters. A judge reads lines 1–4 and then looks for the live URL; everything after that only has
to be *findable*. Target 200–270 lines. Use short lines and tables, not prose paragraphs.

````markdown
<!-- Optional hero. Lockup image, ≤440px, centred. If you have no mark, use the thesis line as the H1 instead. -->
<p align="center">
  <img src="assets/brand/[name]-lockup.png" alt="[NAME]" width="440" />
</p>

# [NAME — or the thesis itself, e.g. "A refund is not a payment"]

<!-- 1. TAGLINE. ≤12 words. The entire product. No jargon, no "platform for". -->
**[State a thesis. Agents execute.]**

<!-- 2. MECHANISM MNEMONIC. Three beats, separated by periods. -->
[One capital pool. Many trading agents. One shared risk envelope.]

<!-- 3. LINKS. Separated by ` · `. Live app first. Then proof page, docs, video. -->
**[Open the live app →]([url])** · [chain / network] · [sponsor primitive]

---

<!-- 4. WHAT IT IS. 2–4 sentences: what it does, then the dominant mechanism, then its negation. -->
[NAME] is [one-sentence product]. It works by [mechanism in one clause]. 

**Dominant mechanism: [noun-phrase, e.g. cross-agent portfolio admission + atomic reservation].**
Not [the thing it looks like]. Not [the adjacent thing]. Not [the obvious misreading].

---

## Why this only works on [SPONSOR/PRIMITIVE]

<!-- 5. THE LOAD-BEARING SECTION. Name the primitive, quote the capability, and say what breaks
     without it. This is the section sponsor judges actually read. 1–3 short paragraphs. -->

[Primitive] does [the new thing]. Other chains/providers do [the weaker version] because
[concrete reason]. That difference is why [NAME] exists rather than being a thin wrapper.

---

## How it works

<!-- 6. The lifecycle. Numbered list or ASCII flow, small enough to read on a phone. -->
```text
1. [step] -> 2. [step] -> 3. [refusal or verdict, named in caps]
```

## Live deployments

<!-- 7. Facts table. Every row links to an explorer. Never a bare address. -->
| | |
| --- | --- |
| Live app | [url] |
| Proof / evidence page | [url] |
| Demo video | [url or _pending_] |
| Network | [chain, chain id] |
| Contract | [`0x…`]([explorer url]) — source verified |
| Settled example | [tx hash link] — [what it proves, e.g. PASS at 100%, operator paid] |

`[pnpm claim:verify]` re-reads every claim above from chain and currently reports **[n]/[n] verified**.

---

## Verify it in 60 seconds

<!-- 8. JUDGE PATH. ≤5 steps, ≤2 minutes, step 1 needs no wallet and no account. -->
1. [Open the app — no wallet needed.]
2. [Click the one button that triggers the mechanism.]
3. [Read the verdict / refusal and the reason printed beside it.]
4. [Open the proof page; follow contract → tx → evidence.]
5. `[one command]` from a clean clone reproduces it without trusting anything we host.

```bash
[the single command, with the real expected output pasted as a comment]
```

## Demo

<!-- 9. Video, or a link to DEMO_SCRIPT.md with timestamps. If not recorded yet, keep the row. -->
[▶ Watch the [2]-minute demo]([url]) · script: [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)

## Evidence

<!-- 10. Claims ledger. Public rule: the README may not assert anything this file does not support. -->
Every public claim, its evidence, and its strength is in [CLAIMS.md](./CLAIMS.md) /
[evidence/claims.json](./evidence/claims.json). Claims carry `proven` or `pending` — nothing is implied.

## What this is not

<!-- 11. THE CUT-LIST. Say what you deliberately did not build, then the honest limits. -->
Not [X]. Not [Y]. Not [Z]. It does not [claim you have not earned] and it is
[unaudited testnet software / demo-grade / single-operator].

See [SECURITY.md](./SECURITY.md) for the trust model and [docs/known-limitations.md](./docs/known-limitations.md)
for the itemised gaps.

## Repository

<!-- 12. Reading order for a judge, ending with an honest rubric self-score. -->
| | |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | What the layers are and which arrows carry authority |
| [DECISIONS.md](./DECISIONS.md) | The choices that could have gone the other way, and what settled each |
| [SETUP.md](./SETUP.md) | Clean clone to running |
| [evidence/submission/RUBRIC_AUDIT.md](./evidence/submission/RUBRIC_AUDIT.md) | Honest self-scoring against the rubric, limitations included |

## Built for

[Event name] — [track] ([sponsor]). [Date].

## License

[MIT / Apache-2.0]
````

Rules that make the skeleton work:
- A refusal or verdict in the hero path (a cap exceeded, an order rejected, a release blocked) is worth
  more than a success screenshot.
- Never write a claim the ledger cannot back. `pending` and `_pending_` rows are fine; invented numbers
  are not.
- Badges only when they carry a fact (test count, npm version, CI, deployed URL). No decorative badge walls.
- No emoji headers, no "Features" bullet lists, no "Setup Instructions" scaffolding.
- Line 1–4 must make sense to someone who has never heard of the sponsor.

---

## 2. Naming procedure

Rules: 5–10 characters · one lowercase token · no digits · no camelCase · no emoji · the name never
explains the product (the tagline does).

**Step 1 — extract the core noun from the mechanism.** Write M as one sentence. Underline the object or
act at its centre: threshold, toll, pledge, net, ledger, guard, coin, order, tenure, verdict, conduit.

**Step 2 — harvest from the mechanism's own vocabulary.** Pull 10 candidates from Latin / archaic
commercial law / older finance terms for that noun. Worked mappings: a *threshold* → limen; a *small coin*
→ obolus; a *bill of exchange* → usance; an *enforcement officer* → lictor; a *debt discharge* →
quittance; a *formal objection* → obstat; *"it is permitted"* → licet; *land tenure* → fief; a *legal
order* → writ; a *guard* → custos.

**Step 3 — mangle 5 of them for uniqueness.** Drop a vowel, `-or`→`-er`→`-y`, collapse a syllable,
double a consonant. Examples of the register this produces: remlo, syrty, setld, vinct, refut, kyrve,
rove, nulth, metrx, availary.

**Step 4 — score, then pick.**

| Check | Pass condition |
|---|---|
| Length / shape | ≤10 chars, single token, lowercase, one breath to say |
| Meaning | Name is evocative but not explanatory; the tagline carries the meaning |
| Collision | Free on GitHub + npm + X handle + the event's Discord/DoraHacks |
| Domain | `[name].xyz` or `.com` obtainable today |
| Register | Sounds institutional, not startup: no `-ify`, `-ly`, `-ai`, no plural `-s` |

**Step 5 — write the tagline for the top two names.** Keep the one whose tagline is shorter and plainer.

**Step 6 — register the domain the same day** and paste it into README line 4. Companions later inherit
the name plus a role suffix: `pot` → `potforge` (SDK), `pot-og` (OG worker), `pot-tagindex` (indexer).

**Anti-patterns:** sponsor name inside the product name (only allowed for a deliberate proof-harness,
e.g. `keeperhub-flightcheck`); `AI`, `Chain`, `Fi`, `X` prefixes; two words joined by camelCase; a name
chosen after the logo; a name that requires a subtitle to be understood.

---

## 3. The 60-second-demo checklist

The demo is a test, not a tour. One command or one page must reproduce the core claim, and the failure
path must be visible.

**Before recording / submitting:**
- [ ] A single command produces the proof, and its real output is pasted into the README as a comment.
- [ ] Run that command from a **clean clone** on a fresh machine (or a container) — not from your dev tree.
- [ ] At least one verification is done by a party other than the executor: a second RPC provider, an
      independent re-read from chain data, or a third-party explorer link. Record which.
- [ ] The demo's state is pre-seeded so it does not depend on catching a market fill, a keeper tick or a
      live counterparty at the right moment.
- [ ] A wallet that is **not yours** has completed at least one step (or says plainly that only your
      accounts have been exercised).
- [ ] The judge path's step 1 needs no wallet, no account, no install.
- [ ] The refusal/failure case is demonstrated too (cap exceeded, correlation refused, release blocked).
- [ ] Every number shown on camera exists in an evidence file with a reproduction command.
- [ ] `DEMO_SCRIPT.md` gives timestamped beats with the literal narration sentences.
- [ ] Dry run done end to end; environment reset afterwards so the recording starts from the documented state.
- [ ] Demo video uploaded and linked from the README; a `_pending_` row remains if it is not.

**Never:**
- [ ] A success path only. A demo that cannot fail proves nothing.
- [ ] Mocked chain, mocked API, or "would work" language in place of a transaction hash.
- [ ] Numbers typed into the README by hand without an evidence file behind them.

---

## 4. Submission-day checklist

**Proof and honesty**
- [ ] Live deployment URL resolves from a clean browser session (incognito), on the right network.
- [ ] Every contract in the README is source-verified; each address links to its explorer page.
- [ ] At least one explorer-linked transaction hash per core mechanism.
- [ ] `CLAIMS.md` / `evidence/claims.json` regenerated: every claim `proven` with a reproduce command, or
      `pending` with what it waits on.
- [ ] "What this is not" and honest limitations sections written, naming the biggest gap first.
- [ ] Reading-order table present, ending with rubric self-scoring (claim → evidence → honest limitation).
- [ ] Secrets sweep: no `.env`, no keys in history (`.gitleaks.toml` / `secretlint`); rotate anything that
      was ever committed.
- [ ] LICENSE present; third-party asset licences listed (`THIRD_PARTY_NOTICES.md`).

**Repo hygiene**
- [ ] Clean clone builds from documented commands only (`SETUP.md`), with no undocumented env vars.
- [ ] CI green on the submission commit (typecheck, tests, lint) — or a note saying which check is red and why.
- [ ] Root docs present: ARCHITECTURE, DECISIONS (ADR-style), SECURITY, SETUP, and a `docs/DEMO_SCRIPT.md`.
- [ ] Repository layout block in the README matches the actual tree.
- [ ] No large dead artifacts committed; no generated caches; `.gitignore` covers secrets and builds.

**Presentation**
- [ ] README line 1–4 survives a stranger's skim; tagline ≤12 words; mechanism named once.
- [ ] Hero image / brand lockup rendered at the top; OG image generated so the link preview is not blank.
- [ ] Demo video linked (and subtitled `.srt` committed if you made one).
- [ ] X/social post drafted and scheduled with the demo clip; profile bio, avatar and header updated from
      the same asset set (`X_PROFILE_PACKAGE.md`).
- [ ] Submission form fields match the README exactly — same mechanism name, same numbers, same URLs.
- [ ] Mobile check: the landing page and the judge path on a phone.
- [ ] Rubric re-read once, line by line, against the README; any rubric line with no artifact gets one.

**After submission (the residual)**
- [ ] Keep the repo alive for 2 weeks: fix the CI, add the missing doc, land the upstream contribution.
- [ ] File the sponsor bug/feedback report (`SPONSOR_FINDINGS.md`) — the highest-trust sponsor signal.
- [ ] Split one reusable artifact into its own maintained repo (SDK, indexer, OG worker, proof harness).
