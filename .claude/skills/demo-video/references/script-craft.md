# Writing the 120 seconds

The script is written for the ear first and the eye second. A judge watches maybe 40 of these in a row, often
muted for the first seconds, often at 1.5x. Every line has to earn the next one.

## Budget

- The narrator speaks about **154 words a minute** (Ava at -4%). Each scene also costs about 1.1 s of breath
  (0.6 s lead, 0.5 s tail) minus a 0.5 s crossfade.
- For a 120 s limit: **240–270 words over 10–12 scenes.** `tts.mjs` prints the real runtime. If it is over,
  cut words. Never raise the speaking rate: fast narration is the first thing that sounds like a bot.
- Leave 2–4 s of headroom under the limit. Submission platforms round up.

## Shape (times are targets, not walls)

| Time | Beat | Picture | Job |
|---|---|---|---|
| 0:00–0:08 | Hook | Title card (name, tagline, product screenshot) | Name in the first 3 s. Then the promise in one sentence. |
| 0:08–0:25 | Problem | Statement card, or the old way shown | One person, one moment, felt. |
| 0:25–0:35 | Solution | Product home, cursor resting | "X lets you Y." One sentence. |
| 0:35–1:35 | Demo, 3 beats | Live product | Action, result, why it matters. Signature moment zoomed. |
| 1:35–1:50 | Why it matters | Product proof (tx, dashboard, live data) or stat card | What is real. Sponsor tech, named once, plainly. |
| 1:50–2:00 | Close | End card (name, URL, credit) | Name, link, one line to remember. |

## The story spine (the gate checks it)

Tag every scene with its `beat`. Beats only move forward. `node story.mjs <demo>` prints this outline with
the word share of each beat; aim for roughly hook 8%, problem 15%, solution 8%, demo 50%, proof 12%, close 7%.

- **Problem statement:** *who* is stuck, *in what moment*, *what it costs them*. On screen as two lines of
  10 words or fewer: the situation, then the pain. "One friend pays." / "Then chases everyone for a week."
  Show the old way (`image`) when it exists: a messy group chat, a spreadsheet, a queue.
- **Solution statement:** "*Name* lets *who* do *what*, *without the pain*." One sentence, 20 words max, the
  name in it. The solution card repeats it on screen with up to three short "how" points that become the
  three demo beats, in the same order and the same words.
- **Demo beats:** each one is *do -> see -> care*. The voice says the action as the cursor does it, the
  result appears on the word that names it, and the last sentence says why it matters to the person from
  the problem. The third beat is the signature moment: zoom and `focus` on the result.
- **Proof:** the one thing that shows it is real (a transaction, a live dashboard, real users), on the
  live product. Sponsor tech named here, once.
- **Close:** name, the solution line again in fewer words, the link.

## Hooks that work in 8 seconds

Lead with the name, then pick one:
- **The outcome:** "This is Tab. Split the bill at the table, and everyone's paid before you stand up."
- **The before/after:** "This is Ledgerly. Your receipts used to live in a shoebox. Now they file themselves."
- **The surprising fact (sourced only):** "This is Quorum. Four in five DAO votes never reach quorum. We fixed the boring part."
- **The direct question:** "This is Relay. What if your grant paid out the minute the work was done?"

Never open with "Introducing", "In today's world", "Have you ever wondered", a logo sting, or the team.

## Voice rules

- Talk to one person: "you", "your". Contractions always ("it's", "you'll", "don't").
- One idea per sentence. 15 words max, most under 10. Vary the length so it breathes.
- Write numbers the way they are said: "two minutes", "forty dollars", "a hundred and twenty".
- Say what the viewer sees, a beat before or as it happens. Never describe a screen that is not on screen.
- Every demo beat: **what you do, what happens, why you'd care.** "Tap split. Everyone gets their share
  instantly. No one has to send a reminder."
- End sentences on the strong word. "Paid in seconds" beats "in seconds, it's paid".
- Run `humanizer` over the voice-over lines, then read them aloud in your head at speaking pace. Rewrite any line you stumble on.

## Jargon swaps (judges are not all engineers)

| Not this | This |
|---|---|
| leverage, utilize, seamless, robust, revolutionary, game-changing, empower, cutting-edge | (delete, or say what it does) |
| onchain settlement | the money moves on its own, and anyone can check it |
| smart contract | a program that holds the money and follows the rules |
| non-custodial | we never touch your money |
| gas fees | network fees |
| stablecoin / USDC | digital dollars (say "USDC" once if the sponsor needs it named) |
| LLM / AI agent pipeline | the assistant / it reads ... and drafts ... |
| zero-knowledge proof | proof without showing the private data |
| API / webhook / backend | (leave it out) |
| users / end-users | people, teams, friends, founders (name who) |

Sponsor technology is named once, in the "why it matters" beat, because the judges are checking for it. Say what
it does for the user, not how it works.

## Picture rules for the script

- The hook card carries a real product screenshot from scout (`image`). Never a stock image.
- The problem may use a statement card. Everything from the solution beat onward is the live product.
- One signature moment: the mechanism acting (the payment landing, the result appearing, the state changing).
  Zoom on it with `onWord` on the word that names it. This is the shot the video is remembered by.
- The cursor never sits still while the voice describes something; point at what is being said.

## script.md format

```
# <Product> demo, <N> words, <runtime>s

| # | Time | Voice-over | Picture |
|---|------|-----------|---------|
| 1 | 0:00 | This is Tab. Split the bill at the table... | Title card + home screenshot |
| 2 | 0:07 | ... | Statement card: "One friend pays. / Then chases everyone." |
```

The plan.json `vo` fields are the source of truth; script.md is the readable copy for him and the judges.

## Worked example (Splitly, about 150 words; a full demo runs 240–270)

1. **Hook.** This is Splitly. Split any bill in seconds, and nobody has to chase anyone.
2. **Problem.** You know the feeling. One friend pays for dinner. Then spends a week chasing everyone else.
3. **Problem, cost.** Small amounts, awkward texts, and somebody always forgets.
4. **Solution.** Splitly turns the bill into a link everyone pays from, right at the table.
5. **Beat 1.** Snap the receipt. Splitly reads every line for you, prices and all.
6. **Beat 2.** Now tap who had what. Ada had the pasta. Tobi had the steak. Shared starters split themselves.
7. **Beat 3, signature.** Hit send. Everyone gets their exact share on their phone. Watch it turn green as people pay.
8. **Result.** And just like that, you're square. No spreadsheet, no reminders.
9. **Why it matters.** Payments settle in digital dollars on Base, so it works across countries and fees are tiny.
10. **Proof.** It's live today. Twelve groups used it this week to split real bills.
11. **Close.** Splitly. Settle up before the bill even arrives. Try it at splitly dot app.
