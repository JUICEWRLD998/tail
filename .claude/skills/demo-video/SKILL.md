---
name: demo-video
description: Make a finished hackathon demo video from a deployed link. Use when he says "make the demo", "demo video", or drops a deployed URL for the product in the current folder. Reads the codebase first, then writes a 120-second script as a senior SaaS product marketer, voices it with a natural female narrator, records the live product with a presenter cursor and zooms, cuts it with transitions, captions and loudness, verifies the result, and hands back a 1080p MP4. Every cut tells one story in order (hook, problem, solution, live demo, proof, close): a short pitch-deck act whose slides reveal each point as the narrator says it, then the live product, checked by a story gate before any voice is made. No stops unless the product blocks the recording.
---

# Demo video

He runs Claude in the product's folder, says "make the demo" and drops the deployed link. Everything after
that is this skill. He does not review drafts. He watches the final MP4.

## The brief (the refined prompt; every demo answers to it)

> Act as a senior SaaS product marketer and demo director. First understand exactly what was built: read the
> codebase in the current folder and walk the deployed product. Then make a demo video of at most 120 seconds
> that a hackathon judge understands with no prior context.
>
> - **0:00–0:08, the hook.** The product name and a one-line description, on screen and spoken in the first
>   3 seconds, then one sentence that makes the viewer want the next 112.
> - **The problem, as a pitch deck.** One real person in one concrete moment. Put it on screen as slides, not
>   only in the voice: a problem slide (the pain in one headline and up to three pieces of evidence, each
>   number with its source), a real quote if one exists, and a before/after slide that shows the old way's
>   steps being struck out. Every point appears on the word that says it. A number only when it is sourced.
> - **The solution.** What the product is, in one plain sentence that names it, then how it works as a flow
>   slide (three or four steps lighting up along a line as the voice reaches each one), or a solution card,
>   or the product itself. The flow's steps become the demo beats, in the same order and words.
> - **The demo.** The live product doing the job: three beats, each an action, its visible result, and why
>   that matters. The product's signature moment is shown big (zoomed) and lands on the word that names it.
> - **Why it matters.** What is real (live, onchain, used by someone). Name the sponsor technology once, in plain words.
> - **The close.** Name, link, one line worth remembering.
>
> Voice: a natural, warm female narrator talking to one person. Conversational, contractions, short sentences,
> no jargon, no hype words. Visuals: clean, calm motion, the product's own colours, nothing generic.
> Deliver a 1920x1080 MP4 with burned captions, plus the script, an .srt and a thumbnail.

## Pipeline

Scripts live in `scripts/` (Node 22+, ffmpeg, Chrome; one npm dependency, `ws`). Run them from this skill's
`scripts/` folder and pass the demo folder: `<product>/demo/`. Paths below are relative to the skill.

| Step | Do | Tool |
|---|---|---|
| 0 Preflight | `node -v`, `ffmpeg -version`, Chrome present, `npm i` in `scripts/` if `node_modules` is missing | Bash |
| 1 Understand | Read README, package.json, routes/pages, main components, contracts, any SUBMISSION/PITCH/hackathon brief, `.env.example`. Write `demo/BRIEF.md`: name, one-liner, user, problem, how it works, signature moment, 3 demo beats, what is real, sponsor tech, the event's video rules. Facts from the code only; mark anything guessed UNVERIFIED | Read, Grep |
| 2 Scout | `node scout.mjs <url> <product>/demo/scout /route2 /route3` then **look at every screenshot**. Note the exact button labels for the actions, the theme colours and fonts for the cards, and what fails live | Bash, Read the PNGs |
| 3 Script | Write `demo/script.md` (timed table: time, voice-over, picture) and `demo/plan.json`, every scene tagged with its `beat`. Follow `references/script-craft.md`, then run the `humanizer` skill over the voice-over lines. Schema: `references/plan-schema.md`; a complete plan: `references/example-plan.json` | Write |
| 3a Deck | For the deck act, choose 3 to 5 slides from `problem`, `quote`, `compare`, `flow` (and `statement`, `stat`, `solution`). Give every point an `onWord` so it lands as the narrator says it. Set `"deck": true` for the chapter rail and progress line. Read `references/script-craft.md` "The deck act" | Write |
| 3b Story gate | `node story.mjs <demo>`. Prints the story outline (words and share per beat). Fix every FAIL; fix every WARN or say why it stays. `tts.mjs` runs the same gate and refuses a plan that fails | Bash |
| 4 Voice | `node tts.mjs <demo>`. Exit 3 means over time: cut words, never speed up the voice | Bash |
| 5 Record | `node record.mjs <demo>`. A scene that fails writes `build/debug/<id>.png`: Read it, fix the action, re-run. `--only=id` re-records cards; page scenes depend on earlier state, so re-run from the first page scene | Bash |
| 6 Edit | `node assemble.mjs <demo>` | Bash |
| 7 Verify | `node verify.mjs <demo>`, then **Read `build/verify/contact-sheet.png` and every scene still**. Fix every FAIL. Fix every WARN or say why it stays. Loop steps 3–7 until clean, at most 3 rounds | Bash, Read |
| 8 Deliver | Open the MP4 for him (`start "" <mp4>` in PowerShell/cmd). Report path, duration, word count, the script, and any WARN left. Add `demo/build/` to `.gitignore` | Bash |

## What "clean and presentable" means here (the bar)

- First 8 seconds: name spoken and on screen, tagline visible. `verify.mjs` fails the cut otherwise.
- **The story reads with the sound off.** The problem is on screen as a statement, the solution as one
  sentence, and a chapter label ("The problem", "The solution", "Live demo", "What's real") marks each
  new beat. Scrub the contact sheet: someone who sees only the stills can say what was broken and what fixes it.
- **The deck act is a real deck.** 3 to 5 slides, at most 40% of the words. One idea per slide, a headline of
  12 words or fewer, every point revealed on its spoken word (`onWord`), the chapter rail and progress line on
  (`"deck": true`). Advance between deck slides with `"transition": "smoothleft"`; cross into the live product
  with a fade. Evidence and quotes carry their source on screen; with no source, there is no number.
- **Motion grammar.** One idea moves at a time. Cursor glides on an arc and lands on the spoken word; a zoom
  pushes in on the result, holds, then pulls out before the next click; `focus` dims the rest of the page so
  the eye lands on the signature result; cards reveal word by word and never bounce. No spinning, no slides
  flying in, no shake, no idle loops. Transitions are crossfades; let the picture do the work.
- Never a static screen longer than 6 seconds while the voice talks (verify warns). Move the cursor, scroll, zoom, or cut words.
- Every page scene has the presenter cursor doing something the voice-over is describing at that moment. Use
  `onWord` so the click lands on the word.
- One zoom per demo beat at most. The signature moment gets the biggest one (1.6–1.8x), and a `focus` on the
  result as the voice names it. Unzoom (and `focus` off) before clicking anything else.
- Cards use the product's theme (`plan.theme` from scout), never the default teal unless the product is teal.
  Statement cards are for the problem only; the demo itself is always the live product.
- No loading spinners, blank pages or error toasts on camera. Navigation and logins go in `prep`, which is not recorded.
- Captions on, 7 words max per line. Loudness -14 LUFS (verify measures it).
- 1920x1080, 30 fps, under the event's limit (`targetSeconds`; default 120).

## Voice

Default: Microsoft Edge neural **en-US-AvaMultilingualNeural** at rate -4% (free, no key, about 154 words a
minute). Alternatives that also sound human: `en-US-EmmaMultilingualNeural`, `en-US-JennyNeural`,
`en-US-AriaNeural`; samples are in `assets/voice-samples/`. If `ELEVENLABS_API_KEY` is set, `tts.mjs` uses
ElevenLabs instead (better prosody, paid). Set `plan.voice` to override. Fix pronunciation with a scene's `say`
field (spoken text), keeping `vo` (caption text) correct.

## Music

Optional. `assemble.mjs` uses `plan.music`, else `demo/assets/music.mp3`, else the first track in this skill's
`assets/music/`. Music is ducked under the voice automatically. No track ships with the skill: he drops
royalty-free tracks (calm, 90–110 bpm, no vocals) into `assets/music/` once and every demo after uses them.
With no track the cut has voice only; say so in the delivery note.

## When to stop and ask (the only stops)

- The core flow needs a wallet signature, a login, an email code or paid API credit that headless Chrome
  cannot provide, and the product has no demo mode or seeded account. Ask once for a test account or a demo
  switch. Never fake a result on screen.
- The deployed link is down or shows a different build than the folder.
- The event's video rules conflict with the brief (for example a 60-second cap or a required face cam).

## Pitfalls (each one cost time once)

- **A slide that looks fine in one card can break in another.** Before recording, render each new slide at
  1440x810 and look at a mid-reveal and a final frame. A grid of nodes stretched shorter columns and dropped
  their labels out of line (`align-content: start` fixed it). An overflow probe that sets `width` on an element
  with `max-width` never fires: plant the control with `min-width`.

- **Edge TTS moved on 2026-10-10 and the old endpoint answers 403 to every client** (rany2/edge-tts#490, the
  `msedge-tts` and `edge-tts` packages included). Edge 155 now signs `wss://api.msedgeservices.com/tts/...` with a new
  `Sec-MS-GEC` format nobody outside Microsoft can compute. `lib/edge-tts.mjs` falls back after two 403s to
  `lib/edge-token.mjs`, which runs the installed Edge headless with a net log, makes it speak one word, and lifts the
  signed URL. One URL works from our client with a fresh ConnectionId for several minutes; it is cached 4 minutes in
  the temp folder. Same Ava voice, same word timings. `EDGE_TTS_BROWSER=1` skips the legacy attempt.
- **`OPENAI_API_KEY` in his environment is invalid (401, checked 2026-10-10).** Do not route voice through it.
- **Screencast frames are CSS pixels unless DPR is forced on the command line.** `lib/cdp.mjs` launches with
  `--force-device-scale-factor=4/3` and a 1440x810 layout, which gives crisp 1920x1080 frames at about 25 fps.
  `Page.captureScreenshot` in a loop gives only 7–16 fps; do not use it for motion.
- **A background tab gets no animation frames.** rAF stalls, the cursor never moves, the recorder hangs.
  `capture()` calls `Page.bringToFront` first and has a watchdog of target + 30 s.
- **ffmpeg 9 removed `-filter_complex_script`.** Use `-/filter_complex graph.txt`.
- **freezedetect and silencedetect print no `_end` for a span that runs to end of file.** `verify.mjs`
  closes open spans at the file end and runs every detector on a planted control clip first. If a detector
  is blind on the control, verify exits 1. Never trust a clean result from a detector that has not fired on the control.
- **Every tab used must be fronted before it navigates, not only before capture** (first real run, Tab,
  2026-10-10: a 10-minute stall). `document.fonts.ready` never settles in a background tab. `record.mjs`
  fronts the scene's tab first; `goto` caps the fonts wait at 5 s.
- **Hash routes (`#/g/...`) never fire `load`.** `goto` also resolves on `Page.navigatedWithinDocument`.
- **In Git Bash, `"#/v/..."` arguments arrive as `#V:/...`** (MSYS path conversion). Prefix with `MSYS_NO_PATHCONV=1`,
  but then pass the demo folder as a Windows path (`'C:\...\demo'`): with conversion off, `/c/Users/...` resolves
  to `C:\c\Users\...` and the output silently lands there (Tab and Fiado runs both left a stray `C:\c\` tree).
- **Find-by-text must rank exact matches over clickables.** `<main tabindex=-1>` contains every word on the
  page and beat the exact `<h2>` it wraps, so a scroll silently went nowhere. `director.js` now scores exact first.
- **Type addresses with `"paste": true`.** Typing a 42-char address character by character makes forms flash validation errors on camera.
- **A live product can break between the build and the demo.** Tab's group page fires one `getLogs` per 5,000
  blocks from the group's creation block; five days later that was about 180 calls and the Arc RPC rate-limited
  every load. Scout catches it. When live screens cannot load, he chose to show the product's own screenshots
  from `docs/img` with a visible "Captured from the live app on <date>" label (`demo/assets/still.html` in the
  Tab repo is the viewer: fitted image, label chip, `#spot-<name>` zoom targets). Never present a capture as live.
- **`hover` used to move only the drawn cursor, so `:hover` and pointerenter never fired** (OneBar, 2026-10-10: a
  leader line stayed on the first number while the cursor sat on the second). `record.mjs` now sends a real
  `mouseMoved` at the end of every hover. Check a hover-driven effect in a still, not in the action log.
- **`waitFor` on text that the next state removes waits forever.** An empty-state heading ("Ask one question")
  vanished the moment the app added a note to the thread. Wait for the text the action produces ("Place set:").
- **A live reply that lands after the voice ends is dead air and a missed zoom.** Give the waiting scene a sentence
  that covers the product's real latency (measured in scout), and hang the zoom on a word near the end.
- **Clicks while pinch-zoomed are mapped through `visualViewport` but this was not tested.** Unzoom before you click.
- **Headless Chrome reports `prefers-color-scheme: dark`.** Set `plan.colorScheme` to the scheme the product is designed for.
- **Chrome as root needs `--no-sandbox`** (Linux containers). Point `CHROME_PATH` at a wrapper that runs
  `chrome --no-sandbox "$@"`.
- **Actions that run past the voice create dead air** (verify warns `dead air`). Shorten the actions, raise
  `cps` on typing, or add `hold` to the scene and words to the voice-over.

## Files

- `scripts/scout.mjs`, `story.mjs`, `tts.mjs`, `record.mjs`, `assemble.mjs`, `verify.mjs`: the pipeline, in order.
- `scripts/lib/story.mjs`: the story gate (beat order, problem on screen, one-sentence solution, live demo with a
  signature moment, hype words, sentence length, sourced stats).
- `scripts/lib/`: `cdp.mjs` (Chrome), `director.js` (in-page cursor, ripple, find-by-text, eased scroll,
  spotlight, focus cutout, chapter label), `edge-tts.mjs` (voice), `util.mjs`.
- `assets/cards/card.html`: title, statement, solution, stat, end, and the deck slides problem, compare, flow and
  quote. Word-by-word reveal, items timed to the voice, chapter rail and progress line, themed by `plan.theme`.
- `scripts/lib/deck.mjs`: resolves `onWord` on any card item to its time, and the deck progress per scene.
  `node scripts/test-deck.mjs` checks it and the deck rules of the story gate (planted control first).
- `references/script-craft.md`: how to write the 120 seconds. `references/plan-schema.md`: every plan field and action.
