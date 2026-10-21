# Extracting event data from JS-rendered hackathon platforms

Verified 2026-10-01 on Colosseum (Crypto World's Fair) and Superteam Earn. WebFetch returned only a sign-up
shell for `colosseum.com/arena/hackathon` and "no tracks listed" for the Superteam hackathon page. Both were
wrong about the content, which was reachable through the routes below. A WebFetch "not present" on a JS page
is a statement about the fetcher, never about the page. DoraHacks has its own recipe in `dorahacks-scraping.md`.

## Superteam Earn (Next.js)

- Hackathon page: `curl -sL -A "Mozilla/5.0" https://superteam.fun/earn/hackathon/<slug>`, then parse
  `<script id="__NEXT_DATA__">`. `props.pageProps.hackathon` holds the dates, the deadline (UTC) and the
  submission form questions (the `eligibility` array).
- Track list: `GET https://superteam.fun/api/hackathon/<slug>` returns every listing (title, token, reward,
  slug, sponsor). Stats: `GET /api/hackathon/public-stats/?slug=<slug>` (total pool, listing count).
  Found by grepping the page's JS chunks for `/api/hackathon`.
- Each track's full text: `https://superteam.fun/earn/listing/<listing-slug>`, parse `__NEXT_DATA__`, then
  `props.pageProps.listing` gives `description` (HTML), `region` (e.g. "Global", "Nigeria"), `rewards`
  (the payout ladder by place), `deadline`, `skills`, and the form questions. A field reading "Global" can
  still hide a residency rule in the description text (the Vietnam track said Global and required a
  Vietnam registration plus a demo day), so read the description, not the field.

## Colosseum (SvelteKit)

- Most pages server-render their text: `curl` the page, strip `<script>`/`<style>`, then strip tags. The
  `/worldsfair` page rendered only one ecosystem track in its HTML; the full prize list was in the rules PDF.
- Official rules: `https://colosseum.com/legal/<Event>%20Hackathon%20Rules.pdf`, linked from the event page.
  `pdftotext -layout rules.pdf` (poppler is on PATH at `/mingw64/bin/pdftotext`). The rules carry the
  judging criteria and the full prize list, so read them before the overview.
- The FAQ at `colosseum.com/hackathon` carries the judging FACTORS used in practice (founder-market fit,
  insight, product and execution, market size, communication, viability, traction), the submission fields
  (2-3 minute pitch video plus a product demo video of 3 minutes or less, GTM, team location), and the
  process (shortlist, panel, 15-minute Zoom interview). Score against both the rules and the FAQ.
- `https://colosseum.com/<path>/__data.json` returns the SvelteKit devalue payload (a flat array whose
  objects reference other entries by index). Useful for live counters such as registrations.
- `colosseum.com/analytics` server-renders registrations, country count and new-user counts.
- Past campaigns: `/renaissance`, `/radar`, `/breakout`, `/cypherpunk`, `/frontier`,
  `/arena/hackathon/hall-of-fame`, `/companies/<slug>`.
- Colosseum Copilot (`colosseum.com/copilot`) searches every past submission with placements. It is the
  best field-sweep source for this organiser, but it installs a skill and needs the user's own browser
  sign-in (`npx @colosseum-org/copilot-connect login`). Ask the user to run it; never authenticate for them.

## AKINDO WaveHack (client-rendered Next export, measured 2026-10-15)

- The page HTML has an empty `__NEXT_DATA__` (`pageProps: {}`), so curl gets nothing. Playwright renders it, and
  `document.body.innerText` gives the overview, rules and rubric. The public API is easier and needs no auth:
  - `api.akindo.io/public/wave-hacks/<id>`: event record.
  - `.../<id>/waves`: every wave with `submissionDeadline`, `judgementDeadline`, `grantAmount`,
    `grantDistributionMode` (`point` means the pool is split in proportion to judge points, not winner-take-all) and
    `totalSubmissionCount`. The platform countdown can disagree with the rules text; the API governs.
  - `.../<id>/waves/<waveId>/submissions`: every entry with product name, tagline, description, repo name,
    `earnedAmount`, and **`votes`**: the judges' point allocation, written comments and per-criterion ratings.
  - `.../<id>/product-summaries?page=1&limit=50` (limit is capped at 50) and
    `public/threads?type=waveHack&parentId=<id>` (the comment wall).
- **Mine the past wave's `votes` before picking an idea.** On the Midnight Buildathon, the Backend, QA and Frontend
  comments were templated word for word across teams. That template exposes the automated reviewer's checklist:
  - compiles on the review toolchains, with a circuit count;
  - `witnesses.ts` present, plus a commitment or hash;
  - tests driven through a simulator;
  - a React app with the wallet provider stack;
  - a deployed address documented.

  The Product and BD comments show what the humans paid for. Build the repo to that checklist and quote it in the
  plan.
