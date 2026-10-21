# The idea forge: evidence first, ceremony last

Rewritten 2026-10-20 at his request: "ensure that the ideation is good, so that it generates standard ideas and
not slop ideas so that i end up winning hackatons ... the ideation shouldnt be consuming too much tokens ... if
you feel for an idea you need a deeper research ensure to use a necessary skill". This file is steps A2-A5 of
`../SKILL.md`. The 2026-10-15 version (persona tournament, 3-5 rounds) is archived at
`~/.claude/skills-archive/hackathon-strategy-pre-2026-10-20/idea-forge.md`.

## Why it was rewritten

1. **Most tokens went to ceremony that added no information.** Five to seven personas voted on 15 pairs, in both
   orders, every round, inside one context. Inline "cold" samples and convergence probes were written by a model
   that had already seen our cards. The old file admitted personas in one context are not independent judges. Order
   swaps and personas cost thousands of tokens and removed none of the one bias that matters (one model wrote it all).
2. **Cards were cued by invented people** ("Kemi, 41, night-shift nurse"). An invented person is the model's
   imagination wearing a name. That is the slop source: the pain is plausible, not real. Real pain is found.
3. **Heavy DECIDE, nothing built.** The three picks made with it (Vigil, Desirepath, HAKO, 2026-10-15/16) all
   reached their deadline at "waiting for GO". An unbuilt entry has P(1st) = 0 whatever its idea scored.

**The rule now: tokens go to inputs, not ceremony.** Every token either brings in something a rival's model was
not given (I1-I5 in SKILL.md) or makes a decision. Search results, quotes and numbers are inputs. Persona votes,
re-scored tables and long reports are ceremony.

## The loop

```
F1 HARVEST     evidence bank E1..En: 8-15 one-line items with URLs (real pain, sponsor asks, new primitives, data, field)
F2 WALL        the ~15 mechanisms any rival's model gives, plus the sponsor's own demos; banned. L0 on its domains
F3 CARDS       10-12 cards; each cites an E-item and a WANT; 5+ cue families; 3+ shapes; slop check
F4 KILL        hard gates only, one line per kill
F5 SCORE       survivors (max 6) once, in one table: rubric + RETELL / SHOWCASE / PAYER / SPIKE
F6 ROUND 2     only when a trigger fires: mutants + fresh cards from NEW evidence
F7 DEEPEN      the top two (different mechanisms); research only the unknowns that could flip the pick
F8 PICK        blind cards first; a clear winner, or his pick
```

Default is at most 2 rounds. **Deep mode** (he says "deep"): up to 4 rounds, each with newly harvested evidence,
and an outside judge in both orders when a CLI is READY. Never run persona pairwise inside one context.

## F1 Harvest the evidence bank

The bank is what makes our cards different from a rival's: their model got the event page and the docs; ours also
gets real people's words, the sponsor's open asks, fresh primitives, a dataset and the field. Write each item as one
line, quote the line and not the page:

`E3 PAIN "verbatim, 20 words max" | who, where | URL | date`

| Kind | What | Need |
|---|---|---|
| PAIN | A real person's complaint in their own words. Best sources: Reddit, HN, GitHub issues and feature requests on the sponsor's and adjacent repos, 1-2 star app-store or G2 reviews of the incumbent (they name the incumbent and the pain together), the sponsor's forum or Discord feedback channel | at least 4 |
| ASK | What the sponsor asked for: "ideas we'd love to see", track texts, RFPs, bounty texts, grant programs, "coming soon" doc pages, open help-wanted issues | at least 2; these feed the WANT MAP |
| NEW | A sponsor primitive shipped in about the last 90 days (changelog, release notes, recent commits). Input for M3, never a card on its own | 1-2 |
| DATA | A public dataset or live source that can produce a number nobody in the field has shown (M2) | 1-2 |
| FIELD | What already exists: this event's visible submissions and repos, past winners, the incumbent product | enough to name the crowded mechanisms |
| PERSON | A real, reachable user or customer: a named community, the public account that posted a PAIN item, his own network only when the event points there (M1, M5) | optional, but a finalist needs one by F7 |

Read cheaply:
- Search highlights first (firecrawl_search, WebSearch). Scrape only the 2-4 pages that matter.
- Read long pages with a question: WebFetch with a prompt, or firecrawl_scrape with `formats: ["query"]` and
  `queryOptions.mode: "directQuote"` for rules and rubrics. Never pull a docs site or a gallery into context whole.
- Query recipes, with `<world>` in the users' words, never the sponsor's:
  `site:reddit.com <world> "I wish" OR "is there a tool" OR "so tired of"` |
  `site:news.ycombinator.com "Ask HN" <world>` | `<incumbent> reviews` (read the 1-2 star ones) |
  `<sponsor> "we'd love to see" OR "coming soon" OR "help wanted"` | firecrawl_search with
  `categories: ["developer"]` for issues and repos.
- Two empty queries on a domain's pain is data (nobody has it, or nobody says it online). Never invent the item.

## F2 The modal wall

In one clean block, before any card exists, write what a rival's model gives for this event: 5 naive ideas (L1,
"what should we build to win?"), 5 contrarian (L2, "ideas nobody else will build"), 5 informed (L3, given the
rubric and docs). One line each, mechanism only. This is also what our own model produces first, so writing it
first moves it out of the way. Add the sponsor's own demos and sample apps, the track's example bullets, and the
crowded mechanisms from the FIELD items. Merge by mechanism. That list is **the wall**. Label it SEMI-COLD.

Add outside samples when they are cheap: run `node scripts/rival-run.mjs --selftest` once per session (NOT READY is
normal, one line), and if he pastes ChatGPT output, merge it. Outside samples count double.

Then L0 judge memory, one call: `node scripts/judge-memory.mjs "<d1>" "<d2>" ... --pages 5` on the 3-5 one- or
two-word domains the wall clusters in. Read the 30 sampled names per domain and count projects with the same
mechanism. Three or more is SEEN-MECHANISM. Write one line per domain; the total and band are context only.

## F3 Cards

10-12 cards. Each card cites at least one E-item and one WANT (no evidence, no card). At least 5 cue families, at
most 3 cards from any one. At least 3 different shapes (tool, consumer app, game, marketplace, agent, creative
media, social, infrastructure); when more than half share a shape, replace the extras.

| Cue | Start from |
|---|---|
| QUOTE | One PAIN item: the product that makes that person's sentence untrue |
| ASK | One ASK item or WANT: what the sponsor would put on its homepage if it existed |
| PAYER | Someone already paying for a bad fix (the incumbent in a review, a spreadsheet, staff hours): what replaces it on this stack |
| NEW | One NEW primitive: what it makes possible that was impossible a year ago, for a user from a PAIN item |
| DATA | One DATA item: the number it produces is the hook |
| COLLIDE | A working business or mechanism from an unrelated field, transplanted (auction, insurance, queue, pawn shop, ward round) |
| INVERT | One wall entry with its core assumption inverted |
| WOW | The 20-second moment a judge would ask to see again; work back to the product |
| HIS | His own hunches, when he gave any |

The card format is fixed and has no adjectives, so cards compete on substance and not on prose:

```
#n  cue: QUOTE E3   WANT-2   shape: consumer app
USER   who, and the moment (E3: "their words")
DOES   one sentence, verb first          NOT: the nearest wall entry or incumbent, and the delta
ONLY   why it needs <sponsor> now: swap the sponsor out and it breaks
PAYER  who pays, about how much, and what they pay today instead
WOW    what the judge sees in 20 seconds, with no narration
```

**The slop check.** Run it on every card as it is written. Two hits: rewrite the card or drop it.

- S1 The only novelty is "AI" or "an agent" doing X.
- S2 A platform, marketplace, layer, protocol or hub for X, with no first user who would use it on day 1.
- S3 A dashboard, tracker or aggregator of data that already lives somewhere else.
- S4 On-chain proof, reputation, badge or credential of X; gamified X; X with NFTs or points.
- S5 The user is invented: no E-item stands behind the person or the pain.
- S6 An existing product already does it, and NOT names no real delta.
- S7 It needs a network effect to show value in the demo (an empty two-sided market).
- S8 The sponsor is a swappable database, payment rail or model.
- S9 The WOW needs narration to impress.
- S10 "For everyone": no specific user.
- S11 Three or more sponsor primitives stacked for coverage, not for need.
- S12 Built for builders or for hackathons, when the event is not about devtools.

## F4 Kill (facts only)

One line per kill, naming the gate and the fact: `#4 KILL G3 sponsor ships this (URL)`.

| Gate | Kills when |
|---|---|
| G0 | No WANT, or a WANT with no quote |
| G14a | No payer who pays for this problem today. "Users", "the community" and "monetise later" are not payers. A free public good passes only when a WANT asks for one; then name who funds it |
| WALL | Within one mechanism of the wall: the same 20-second demo would prove both, with only the user or noun swapped |
| L0 | SEEN-MECHANISM: 3 or more same-mechanism projects in its domain's 30-project sample |
| G2 | Swap the sponsor out and it still works |
| G3 | The sponsor already ships it |
| G4 | The lane is RED (rules, eligibility or the platform make it impossible) |
| G9 | We cannot build the core to a working state (capability, never calendar) |
| G12 | Load-bearing on platform behaviour nobody has verified, and a 2-minute check cannot settle it |

Taste never kills here. Count rules on the survivors: the IDEA FIREWALL (at most 2 of the finalists in the
security, audit, DeFi-risk or verifier family), the LOCALE ALARM (at most 1 of the top 6 and 1 of the final two set
in his country or diaspora, unless the event points there) and the VERIFIER REFLEX (at most 1 "engine that checks,
proves or refuses X" unless the event's users need verification most). Swap extras for the next card; report it.

## F5 Score once

Survivors, at most 6, in one table:

| # | criterion 1 (weight) ... 1-5 each | weighted | RETELL | SHOWCASE | PAYER | SPIKE |
|---|---|---|---|---|---|---|

- RETELL: Y when a judge who saw 50 demos can say "the one where <person> <did thing> and <result>" without naming
  a product category.
- SHOWCASE: Y when the sponsor's devrel would put it on their showcase page or post it.
- PAYER: Y when the payer already pays for the problem today.
- SPIKE: the one dimension where it is 10/10, or "none". A 7-everywhere card loses to one unforgettable peak.
- When weights are not published, score with assumed and with equal weights, and flag any rank flip.

Self-ranking is weak: the best LLM pairwise ranker agreed with experts 53.3% of the time, against 56.1% between
experts (Si et al. 2024). So the table is a filter, not an oracle. Cards within 10% of the top score are tied, and
ties go to the final as blind cards.

## F6 Round 2, only when a trigger fires

Triggers:
- no survivor has all three Ys and a SPIKE;
- the top two share a mechanism;
- the ambition floor fails: "if it worked perfectly, would it matter outside this event?" is "not much" for both;
- an alarm swap left fewer than 2 strong survivors;
- fewer than 4 cards survived F4.

Round 2 adds: 3 mutants of the top card (the 10x version, from `product-brainstorming` Provoke; a different payer;
a sharper WOW), 1 crossover of the top two, and 3-4 fresh cards from NEW evidence (harvest 3-5 more E-items from a
different user world or source) in cue families not yet used. Run F3's slop check, F4 and F5 on the new cards only
and merge them into the table. Re-cueing the same inputs does not work: about 5% of 4,000 model ideas were distinct
(Si et al. 2024). When most fresh cards hit the wall, read one technique from `generate-creative-ideas`
(Combinatorial Engine or Future-Back), only that section, and use it as the next cue.

## F7 Deepen the top two

The top two with different mechanisms (three when tied within 10%). Same steps, same order and about the same
length for each, so neither gets more attention:

1. **STARTUP.** The payer and the price; why now; the wedge; the first 10 users and the channel he actually has; the
   named competitor and why we win; the one lever that makes it 10x more valuable.
2. **REAL PRODUCT.** What in the core path would be mocked: replace it or cut it. What a user does on day 31 without
   us. Use the `product-hardening` demo-seam audit when unsure.
3. **WOW BEATS.** The screen before, the one action, the screen after. The judge's own input reaches it (G11).
4. **MOATS.** At least two of M1-M6 (`rival-simulation.md`) with their evidence; E-items count. M3 alone fails.
5. **KILL SHOTS.** The three questions that would sink it in Q&A, business model and the real competitor always
   among them, each answered or marked OPEN.
6. **RESEARCH.** List the unknowns that would flip the pick. Run the trigger table below on those only, one line of
   result each.
7. **P(1st).** P(eligible) x P(core runs end to end) x P(a judge gets it in 20 s) x P(beats the strongest rival on
   the heaviest criterion) x P(survives unscripted input). Name the weakest factor.

### Research triggers: deeper research only where an unknown could flip the pick

| Unknown | Run | Done when |
|---|---|---|
| Does someone already sell or ship this? | firecrawl_search or `ecc:exa-search` in the mechanism's implementation words, plus `judge-memory.mjs` on the domain | an incumbent is named with our delta, or two clean queries each beside a positive control |
| Does the payer really pay, and how much? | `ecc:market-research` | one priced alternative they use today, sourced |
| Is the why-now or the market real (a multi-source question)? | `ecc:deep-research`, one question per run | three sources agree, or the disagreement is written down |
| Can the sponsor actually do X? | context7 or `ecc:documentation-lookup`, then one live call (the access spike) | a doc line plus a live response |
| Is the M2 number real? | find the dataset, compute the number once, record the query and the date | the number, or "no data" |
| How crowded is our lane in this event? | read the event's visible submissions and repos | a count by mechanism |
| Is it a product or a demo? | `ecc:product-lens` | the day-31 answer |
| Final stress test | `attacker`, one pass, on the pick only | the three strongest attacks answered or accepted |

Never "research the domain" in general. One question per call. Skip any research whose answer would not change the
pick. The access spike runs here, for the finalists' load-bearing APIs only.

## F8 The pick

PICK.md opens with the finalists as blind cards: the six-line format with the deepened content, no scores, labelled
X, Y (and Z). He can choose cold before reading our ranking.

- **Clear winner**: top of F5 by more than 10%, all three Ys and a SPIKE, and no OPEN kill shot after F7. Pick it,
  and say which card came second and why it lost.
- **Otherwise**: write "your pick needed" and why (a tie, an OPEN kill shot, an outside judge disagreeing). His
  choice among blind cards is the independent signal: AI ideas reranked by a human scored highest on novelty in Si
  et al. (5.78, against 5.62 for AI alone), a small margin, so it is one strong signal and not an oracle.

## The JUDGE brief (outside CLI only)

When `scripts/rival-run.mjs --selftest` shows a READY CLI, run this twice, the second time with the cards reversed.
An outside FIRST that differs from ours means "your pick needed".

```
You are judging a hackathon. Here is the rubric with weights:
<RUBRIC>
What the organisers and sponsor say they want to see:
<WANT MAP, quotes only>
Below are <K> entries, described in the same format. You have not seen any of them before.
<CARDS, labelled A, B, C ... in this run's order>

For each pair, say which one the panel would rank higher and give one reason tied to the rubric or the wants.
Then say which entries could become a real company and which are only demos, in one line each.
Name the entry you would bet wins first place, with the single reason.
Answer as: PAIRS: A>B (reason) ... | COMPANY: ... | FIRST: <label> (reason)
```

## The research behind the rules

| Finding | Source | Used as |
|---|---|---|
| Of 4,000 LLM seed ideas, about 5% were distinct; new batches add fewer | Si, Yang, Hashimoto 2024, arXiv 2409.04109 | Change the inputs (new evidence), never re-ask the same cue |
| Best LLM pairwise ranker 53.3% agreement with experts, 56.1% expert to expert; novelty human 4.86, AI 5.62, AI reranked by a human 5.78 | same paper, Table 11 and §5 | The score table is a filter; his blind pick settles ties |
| Ordinary-person cues beat genius personas for idea diversity | Deng, Brucks, Toubia 2026, arXiv 2602.20408 | The cue is a real ordinary person's own words (a PAIN item), not an invented persona |

## Anti-patterns

- An invented person as the user. Find the sentence a real one wrote.
- Asking for more ideas from the same inputs.
- Personas voting in both orders inside one context: tokens, not independence.
- Researching "to be thorough". Research a named unknown that could flip the pick.
- Writing implementation.md or a build plan before GO.
- A card with no WANT, a payer who does not pay today, or a mocked core path.
- Treating "no judge has seen it" (L0 RARE) as "judges will love it". RARE can mean nobody wants it.
