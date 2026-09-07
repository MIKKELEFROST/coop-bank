# Coop Bank · Marketing og AI-agenter

A deterministic, frame-by-frame SaaS explainer video for an internal leadership
presentation at Coop Bank: how the marketing department works with AI agents
today, the value those agents create, and how they may change roles, capability
and staffing.

| | |
| --- | --- |
| Resolution | 1920 × 1080 (16:9) |
| Frame rate | 30 fps |
| Duration | 75.0 s |
| Total frames | 2250 |
| Codec | H.264 (High), `yuv420p`, `+faststart` |
| Output | `dist/coop-bank-ai-agenter-preview.mp4` |
| Viewer-facing language | Danish |

Everything on screen is Danish. Code, comments, filenames and this
documentation are English. Product names — Claude, Webflow, MCP, TonePilot,
CMO Copilot — are never translated.

## The core principle: the page is a pure function of the frame index

This is **not** an HTML animation captured with a screen recorder. It is one
page that can be set to any exact frame and rendered:

```
seekToFrame(1400) → render → screenshot → seekToFrame(20) → render → screenshot
```

Both screenshots are byte-identical to what a sequential pass would produce.
Every visual property — position, scale, rotation, opacity, blur, colour, SVG
path progress, card state, text reveal, scene transition — is computed from
`time = frameIndex / fps` and nothing else.

Not used anywhere in the film's motion: CSS keyframes, CSS transitions,
`setTimeout`, `setInterval`, `Date.now`, `performance.now`,
`requestAnimationFrame`, unseeded randomness, or screen recording.
`src/styles.css` force-disables `animation` and `transition` globally as a
guard, and randomness goes through the seeded `M.rng` / `M.hash01`.

`requestAnimationFrame` appears in exactly two places, neither of which drives
the film: the preview's play button (it calls the same `seekToTime()`), and the
renderer's wait-for-paint before each screenshot.

### Public API

```js
window.seekToFrame(frameIndex)   // set the page to an exact frame
window.seekToTime(seconds)       // set the page to an exact timestamp
window.getDuration()             // 75
window.getFrameCount()           // 2250
window.getFps()                  // 30
window.getBeats()                // the 12 beats with timings and transitions
window.__ready                   // true once fonts + assets are loaded
```

The renderer additionally waits for `document.documentElement.dataset.frameReady`
to equal the requested frame index before capturing.

## Commands

```bash
npm install                    # once — playwright, npm-bundled ffmpeg, Inter

npm run dev                    # local preview at http://127.0.0.1:5178
npm run frame -- 450           # render one frame
npm run frames -- 0 300        # render an inclusive frame range
npm run frames                 # render all 2250 frames
npm run beats                  # one representative frame per beat
npm run sheet                  # dist/storyboard-contact-sheet.png
npm run preview                # fast low-res pass over the whole film
npm run voiceover              # manuscript + timing JSON + SRT
npm run assets                 # rescan assets/, rewrite asset-report.md
npm run encode                 # frames -> MP4
npm run verify                 # prove the render is order-independent
npm run render                 # the whole production run, end to end

npm run motion                 # where the film is moving, and where it rests
npm run match -- cut.mp4       # measure what an editor did to a re-cut
npm run retime -- --curve dist/measured-warp.json   # re-render it smoothly
```

`npm run render` does all six steps: assets → voiceover deliverables → 2250
frames → encode → contact sheet → ffprobe verification of resolution, frame
rate, pixel format and duration.

### Retiming

Because `seekToTime()` takes any fractional second, the film can be made longer
by rendering frames at instants between the master's own — the movement runs
slower instead of stopping. That is the one thing a normal edit cannot do: an
NLE can only hold a frame, and a held frame in a film that moves this
continuously reads as judder. See [RETIMING.md](RETIMING.md).

### Interactive preview

`npm run dev` serves the same page with a scrub bar: play/pause, current
timecode, current frame number, clickable markers for all 12 beats, and a
`Hjælpelinjer` toggle that draws the title-safe box and the 9:16 column.
Keyboard: space = play/pause, ←/→ = one frame (shift = ten), `1`–`9` and `0`
jump to a beat, Home/End jump to the ends.

**The exported video is never produced by recording this preview.**

## Project structure

```
index.html                      the stage + preview chrome
src/
  main.js                       boot: assets, fonts, build, expose the seek API
  timeline.js                   the deterministic engine + boundary transitions
  scenes.js                     scene registry
  scenes/beat01.js … beat12.js  one module per beat
  motion.js                     clamp, lerp, smoothstep, easings, spring,
                                overshoot, stagger, velocity blur, seeded rng
  design.js                     tokens, DOM/SVG factories, per-frame setters,
                                cards, chips, app windows, icons, path reveal
  assets.js                     optional-asset resolution + fallbacks
  script-da.js                  beat timings + Danish voiceover (single source)
  preview.js                    scrub UI
  styles.css                    the static visual system
scripts/
  serve.mjs                     dependency-free static server
  render-frames.mjs             Playwright frame capture
  render-preview.mjs            fast low-res pass
  contact-sheet.mjs             storyboard sheet
  voiceover.mjs                 manuscript / timing JSON / SRT
  scan-assets.mjs               manifest + asset-report.md
  encode-video.sh               ffmpeg → MP4 (+ audio mux when present)
  render-all.mjs                the full production run
  verify.mjs                    order-independence proof
assets/                         optional inputs (see asset-report.md)
dist/                           rendered output
SCENE-CONTRACT.md               the rules every scene module follows
asset-report.md                 found / used / missing / fallbacks
```

## The twelve beats

| # | Time | Beat | Danish on-screen |
| --- | --- | --- | --- |
| 1 | 00:00.0–00:04.5 | Åbning | Marketing og AI-agenter |
| 2 | 00:04.5–00:10.5 | Hvad er en AI-agent | Planlæg · Søg · Beslut · Udfør |
| 3 | 00:10.5–00:15.5 | Organisatorisk konsekvens | Værktøjer → Arbejdsgange → Roller → Bemanding |
| 4 | 00:15.5–00:21.5 | Konkurrencefordel | Mindre afdeling. Større slagkraft. |
| 5 | 00:21.5–00:26.0 | Bedre indsigter | Bedre indsigter |
| 6 | 00:26.0–00:30.5 | Løbende optimering | Analysér · Test · Forbedr |
| 7 | 00:30.5–00:35.5 | Digital synlighed | AI søger. Bliver vi fundet? |
| 8 | 00:35.5–00:41.5 | Ny rolle | Lede · kontrollere · prioritere |
| 9 | 00:41.5–00:46.0 | Tillid og kontrol (mørk) | Høj tillid kræver høj kontrol |
| 10 | 00:46.0–00:50.0 | Overgang til nutid | Sådan bruger vi AI-agenter i dag |
| 11 | 00:50.0–01:02.5 | Fire agenter i drift | Fire agenter. Ét samlet marketingsystem. |
| 12 | 01:02.5–01:15.0 | Konklusion | Er fremtidens marketingchef den, der tænder og slukker agenter? |

Boundary transitions live in `TRANS` in `src/timeline.js` — whip-pans,
zoom-throughs, a scale-through, a dark drop and a vertical wipe, each 0.38–0.52 s
and movement-led rather than a fade.

## Visual identity

No official Coop Bank brand assets were supplied, so the brief's fallback
tokens are used:

| | |
| --- | --- |
| Background | `#F6F6F3` |
| Primary text | `#151515` |
| Coop-red accent | `#E30613` |
| Blue secondary | `#315BFF` |
| Green status | `#48C77A` |
| Yellow accent | `#FFC84A` |
| Light red / blue / green cards | `#FFD9DC` / `#DCE7FF` / `#DDF7E5` |

Type is **Inter** (SIL OFL), bundled locally in `assets/brand/fonts/` — no
external font CDN. Headlines 88–118 px, secondary 56–76 px, supporting text
34–46 px, card text ≥ 28 px, max two lines per primary headline, max one accent
colour per headline. Symbols are simple vector strokes from `D.icon()`; there
are no emoji.

No Coop Bank logo is invented anywhere. Where a logo would sit, the film shows
a clean text mark. Dropping `assets/brand/coop-bank-logo.svg` into the repo
makes `assets.js` use it automatically, with no code change.

## Audio

No voiceover file was supplied, so the video renders silent and browser speech
synthesis is deliberately not used. Instead `npm run voiceover` produces:

- `dist/voiceover-manus.txt` — recording-ready Danish manuscript with direction,
  per-beat timings, word counts and the required delivery rate
- `dist/voiceover-timing.json` — machine-readable beat and line timings plus a
  sound-design cue list (whooshes, interface clicks, impacts, the single beat-9
  glitch)
- `dist/voiceover-da.srt` — Danish subtitles

Drop `assets/audio/voiceover-da.wav` (or `.mp3`) into the repo and
`npm run encode` muxes it in; optional `music.*` and `sfx.*` are mixed
underneath it, limited and ducked so they never compete with the voice.

## 9:16

The film is 16:9 for the leadership presentation, but all primary content is
kept inside a central safe area so it can be recut to 9:16 later. The preview's
`Hjælpelinjer` button draws that column.
