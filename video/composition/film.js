/* ---------------------------------------------------------------------------
   film.js — the beat sheet, as data.

   THIS IS THE ONLY FILE THAT CHANGES WHEN THE PROJECT IS NAMED.
   Everything else in composition/ is project-independent machinery.

   The structure below is the measured template, not an invention:
     - 9 beats (references carry 8-11 movements across ~21 s)
     - a chaos peak followed immediately by a 1.000 s dead stop
     - the last 3.8 s completely static (all four references do this)
     - exactly one accent word, in the payoff line

   Copy is placeholder. Word counts are not: keep lines at 2-7 words.
   --------------------------------------------------------------------------- */

import { HOLD, HOLD_LONG, DEADSTOP } from "./rhythm.js";

export const film = {
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 21.0,

  /** Deterministic layout seed. Changing this reshuffles every swarm tile. */
  seed: 20260904,

  beats: [
    {
      id: "hook",
      kind: "type",
      at: 0.0,
      dur: 2.2,
      text: "Every week",
      size: "hook",
      hold: HOLD_LONG,
      exit: "blur", // measured transition: current line blurs as next sharpens
    },
    {
      id: "problem",
      kind: "type",
      at: 2.2,
      dur: 1.8,
      text: "the same work again",
      size: "line",
      hold: HOLD,
      exit: "blur",
    },
    {
      id: "swarm",
      kind: "swarm",
      at: 4.0,
      dur: 3.4,
      // 14 tiles measured as the quietest stretch of the film, where the
      // script calls for its loudest. The reference chaos beats fill the
      // frame — Apple's wall of tickers, Notion's scattered site cards.
      count: 26,
      // Density ramps across the beat and peaks at the end — the reference
      // motion profiles all climb to a single maximum, then stop dead.
      peakAt: 0.88,
      collapse: true, // tiles converge to centre rather than fading out
    },
    {
      id: "stop",
      kind: "still",
      at: 7.4,
      dur: DEADSTOP, // 1.000 s — the hinge. Do not shorten.
      mode: "ink",
      text: "it never lands",
    },
    {
      id: "pivot",
      kind: "mark",
      at: 8.4,
      dur: 2.0,
      label: "Placeholder",
      hold: HOLD,
    },
    {
      id: "demo",
      kind: "card",
      at: 10.4,
      dur: 2.6,
      title: "Placeholder record",
      caption: "Ready · 2 min ago",
      rows: 3,
      becomes: true, // card grows to fill frame and hands off to the next beat
    },
    {
      id: "panel",
      kind: "panel",
      at: 13.0,
      dur: 2.4,
      title: "Placeholder record",
      panelTitle: "Filters",
      items: ["Everything", "This week", "Owner", "Status", "Archive"],
    },
    {
      id: "payoff",
      kind: "type",
      at: 15.4,
      dur: 1.8,
      text: "Once. Then it *runs*.", // *word* takes the accent colour
      size: "payoff",
      hold: HOLD,
      exit: "none",
    },
    {
      id: "outro",
      kind: "outro",
      at: 17.2,
      dur: 3.8, // static: measured, all four references end near-zero motion
      label: "Placeholder",
      tagline: "Tagline goes here.",
    },
  ],
};
