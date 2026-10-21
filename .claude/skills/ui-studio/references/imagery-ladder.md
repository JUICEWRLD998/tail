# Imagery ladder: which image, from where, and how to prove it works

**Added 2026-09-30,** when he asked for imagery where it is needed. Hallmark already covers web pages in
general: `references/hero-enrichment.md` (image-need detection, the E1–E8 archetypes, the tier order),
`references/assets.md` (sourcing canon) and `references/imagery-kit.md` (abstract decorative assets). This
file orders imagery for **our** builds, which are products where an image should also be evidence, and adds
the packaging set, the Next.js mechanics, the grading lesson and the probes. Where Hallmark's genre rules
forbid imagery (modern-minimal, for example), Hallmark wins.

Next.js facts below were checked on 2026-09-30 against the Next.js 16.2 docs (via Context7).

## 1. Does this screen need an image at all?

| Screen | Default |
|---|---|
| App or workbench screen | **One, outside the data region** (2026-10-04; was "None", which shipped bare apps): an R1 crop or R2 subject illustration in the header, side panel or empty state. Skip only when data fills the viewport, and write why |
| Landing hero | Usually one: an R1 loop or screenshot, or an R2 illustration |
| Empty state | A small R2 illustration from the vocabulary sheet, plus the one action that fills it |
| Onboarding | R1 screenshots of the real product, annotated |
| Error | None. Words that say what broke and how to fix it. |
| Packaging | Always (section 4) |

When the subject itself is photographic (food, travel, a team, a place), Hallmark's image-need detection
overrides this table.

## 2. The ladder: take the highest rung you can ship honestly

**R1 · The product's own output.** This is the best rung, because the image is also proof.
- **Screenshots** from the CDP driver at `deviceScaleFactor: 2` (`Emulation.setDeviceMetricsOverride`), with
  real data in the app, cropped to the region that matters. Never draw browser, phone or IDE chrome around
  them (Hallmark gate 47). A `<figure>` with at most a hairline border and a caption is enough.
- **A loop of the wow moment,** recorded from the deployed app (OBS or the OS recorder), then trimmed and
  compressed with ffmpeg (installed):
  `ffmpeg -ss 00:00:03 -t 8 -i raw.mp4 -vf "scale=1280:-2,fps=30" -c:v libx264 -pix_fmt yuv420p -crf 26 -an -movflags +faststart loop.mp4`
  and a poster from its best frame: `ffmpeg -ss 00:00:05 -i loop.mp4 -frames:v 1 poster.png`.
  Serve it as `<video muted loop playsinline preload="metadata" poster=…>`, 10 seconds or less, no audio
  track. Autoplay only when reduced motion is off (check `matchMedia` in a small client component), and give
  it a visible pause control: content that moves for more than 5 seconds needs one (WCAG 2.2.2).
- **Real data, drawn.** Load the `dataviz` skill before the first chart.
- **Real receipts.** A transaction hash linked to the explorer, a verification command and its output.

**R2 · Hand-built SVG or CSS art** drawn from the vocabulary sheet, using `currentColor` and tokens so it
follows the theme. Flat fills, crisp edges and drawn facial features read as clip art (2026-09-17). Grade it:
one `feGaussianBlur stdDeviation="0.5"` on the wrapper layer, a warm-key/cool-fill gradient, bloom where the
practical light is (never centred on a head), and shadow forms such as a brow or jaw shadow instead of dot
eyes and a mouth line. If anything scores the art by coordinates, apply the grade at the wrapper so no
coordinate moves. Optimise the file (SVGO) and never embed a raster inside it.

**R3 · Generated stills,** only through a generator we actually have:
- the Hermes `comfyui` skill (`%LOCALAPPDATA%\hermes\skills\creative\comfyui`). It needs a local ComfyUI or a
  Comfy Cloud key, so run its `health_check.py` first; or
- a key he supplies.
If neither exists, say so and drop to R2 or R4. Never imply an image was generated when it was not. Pin the
prompt, model, seed and settings in `public/imagery/PROMPTS.md` so every image can be regenerated. Crop it,
colour-balance it toward the palette tokens, and export WebP (PNG only where alpha matters). **Never** use a
generated image as a real person, customer, testimonial avatar, real place or real event, and label it as an
illustration wherever it could be mistaken for a photo.

**R4 · Licensed photography** (Unsplash, Pexels). Check the licence when you download, rather than assuming
it. Self-host the file in `public/` and credit it in `CREDITS.md` (photographer, source URL, licence, date).
Crop hard to the subject and grade it to the palette: a duotone or tint, either preprocessed or done in CSS
with `filter` and `mix-blend-mode` over a token colour. Test the blend on every theme, because `multiply` over
a dark ground inverts. Never hotlink, and never use picsum, randomuser or any placeholder service; the
pre-submit grep catches them.

**R5 · Lottie, Rive or 3D:** not without his explicit OK. It is a second animation stack plus its weight, and
Hallmark ranks Lottie as the last resort.

## 3. Next.js mechanics (Next 16)

- Every raster goes through `next/image`, with `width` and `height`, or with `fill` inside a box that has a
  fixed `aspect-ratio`, so nothing shifts when it loads.
- Give every responsive image a `sizes` value that matches its real layout width, so the srcset serves the
  right file.
- Put `preload` on **exactly one** image per route: the LCP image. `priority` is deprecated as of Next.js 16.
  Do not preload several images; the docs advise against it when more than one could be the LCP.
- `alt` describes what the image does for the reader. Use `alt=""` only when the image is purely decorative.
- Budgets: 200 KB or less per still (Hallmark's kit budget) and about 3 MB or less for a hero loop. State the
  image weight per route in the hand-off.

## 4. The packaging set (hackathon builds)

Judges see these before they see the app. Cut every one from the signature moment's **thumbnail frame**
(`motion-system.md` §2), so the gallery card, the social card and the video all show the same moment.

| Asset | Where | Size | How |
|---|---|---|---|
| OG card | `app/opengraph-image.tsx` | 1200×630 | `ImageResponse` from `next/og`; export `alt`, `size` and `contentType`; load the brand font file |
| X card | `app/twitter-image.tsx` | 1200×630 | same convention |
| App icon | `app/icon.svg` | vector | file convention; replaces the default favicon |
| Gallery thumbnail | the submission form | the platform's stated ratio (check it; never assume) | the thumbnail frame plus the name |
| README hero | the repo | about 1600px wide | a real 2x screenshot of the wow screen, or the OG card |
| Video poster | the demo video | 1920×1080 | the thumbnail frame |

**Check the thumbnail at the size the gallery shows it** (screenshot it at about 300px wide). If the name is
unreadable or the frame does not say what the product does, recut it.

## 5. Probes: every one with a planted control

Run them through CDP on every route at 375 and 1280, after images have loaded. Plant each control, confirm
it registers, then exclude the control from the sample (`instrument-traps.md`).

| Probe | Measure | Planted control that must register |
|---|---|---|
| Broken images | `img.complete && img.naturalWidth === 0` | an `<img>` pointing at a missing file |
| Missing alt | an `<img>` with no `alt` attribute (flag `alt=""` for review) | an `<img>` with no `alt` |
| Oversized | `naturalWidth / (renderedWidth × devicePixelRatio) > 2` | a 2000px image rendered at 100px |
| LCP element | the last `largest-contentful-paint` entry's `element` (buffered observer) is the one intended | none: compare against the hierarchy contract |
| Layout shift | the sum of `layout-shift` values where `!hadRecentInput` (buffered observer) | an unsized image injected after 500ms that pushes content down |
| Loop behaviour | under emulated reduced motion `video.paused === true`; a pause control exists | a planted autoplay loop with no control |

Label timing results with their conditions. Headless Chrome is not a phone.

## 6. Pitfalls

- **Stock atmosphere where the product's own output would have been proof.** Climb to R1 first.
- **Hero art centred behind the headline** is the AI-default move. Bias it to one side (Hallmark).
- **A generated face presented as a user** is a fabricated testimonial, whatever the caption says.
- **Vector art that reads as a diagram** until it is graded (R2).
- **Preloading several images,** so none of them is prioritised.
- **A looping video with no pause control,** which fails WCAG 2.2.2 and pulls the eye forever.
