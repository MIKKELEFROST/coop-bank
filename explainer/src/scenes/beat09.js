/**
 * Beat 9 · 00:41.5–00:46.0 — "Høj tillid kræver høj kontrol" (the dark beat)
 *
 * VO: "Jo mere vi overlader til AI, desto vigtigere bliver spørgsmålet om
 *      tillid og kontrol."
 * Cues (local t): 0.20 "Jo mere vi overlader til AI,"
 *                 1.80 "desto vigtigere bliver spørgsmålet om tillid og kontrol."
 *
 * The film's only dark sequence. A full-bleed #0B0B0C backdrop with a low
 * scanline overlay takes the frame on the darkDrop. The headline lands on the
 * left and is hit by one short, deterministic glitch (offset slices + a faint
 * red/blue channel split) between local t 0.10 and 0.30 — after 0.32 it is gone
 * and never returns. On the right a large Coop-red shield draws itself in two
 * symmetric halves around the agent core, then five dark chips snap in one at a
 * time, each with a short connector tick to the shield outline. The beat ends
 * completely still so it can slide up out of frame on beat 10's wipeUp.
 *
 * Determinism: every value below is a pure function of `t`. The glitch is
 * driven by M.hash01(Math.round(t * FPS)), the scene creates no DOM in render()
 * and every property it owns is written on every call.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
        smoothstep, pulse } = M;

/* ------------------------------------------------------------------ *
 * Layout — stage coordinates
 * ------------------------------------------------------------------ */

const LEFT_X = 322;          // left edge of the whole text column
const RULE_Y = 348;          // the short red rule above the headline
const HEAD_Y = 384;          // top of the headline block
const SUP_Y = 698;           // top of the supporting line
const SUP_LH = 46;           // one supporting line box

const SH = {                 // shield
  cx: 1300, top: 300, bottom: 730, left: 1140, right: 1460, midY: 500,
};
const CORE = { x: SH.cx, y: 498, size: 114 };

/** The supporting line, split so each half is revealed by its own mask. */
const SUP = [
  { text: 'Mennesket sætter rammerne', at: 2.46 },
  { text: 'og godkender resultatet.',  at: 2.58 },
];

/** Right half of the shield outline: top centre → bottom point. */
const D_RIGHT =
  `M 1300 300 L 1444 300 A 16 16 0 0 1 1460 316 L 1460 500 ` +
  `C 1460 618 1402 692 1300 730`;
/** Left half, mirrored, so the two draw outward together. */
const D_LEFT =
  `M 1300 300 L 1156 300 A 16 16 0 0 0 1140 316 L 1140 500 ` +
  `C 1140 618 1198 692 1300 730`;
/** Closed silhouette used for the very dark inner fill. */
const D_FILL =
  `M 1156 300 L 1444 300 A 16 16 0 0 1 1460 316 L 1460 500 ` +
  `C 1460 618 1402 692 1300 730 C 1198 692 1140 618 1140 500 ` +
  `L 1140 316 A 16 16 0 0 0 1156 300 Z`;

/**
 * The five governance chips. `at` is local seconds, `dx/dy` the outward offset
 * they travel in from, `ln` the connector tick and `dot` its shield-side end.
 * `base` is a permanent accent on the border, `hit` a second flash on the VO.
 */
const CHIPS = [
  { text: 'Tydelige regler',       ic: 'plan',   x: 1078, y: 232, at: 1.06,
    dx: -50, dy: -26, accent: D.C.red,   base: 0,    hit: 0,
    ln: 'M 1206 266 L 1178 302', dot: [1178, 302] },
  { text: 'Datagrænser',           ic: 'db',     x: 1500, y: 232, at: 1.40,
    dx:  50, dy: -26, accent: D.C.red,   base: 0,    hit: 0,
    ln: 'M 1394 266 L 1422 302', dot: [1422, 302] },
  { text: 'Kvalitetskontrol',      ic: 'target', x: 1040, y: 782, at: 1.74,
    dx: -50, dy:  26, accent: D.C.red,   base: 0,    hit: 0,
    ln: 'M 1168 746 L 1200 671', dot: [1200, 671] },
  { text: 'Menneskelig vurdering', ic: 'people', x: 1490, y: 782, at: 2.08,
    dx:  50, dy:  26, accent: D.C.red,   base: 0,    hit: 0,
    ln: 'M 1432 746 L 1400 671', dot: [1400, 671] },
  { text: 'Godkendelse krævet',    ic: 'check',  x: 1300, y: 886, at: 3.00,
    dx:   0, dy:  38, accent: D.C.green, base: 0.62, hit: 0.95,
    ln: 'M 1284 852 L 1246 706', dot: [1246, 706] },
];

/* ------------------------------------------------------------------ *
 * Local component factories (built from design.js primitives only)
 * ------------------------------------------------------------------ */

/** One copy of the two-line headline. Six identical copies drive the glitch. */
function headCopy(parent, cA, cB) {
  const root = D.el('div', '', parent);
  root.style.cssText =
    'position:absolute;left:0;top:0;width:900px;height:190px;will-change:transform,opacity';
  const base =
    'font-size:84px;font-weight:800;letter-spacing:-.030em;line-height:1.0;white-space:nowrap;';
  const l1 = D.el('div', '', root, 'Høj tillid kræver');
  l1.style.cssText = base + `color:${cA}`;
  const l2 = D.el('div', '', root, 'høj kontrol');
  l2.style.cssText = base + `color:${cB};margin-top:10px`;
  return { root, l1, l2 };
}

/** Dark governance chip with a coloured icon and an accent ring. */
function darkChip(parent, spec) {
  const root = D.el('div', '', parent);
  root.style.cssText =
    'display:inline-flex;align-items:center;gap:14px;padding:15px 26px;border-radius:16px;' +
    `background:${D.C.darkPanel};border:1px solid ${D.C.darkLine};color:${D.C.darkInk};` +
    'font-size:28px;font-weight:700;letter-spacing:-.015em;white-space:nowrap;' +
    'box-shadow:0 10px 34px rgba(0,0,0,.55)';
  const ic = D.el('div', '', root);
  ic.style.cssText = `display:flex;align-items:center;flex:none;color:${spec.accent}`;
  ic.appendChild(D.icon(spec.ic, 27, 2.1));
  const label = D.el('div', '', root, spec.text);
  const ring = D.el('div', '', root);
  ring.style.cssText =
    `position:absolute;inset:-3px;border-radius:19px;border:2px solid ${spec.accent};pointer-events:none`;
  return { root, ic, label, ring };
}

/* ------------------------------------------------------------------ *
 * Colour helper
 * ------------------------------------------------------------------ */

const _rgb = (h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];
function mix(a, b, p) {
  const A = _rgb(a), B = _rgb(b), q = clamp(p);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * q)},` +
         `${Math.round(A[1] + (B[1] - A[1]) * q)},` +
         `${Math.round(A[2] + (B[2] - A[2]) * q)})`;
}

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

export default {
  id: 'beat-09',

  build(root) {
    const r = {};

    /* ---- full-bleed dark backdrop, behind absolutely everything ---- */
    const bd = D.el('div', 'backdrop', root);
    bd.style.background = D.C.darkBg;
    r.bd = bd;
    root.style.background = D.C.darkBg;   // TEST

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px;' +
      `background:${D.C.darkBg}`;
    r.cam = cam;

    /* ---- a very quiet red pool behind the shield ----
       Deliberately confined to the right half: a full-bleed gradient layer
       behind the headline makes Chromium re-decide the text's antialiasing
       between renders, which breaks byte-identical out-of-order frames. ---- */
    const vig = D.el('div', '', cam);
    vig.style.cssText =
      'position:absolute;left:980px;right:0;top:0;bottom:0;' +
      'background:radial-gradient(640px 560px at 320px 500px, rgba(227,6,19,.07) 0%, rgba(227,6,19,0) 70%)';
    r.vig = vig;

    /* ---- shield + connector layer (below the DOM furniture) ---- */
    const gfx = D.svgLayer(cam);

    r.fill = D.svg('path', { d: D_FILL, fill: '#16161A', stroke: 'none' }, gfx);
    r.glow = D.svg('path', {
      d: D_FILL, fill: 'none', stroke: D.C.red, 'stroke-width': 14,
      'stroke-linejoin': 'round', opacity: 0,
    }, gfx);

    r.shR = D.revealPath(D.svg('path', {
      d: D_RIGHT, fill: 'none', stroke: D.C.red, 'stroke-width': 5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, gfx));
    r.shL = D.revealPath(D.svg('path', {
      d: D_LEFT, fill: 'none', stroke: D.C.red, 'stroke-width': 5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, gfx));

    // Two bright heads that ride the outline while it draws.
    r.headR = D.svg('circle', { r: 5, fill: '#FF5A63', opacity: 0 }, gfx);
    r.headL = D.svg('circle', { r: 5, fill: '#FF5A63', opacity: 0 }, gfx);

    r.links = CHIPS.map((c) => D.revealPath(D.svg('path', {
      d: c.ln, fill: 'none', stroke: c.accent, 'stroke-width': 3.2,
      'stroke-linecap': 'round', opacity: 0,
    }, gfx)));
    r.dots = CHIPS.map((c) => D.svg('circle', {
      cx: c.dot[0], cy: c.dot[1], r: 4.5, fill: c.accent, opacity: 0,
    }, gfx));

    /* ---- agent core inside the shield ---- */
    const coreGlow = D.el('div', '', cam);
    D.place(coreGlow, CORE.x, CORE.y, 250, 250);
    coreGlow.style.background =
      'radial-gradient(circle, rgba(227,6,19,.085) 0%, rgba(227,6,19,0) 62%)';
    coreGlow.style.borderRadius = '50%';
    r.coreGlow = coreGlow;

    const core = D.agentCore(cam, CORE.size);
    D.place(core.root, CORE.x, CORE.y);
    r.core = core;

    /* ---- headline: base + 2 channel ghosts + 3 glitch slices ---- */
    const hlWrap = D.el('div', '', cam);
    hlWrap.style.cssText =
      `position:absolute;left:${LEFT_X}px;top:${HEAD_Y}px;width:900px;height:190px;` +
      'will-change:transform,opacity';
    r.hlWrap = hlWrap;

    r.gR = headCopy(hlWrap, D.C.red, D.C.red);
    r.gB = headCopy(hlWrap, D.C.blue, D.C.blue);
    r.base = headCopy(hlWrap, D.C.darkInk, D.C.red);

    const SLICE = ['inset(0 0 63% 0)', 'inset(33% 0 31% 0)', 'inset(67% 0 0 0)'];
    r.slices = SLICE.map((clip) => {
      const c = headCopy(hlWrap, D.C.darkInk, D.C.red);
      c.root.style.clipPath = clip;
      return c;
    });
    // Everything that must move in lockstep with the base copy.
    r.copies = [r.gR, r.gB, r.base, ...r.slices];

    /* ---- short red rule above the headline ---- */
    const rule = D.el('div', '', cam);
    rule.style.cssText =
      `position:absolute;left:${LEFT_X}px;top:${RULE_Y}px;width:88px;height:5px;` +
      `background:${D.C.red};transform-origin:0 50%;border-radius:3px`;
    r.rule = rule;

    /* ---- supporting line: one mask per line, staggered ---- */
    r.sup = SUP.map((ln, i) => {
      const clip = D.el('div', '', cam);
      clip.style.cssText =
        `position:absolute;left:${LEFT_X}px;top:${SUP_Y + i * SUP_LH}px;` +
        `width:560px;height:${SUP_LH}px;overflow:hidden`;
      const txt = D.el('div', '', clip, ln.text);
      txt.style.cssText =
        `font-size:34px;font-weight:500;line-height:${SUP_LH}px;letter-spacing:-.012em;` +
        `white-space:nowrap;color:${D.C.darkInkSoft}`;
      return { clip, txt };
    });

    /* ---- the five chips ---- */
    r.chips = CHIPS.map((c) => {
      const n = darkChip(cam, c);
      D.place(n.root, c.x, c.y);
      return n;
    });

    /* ---- scanlines above the scene, brandmark above those ---- */
    const scan = D.el('div', 'scanlines', root);
    r.scan = scan;

    r.brand = brandmark(root, { dark: true });

    return r;
  },

  render(t, r) {
    /* ------------------------------------------------------------------ *
     * Camera — one small settle on the drop, then absolutely still.
     * ------------------------------------------------------------------ */
    const settle = seg(t, 0, 0.72, easeOutQuint);
    r.cam.style.transform = `scale(${lerp(1.030, 1, settle).toFixed(5)})`;

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ------------------------------------------------------------------ *
     * The one glitch — local t 0.10 … 0.30, gone for good afterwards.
     * ------------------------------------------------------------------ */
    const fr = Math.round(t * M.FPS);
    const gWin = M.window_(t, 0.095, 0.33, 0.03);
    const gate = M.hash01(fr, 3) > 0.28 ? 1 : 0;      // per-frame flicker
    const g = gWin * gate;

    /* ---- dark furniture ---- */
    r.bd.style.opacity = '1';
    r.scan.style.opacity = clamp(0.42 * seg(t, 0, 0.26, easeOutCubic) + 0.30 * g).toFixed(4);
    r.vig.style.opacity = '1';   // static: the dark ground arrives whole

    /* ------------------------------------------------------------------ *
     * Headline — one shared entrance written into all six copies.
     * ------------------------------------------------------------------ */
    const y1 = (u) => lerp(76, 0, spring(clamp(u / 0.42), { freq: 1.05, damping: 0.66 }));
    const y2 = (u) => lerp(76, 0, spring(clamp((u - 0.07) / 0.42), { freq: 1.05, damping: 0.66 }));
    const l1y = y1(t), l2y = y2(t);
    const l1o = seg(t, 0, 0.14, easeOutCubic);
    const l2o = seg(t, 0.07, 0.14, easeOutCubic);
    const l1b = clamp(Math.abs(M.velocity(y1, t)) * 0.005, 0, 9);
    const l2b = clamp(Math.abs(M.velocity(y2, t)) * 0.005, 0, 9);

    D.setT(r.hlWrap, {
      x: (M.hash01(fr, 51) * 2 - 1) * 7 * g, y: 0, s: 1, o: 1, centered: false,
    });

    for (let i = 0; i < r.copies.length; i++) {
      const c = r.copies[i];
      D.setT(c.l1, { x: 0, y: l1y, s: 1, o: l1o, blur: l1b, centered: false });
      D.setT(c.l2, { x: 0, y: l2y, s: 1, o: l2o, blur: l2b, centered: false });
    }

    // Channel split: red pulled left, blue pushed right, both only while g > 0.
    D.setT(r.gR.root, {
      x: -(5 + 7 * M.hash01(fr, 41)) * g, y: (M.hash01(fr, 43) * 2 - 1) * 3 * g,
      s: 1, o: 0.5 * g, centered: false,
    });
    D.setT(r.gB.root, {
      x: (5 + 7 * M.hash01(fr, 42)) * g, y: (M.hash01(fr, 44) * 2 - 1) * 3 * g,
      s: 1, o: 0.45 * g, centered: false,
    });
    // Base copy dims while the offset slices stand in for it.
    D.setT(r.base.root, { x: 0, y: 0, s: 1, o: 1 - 0.5 * g, centered: false });

    for (let i = 0; i < r.slices.length; i++) {
      D.setT(r.slices[i].root, {
        x: (M.hash01(fr, 21 + i) * 2 - 1) * 24 * g,
        y: (M.hash01(fr, 31 + i) * 2 - 1) * 4 * g,
        s: 1, o: g, centered: false,
      });
    }

    /* ---- red rule ---- */
    const ruleP = seg(t, 0.30, 0.34, easeOutQuint);
    r.rule.style.transform = `scaleX(${ruleP.toFixed(4)})`;
    r.rule.style.opacity = (ruleP > 0.01 ? 1 : 0).toFixed(3);

    /* ------------------------------------------------------------------ *
     * Shield — two halves draw outward from the top centre.
     * ------------------------------------------------------------------ */
    const draw = seg(t, 0.36, 0.58, easeOutQuint);
    const complete = seg(t, 0.90, 0.30, easeOutCubic);
    const flare = pulse(t, 0.92, 0.46, easeOutCubic);
    const trust = pulse(t, 3.52, 0.56, easeOutCubic);   // "tillid"
    const ctrl  = pulse(t, 3.96, 0.58, easeOutCubic);   // "kontrol"
    const lift  = clamp(flare + trust * 0.9 + ctrl);

    r.shR.set(draw);
    r.shL.set(draw);
    const strokeW = (5 + 1.6 * lift).toFixed(2);
    r.shR.node.style.strokeWidth = strokeW;
    r.shL.node.style.strokeWidth = strokeW;
    r.shR.node.style.opacity = (draw > 0.002 ? 1 : 0).toFixed(3);
    r.shL.node.style.opacity = (draw > 0.002 ? 1 : 0).toFixed(3);
    r.shR.node.style.stroke = mix(D.C.red, '#FF6A72', 0.55 * lift);
    r.shL.node.style.stroke = mix(D.C.red, '#FF6A72', 0.55 * lift);

    r.glow.style.opacity = (0.038 * complete + 0.085 * lift).toFixed(4);
    r.glow.style.strokeWidth = (14 + 9 * lift).toFixed(2);

    // Inner fill grows into place under the outline rather than fading alone.
    const fillP = seg(t, 0.54, 0.46, easeOutQuint);
    D.setS(r.fill, { x: 0, y: 0, s: lerp(0.94, 1, fillP), o: 0.96 * fillP, ox: SH.cx, oy: 520 });

    // Drawing heads ride the outline exactly where the dash ends.
    const headO = M.window_(t, 0.38, 0.90, 0.10) * (draw < 0.999 ? 1 : 0);
    const pR = D.pointOn(r.shR.node, draw, r.shR.len);
    const pL = D.pointOn(r.shL.node, draw, r.shL.len);
    r.headR.setAttribute('cx', pR.x.toFixed(2));
    r.headR.setAttribute('cy', pR.y.toFixed(2));
    r.headL.setAttribute('cx', pL.x.toFixed(2));
    r.headL.setAttribute('cy', pL.y.toFixed(2));
    r.headR.setAttribute('opacity', headO.toFixed(4));
    r.headL.setAttribute('opacity', headO.toFixed(4));
    r.headR.setAttribute('r', (5 + 2 * headO).toFixed(2));
    r.headL.setAttribute('r', (5 + 2 * headO).toFixed(2));

    /* ------------------------------------------------------------------ *
     * Agent core inside the shield
     * ------------------------------------------------------------------ */
    const coreIn = spring(clamp((t - 0.30) / 0.62), { freq: 1.1, damping: 0.64 });
    D.setT(r.core.root, {
      x: 0, y: 0,
      s: lerp(0.42, 1, coreIn) * (1 + 0.045 * flare + 0.055 * trust + 0.05 * ctrl),
      o: seg(t, 0.30, 0.18, easeOutCubic),
    });
    const ringOpen = seg(t, 0.88, 0.72, easeOutQuint);
    r.core.ring.style.transform =
      `scale(${(1 + 0.62 * ringOpen + 0.16 * trust + 0.20 * ctrl).toFixed(4)})`;
    r.core.ring.style.opacity =
      clamp(0.60 * (1 - 0.42 * ringOpen) + 0.40 * trust + 0.45 * ctrl).toFixed(4);
    D.setT(r.coreGlow, {
      x: 0, y: 0, s: lerp(0.7, 1, coreIn) * (1 + 0.10 * lift),
      o: clamp(0.62 * seg(t, 0.34, 0.6, easeOutCubic) + 0.30 * lift),
    });

    /* ------------------------------------------------------------------ *
     * Supporting line — a clip-height reveal, not a fade
     * ------------------------------------------------------------------ */
    for (let i = 0; i < r.sup.length; i++) {
      const p = seg(t, SUP[i].at, 0.44, easeOutQuint);
      D.setT(r.sup[i].clip, { x: 0, y: 0, s: 1, o: p > 0.02 ? 1 : 0, centered: false });
      D.setT(r.sup[i].txt, { x: 0, y: lerp(SUP_LH, 0, p), s: 1, o: 1, centered: false });
    }

    /* ------------------------------------------------------------------ *
     * Chips + their connector ticks
     * ------------------------------------------------------------------ */
    for (let i = 0; i < r.chips.length; i++) {
      const spec = CHIPS[i];
      const n = r.chips[i];
      const at = spec.at;

      const inFn = (u) => spring(clamp((u - at) / 0.56), { freq: 1.1, damping: 0.64 });
      const p = inFn(t);
      const mvx = (u) => lerp(spec.dx, 0, inFn(u));
      const mvy = (u) => lerp(spec.dy, 0, inFn(u));

      // The approval chip gets a second accent when the VO reaches "tillid".
      const say = clamp(pulse(t, at + 0.04, 0.46, easeOutCubic) + spec.hit * trust);

      D.setT(n.root, {
        x: mvx(t), y: mvy(t),
        s: lerp(0.88, 1, p) * (1 + 0.045 * say),
        o: seg(t, at - 0.02, 0.16, easeOutCubic),
        blur: clamp(
          Math.hypot(M.velocity(mvx, t), M.velocity(mvy, t)) * 0.004, 0, 8),
      });
      n.root.style.boxShadow =
        say > 0.05 ? '0 14px 44px rgba(0,0,0,.65)' : '0 10px 34px rgba(0,0,0,.55)';
      n.root.style.borderColor =
        mix(D.C.darkLine, spec.accent, clamp(spec.base * p + 0.75 * say));
      n.ring.style.opacity = (clamp(0.30 * spec.base * p + 0.85 * say)).toFixed(4);
      n.ring.style.transform = `scale(${(1 + 0.030 * (1 - say)).toFixed(4)})`;
      n.ic.style.transform = `scale(${(1 + 0.30 * say).toFixed(4)})`;
      n.ic.style.opacity = (0.72 + 0.28 * clamp(p + say)).toFixed(4);

      const link = seg(t, at + 0.03, 0.20, easeOutQuint);
      r.links[i].set(link);
      r.links[i].node.style.opacity =
        (link > 0.002 ? 0.55 + 0.45 * say : 0).toFixed(4);
      const dotP = spring(clamp((t - at - 0.18) / 0.36), { freq: 1.2, damping: 0.62 });
      r.dots[i].setAttribute('opacity', (dotP * (0.75 + 0.25 * say)).toFixed(4));
      r.dots[i].setAttribute('r', (4.5 * dotP * (1 + 0.35 * say)).toFixed(3));
    }
  },
};
