/**
 * timeline.js — the deterministic playback engine.
 *
 * There is exactly one way a pixel gets its value: seekToTime(t) walks the
 * active scene(s) and asks each to write its complete state for that t.
 * No CSS animation, no CSS transition, no timer, no rAF, no Date.now().
 *
 * Public API (used by scripts/render-frames.mjs):
 *   window.seekToFrame(i)   window.seekToTime(sec)
 *   window.getDuration()    window.getFrameCount()   window.getFps()
 *   window.getBeats()       window.__ready
 */

import { FPS, DURATION, FRAME_COUNT, BEATS } from './script-da.js';
import * as M from './motion.js';
import * as D from './design.js';
import SCENES from './scenes.js';

const { clamp, smoothstep, easeInOutCubic, easeOutQuint, easeInOutQuart } = M;

/* ------------------------------------------------------------------ *
 * Boundary transitions
 * Each incoming beat declares how it takes over the frame. Durations sit in
 * the 0.3–0.6 s band; every one is movement-led rather than a plain fade.
 * ------------------------------------------------------------------ */

const TRANS = {
  'beat-02': { type: 'zoomThrough', dur: 0.46 },
  'beat-03': { type: 'whipLeft', dur: 0.40 },
  'beat-04': { type: 'scaleThrough', dur: 0.42 },
  'beat-05': { type: 'whipUp', dur: 0.44 },
  'beat-06': { type: 'whipLeft', dur: 0.38 },
  'beat-07': { type: 'zoomThrough', dur: 0.44 },
  'beat-08': { type: 'whipLeft', dur: 0.40 },
  'beat-09': { type: 'darkDrop', dur: 0.40 },
  'beat-10': { type: 'wipeUp', dur: 0.52 },
  'beat-11': { type: 'pushUp', dur: 0.46 },
  'beat-12': { type: 'crossScale', dur: 0.50 },
};

const NEUTRAL = { x: 0, y: 0, s: 1, o: 1, blur: 0 };

/** Compute {out, in} container states for a transition at progress p (0..1). */
function transitionState(type, p) {
  const e = easeInOutQuart(p);
  const eo = easeOutQuint(p);
  // Blur peaks mid-move and returns to zero, so held frames are always sharp.
  const mb = Math.sin(Math.PI * clamp(p)) ;

  switch (type) {
    case 'whipLeft':
      return {
        out: { x: -560 * e, y: 0, s: 1 - 0.04 * e, o: 1 - smoothstep(0.55, 1, p), blur: 9 * mb },
        in: { x: 620 * (1 - eo), y: 0, s: 1, o: 1, blur: 8 * mb },
      };
    case 'whipUp':
      return {
        out: { x: 0, y: -420 * e, s: 1 - 0.05 * e, o: 1 - smoothstep(0.6, 1, p), blur: 8 * mb },
        in: { x: 0, y: 500 * (1 - eo), s: 1, o: 1, blur: 7 * mb },
      };
    case 'pushUp':
      return {
        out: { x: 0, y: -300 * e, s: 1 - 0.08 * e, o: 1 - smoothstep(0.45, 0.95, p), blur: 6 * mb },
        in: { x: 0, y: 340 * (1 - eo), s: 1, o: 1, blur: 5 * mb },
      };
    case 'zoomThrough':
      return {
        out: { x: 0, y: 0, s: 1 + 0.36 * e, o: 1 - smoothstep(0.15, 0.8, p), blur: 12 * mb },
        in: { x: 0, y: 0, s: 0.86 + 0.14 * eo, o: smoothstep(0, 0.35, p), blur: 6 * (1 - eo) },
      };
    case 'scaleThrough':
      // The outgoing object accelerates past camera; incoming settles back.
      return {
        out: { x: 0, y: 0, s: 1 + 1.5 * M.easeInCubic(p), o: 1 - smoothstep(0.35, 0.85, p), blur: 20 * mb },
        in: { x: 0, y: 0, s: 0.92 + 0.08 * eo, o: smoothstep(0.1, 0.45, p), blur: 5 * (1 - eo) },
      };
    case 'crossScale':
      return {
        out: { x: 0, y: 0, s: 1 - 0.10 * e, o: 1 - smoothstep(0.2, 0.85, p), blur: 5 * mb },
        in: { x: 0, y: 0, s: 1.06 - 0.06 * eo, o: smoothstep(0.05, 0.5, p), blur: 4 * (1 - eo) },
      };
    case 'darkDrop':
      // Beat 9 arrives as a hard, confident takeover from above.
      return {
        out: { x: 0, y: 60 * e, s: 1 - 0.06 * e, o: 1 - smoothstep(0.1, 0.6, p), blur: 6 * mb },
        in: { x: 0, y: -180 * (1 - M.easeOutQuart(p)), s: 1, o: 1, blur: 0 },
      };
    case 'wipeUp':
      // Beat 9 (dark) leaves upward, uncovering the bright beat 10.
      return {
        out: { x: 0, y: -1120 * M.easeInOutQuint(p), s: 1, o: 1, blur: 4 * mb },
        in: { x: 0, y: 140 * (1 - eo), s: 1, o: 1, blur: 0 },
      };
    default:
      return { out: { ...NEUTRAL, o: 1 - e }, in: { ...NEUTRAL, o: e } };
  }
}

/* ------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------ */

const state = {
  scenes: [],       // {def, beat, root, inner, refs, trans}
  built: false,
  frame: -1,
  time: -1,
};

function applyContainer(node, s) {
  // 2D transform only — see the note in design.setT about raster-scale pinning.
  node.style.transform =
    `translate(${s.x.toFixed(3)}px, ${s.y.toFixed(3)}px) scale(${s.s.toFixed(5)})`;
  node.style.opacity = s.o.toFixed(4);
  node.style.filter = s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : 'none';
}

export function build(stageEl) {
  const api = { D, M, C: D.C, STAGE: D.STAGE, FPS, BEATS };

  BEATS.forEach((beat) => {
    const def = SCENES[beat.id];
    if (!def) {
      console.warn('[timeline] no scene module for', beat.id);
      return;
    }
    const root = D.el('div', 'scene', stageEl);
    root.id = beat.id;
    // Visible during build so scenes can measure real layout geometry with
    // D.stageCenter(); every scene is hidden again once the loop finishes.
    root.style.display = 'block';
    const inner = D.el('div', 'scene-inner', root);
    const localApi = { ...api, beat, dur: beat.end - beat.start };
    const refs = def.build(inner, localApi) || {};
    state.scenes.push({
      def, beat, root, inner, refs,
      api: localApi,
      trans: TRANS[beat.id] || { type: 'crossScale', dur: 0.4 },
    });
  });

  state.scenes.forEach((s) => { s.root.style.display = 'none'; });
  state.built = true;
  return state.scenes;
}

function indexAt(t) {
  let k = 0;
  for (let i = 0; i < state.scenes.length; i++) {
    if (t >= state.scenes[i].beat.start) k = i; else break;
  }
  return k;
}

/** Render the whole page for an absolute time in seconds. Pure w.r.t. `sec`. */
export function seekToTime(sec) {
  if (!state.built) return;
  const t = clamp(sec, 0, DURATION - 1e-6);
  const k = indexAt(t);
  const cur = state.scenes[k];
  const prev = k > 0 ? state.scenes[k - 1] : null;

  // Everything hidden and neutral first — no state may survive from the
  // previously rendered frame, whatever order frames arrive in.
  for (let i = 0; i < state.scenes.length; i++) {
    const s = state.scenes[i];
    s.root.style.display = 'none';
    applyContainer(s.root, NEUTRAL);
  }

  const tIn = cur.trans;
  const p = tIn.dur > 0 ? (t - cur.beat.start) / tIn.dur : 1;
  const inTransition = prev && p < 1;

  if (inTransition) {
    const st = transitionState(tIn.type, clamp(p));
    prev.root.style.display = 'block';
    applyContainer(prev.root, st.out);
    prev.def.render(t - prev.beat.start, prev.refs, prev.api);

    cur.root.style.display = 'block';
    applyContainer(cur.root, st.in);
    cur.def.render(t - cur.beat.start, cur.refs, cur.api);
  } else {
    cur.root.style.display = 'block';
    applyContainer(cur.root, NEUTRAL);
    cur.def.render(t - cur.beat.start, cur.refs, cur.api);
  }

  state.time = t;
  state.frame = Math.round(t * FPS);
  document.documentElement.dataset.time = t.toFixed(4);
  return t;
}

export function seekToFrame(i) {
  const idx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(i)));
  seekToTime(idx / FPS);
  state.frame = idx;
  document.documentElement.dataset.frame = String(idx);
  return idx;
}

export const getDuration = () => DURATION;
export const getFrameCount = () => FRAME_COUNT;
export const getFps = () => FPS;
export const getBeats = () => BEATS.map((b) => ({ ...b, transIn: TRANS[b.id] || null }));
export const getState = () => state;

export default { build, seekToTime, seekToFrame, getDuration, getFrameCount, getFps, getBeats };
