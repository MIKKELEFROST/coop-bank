/**
 * Beat 4 · 00:15.5–00:21.5 — "Mindre afdeling. Større slagkraft."
 *
 * VO: "For en mindre marketingafdeling som vores betyder det, at Coop Bank
 *      kan stå stærkere over for langt større spillere."
 * Cues (local t): 0.20 "For en mindre marketingafdeling som vores betyder det,"
 *                 3.00 "at Coop Bank kan stå stærkere over for langt større spillere."
 *
 * Composition: split frame. LEFT — three large anonymous grey blocks (the far
 * bigger players) establish first; the compact Coop Bank Marketing unit lands
 * small in front of them; four tinted agent modules connect one by one on a
 * ring and the unit's reach circle grows one step per connection until its
 * diameter matches the width of the whole competitor row. RIGHT — the headline
 * builds on the second cue. No conflict imagery: this is about scale.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInCubic,
        smoothstep, pulse } = M;

/* ------------------------------------------------------------------ *
 * Layout constants — all stage coordinates
 * ------------------------------------------------------------------ */

const CX = 526;            // centre of the Coop unit
const CY = 562;
const CARD_W = 340;
const CARD_H = 154;        // measured: title line + two sub lines + padding
const RING = 203;          // radius the four agent modules sit on

/** Reach radius after 0…4 connections. The last equals half the slab row. */
const AURA = [198, 222, 246, 271, 296];

/**
 * The larger players: plain grey volumes, no names, no logos. The row is
 * exactly as wide and as tall as the final reach circle, so the last step of
 * the growth lands on their scale.
 */
const SLAB_BOTTOM = 858;   // = CY + AURA[4]: the circle ends on their baseline
const SLABS = [
  { cx: 310, w: 160, h: 592, at: 0.03 },
  { cx: 526, w: 160, h: 470, at: 0.16 },
  { cx: 742, w: 160, h: 530, at: 0.29 },
];

/** Four agent modules, in the order they connect (clockwise from top-left). */
const MODS = [
  { label: 'Indsigter',  icon: 'chart',  color: D.C.blue,   tint: D.C.cardBlue,   dx: -118, dy: -165, at: 1.65 },
  { label: 'Content',    icon: 'pen',    color: D.C.red,    tint: D.C.cardRed,    dx:  118, dy: -165, at: 2.00 },
  { label: 'Optimering', icon: 'target', color: '#2FA55F',  tint: D.C.cardGreen,  dx:  118, dy:  165, at: 2.35 },
  { label: 'Strategi',   icon: 'decide', color: '#C08A15',  tint: D.C.cardYellow, dx: -118, dy:  165, at: 2.70 },
];

const RIGHT_X = 922;       // left edge of the headline column
const RIGHT_W = 768;

/** A clipped single-line block: the inner line slides up into view. */
function clipLine(parent, text, h, css, marginTop = 0) {
  const wrap = D.el('div', '', parent);
  wrap.style.cssText =
    `height:${h}px;overflow:hidden;padding:0 8px;margin:${marginTop}px 0 0 -8px`;
  const inner = D.el('div', '', wrap, text);
  inner.style.cssText = css + ';white-space:nowrap';
  return { wrap, inner, h };
}

/** One agent module: tinted pill, icon in the accent colour, Danish label. */
function agentPill(parent, spec) {
  const root = D.el('div', '', parent);
  root.style.cssText =
    `display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;` +
    `background:${spec.tint};border:1px solid rgba(21,21,21,.07);box-shadow:${D.SHADOW[2]};` +
    `white-space:nowrap`;
  const ic = D.el('div', '', root);
  ic.style.cssText =
    `width:30px;height:30px;flex:none;display:flex;align-items:center;` +
    `justify-content:center;color:${spec.color}`;
  ic.appendChild(D.icon(spec.icon, 26, 2.15));
  const label = D.el('div', '', root, spec.label);
  label.style.cssText = 'font-size:28px;font-weight:700;letter-spacing:-.015em;color:#151515';
  const ring = D.el('div', '', root);
  ring.style.cssText =
    `position:absolute;inset:-5px;border-radius:21px;border:2.5px solid ${spec.color};pointer-events:none`;
  return { root, ring };
}

export default {
  id: 'beat-04',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px';
    r.cam = cam;

    /* ---------- back layer: the competitor volumes ---------- */
    const back = D.svgLayer(cam);

    r.slabs = SLABS.map((s) => D.svg('rect', {
      x: s.cx - s.w / 2, y: SLAB_BOTTOM - s.h, width: s.w, height: s.h,
      rx: 26, fill: '#DEDED6', stroke: '#D3D3CA', 'stroke-width': 1.5,
    }, back));

    /* ---------- mid layer: reach, guide ring, ripples, arcs ---------- */
    const mid = D.svgLayer(cam);

    r.auraFill = D.svg('circle', {
      cx: CX, cy: CY, r: AURA[0], fill: 'rgba(227,6,19,.045)',
    }, mid);

    r.guide = D.revealPath(D.svg('path', {
      d: `M ${CX} ${CY - RING} A ${RING} ${RING} 0 1 1 ${CX} ${CY + RING} ` +
         `A ${RING} ${RING} 0 1 1 ${CX} ${CY - RING}`,
      stroke: '#DCDCD4', 'stroke-width': 2, fill: 'none',
    }, mid));

    r.auraRing = D.svg('circle', {
      cx: CX, cy: CY, r: AURA[0], fill: 'none',
      stroke: D.C.red, 'stroke-width': 2.6,
    }, mid);

    r.ripples = MODS.map(() => D.svg('circle', {
      cx: CX, cy: CY, r: AURA[0], fill: 'none',
      stroke: D.C.red, 'stroke-width': 2, opacity: 0,
    }, mid));

    const cardTop = CY - CARD_H / 2;
    const cardBot = CY + CARD_H / 2;
    r.arcs = MODS.map((m) => {
      const x1 = CX + (m.dx < 0 ? -60 : 60);
      const y1 = m.dy < 0 ? cardTop : cardBot;
      const x2 = CX + m.dx;
      const y2 = CY + m.dy + (m.dy < 0 ? 28 : -28);
      return D.revealPath(D.svg('path', {
        d: M.curveV(x1, y1, x2, y2, 0.62),
        stroke: m.color, 'stroke-width': 4.5, 'stroke-linecap': 'round', fill: 'none',
      }, mid));
    });

    /* ---------- label above the competitor row ---------- */
    r.bigLabel = clipLine(
      D.el('div', '', cam), 'STØRRE SPILLERE I MARKEDET', 30,
      'font-size:22px;font-weight:700;letter-spacing:.2em;line-height:30px;color:#9A9A95'
    );
    D.place(r.bigLabel.wrap.parentNode, 230 + 300, 199, 600);
    r.bigLabel.wrap.parentNode.style.textAlign = 'left';
    r.bigLabelBox = r.bigLabel.wrap.parentNode;

    /* ---------- four agent modules on the ring (behind the unit, so they
     *            travel out from under it) ---------- */
    r.mods = MODS.map((m) => {
      const p = agentPill(cam, m);
      D.place(p.root, CX + m.dx, CY + m.dy);
      return p;
    });

    /* ---------- the compact Coop unit ---------- */
    const card = D.el('div', '', cam);
    card.style.cssText =
      `width:${CARD_W}px;padding:20px 20px 20px 16px;border-radius:20px;background:#fff;` +
      `border:1px solid ${D.C.line};border-left:4px solid ${D.C.red};box-shadow:${D.SHADOW[3]}`;
    const cTitle = D.el('div', '', card, 'Coop Bank Marketing');
    cTitle.style.cssText = 'font-size:28px;font-weight:700;letter-spacing:-.018em;line-height:1.14;color:#151515';
    const cSub = D.el('div', '', card, 'Kompakt team · udvidet kapacitet');
    cSub.style.cssText = 'font-size:28px;font-weight:500;line-height:1.28;color:#5A5A57;margin-top:8px';
    D.place(card, CX, CY);
    r.card = card;

    /* ---------- right column ---------- */
    const block = D.el('div', '', cam);
    D.place(block, RIGHT_X + RIGHT_W / 2, 556, RIGHT_W);
    block.style.textAlign = 'left';
    r.block = block;

    r.kick = clipLine(block, 'KONKURRENCEKRAFT', 30,
      'font-size:22px;font-weight:700;letter-spacing:.2em;line-height:30px;color:#9A9A95');
    const H = 'font-size:96px;font-weight:800;letter-spacing:-.035em;line-height:1.06';
    r.hl1 = clipLine(block, 'Mindre afdeling.', 104, H + ';color:#151515', 24);
    r.hl2 = clipLine(block, 'Større slagkraft.', 104, H + ';color:' + D.C.red, 2);
    const L = 'font-size:33px;font-weight:500;letter-spacing:-.012em;line-height:1.34;color:#5A5A57';
    r.ld1 = clipLine(block, 'AI-agenter giver et mindre team mulighed for at', 46, L, 32);
    r.ld2 = clipLine(block, 'konkurrere stærkere med langt større spillere.', 46, L, 0);

    return r;
  },

  render(t, r) {
    /* ---------------- camera: one settle out of the scaleThrough ---------- */
    const settle = seg(t, 0, 0.75, easeOutQuint);
    r.cam.style.transform = `scale(${lerp(1.03, 1, settle).toFixed(5)})`;
    r.cam.style.opacity = '1';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---------------- the larger players establish first ------------------ */
    const dim = seg(t, 5.05, 0.75, easeOutCubic);
    r.slabs.forEach((node, i) => {
      const s = SLABS[i];
      const p = spring(clamp((t - s.at) / 0.62), { freq: 1.05, damping: 0.7 });
      const sy = lerp(0.66, 1, p);
      const dy = lerp(34, 0, p);
      const by = SLAB_BOTTOM;
      node.setAttribute(
        'transform',
        `translate(${s.cx.toFixed(3)} ${(by + dy).toFixed(3)}) ` +
        `scale(1 ${sy.toFixed(5)}) translate(${(-s.cx).toFixed(3)} ${(-by).toFixed(3)})`
      );
      node.setAttribute('opacity', (seg(t, s.at, 0.24, easeOutCubic) * lerp(1, 0.80, dim)).toFixed(4));
    });

    const bigP = seg(t, 0.62, 0.44, easeOutQuint);
    D.setT(r.bigLabelBox, { x: 0, y: 0, s: 1, o: 1 });
    D.setT(r.bigLabel.inner, { x: 0, y: lerp(30, 0, bigP), s: 1, o: 1, centered: false });

    /* ---------------- the compact unit lands ------------------------------ */
    const cardIn = spring(clamp((t - 0.78) / 0.66), { freq: 1.15, damping: 0.64 });
    const cardSay = pulse(t, 3.10, 0.6, easeOutCubic);   // "at Coop Bank …"
    D.setT(r.card, {
      x: 0, y: lerp(-16, 0, cardIn),
      s: lerp(0.62, 1, cardIn) * (1 + 0.028 * cardSay),
      o: seg(t, 0.78, 0.2, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(
        (u) => lerp(-16, 0, spring(clamp((u - 0.78) / 0.66), { freq: 1.15, damping: 0.64 })), t
      )) * 0.006, 0, 6),
    });

    /* ---------------- ring guide behind the modules ----------------------- */
    r.guide.set(seg(t, 1.10, 0.62, easeOutQuint));

    /* ---------------- reach grows one step per connection ----------------- */
    let R = AURA[0];
    for (let i = 0; i < MODS.length; i++) {
      R += (AURA[i + 1] - AURA[i]) * seg(t, MODS[i].at + 0.04, 0.46, easeOutQuint);
    }
    const claim = pulse(t, 5.15, 0.8, easeOutCubic);      // "langt større spillere"
    const Rr = R * (1 + 0.026 * claim);
    const auraOn = seg(t, 1.22, 0.42, easeOutCubic);
    const reached = (R - AURA[0]) / (AURA[4] - AURA[0]);

    r.auraFill.setAttribute('r', Rr.toFixed(2));
    r.auraFill.setAttribute('opacity', (auraOn * (0.55 + 0.45 * reached)).toFixed(4));
    r.auraRing.setAttribute('r', Rr.toFixed(2));
    r.auraRing.setAttribute('opacity',
      (auraOn * clamp(0.20 + 0.16 * reached + 0.26 * claim, 0, 1)).toFixed(4));

    r.ripples.forEach((node, i) => {
      const m = MODS[i];
      const p = seg(t, m.at + 0.06, 0.68, easeOutQuint);
      const on = smoothstep(m.at + 0.02, m.at + 0.10, t);
      node.setAttribute('r', lerp(AURA[i + 1], AURA[i + 1] + 58, p).toFixed(2));
      node.setAttribute('opacity', (0.34 * (1 - p) * on).toFixed(4));
    });

    /* ---------------- arcs draw, then modules travel out ------------------ */
    r.mods.forEach((mod, i) => {
      const m = MODS[i];
      r.arcs[i].set(seg(t, m.at - 0.26, 0.36, easeOutQuint));

      const inFn = (u) => spring(clamp((u - m.at + 0.30) / 0.64), { freq: 1.1, damping: 0.64 });
      const p = inFn(t);
      const say = clamp(pulse(t, m.at, 0.55, easeOutCubic)
        + 0.85 * pulse(t, 5.18 + i * 0.13, 0.46, easeOutCubic), 0, 1);
      const v = Math.abs(M.velocity((u) => lerp(-0.42 * m.dy, 0, inFn(u)), t));
      D.setT(mod.root, {
        x: lerp(-0.42 * m.dx, 0, p),
        y: lerp(-0.42 * m.dy, 0, p),
        s: lerp(0.76, 1, p) * (1 + 0.05 * say),
        o: seg(t, m.at - 0.30, 0.2, easeOutCubic),
        blur: clamp(v * 0.0038, 0, 9),
      });
      mod.root.style.boxShadow = say > 0.05 ? D.SHADOW[3] : D.SHADOW[2];
      mod.ring.style.opacity = (say * 0.85).toFixed(3);
      mod.ring.style.transform = `scale(${(1 + 0.035 * (1 - say)).toFixed(4)})`;
    });

    /* ---------------- right column builds on the second cue --------------- */
    D.setT(r.block, { x: 0, y: 0, s: 1, o: 1 });

    const kickP = seg(t, 3.02, 0.4, easeOutQuint);
    D.setT(r.kick.inner, { x: 0, y: lerp(30, 0, kickP), s: 1, o: 1, centered: false });

    const line = (ref, at) => {
      const fn = (u) => lerp(ref.h + 10, 0, spring(clamp((u - at) / 0.64), { freq: 1.05, damping: 0.7 }));
      D.setT(ref.inner, {
        x: 0, y: fn(t), s: 1, o: 1,
        blur: clamp(Math.abs(M.velocity(fn, t)) * 0.0055, 0, 8),
        centered: false,
      });
    };
    line(r.hl1, 3.30);   // "Coop Bank kan"
    line(r.hl2, 3.85);   // "stå stærkere"
    line(r.ld1, 4.58);
    line(r.ld2, 4.76);
  },
};
