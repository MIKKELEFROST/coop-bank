/**
 * Beat 3 · 00:10.5–00:15.5 — Organisatorisk konsekvens
 *
 * VO: "Det ændrer vores arbejdsgange – og på sigt også vores roller og hvor
 *      mange vi skal være."
 *
 * Motion: a horizontal consequence chain is typeset word by word —
 * Værktøjer → Arbejdsgange → Roller → Bemanding. The first three are quiet
 * white chips; the last one is solid Coop red and lands on "hvor mange vi skal
 * være". A very light ghost wordmark ("marketing i bevægelse") wipes up behind
 * the row as texture. From local t 4.2 the whole row re-centres on "Bemanding"
 * and accelerates toward the camera with velocity-derived blur, so that chip is
 * the object beat 4's scaleThrough cut takes over.
 *
 * Every animated property is written on every call; nothing reads a clock.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
        easeInCubic, pulse } = M;

/**
 * The four links of the chain, in the order the voiceover implies them.
 * `at` = local seconds where the chip seats itself, `say` = the accent beat.
 */
const STEPS = [
  { label: 'Værktøjer',    at: 0.34, say: 0.44, solid: false },
  { label: 'Arbejdsgange', at: 0.92, say: 1.08, solid: false },
  { label: 'Roller',       at: 2.55, say: 2.80, solid: false },
  { label: 'Bemanding',    at: 3.18, say: 3.48, solid: true  },
];

/** Each connector draws in just before the chip that follows it. */
const ARROW_AT = [0.72, 2.26, 2.90];

/** Local time the composition starts its run at the camera. */
const PUSH_T = 4.20;

function stepChip(parent, spec) {
  const n = D.el('div', '', parent);
  const solid = spec.solid;
  n.style.cssText =
    'position:relative;display:inline-flex;align-items:center;flex:none;' +
    (solid ? 'gap:14px;padding:20px 38px;border-radius:20px;'
           : 'gap:0;padding:19px 32px;border-radius:18px;') +
    (solid ? 'font-size:42px;font-weight:800;' : 'font-size:38px;font-weight:700;') +
    'letter-spacing:-.022em;line-height:1;white-space:nowrap;' +
    (solid
      ? `background:${D.C.red};border:1px solid ${D.C.red};color:#FFFFFF;`
      : `background:#FFFFFF;border:1px solid ${D.C.line};color:${D.C.ink};`) +
    'will-change:transform,opacity,filter';
  if (solid) {
    const box = D.el('div', '', n);
    box.style.cssText = 'display:flex;align-items:center;color:#FFFFFF;flex:none';
    box.appendChild(D.icon('people', 38, 2.1));
  }
  const label = D.el('span', '', n, spec.label);
  label.style.cssText = 'display:inline-block';
  return n;
}

function stepArrow(parent) {
  const s = D.svg('svg', {
    viewBox: '0 0 78 28', width: 78, height: 28, fill: 'none',
  }, parent);
  s.style.cssText = 'flex:none;margin:0 18px;overflow:visible';
  const p = D.svg('path', {
    d: 'M 5 14 H 56 M 45 5.5 L 72 14 L 45 22.5',
    stroke: D.C.inkFaint, 'stroke-width': 3.4,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
  }, s);
  return D.revealPath(p);
}

export default {
  id: 'beat-03',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 566px';
    r.cam = cam;

    /* ---- ghost wordmark, furthest back: texture, never a headline -------- */
    const ghostClip = D.el('div', '', cam);
    D.place(ghostClip, 960, 792, 1580, 196);
    ghostClip.style.cssText +=
      'overflow:hidden;display:flex;align-items:center;justify-content:center';
    const ghost = D.el('div', '', ghostClip, 'marketing i bevægelse');
    ghost.style.cssText =
      'font-size:118px;font-weight:800;letter-spacing:-.038em;line-height:1.2;' +
      'color:#E8E8E2;white-space:nowrap;will-change:transform,opacity';
    r.ghostClip = ghostClip;
    r.ghost = ghost;

    /* ---- quiet headline, upper left --------------------------------------- */
    const head = D.el('div', '', cam);
    head.style.cssText =
      'position:absolute;left:302px;top:254px;will-change:transform,opacity';
    const rule = D.el('div', '', head);
    rule.style.cssText =
      `width:86px;height:6px;border-radius:3px;background:${D.C.red};` +
      'margin-bottom:26px;transform-origin:0 50%';
    const headLine = 'font-size:54px;font-weight:700;letter-spacing:-.024em;' +
      `line-height:1.15;color:${D.C.ink};white-space:nowrap`;
    const l1 = D.el('div', '', head);
    l1.style.cssText = headLine;
    const l2 = D.el('div', '', head);
    l2.style.cssText = headLine;
    r.headWords = [
      ...D.words(l1, 'AI ændrer mere end'),
      ...D.words(l2, 'vores værktøjer'),
    ];
    r.head = head;
    r.rule = rule;

    /* ---- the chain -------------------------------------------------------- */
    // pushWrap carries the screen-space motion blur; row carries the transform,
    // so the blur is never scaled up along with the run at the camera.
    const pushWrap = D.el('div', '', cam);
    pushWrap.style.cssText = 'position:absolute;inset:0;will-change:filter';
    r.pushWrap = pushWrap;
    // Directional smear: the run is horizontal, so blurring it isotropically
    // would just make the type mushy. pushWrap itself never transforms, so the
    // filter is applied in screen space and never scales with the row.
    r.rowBlur = D.makeDirBlur('b3row');

    const row = D.el('div', '', pushWrap);
    D.place(row, 960, 574);
    row.style.cssText += 'display:flex;align-items:center;white-space:nowrap';
    r.row = row;

    r.chips = [];
    r.arrows = [];
    STEPS.forEach((spec, i) => {
      if (i > 0) r.arrows.push(stepArrow(row));
      r.chips.push(stepChip(row, spec));
    });

    // Static shadows live on the element; the per-frame lift is written in
    // render() so the value is always a function of t.
    r.shadowRest = [D.SHADOW[2], D.SHADOW[2], D.SHADOW[2], D.SHADOW[3]];
    r.shadowLift = [D.SHADOW[3], D.SHADOW[3], D.SHADOW[3], D.SHADOW[4]];

    /* ---- measured geometry ------------------------------------------------ */
    const rowC = D.stageCenter(row);
    const edges = r.chips.map((c) => {
      const b = D.stageCenter(c);
      return { l: b.x - b.w / 2, r: b.x + b.w / 2, y: b.y };
    });
    // The row reserves its full width from the start, so it glides left as each
    // link joins — the chain that is actually on screen stays centred.
    r.shift = edges.map((e, k) => 960 - (edges[0].l + edges[k].r) / 2);
    // Scale the run about the red chip so it stays put while the rest sweeps by.
    row.style.transformOrigin =
      `${(edges[3].l + (edges[3].r - edges[3].l) / 2 - (rowC.x - rowC.w / 2)).toFixed(2)}px ` +
      `${(rowC.h / 2).toFixed(2)}px`;
    r.pushDX = 960 - (edges[3].l + edges[3].r) / 2;
    r.pushDY = 528 - edges[3].y;

    return r;
  },

  render(t, r) {
    /* ---- the run at the camera ------------------------------------------
     * One continuous accelerating gesture: the same curve drives the sideways
     * travel and the scale, so speed and size grow together and the beat is
     * still gaining on the cut into beat 4 (which takes over with scaleThrough).
     */
    const accFn = (u) => Math.pow(clamp((u - PUSH_T) / 0.95), 2.4);
    const acc = accFn(t);
    const rowScale = 1 + 2.20 * acc;

    /* ---- camera: still for the whole beat, a small lean at the end ------- */
    r.cam.style.transform = `scale(${(1 + 0.055 * seg(t, PUSH_T, 0.9, easeInCubic)).toFixed(5)})`;
    r.cam.style.opacity = '1';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---- headline: rule wipes out, then the words rise ------------------- */
    const ruleP = seg(t, 0.10, 0.42, easeOutQuint);
    r.rule.style.transform = `scaleX(${ruleP.toFixed(5)})`;
    r.rule.style.opacity = ruleP > 0.02 ? '1' : '0';

    const headOut = seg(t, PUSH_T + 0.34, 0.40, easeOutCubic);
    r.headWords.forEach((w, i) => {
      const p = spring(clamp((t - (0.18 + i * 0.05)) / 0.52), { freq: 1.05, damping: 0.70 });
      D.setT(w, {
        x: 0, y: lerp(52, 0, p), s: 1,
        o: seg(t, 0.18 + i * 0.05, 0.18, easeOutCubic),
        centered: false,
      });
    });
    D.setT(r.head, {
      x: -280 * headOut, y: 0, s: 1, o: 1 - headOut, centered: false,
    });

    /* ---- ghost wordmark wipes up from its own clip ------------------------ */
    const ghostP = seg(t, 1.20, 0.62, easeOutQuint);
    const ghostOut = seg(t, PUSH_T + 0.40, 0.40, easeOutCubic);
    D.setT(r.ghostClip, { x: 0, y: 0, s: 1, o: 1 });
    D.setT(r.ghost, {
      x: 0, y: lerp(150, 0, ghostP) + 70 * ghostOut, s: 1,
      o: (ghostP > 0.01 ? 1 : 0) * (1 - ghostOut),
      centered: false,
    });

    /* ---- the row: glide while it builds, then run at the camera ----------- */
    const shiftFn = (u) => {
      let v = r.shift[0];
      for (let k = 1; k < STEPS.length; k++) {
        v += (r.shift[k] - r.shift[k - 1]) * seg(u, ARROW_AT[k - 1] + 0.02, 0.52, easeInOutCubic);
      }
      return v;
    };
    // 1.5× the measured distance so the chip is still travelling, not parking,
    // at the exact frame beat 4 takes the cut.
    const rowXFn = (u) => shiftFn(u) + r.pushDX * 1.5 * accFn(u);
    const rx = rowXFn(t);
    const ry = r.pushDY * 1.5 * acc;
    const vx = M.velocity(rowXFn, t);
    const vs = M.velocity((u) => 1 + 2.20 * accFn(u), t);
    D.setT(r.row, { x: rx, y: ry, s: rowScale, o: 1 });
    const blur = clamp(Math.abs(vx) * 0.0026 + Math.abs(vs) * 340 * 0.0022, 0, 9);
    r.rowBlur.set(r.pushWrap, blur, blur * 0.20);

    /* ---- the three quiet links dim once the punchline lands -------------- */
    const dim = lerp(1, 0.66, seg(t, 3.68, 0.52, easeOutCubic));
    const dimArrow = lerp(1, 0.48, seg(t, 3.68, 0.52, easeOutCubic));

    r.arrows.forEach((a, i) => {
      const drawn = seg(t, ARROW_AT[i], 0.28, easeOutQuint);
      a.set(drawn);
      a.node.style.opacity = (Math.min(1, drawn * 7) * dimArrow).toFixed(4);
    });

    r.chips.forEach((c, i) => {
      const s = STEPS[i];
      const heavy = s.solid;
      const dur = heavy ? 0.60 : 0.52;
      const rise = heavy ? 74 : 46;
      const from = heavy ? 0.84 : 0.90;
      const inFn = (u) => spring(clamp((u - s.at) / dur), { freq: heavy ? 1.05 : 1.10, damping: heavy ? 0.61 : 0.68 });
      const inP = inFn(t);
      const say = pulse(t, s.say, 0.60, easeOutCubic);
      const land = heavy ? pulse(t, s.at + 0.30, 0.34, easeOutCubic) : 0;
      const base = lerp(from, 1, inP) * (1 + (heavy ? 0.05 : 0.038) * say);
      const chipBlur = clamp(Math.abs(M.velocity((u) => lerp(rise, 0, inFn(u)), t)) * 0.0055, 0, 8);
      D.setT(c, {
        x: 0, y: lerp(rise, 0, inP),
        sx: base * (1 + 0.05 * land),
        sy: base * (1 - 0.045 * land),
        o: seg(t, s.at, 0.17, easeOutCubic) * (heavy ? 1 : dim),
        blur: chipBlur,
        centered: false,
      });
      c.style.boxShadow = say > 0.06 ? r.shadowLift[i] : r.shadowRest[i];
    });
  },
};
