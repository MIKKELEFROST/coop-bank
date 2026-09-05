# Scene contract

Every file in `src/scenes/` implements the same interface. Read this before
touching a scene.

```js
export default {
  id: 'beat-0X',
  build(root, api) { /* create ALL DOM once; return a refs object */ },
  render(t, refs, api) { /* t = seconds since THIS beat started */ },
};
```

`api` = `{ D, M, C, STAGE, FPS, BEATS, beat, dur }` where `D` is `design.js`,
`M` is `motion.js`, `beat` is this beat's entry from `script-da.js` and `dur`
is its length in seconds. Most scenes import `D`/`M` directly instead.

## The one hard rule

**`render(t)` is a pure function of `t`.** Frame 1400 may be rendered before
frame 20 and must produce the identical image.

That means:

- No `setTimeout`, `setInterval`, `Date.now()`, `performance.now()`,
  `requestAnimationFrame`, or unseeded `Math.random()` anywhere in a scene.
  Use `M.rng(seed)` / `M.hash01(i)` for anything that should look random.
- No CSS `@keyframes`, `animation` or `transition`. `styles.css` force-disables
  them globally as a guard.
- **Write every property you own on every call.** If any frame sets
  `el.style.opacity`, then *every* frame must set it. A property written only
  inside an `if` leaves stale state behind when frames arrive out of order.
  This is the single most common way to break a render.
- Do not mutate `refs` in `render()`; do not create DOM in `render()`.
- `t` can be slightly negative or larger than `dur` during the neighbouring
  beat's transition. `M.seg()` clamps, so ordinary code handles this already —
  just never `if (t < 0) return;`, because that leaves the previous frame's
  state on screen.

## Writing state

`D.setT(node, {x, y, s, sx, sy, r, o, blur, centered})` writes transform,
opacity and blur in one call — prefer it over touching `style.transform`
directly. Nodes positioned with `D.place(node, x, y)` are centred on `(x, y)`
in stage coordinates, so `x`/`y` in `setT` are *offsets from that anchor*.
Pass `centered: false` for nodes that are not placed by `D.place` (inline
spans, flow children).

`D.setS(svgNode, {...})` is the SVG equivalent.

## Timing vocabulary

```js
M.seg(t, start, dur, ease)   // 0..1 across [start, start+dur]  ← the workhorse
M.spring(p, {freq, damping}) // 0..1 settling on 1, with overshoot
M.pulse(t, start, dur)       // 0 → 1 → 0, for "this is being said now"
M.stagger(i, per, base)      // staggered start times
M.velocity(fn, t)            // analytic derivative → motion blur amount
M.f(12)                      // 12 frames, in seconds
```

House motion values (from the brief):

| | |
| --- | --- |
| Element entrance | 8–14 frames (0.27–0.47 s) |
| Fast transition | 10–18 frames (0.33–0.60 s) |
| Readable hold | 30–75 frames (1.0–2.5 s) |
| Stagger between related objects | 3–6 frames (0.10–0.20 s) |
| Max overshoot | 4–7 % (`spring` damping 0.6–0.72) |
| Motion blur | only while genuinely moving; cap ≈ 6–14 px |

Something must change roughly every 0.5–1.2 s, including inside long beats.
One clear focus per frame. Prefer movement, scale, cropping and object
transformation over repeated fade-in/fade-out.

## Layout

Stage is 1920 × 1080. Keep primary content inside x ∈ [230, 1690] and
y ∈ [120, 960]; keep headlines and the key object near the horizontal centre so
the piece can later be recut to 9:16 (the preview's *Hjælpelinjer* button draws
the 9:16 column and the title-safe box).

Type scale (`styles.css`): `.h1-xl` 118px, `.h1` 104px, `.h2` 68px, `.h3` 46px,
`.lead` 38px, `.kicker` 22px. Card text never below 28px. Maximum two lines in
a primary headline, maximum one accent colour per headline.

## Language

Every viewer-facing word is Danish — headlines, labels, UI text, status text,
cards, buttons, diagram labels, captions. No generic English UI strings.
Product names stay as they are: Claude, Webflow, MCP, TonePilot, CMO Copilot.
Use `D.icon(name, size, stroke)` for symbols — never emoji.

## Scene skeleton

```js
import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, pulse } = M;

export default {
  id: 'beat-0X',

  build(root) {
    const r = {};
    r.brand = brandmark(root);                     // corner wordmark
    const cam = D.el('div', '', root);             // scene-level zoom wrapper
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px';
    r.cam = cam;
    // … build every node here, place() them, keep handles on r …
    return r;
  },

  render(t, r) {
    r.cam.style.transform = `scale(${(1 + 0.05 * seg(t, 4.0, 0.6, M.easeInCubic)).toFixed(5)})`;
    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });
    // … write every animated property, every frame …
  },
};
```

`src/scenes/beat01.js` (kinetic type, object impact, path reveal) and
`src/scenes/beat02.js` (cards, connectors, spoken-word pulses) are the two
reference implementations.

## Boundary transitions

The engine owns the cut between beats — see `TRANS` in `src/timeline.js`. A
scene therefore starts at its own `t = 0` while the previous scene is still on
screen for 0.38–0.52 s. Compose the first half-second so it reads well while
sliding/scaling in, and end the beat on a state worth carrying out.

## Checking your work

```bash
node scripts/render-frames.mjs 640 680 --out dist/check   # a range
node scripts/contact-sheet.mjs --frames 470,520,570,620 --out dist/check.png
node scripts/verify.mjs                                   # determinism + errors
```

`scripts/verify.mjs` re-renders a sample of frames in shuffled order and
compares them byte-for-byte against a sequential pass. If a scene leaks state
between frames, it fails there.
