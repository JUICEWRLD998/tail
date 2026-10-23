# Tail: working rules for Claude sessions

Owner: Mustapha Fadhlullah. **No byline or personal name on the public pages or in the README** (his call, 2026-10-22);
internal notes may name him. First person singular in his voice; impersonal in report prose.

**Start here:** `DECISIONS.md` is the log (newest first) and `README.md` the status table (LIVE, NEXT, NOT LIVE). The build
plan (phases P0-P10) was removed from the submission; it is in git history (`git show 5dc8e3b:implementation.md`). Continue
from the first item still NEXT or NOT LIVE. Record progress in `DECISIONS.md`.

## Standing rules (from him; not negotiable)
- **No subagents** unless he says "fan out" in that session. Do the work inline, in sequence.
- **Testnet by default.** `STRIKE_NETWORK=testnet`. Never touch mainnet, never ask for a mainnet key, never place a
  mainnet order without his explicit go in that session.
- **He presses submit.** Never post in public channels, never message Strike's Discord, never submit the entry. Draft
  it and hand it over.
- **No fake anything.** No invented callers or followers, no hardcoded "live" numbers, no mocked core path. Our own
  test activity is never adoption; label it as test activity. Record metrics as measured, unavailable or zero.
- **The model never builds an order.** Calls are parsed and sized by deterministic, tested code. Ambiguity becomes a
  question to the user, never a guess.
- **Keys:** Strike API wallet private keys are encrypted at rest with `TAIL_KEK`, never logged, never returned by any
  route, never committed. Grep for key patterns before every push.
- **Days left never shrinks the product.** Scope is cut only by the MVP / stretch / NOT BUILDING list.
- **Tag every Strike or Telegram claim** VERIFIED (doc URL, OpenAPI line, or live response) or UNVERIFIED. Never invent
  an endpoint, field or parameter. Read `docs.strikefinance.org/llms.txt` (append `.md` to any docs page), the OpenAPI
  specs in `github.com/strike-finance/strike-finance-skills/openapi/`, and the installed `strike-*` skills first.
  Use context7 for grammY, Fastify, Vite, React and `motion`.
- Strategy and win-odds notes are not in this repo and never go in it.
- When a claim turns out wrong, correct it in place and mark the correction. Never quietly rewrite it.

## Cloud-session facts
- No inbound traffic reaches the VM: in a cloud session the bot runs with long polling (`TAIL_MODE=dev`) on the Dev
  bot token. The deployed service uses a webhook on the other token. Never set a webhook on the Dev bot.
- A wallet signature needs his browser. Anything that needs Lace, Eternl, Phantom or Rabby is a step for him: print the
  exact URL and what to click, then wait. `scripts/scripted-follower.ts` (a Solana keypair) covers the automated path.
- Foreground commands stop at 2 minutes by default (10 max). Run the bot and long jobs in the background.

## Skills
All his skills are in `.claude/skills/`. When a skill says `~/.claude/skills/<name>/...`, read
`.claude/skills/<name>/...` in this repo instead. Skills that call Windows paths (`C:\Users\fadhm\...`) or
Windows-only tools need a Linux equivalent here; say so instead of skipping silently. Strike's official skills
(`strike-auth`, `strike-trading`, `strike-userstream`, ...) are installed by the environment's setup script.
- Build spine: `hackathon-strategy` → `references/build-and-ship.md` (Stage B).
- Plans and tests: `plan`, `test-driven-development`, `systematic-debugging`, `diagnosing-bugs`.
- UI: `ui-studio` (the pipeline; its `references/toolbox.md` maps `frontend-design`, `emil-design-eng`, `animate`,
  `review-animations`, `break`, `better-interface` and the rest).
- Product: `product-hardening` (demo-seam audit), `attacker` (one pass on the finished product, only if he allows a
  subagent).
- Packaging: `demo-video` (record Telegram Web plus the web pages), `humanizer` (all public copy).
- ECC plugin skills (`ecc:browser-qa`, `ecc:verification-loop`, `ecc:security-review`) come from the ECC plugin, if
  the session loaded it (`.claude/settings.json`). If not, use Playwright directly.

**Lessons go back into the skills.** When a pass teaches something durable (a trap, a wrong assumption, a probe that
lied), write it into the governing skill file under `.claude/skills/`, in that skill's Pitfalls, replacing the
wording it supersedes, and say so in the commit message. He syncs these back to his machine.

## Stack
- Node 24, TypeScript, grammY, Fastify, better-sqlite3, vitest. Ed25519 request signing with `node:crypto`.
- Web pages: Vite + React with **CSS Modules + design tokens**. **No Tailwind.** **`motion`** is the only animation
  library, imported from `motion/react`.

## His design taste (it bites if ignored)
- Clean, top-tier polish; he rejects anything that looks AI-generated. **One choreographed signature moment** (here:
  a real call card filling with real tails), real images on every key route (real screenshots of the product, never
  stock), feedback motion on every state change.
- His products default to "SIGNAL DECK" (flat deep blue-black, one mint-teal accent). Use it only if it survives the
  slop audit for this subject; derive the vocabulary from signal-channel culture (call cards, tail, fade, receipts).
  **"Terminal / CRT / neon" is the default trap for a trading product.** Measured OKLCH palette with 2-3 support hues
  and tinted surfaces; one accent = one CTA colour.
- **Do not clone a reference's grammar** (not pvp.trade, not Cornix, not the Strike app).
- **Every screen width**, never mobile-only: screenshots at 320, 375, 414, 768, 1024, 1280, 1440 and 1920 px, each
  band composed. No sample or filler text: show real data, or say plainly there is none.
- Telegram messages are UI too: read every bot message on a phone; short lines, no emoji walls.

## Verification rules (each one cost him real time)
- **Drive a browser; never infer the rendered state.** Use Playwright (`npx playwright install chromium`) to click,
  then screenshot and look. If you cannot see it, say so.
- **A green typecheck is not a demo.** A testnet order id from a real tap is.
- **Contrast is measured, never eyeballed.** Write the WCAG ratio for every foreground/background pair.
- **Match the metric to the question.** "Are these two colours different?" needs CIE Lab ΔE, not the contrast ratio.
- **Every probe gets a planted positive control** that must fail on purpose before a pass is trusted.
- **A probe asserts a mechanism; when the mechanism changes, it lies instead of failing.** When a check fails, ask
  first: is this the app, or my check?
- **Kill CSS transitions before a synchronous `getComputedStyle` read.** CSS Modules hash class names: select with
  `[class*="name"]`. Headless Chrome defaults to `prefers-color-scheme: dark`.
- **A stale server serving dead asset hashes looks like broken CSS.** Diff served asset hashes against disk first.

## Commits
Real, small commits with descriptive messages. Never skip hooks. Never force-push `main`.
