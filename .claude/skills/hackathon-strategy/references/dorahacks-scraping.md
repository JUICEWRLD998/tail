# Extracting full hackathon details from DoraHacks (Nuxt) pages

DoraHacks hackathon pages are Nuxt/JS-rendered. `web_extract` returns only a truncated hero, timeline, and tags — NOT the sponsor message, judging criteria, or track descriptions. Those are embedded in the served HTML as JSON.

## Recipe (worked reliably)
1. `curl -sL "<hackathon-url>" -H "User-Agent: Mozilla/5.0 ... Chrome/120 ..." -o page.html`
   - On Windows/MSYS, write to `$LOCALAPPDATA/Temp` (or `$HOME/AppData/Local/Temp`), NOT `/tmp` — native tools and later `python` reads need a real path.
2. Parse with Python (write the script to a file with `write_file`, then `python script.py` — do NOT use a heredoc: MSYS mangles backslashes/escapes in inline heredoc Python).
3. The full markdown description and judging criteria are embedded as JSON with escaped newlines. Decode with `txt = raw.replace('\\n', '\n').replace('\\"', '"')` then search for the key phrases.

## Key strings to locate
- Judging criteria + weights: grep `Innovation & Originality`, `Technical Implementation`, `Submission Guidelines`.
- Track descriptions + example use-cases: grep `"tracks":[{` or `"name":"Open Track"` — the full track `description` is in the embedded Nuxt state, not the meta tags.
- The `<meta name="description">` tag content is TRUNCATED with "..." — it is a teaser, not the source of truth.
- The `application/ld+json` block carries organizer name + exact start/end dates.

## Also useful
- `web_search` backends (Firecrawl/Exa) can be flaky or unconfigured (403 / unrecognized shape). Direct `curl` + parse of the platform page is more reliable for structured hackathon data.
- Sponsor docs (docs.<sponsor>.io, GitHub) are usually plain Markdown accessible via `web_extract` or by appending `.md` to doc URLs (GitBook) — use those for the technical primitive/SDK surface.
