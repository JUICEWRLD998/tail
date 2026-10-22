# demo/plan.json

One file drives voice, recording and the edit. Re-running any step reads it fresh.

```jsonc
{
  "product": { "name": "Splitly", "tagline": "Split any bill in seconds", "url": "splitly.app" },
  "url": "https://splitly.vercel.app",        // base for relative scene/goto URLs
  "targetSeconds": 120,                        // hard max; verify fails above it
  "colorScheme": "dark",                       // optional: pin prefers-color-scheme
  "theme": {                                   // from scout.json; drives cards and the click ring
    "bg": "#0d1417", "surface": "#132126", "fg": "#e8f1ee", "muted": "#9fb3ad",
    "accent": "#3ee0c0", "accent2": "#f2b45a",
    "font": "\"Inter\", sans-serif", "display": "\"Fraunces\", serif",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Fraunces:wght@700&display=swap"
  },
  "voice": { "edgeVoice": "en-US-AvaMultilingualNeural", "rate": "-4%", "lead": 0.6, "tail": 0.5 },
  "transition": 0.5,                           // crossfade seconds between scenes
  "transitionStyle": "fade",                   // any ffmpeg xfade name; per scene: "transition"
  "deck": true,                                // chapter rail + progress line on deck slides (not title/end)
  "captions": true,
  "captionStyle": { "font": "Segoe UI Semibold", "size": 46 },
  "chapters": true,                            // chapter label on the first scene of each new beat; false hides them
  "music": "assets/music.mp3",                 // optional; false disables the skill library
  "musicVolume": 0.16,
  "thumbnailAt": 2.6,
  "scenes": [ /* see below */ ]
}
```

## Scene

```jsonc
{
  "id": "s05-split",            // unique, used for file names
  "beat": "demo",               // required: hook | problem | solution | demo | proof | close, in that order
  "chapter": "Live demo",       // optional: override the chapter label, or false to hide it on this scene
  "signature": true,            // optional: marks THE moment the video is remembered by (one per video)
  "vo": "Hit send. Everyone gets their exact share.",   // spoken + captioned
  "say": "Hit send. Everyone gets their exact share.",  // optional: spoken text if pronunciation needs help
  "rate": "-8%",                // optional per-scene speaking rate
  "hold": 1.0,                  // optional extra seconds of picture after the voice ends
  "lead": 0.6, "tail": 0.5,     // optional per-scene breath
  "captions": true,             // default: on, except title/end cards
  "transition": "fade",
  "visual": { ... }
}
```

Scene length = lead + voice + tail + hold, or longer if the actions run long (verify then warns dead air).

## visual: card

```jsonc
{ "type": "card", "template": "title", "kicker": "ETHGlobal 2026", "name": "Splitly",
  "tagline": "Split any bill in *seconds*", "image": "scout/home.png" }

{ "type": "card", "template": "statement", "kicker": "The problem",
  "lines": ["One friend pays.", { "text": "Then *chases* everyone for a week.", "dim": false }],
  "sub": "optional smaller line", "center": false, "image": "scout/old-way.png" }

{ "type": "card", "template": "solution", "name": "Splitly",
  "line": "One link. Everyone pays their *exact* share.",
  "points": ["Snap the receipt", "Tap who had what", "Watch it settle"],   // up to 3, short
  "image": "scout/home.png" }

{ "type": "card", "template": "stat", "value": "73%", "caption": "of shared bills are settled late", "source": "Source: X survey, 2025" }

{ "type": "card", "template": "end", "name": "Splitly", "tagline": "Settle up before the bill arrives",
  "url": "splitly.app", "credit": "Built for ETHGlobal 2026 · Mustapha Fadhlullah" }
```

On problem, solution and proof cards with no `kicker`, the chapter label becomes the kicker (sentence case).
### Deck slides

Every item below (a row, a step, a list entry) may carry `"onWord": "word"` (and `"occurrence": 1`): it then
appears while the narrator says that word. `tallyOnWord` times the compare tally. Unknown words fall back to
the default stagger and `record.mjs` warns.

```jsonc
{ "type": "card", "template": "problem", "head": "Followers copy calls by hand, and lose the trade",
  "rows": [ { "value": "6 steps", "text": "from a call to a placed order", "source": "Counted in the app, Oct 2026", "onWord": "six" },
            { "text": "Callers earn nothing when people follow them", "onWord": "earn" } ] }   // 3 rows max

{ "type": "card", "template": "quote", "text": "By the time I've typed it in, the entry is gone.",
  "who": "A channel follower", "source": "Public post, 12 Oct 2026" }                       // who + source required

{ "type": "card", "template": "compare", "head": "Six steps become one tap",
  "before": { "label": "Today", "cost": "6 steps", "steps": [ { "text": "Read the call", "onWord": "read" }, "Open the exchange" ] },
  "after":  { "label": "With Tail", "cost": "1 tap", "steps": [ { "text": "Tap Tail", "onWord": "tap" } ] },
  "tally": "One tap, sized to *your* risk", "tallyOnWord": "risk" }

{ "type": "card", "template": "flow", "head": "How Tail works",
  "steps": [ { "label": "Caller posts", "sub": "any common format", "onWord": "posts" },
             { "label": "You tap", "sub": "sized to your risk", "onWord": "tap" },
             { "label": "Strike holds it", "sub": "entry, target, stop", "onWord": "Strike" } ] }   // 2-4 steps
```

`*word*` paints a word in the accent colour. `image` paths are relative to the demo folder. Stat values count up
from zero, keeping a prefix or suffix (`$4.2M`, `73%`, `4 days`). Only use a stat that has a source.

## visual: page

```jsonc
{ "type": "page",
  "url": "/app",                // optional: navigate BEFORE recording; omit to continue in the same tab
  "prep": [ ... ],              // actions run before recording (logins, seeding, navigation)
  "cursor": true,               // false hides the presenter cursor
  "settle": 400,                // ms to wait after prep before recording
  "actions": [ ... ] }          // recorded, in order
```

The app tab persists across page scenes, so state (added items, logged-in session) carries forward.

## Actions

Targets: `"text": "Add person"` (visible label, button-like elements first, exact match preferred) or
`"selector": "#who"`; `"nth": 1` picks a later match. Every action takes `"optional": true` to skip on failure.

Timing: `"onWord": "send"` starts the action so it lands while the narrator says that word (for click/hover the
cursor travel is subtracted). `"occurrence": 1` picks the second time the word is said. `"at": 3.2` starts at a
fixed second of the scene.

| do | Fields | Effect |
|---|---|---|
| `click` | target, `move` (ms, 750), `pause` (120), `after` (500), `dx`, `dy` | Cursor glides on an arc, presses, ripple, real mouse click |
| `hover` | target, `move` | Cursor glides and rests |
| `type` | target (optional), `value`, `cps` (14), `clear`, `after` | Clicks the field, types with human rhythm |
| `press` | `key` (`Enter`, `Tab`, `Escape`, arrows) | Key press |
| `scroll` | target or `y`, `ms` (1200), `block` (0.3 = target sits 30% down) | Eased scroll |
| `zoom` | target, `scale` (1.5), `ms` (900) | Native pinch zoom on the target, crisp |
| `unzoom` | `ms` (800) | Back to 1x. Do this before the next click |
| `spotlight` | target, or `"off": true` | Accent outline around an element |
| `focus` | target, or `"off": true` | Dims the rest of the page and outlines the target; glides if moved to another target. Use on the signature result, on the word that names it |
| `chapter` | `text`, `ms` (2800) | Shows a chapter label mid-scene (the first scene of a beat gets one automatically) |
| `wait` | `ms` | Pause |
| `waitFor` | target or `js`, `timeout` | Wait for an element or a JS condition |
| `goto` | `url` | Navigate mid-scene (avoid: loading shows on camera) |
| `cursor` | `hide` | Show or hide the cursor |
| `eval` | `js` | Run JS in the page (seed state, close a banner) |

## Outputs

```
demo/
  BRIEF.md  script.md  plan.json
  scout/            screenshots + scout.json
  build/            audio/, frames/, clips/, timeline.json, captions.ass, graph.txt, verify/, debug/  (gitignore)
  out/<slug>-demo.mp4  <slug>-demo.srt  thumbnail.png
```
