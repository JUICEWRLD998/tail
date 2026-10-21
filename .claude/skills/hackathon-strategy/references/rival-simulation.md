# Rival simulation: beating teams that also use AI

Written 2026-10-04; L0 added 2026-10-15; cut to the parts that carry information on 2026-10-20 (the full earlier
version is in `~/.claude/skills-archive/hackathon-strategy-pre-2026-10-20/rival-simulation.md`). Used by F2 (the
wall), F5 (score) and F7 (moats) in `idea-forge.md`.

## The problem

Every rival team has a frontier model, and most are not naive: they paste the event page, ask for "unique ideas
judges will love", paste the sponsor docs, ask again, then let an agent build it with an anti-slop UI skill. So two
things are commodities and cannot win on their own: **a clean build** and **a clever-sounding idea**. The engine
competes on what a model cannot produce from the event page: real people, real numbers, live proof, distribution
and taste (the six moats below).

## The four layers of the wall

| Layer | Who it simulates | How it is measured |
|---|---|---|
| L0 judge memory | What judges have seen at every other event | `node scripts/judge-memory.mjs "<domain, 1-2 words>" --pages 5`, then count same-mechanism projects in the 30 listed (3+ = SEEN-MECHANISM). Devpost only: Web3 also lives on DoraHacks, ETHGlobal and Colosseum |
| L1 naive | The median team | "What should we build to win this?" |
| L2 contrarian | The team that knows L1 is crowded | "Ideas nobody else will build" |
| L3 informed | The strong team | Event page, rubric, sponsor docs, judges: "the idea most likely to take 1st" |

L2 matters most. Models asked for "unique" ideas converge on a second cluster: agent-for-X, reputation layer,
gamified X, on-chain proof of X, AI copilot for niche-profession X. Smart teams land there, which is worse than a
crowd of average ones. L0 exists because the field sweep is local: Upkeep and Alert (2026-10-06, 10-10) each sat in
an empty cell of their event and were both remittance, which crypto judges have seen for years (Devpost, 2026-10-15:
remittance 208 projects, carbon credits 557, mental-health chatbot 2,110).

Inline L1-L3 are written ONCE, in F2, before any card exists, and labelled SEMI-COLD. A convergence probe run inline
after our cards exist is contaminated (the model already knows our idea), so it is not run. Independent samples
come only from outside: a READY CLI via `scripts/rival-run.mjs`, or his pasted ChatGPT output. Both count double.

### Paste-ready blocks for another assistant

Replace `<EVENT>` with the event page text, `<RUBRIC>` with the judging criteria, `<DOCS>` with the sponsor's main
doc page or README.

```
L1  Here is a hackathon: <EVENT>
    What should my team build to win first place? Give 10 ideas, one line each.

L2  Here is a hackathon: <EVENT>
    Most teams will build the obvious ideas. Give me 10 ideas nobody else will think of,
    that judges would still love. One line each.

L3  You have won several hackathons. Here is the event: <EVENT>
    The rubric: <RUBRIC>
    The sponsor's docs: <DOCS>
    Give me the 5 ideas most likely to win first place, and say why each beats the field.
```

Outside convergence probe for a finalist (only with an outside model): "Here is <EVENT>. Give me 5 ideas for
<DOMAIN in one plain phrase>." If our mechanism appears, change the mechanism, the proof or the user, or drop it.

## The six moats (what a rival's model cannot produce)

Every finalist holds at least TWO, with evidence, by F7. One moat is a weekend copy.

| Moat | What it is | Example |
|---|---|---|
| M1 Real person | A named, reachable user whose real inputs drive the demo, with consent | Derica: her messages, her calibration, her reaction on video |
| M2 Real data finding | A number computed from real data this week that the field has not seen | Derica: WFP markups 9.1% to 4.6%; Desirepath: 24.5% of Mind2Web steps re-walk another task's step |
| M3 Fresh primitive | A sponsor capability shipped after model training data, found in the changelog or repo | Arc Memo plus Multicall3From, weeks old |
| M4 Live proof | Something a judge can check in one click that cannot be faked: mainnet tx, live endpoint, eval on held-out real data | Explorer link; `results/eval.json` |
| M5 Distribution | A channel to real users inside the window that the team actually owns | A market group chat, a community he runs |
| M6 Taste | A subject-grounded identity: name, vocabulary, signature moment, from the users' own world | "derica", the tomato-tin measure |

M3 alone is the trap: it feels novel because the primitive is new, and every L3 rival read the same changelog. Tab
(Arc, 2026-10-01) held M3 and M4 only, and its own report said a rival could copy it in a weekend. Derica held M1,
M2, M4 and M6. That is the bar.

## Strength and the spike

The strength test now lives in F5 as three columns (RETELL, SHOWCASE, PAYER) plus the SPIKE, and in F7 as the
moats. Judges remember peaks: an idea at 7 everywhere and 10 nowhere loses to one with a single unforgettable
dimension. The ambition floor ("if it worked perfectly, would it matter outside this event?") is an F6 trigger.

## Anti-patterns

- Treating our first original-feeling idea as original. It feels new because we did not see the rivals' outputs.
- Escaping L1 and stopping. L2 is where competent teams go.
- A new primitive as the whole differentiation.
- The verifier reflex: wrapping any domain in "an engine that checks, proves or refuses X" is a habit from the fexx
  corpus, not a judge preference. Legal only when the event's users need verification most.
- The locale reflex (2026-10-15): reaching for his own city or diaspora because M1 and M5 are easy there. Legal only
  when the event points there, and it still has to pass L0.
- An empty cell measured only locally. Run L0 before trusting it.
