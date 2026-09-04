# UI motion explainer — render harness

A deterministic frame renderer for short, UI-driven product motion explainers:
the format used by the four reference films (Airbnb, Notion, Whop, Apple
Stocks), where the product's interface is the protagonist and the whole thing
reads as one choreographed movement rather than a slideshow.

The page is not played. It is a pure function of time: set `t`, photograph the
browser, repeat 630 times, assemble with FFmpeg.

**Status: harness complete and verified. Film content is placeholder** — the
beat sheet in `composition/film.js` is a structurally correct stand-in waiting
for the real project.

The placeholder film is not decorative: it exists so the timing primitives can
be checked against the references by the same measurement. Running the
reference analysis on our own output:

| measure                  | our film      | references        |
| ------------------------ | ------------- | ----------------- |
| movements                | 11            | 8–11              |
| median movement          | 0.17 s        | 0.17–0.27 s       |
| median hold              | 0.40 s        | 0.33–0.83 s       |
| chaos peak → next ½ s    | 1.14 → **0.00** | peak → near-zero within 1–2 s |
| final 4 s mean motion    | 0.10          | near zero         |

That loop — render, measure the render the same way the references were
measured, correct — is the point of the harness. It caught two content faults
that reading the code would not have: a chaos beat that was the quietest
stretch of the film, and seven seconds of dead stillness.

---

## Quick start

```bash
npm install
node scripts/verify.mjs                 # prove reproducibility first
node scripts/capture.mjs --samples 4    # 630 frames x 4 subframes
node scripts/assemble.mjs               # -> out/film.mp4
```

Useful flags:

```bash
node scripts/capture.mjs --samples 1              # no motion blur, ~4x faster
node scripts/capture.mjs --from 7.0 --to 9.0      # just one beat
node scripts/capture.mjs --scale 0.5              # half-res preview
node scripts/assemble.mjs --crf 16 --audio mix.m4a
```

Requires Node 18+, Playwright with Chromium, and an FFmpeg built with
**libx264 and tmix**. Playwright ships its own FFmpeg but it has neither, so
`assemble.mjs` probes candidates and fails loudly rather than silently picking
a crippled binary. `pip install imageio-ffmpeg` is the easiest source.

---

## Layout

```
composition/
  index.html    the 1920x1080 stage
  tokens.css    style system — measured palette, type, depth
  stage.css     layout; also the rules that keep rendering deterministic
  rhythm.js     timing primitives measured from the reference films
  film.js       THE BEAT SHEET — the only file that changes per project
  build.js      turns the beat sheet into DOM + a paused GSAP timeline
scripts/
  capture.mjs   Playwright frame capture
  assemble.mjs  subframe averaging + H.264 encode
  verify.mjs    reproducibility test suite
vendor/         GSAP and Inter, both local — no CDN at render time
```

To change the film, edit `composition/film.js`. Everything else is machinery.

---

## The measured spec

Every number below came from decoding all 2,618 frames of the four reference
MP4s, not from watching them.

**Rhythm.** Frame-to-frame motion energy, hard cuts excluded, normalised per
film:

| film   | movements | median movement | median hold |
| ------ | --------- | --------------- | ----------- |
| Airbnb | 10        | 0.17 s          | 0.68 s      |
| Notion | 11        | 0.17 s          | 0.33 s      |
| Whop   | 8         | 0.20 s          | 0.60 s      |
| Apple  | 10        | 0.27 s          | 0.83 s      |

A movement is 5–8 frames. The hold after it is 2–4x longer. 8–11 movements
carry a whole 20-second film. Encoded as `MOVE`/`HOLD` in `rhythm.js`.

**The dead stop.** Every reference drops to near-zero motion within 1–2 seconds
of its chaos peak — Apple goes from 1.00 to 0.00 in a single second. This is
the hinge of the form, not a gap between scenes. Encoded as `DEADSTOP`, and
`film.js` places it immediately after the swarm beat. Do not shorten it.

**The static ending.** All four run their final 3–5 seconds at near-zero
motion. None of them animates its own logo.

**Nothing else is ever still.** Measuring our own first render the same way
caught this: the placeholder film had seven whole seconds at exactly 0.00
motion and holds of 1.15 s against the references' 0.33–0.83 s. The reference
films always keep something easing — a background drifting, a card still
settling — and reserve real stillness for the dead stop and the outro, where
it carries meaning. A beat that genuinely freezes reads as a slide. Hence
`drift()` in `build.js`, applied to the background under every beat except
those two.

**One background colour.** Notion holds `#F3F3F3` and Airbnb `#FDFBF2`
unchanged end to end. Only Apple Stocks swaps, and there the swap *is* the
narrative. Never pure white; always a soft radial lift toward centre.

**One accent word.** Measured accents: Notion `#273DFF`, Airbnb `#F22161`,
Whop `#E93F25`. Applied to exactly one word of the payoff line. Never two.

**Sound** (measured but not yet implemented here): 15 of 17 hard cuts carry an
audio transient within 200 ms, and each film holds 51–71 transients — roughly
one every 0.35 s. But audio energy correlates with motion energy at only
0.13–0.33, so the music is a near-constant bed rather than something that
follows the animation. All four cut to silence in the final second.

---

## Reproducibility

`verify.mjs` enforces the contract that actually matters:

```
A  cold forward pass vs cold forward pass  -> byte-identical   (the contract)
B  warmed partial render vs full render    -> byte-identical   (--from splice)
C  forward vs backward scrubbing           -> informational
```

Both A and B pass. Run `verify.mjs` after any change to `composition/`.

### What broke, and why it is documented here

Getting to a byte-identical render took four real bugs. They are all the kind
that would otherwise show up as unexplained flicker halfway through a finished
film, so they are worth knowing:

1. **`filter: blur(0px)` at rest.** A zero blur is not the same as no filter —
   it keeps text on Chromium's filtered rasterisation path, where glyph pixels
   depend on whether that layer was previously rasterised blurred. Fixed by
   dropping to `filter: none` once a word lands.

2. **A 3D context on the stage.** `perspective` + `transform-style:
   preserve-3d` on `#stage` promoted *every* descendant into a composited 3D
   layer, plain text included, and composited glyphs rasterise from layer
   history. This was the big one: 11/42 probe frames differing, at a mean
   channel delta of 30/255 — a visibly different glyph weight, not
   antialiasing noise. Fixed by moving the 3D context onto only the three
   layers that actually rotate in depth.

3. **`will-change`.** A hint for real-time compositing. Offline it only
   promotes layers, with the same consequence. Removed everywhere and blocked
   in the reset.

4. **A resting `rotateX(0deg)` on the demo card.** Still counts as a 3D
   transform, so the card stayed composited and the accent chip's rounded
   corners rendered differently run to run — 236 pixels, max delta 216. Fixed
   by clearing the transform once the card has landed.

5. **A race between the seek and the screenshot.** The last residue was
   intermittent — three frames in forty-two, and a different three (or none)
   each run. That pattern is diagnostic: a layer-history bug reproduces, a
   race moves. The screenshot was occasionally beating the compositor's commit
   and returning the previous frame's raster for composited subtrees. Fixed
   with a two-`requestAnimationFrame` barrier after every seek — the first
   fires before the commit, the second after. `capture.mjs` and `verify.mjs`
   share the same `seek()` so they cannot drift apart.

The general rule this leaves: **anything composited rasterises from history,
so nothing may stay composited while at rest — and never photograph the page
until the compositor has committed.**

Because bug 5 is a race, one clean run does not prove much. Two consecutive
`verify.mjs` runs — eight full 630-frame passes — currently come back
byte-identical. Re-run it twice after any change to `composition/`.

### Known limitation

Scrubbing *backwards* does not always reproduce the forward state, because
GSAP's `set()` does not restore the pre-set value on a backward seek. Test C
reports it (currently 6/42 frames) but does not fail on it: the capture path
only ever walks forward, and warms over skipped frames when `--from` is used,
so `--from` renders splice cleanly into a full one. Treat the preview in a
browser as approximate and the captured frames as authoritative.

---

## How motion blur works

Real accumulation, not a filter. For each output frame, `capture.mjs` takes
`--samples` screenshots spread across the shutter interval (`--shutter 0.5`,
a 180-degree shutter). `assemble.mjs` averages them with FFmpeg's `tmix`:

```
tmix=frames=N, trim=start_frame=N-1, setpts=PTS-STARTPTS, framestep=N
```

`tmix` averages a sliding window, so the average belonging to output frame `k`
sits at input index `k*N + (N-1)`; the trim and framestep pick exactly those.
`--samples 1` skips it entirely.

Four samples is a good default. Fast movements are only 6 frames long, so blur
does real work on a small fraction of the film — but that fraction is where
the reference films look expensive.

---

## Running it inside Higgsfield

Higgsfield's `sandbox_exec` has Playwright with headless Chromium, FFmpeg,
Node and ImageMagick preinstalled, and their own `ugc-saas-flow` workflow uses
the same Playwright-screenshot approach (`capture_site.mjs`) to photograph
live sites. `capture.mjs` resolves Playwright the same way theirs does, so it
runs there unchanged.

Two constraints to plan around: commands time out at 120 s in the foreground
(15 minutes with `background: true`), and the sandbox is discarded about ten
seconds after a call finishes — so the upload has to be chained into the same
command that produces the file.

---

## What is not here yet

- Real copy, brand, and UI. `film.js` is placeholder.
- The audio bed and SFX. The measured spec is written down above; nothing is
  implemented.
- Reframing to 9:16.
