# Hackathon engine: the kickoff prompt

Rewritten 2026-10-20 (was 46 KB; the full 2026-10-15 version is archived at
`~/.claude/skills-archive/hackathon-strategy-pre-2026-10-20/starter-prompt.md`). He asked for ideation that is
strong, not slop, and that does not burn tokens. The kickoff now carries only what the skill does not: his
constraints and the event material. The order of work is in `../SKILL.md`, the ideation in `idea-forge.md`, the
build rules in `build-and-ship.md` (read only after GO).

Usually this block is not needed: pasting the event link with "find an idea" loads the skill. Paste the block in a
fresh session when you want the constraints filled explicitly. Add "deep" for up to 4 forge rounds.

---

```
HACKATHON ENGINE: kickoff

Run the hackathon-strategy skill on the event below. One number: P(1st place) at THIS event.

ORDER: A0 gate -> A1 intake + WANT MAP -> A2 evidence bank + modal wall -> A3 cards, kill, score
(round 2 only on a trigger) -> A4 deepen the top two, researching only unknowns that could flip the
pick -> A5 PICK.md with the blind cards first. Then STOP until I reply "GO <name>".

EVERY IDEA CLEARS FIVE BARS
1 Not on the modal wall (what any rival's model suggests) and not SEEN by judges (L0).
2 Serves a quoted WANT: what this event and sponsor are paying to see.
3 A real product with a payer who pays today. Never a demo.
4 Needs this sponsor: swap it out and it breaks.
5 A judge who saw 50 demos can retell it in one sentence: "the one where <person> <did> and <result>".
Every card stands on real evidence (a real person's words, a sponsor ask, a dataset), never an
invented persona. Run the slop check on every card.

STANDING RULES
- Idea firewall: ideas come from the event, never from my security-researcher profile.
- Locale alarm: at most one finalist set in my country or diaspora unless the event points there.
- Days left never shrinks the idea. Record the deadline as a fact.
- No subagents unless I say so. No build, post, email or submit without my GO.
- Tag claims VERIFIED (source) or UNVERIFIED (plus the 2-minute check). Never invent an API,
  judge, prize or past winner.
- Strategy files live in <workdir>/<event-slug>/strategy/, outside the public repo.

TOKEN DISCIPLINE
Tokens go to inputs (real quotes, data, platform truth, the field), not ceremony. Read pages with a
question, quote lines not pages. Cards are 6 lines. Deeper research only for a named unknown that
could flip the pick, with the skill the trigger table names. INTAKE.md <= 80 lines, CATALOGUE.md
<= 200, PICK.md <= 150. Chat <= 15 lines. No implementation plan before GO.

MY CONSTRAINTS (fill from my paste; mark VERIFIED or ASSUMED; ask at most 3 questions, only ones
whose answer would change the pick)
- Event, platform, URL:
- Deadline (fact only):
- Team and real skills:
- Unfair advantage: none stated means none. Never my profession. My location counts only when the
  rubric scores founder-market fit or traction.
- Where I am based:
- Prior work the rules let me reuse:
- Target prize, side tracks:
- Who pays the runtime (keys, hosting, gas):
- Submission mechanics (repo, video cap, live URL, testnet, form fields):
- My hunches (optional):

EVENT MATERIAL
<paste the event page, rules, rubric, sponsors, dates>
```
