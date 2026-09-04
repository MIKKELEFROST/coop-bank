/* ---------------------------------------------------------------------------
   build.js — turns the beat sheet in film.js into DOM plus a paused GSAP
   timeline, then exposes a single deterministic entry point:

       window.__setTime(t)   ->  renders the composition at exactly t seconds

   Determinism rules enforced here:
     1. No requestAnimationFrame, no autoplay. The timeline is always paused
        and only ever moved by seeking.
     2. No CSS transitions or keyframe animations anywhere (see stage.css).
     3. Layout randomness comes from a seeded PRNG, never Math.random().
     4. fromTo() everywhere, so a tween's start state cannot depend on
        whatever the previous seek happened to leave behind.
   --------------------------------------------------------------------------- */

import { MOVE, HOLD, EASE, snap } from "./rhythm.js";
import { film } from "./film.js";

const gsap = window.gsap;
gsap.ticker.lagSmoothing(0);

/* -- Force the font in before anything is measured or drawn -----------------
   document.fonts.ready is not sufficient on its own. Every text element starts
   hidden, so at load time the browser has no pending font request to wait on
   and fonts.ready resolves immediately -- the woff2 then arrives partway
   through the render. Verified: two identical forward passes disagreed on
   ~24% of probe frames, always inside the text bounding box, at a mean
   channel delta of 30/255. That is a visibly different glyph weight, not
   antialiasing noise.

   Loading each weight explicitly instantiates the variable-font axis before
   layout, so glyph metrics and rasterisation are settled before frame 0. */
await Promise.all(
  ["400", "500", "600", "700", "800"].map((w) =>
    document.fonts.load(`${w} 100px InterVar`)
  )
);
await document.fonts.ready;

/* -- Seeded PRNG (mulberry32) ---------------------------------------------
   Identical layout on every run, on every machine. A Math.random() call
   anywhere in this file would silently break frame-to-frame reproducibility
   across separate capture passes. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(film.seed);

/* -- DOM helpers ----------------------------------------------------------- */
const stage = document.getElementById("stage");
const bg = document.getElementById("bg");

function el(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  (parent || stage).appendChild(n);
  return n;
}

/**
 * Splits "Once. Then it *runs*." into word spans, accenting *starred* words.
 *
 * Trailing punctuation has to be handled explicitly: a naive startsWith("*") /
 * endsWith("*") check misses "*runs*." and renders the asterisks literally,
 * which is exactly what shipped in the first full render. The accent lives on
 * the word; the punctuation stays in the ink colour, as in every reference.
 */
function words(container, text) {
  const out = [];
  for (const raw of text.split(/\s+/)) {
    const m = raw.match(/^\*(.+?)\*([^\w*]*)$/);
    const w = el("span", m ? "w accent" : "w", container);
    if (m) {
      w.textContent = m[1];
      if (m[2]) {
        const tail = el("span", "tail", w);
        tail.textContent = m[2];
      }
    } else {
      w.textContent = raw;
    }
    out.push(w);
  }
  return out;
}

const tl = gsap.timeline({ paused: true });

/**
 * Slow continuous push across a beat.
 *
 * Measuring our own first render against the references exposed this: the
 * placeholder film had seven whole seconds at exactly 0.00 motion, and holds
 * of 1.15 s against the references' 0.33-0.83 s. The reference films are
 * never actually still — a card keeps easing toward camera, a background
 * keeps drifting — and stillness is reserved for the dead stop and the outro,
 * where it means something. A beat that truly freezes reads as a slide.
 *
 * Amplitude is deliberately below the threshold of being read as movement.
 */
function drift(target, at, dur, amount = 0.018) {
  tl.fromTo(
    target,
    { scale: 1 },
    { scale: 1 + amount, duration: dur, ease: "none" },
    at
  );
}

/* -- Beat builders ---------------------------------------------------------
   Each returns nothing; each appends its own tweens at absolute positions on
   the shared timeline. Beats never overlap-cleanup each other: every beat
   hides itself at its own end. */

function buildType(b) {
  const layer = el("div", `layer type size-${b.size}`);
  const line = el("div", "line", layer);
  const ws = words(line, b.text);

  tl.set(layer, { autoAlpha: 1 }, b.at);
  tl.fromTo(
    ws,
    { y: 30, autoAlpha: 0, filter: "blur(12px)" },
    {
      y: 0,
      autoAlpha: 1,
      filter: "blur(0px)",
      duration: MOVE,
      ease: EASE.type,
      stagger: 1 / film.fps / 2, // half a frame between words: reads as one move
    },
    b.at
  );

  /* A resting `filter: blur(0px)` is NOT the same as no filter: it keeps the
     text on Chromium's filtered rasterisation path, and the glyph pixels then
     depend on whether that layer was previously rasterised blurred. Verified:
     leaving it on made ~26% of sample frames history-dependent. Dropping to
     `none` once the word has landed puts resting text back on the normal path. */
  const settled = snap(b.at + MOVE + 2 / film.fps);
  tl.set(ws, { filter: "none" }, settled);

  const exitAt = snap(b.at + b.dur - MOVE);
  if (b.exit === "blur") {
    // Measured transition: the outgoing line goes soft while the next sharpens.
    // fromTo, not to: the start value must be stated because `none` cannot be
    // interpolated toward a blur.
    tl.fromTo(
      ws,
      { filter: "blur(0px)" },
      {
        autoAlpha: 0,
        filter: "blur(14px)",
        scale: 1.05,
        duration: MOVE,
        ease: EASE.out,
      },
      exitAt
    );
  }
  tl.set(layer, { autoAlpha: 0 }, snap(b.at + b.dur));
}

function buildSwarm(b) {
  const layer = el("div", "layer swarm");
  const tiles = [];
  for (let i = 0; i < b.count; i++) {
    const t = el("div", "tile", layer);
    // Scatter across a wide ellipse, biased away from dead centre so the
    // middle stays readable until the collapse.
    const ang = rand() * Math.PI * 2;
    const rad = 0.3 + rand() * 0.72;
    t.style.left = `${50 + Math.cos(ang) * rad * 44}%`;
    t.style.top = `${50 + Math.sin(ang) * rad * 40}%`;
    // Larger tiles: frame coverage is what registers as chaos. Mean
    // frame-to-frame delta scales with moving area, not with element count.
    const s = 0.7 + rand() * 1.05;
    t.dataset.scale = String(s);
    t.style.width = `${210 * s}px`;
    t.style.height = `${138 * s}px`;
    for (let r = 0; r < 3; r++) el("i", "row", t);
    tiles.push(t);
  }

  tl.set(layer, { autoAlpha: 1 }, b.at);

  /* Entries overlap heavily. Spreading 14 tiles evenly across the beat meant
     roughly one tile moving at a time, and the first render measured 0.11-0.19
     motion here — the quietest stretch of the film, where the script calls for
     its loudest. Packing the entries into the first 45% of the beat puts
     several tiles in flight at once, which is what chaos actually looks like. */
  /* Tiles must keep arriving right up to the collapse. Packed into the first
     34% they all landed by t+1.2 and the beat went dead (measured 0.09 of
     typical motion for a second and a half). Spread across 72% with 26 tiles
     there is a new arrival every ~0.09 s and roughly two in flight at all
     times, so the beat sustains instead of front-loading. */
  const rampEnd = b.dur * 0.72;
  tiles.forEach((t, i) => {
    const at = snap(b.at + (i / tiles.length) * rampEnd);
    // Each tile keeps drifting after it lands, so the swarm stays alive until
    // the collapse instead of freezing into a still life.
    drift(t, snap(at + MOVE), Math.max(0.2, b.at + b.dur - at - MOVE), 0.05);
    tl.fromTo(
      t,
      {
        autoAlpha: 0,
        scale: 0.7,
        rotateZ: (rand() - 0.5) * 16,
        rotateY: (rand() - 0.5) * 26,
        z: -300 - rand() * 400,
      },
      {
        autoAlpha: 1,
        scale: 1,
        rotateZ: (rand() - 0.5) * 10,
        rotateY: (rand() - 0.5) * 18,
        z: 0,
        duration: MOVE,
        ease: EASE.in,
      },
      at
    );
  });

  if (b.collapse) {
    // Chaos collapses inward instead of fading: the measured "kaos-kollaps"
    // transition. Ends exactly on the beat boundary so the stop lands clean.
    const at = snap(b.at + b.dur - MOVE);
    tl.to(
      tiles,
      {
        left: "50%",
        top: "50%",
        scale: 0.12,
        autoAlpha: 0,
        rotateZ: 0,
        duration: MOVE,
        ease: EASE.out,
      },
      at
    );
  }
  tl.set(layer, { autoAlpha: 0 }, snap(b.at + b.dur));
}

function buildStill(b) {
  const layer = el("div", "layer still");
  const line = el("div", "line", layer);
  words(line, b.text);

  // THE DEAD STOP. Everything snaps in on a hard cut, then nothing moves for
  // the whole beat. No tweens here on purpose — measured motion energy in the
  // references drops to <=0.09 of typical for a full second at this point.
  tl.set(bg, { attr: { "data-mode": b.mode } }, b.at);
  tl.set(layer, { autoAlpha: 1 }, b.at);
  tl.set(layer, { autoAlpha: 0 }, snap(b.at + b.dur));
  tl.set(bg, { attr: { "data-mode": "light" } }, snap(b.at + b.dur));
}

function buildMark(b) {
  const layer = el("div", "layer mark");
  const row = el("div", "mark-row", layer);
  const glyph = el("div", "glyph", row);
  const label = el("div", "mark-label", row);
  label.textContent = b.label;

  tl.set(layer, { autoAlpha: 1 }, b.at);
  tl.fromTo(
    glyph,
    { scale: 0.4, autoAlpha: 0, rotateZ: -8 },
    { scale: 1, autoAlpha: 1, rotateZ: 0, duration: MOVE, ease: EASE.in },
    b.at
  );
  tl.fromTo(
    label,
    { x: -24, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: MOVE, ease: EASE.in },
    snap(b.at + MOVE / 2)
  );
  tl.to(
    layer,
    { autoAlpha: 0, duration: MOVE, ease: EASE.out },
    snap(b.at + b.dur - MOVE)
  );
}

function makeCard(parent, title, caption, rows) {
  const card = el("div", "card", parent);
  const head = el("div", "card-head", card);
  const dot = el("div", "card-dot", head);
  const txt = el("div", "card-text", head);
  const h = el("div", "card-title", txt);
  h.textContent = title;
  const c = el("div", "card-cap", txt);
  c.textContent = caption;
  for (let i = 0; i < rows; i++) el("i", "card-row", card);
  return card;
}

function buildCard(b) {
  const layer = el("div", "layer cardlayer");
  const card = makeCard(layer, b.title, b.caption, b.rows);

  tl.set(layer, { autoAlpha: 1 }, b.at);
  tl.fromTo(
    card,
    { y: 90, autoAlpha: 0, scale: 0.92, rotateX: 14, z: -260 },
    {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      rotateX: 0,
      z: 0,
      duration: MOVE,
      ease: EASE.in,
    },
    b.at
  );

  /* Drop the transform once the card has landed. A resting `rotateX(0deg)`
     still keeps the element on the 3D compositing path, and rounded-corner
     antialiasing inside a composited 3D layer rasterises from history:
     measured as 236 pixels of the accent chip's corners differing between two
     otherwise identical renders. Clearing the transform returns the resting
     card to the 2D path. */
  tl.set(card, { clearProps: "transform" }, snap(b.at + MOVE + 2 / film.fps));

  if (b.becomes) {
    // "Element becomes the next scene" — the most load-bearing transition in
    // all four references. The card grows past the frame and hands off.
    // fromTo, because the transform was cleared above and has no start value.
    const at = snap(b.at + b.dur - MOVE);
    tl.fromTo(
      card,
      { scale: 1, rotateX: 0, z: 0 },
      { scale: 4.2, autoAlpha: 0, duration: MOVE, ease: EASE.becomes },
      at
    );
  }
  tl.set(layer, { autoAlpha: 0 }, snap(b.at + b.dur));
}

function buildPanel(b) {
  const layer = el("div", "layer panellayer");
  const wrap = el("div", "panel-wrap", layer);
  const card = makeCard(wrap, b.title, "", 4);
  card.classList.add("card-dark");
  const panel = el("div", "panel", wrap);
  const ph = el("div", "panel-title", panel);
  ph.textContent = b.panelTitle;
  for (const it of b.items) {
    const row = el("div", "panel-item", panel);
    el("i", "panel-ico", row);
    const s = el("span", null, row);
    s.textContent = it;
  }

  tl.set(layer, { autoAlpha: 1 }, b.at);
  // Rotation reveal: kept under 25 degrees so it reads as 2.5D, not 3D software.
  tl.fromTo(
    wrap,
    { rotateY: 22, rotateX: 6, autoAlpha: 0, z: -220 },
    {
      rotateY: 13,
      rotateX: 3,
      autoAlpha: 1,
      z: 0,
      duration: MOVE,
      ease: EASE.camera,
    },
    b.at
  );
  tl.fromTo(
    panel,
    { x: 120, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: MOVE, ease: EASE.in },
    snap(b.at + MOVE + HOLD / 3)
  );
  tl.to(
    layer,
    { autoAlpha: 0, duration: MOVE, ease: EASE.out },
    snap(b.at + b.dur - MOVE)
  );
}

function buildOutro(b) {
  const layer = el("div", "layer outro");
  const row = el("div", "mark-row", layer);
  el("div", "glyph", row);
  const label = el("div", "mark-label", row);
  label.textContent = b.label;
  const tag = el("div", "tagline", layer);
  tag.textContent = b.tagline;

  // Static by measurement: all four references run the final 3-5 seconds at
  // near-zero motion. The logo does not animate. One short fade in, then hold.
  tl.set(layer, { autoAlpha: 1 }, b.at);
  tl.fromTo(
    [row, tag],
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: MOVE, ease: EASE.in, stagger: 2 / film.fps },
    b.at
  );
}

const builders = {
  type: buildType,
  swarm: buildSwarm,
  still: buildStill,
  mark: buildMark,
  card: buildCard,
  panel: buildPanel,
  outro: buildOutro,
};

for (const b of film.beats) {
  const fn = builders[b.kind];
  if (!fn) throw new Error(`unknown beat kind: ${b.kind}`);
  fn(b);

  /* Background parallax under every beat except the two that are meant to be
     still. Drifting the background rather than the type layers keeps glyphs
     off any scaled raster path, so the film gains continuous low-level motion
     without putting text back into the nondeterminism documented in README. */
  if (b.kind !== "still" && b.kind !== "outro") {
    drift(bg, b.at, b.dur, 0.03);
  }
}

/* -- Deterministic entry point --------------------------------------------- */
tl.pause(0);

window.__film = film;
window.__duration = film.duration;
window.__timeline = tl;

/**
 * Render the composition at exactly t seconds. Synchronous: when this
 * returns, the DOM is in its final state for that instant.
 */
window.__setTime = function (t) {
  const clamped = Math.max(0, Math.min(film.duration, t));
  tl.time(clamped, false);
  return clamped;
};

window.__setTime(0);
document.documentElement.dataset.ready = "1";
