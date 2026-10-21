# Slop tells: what makes a UI read as generated, and what to do instead

One page to check a screen against. Every row is a default a model reaches for on any brief, so rivals ship
it too. A row is not banned: if the brief asks for it, or the subject earns it, keep it and write the reason in
the plan. The `ui-score` id is given where the scorer measures it; the rest are checked by eye on screenshots.

Read it twice: once before the plan (phase 1) and once against the rendered screenshots (phase 6).

## Type

| Tell | Instead | ui-score id |
|---|---|---|
| Inter, Roboto, Poppins, Geist, system-ui as the display face | A face from the subject's world, chosen and named in the plan | `slop-display-font` |
| One family for everything, no type voice | One family with real weight/width contrast, or two clearly distinct families | `one-font-page` |
| One word in the headline painted, italicised or gradient-filled | Let the whole sentence carry it; make the type treatment itself the idea | `one-word-accent-headline` |
| Tracked ALL-CAPS eyebrow above every heading | No eyebrow. If the content needs a label, sentence case, same column | `allcaps-eyebrows` |
| Gradient text | Solid ink. Spend colour on a surface or the one action | `gradient-text` |
| Headlines that wrap into a one-word last line | `text-wrap: balance` on headings, `pretty` on short body | `no-text-wrap` |

## Colour

| Tell | Instead | ui-score id |
|---|---|---|
| Indigo/violet accent (hue 240–275) | Derive the accent from the subject's materials | `default-tech-hue-accent` |
| Cream #F4F1EA + serif + terracotta #D97757 | Only when the brief is literally warm-paper; otherwise pick again | `cream-clay-default` |
| Near-black + one acid green or vermilion | Tinted dark ground, accent with a job, 2–3 support hues | `acid-on-black` |
| Pure #000 / #fff / zero-chroma greys | Neutrals tinted toward the palette hue (OKLCH chroma 0.008–0.03) | `pure-black-base`, `pure-white-base`, `zero-chroma-ground`, `untinted-neutral-tokens` |
| Violet-to-blue or rainbow gradient washes as decoration | Flat surfaces; a gradient only when it encodes something (light, depth, data) | `gradient-hero` |
| Three or more competing accent colours | One call-to-action colour plus support hues with named jobs | `multiple-accents` |
| Glow, glass and blur on everything | One boldness per screen, spent on the signature element | (eye) |

## Layout

| Tell | Instead | ui-score id |
|---|---|---|
| Centred hero: headline, sub, two buttons, all on the axis | An asymmetric composition that leads with the product's most characteristic thing | `centred-everything-hero` |
| Three equal feature cards with an icon each | Vary scale by importance; show the feature working instead of describing it | `three-equal-columns` |
| Cards inside cards, one radius and one grey shadow on everything | Fewer containers; radius and depth that follow hierarchy (concentric radius) | `card-in-card`, `radius-collapsed` |
| Coloured left-border "callout" cards | Spacing and type weight carry grouping | `side-stripe-card` |
| Sticky nav with 4–6 links on a one-page product | The product's own navigation, or none | `ai-nav` |
| Four-column link footer on a hackathon app | One line: name, link, credit | `ai-footer` |
| Identical vertical rhythm between every section | Rhythm follows content: tight where related, generous at chapter breaks | `sectionRhythm` subscore |
| Big number + small label stat blocks ("10M+ users") | Only sourced numbers. Otherwise a labelled placeholder, or no stat | `invented-metric` |

## Chrome

| Tell | Instead | ui-score id |
|---|---|---|
| "A · B · C" meta strings everywhere | Say the one fact that matters | `middot-meta-strings` |
| `→` appended to every button and link | The verb names the action; an icon only when it adds meaning (external link) | `arrow-suffix-cta` |
| 01 / 02 / 03 markers on things that are not a sequence | Numbers only for real steps or a timeline | `numbered-markers` |
| Monospace for small labels on a non-technical product | The body face at a smaller size, with tabular numbers where they change | `mono-label-chrome` |
| Emoji as feature icons | One icon set, drawn at one stroke weight, or no icon | `emoji-feature-icon`, `mixed-icon-libs` |
| Drawn browser, phone or IDE frames around screenshots | The real screenshot, cropped to the part that matters | (eye) |

## Motion

| Tell | Instead | ui-score id |
|---|---|---|
| Fade-and-slide-up on every section as it scrolls in | Content is just there. One orchestrated entrance per page, at most | `content-held-invisible` |
| Hover scale + shadow + colour shift on every card | One hover channel per control, matched to what it does | `universal-hover-scale`, `multiple-hover-effects` |
| `transition: all`, bouncy overshoot on UI state | Name the properties; ease-out 150–250 ms for feedback | `transition-all`, `bouncy-easing` |
| Animated width/height/margin | transform and opacity, or Motion's `layout` | `animates-layout-property` |
| Idle loops: floating blobs, pulsing badges, marquee logos | Stillness. Motion answers a person's action, or shows the signature moment | (eye) |
| No reduced-motion path | Same end state, no travel | `no-reduced-motion` |

## Copy

| Tell | Instead |
|---|---|
| "Supercharge", "seamless", "unlock", "revolutionize", "AI-powered" | Say what it does for whom, in plain verbs |
| "Introducing X 3.0" eyebrow on a first release | The product name and what it does |
| "Get started" / "Learn more" / "Submit" | The action by name: "Split this bill", "Save changes" |
| Lorem ipsum, "John Doe", fake testimonials, fake logos | Real content from the product's domain, or an honest empty state |
| Exclamation marks and apologetic errors | What happened and how to fix it, calm |

## Imagery

| Tell | Instead |
|---|---|
| No images at all: a grey shell with one accent | One real image per key route, by `imagery-ladder.md` (product output first) |
| Stock photos of people pointing at laptops | The product's own output, or graded hand-built SVG from the subject's world |
| Abstract 3D blobs and gradient orbs | Something that could only belong to this product |

## The five-second test

Show the first viewport at 1280 and at 375 to someone, or to a semi-blind critic pass, for five seconds. If they
can't say what the product does, what to press, and what matters most, the page fails. A page that passes
every row above can still fail this test. Fix the hierarchy first.
