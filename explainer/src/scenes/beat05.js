/**
 * Beat 5 · 00:21.5–00:26.0 — "Bedre indsigter"
 *
 * VO: "Agenter kan analysere store datamængder, finde mønstre og give os
 *      bedre indsigter."
 * Cues (local t): 0.20 "Agenter kan analysere store datamængder, finde mønstre"
 *                 2.70 "og give os bedre indsigter."
 *
 * Composition: split frame. LEFT — kicker, the two-line headline
 * "Bedre / indsigter" and the supporting line; the headline literally opens a
 * gap between kicker and supporting text on the second cue. RIGHT — a white
 * "Marketingdata" card with a counting total.
 *
 * Motion: 210 data points fly in from the top, right and bottom edges as an
 * unorganised cloud that fills the card, then condense left-to-right into a
 * tight band along the trend line while the line itself draws through them and
 * the node markers pop. Noise points (every fourth) disperse outward and fade
 * instead of littering the frame. A blue "Mønster fundet" pill lands on the
 * rising end, then the headline builds and "indsigter" turns blue as it is
 * spoken.
 *
 * Every point's scatter comes from M.hash01(i, salt): same layout every render.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
        smoothstep, pulse, hash01, linear } = M;

/* ------------------------------------------------------------------ *
 * Layout — all stage coordinates
 * ------------------------------------------------------------------ */

const LEFT_X = 348;          // left edge of the text column
const LEFT_W = 552;

// Card box: x 900..1520, y 320..760.
const CARD_CX = 1210, CARD_CY = 540, CARD_W = 620, CARD_H = 440;

const PX0 = 936, PX1 = 1484;           // chart plot area
const PY_TOP = 492, PY_BOT = 716;

/** The trend: a believable series that dips twice and ends high. */
const VALUES = [0.16, 0.30, 0.22, 0.44, 0.36, 0.58, 0.70, 0.90];
const NODES = VALUES.map((v, k) => ({
  x: PX0 + (k * (PX1 - PX0)) / (VALUES.length - 1),
  y: PY_BOT - v * (PY_BOT - PY_TOP),
}));
const LAST = NODES[NODES.length - 1];

const GRID_Y = [670, 614, 558, 502];

const PILL_X = 1344, PILL_Y = 457;

const N_DOTS = 210;                    // swarm size
const CLOUD_L = 915, CLOUD_R = 1505;   // unorganised cloud extent
const CLOUD_T = 478, CLOUD_B = 726;

const TOTAL = 42680;

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** Catmull-Rom through the points, emitted as cubic beziers. */
function smoothPath(pts, tension = 0.92) {
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[0];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || pts[pts.length - 1];
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)},` +
         ` ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Danish thousands separator: 42680 -> "42.680". */
function daNum(n) {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '.';
    out += s[i];
  }
  return out;
}

/** ink -> blue, as a css colour string. */
function inkToBlue(p) {
  const r = Math.round(lerp(21, 49, p));
  const g = Math.round(lerp(21, 91, p));
  const b = Math.round(lerp(21, 255, p));
  return `rgb(${r},${g},${b})`;
}

/**
 * A single-line block that reveals by sliding its inner line up into a clipped
 * wrapper — movement, not a fade. The inner span is measurable.
 */
function clipLine(parent, text, h, css, marginTop = 0) {
  const wrap = D.el('div', '', parent);
  wrap.style.cssText =
    `height:${h}px;overflow:hidden;padding:0 10px;margin:${marginTop}px 0 0 -10px`;
  const inner = D.el('div', '', wrap);
  inner.style.cssText = 'white-space:nowrap;will-change:transform';
  const span = D.el('span', '', inner, text);
  span.style.cssText = css + ';display:inline-block;white-space:nowrap';
  return { wrap, inner, span, h };
}

export default {
  id: 'beat-05',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px';
    r.cam = cam;

    /* ---------------- the data card ---------------- */
    const card = D.el('div', '', cam);
    card.style.cssText =
      `width:${CARD_W}px;height:${CARD_H}px;border-radius:26px;background:#fff;` +
      `border:1px solid ${D.C.line};box-shadow:${D.SHADOW[3]}`;
    D.place(card, CARD_CX, CARD_CY);
    r.card = card;

    const header = D.el('div', '', cam);
    D.place(header, CARD_CX, 374, PX1 - PX0);
    header.style.cssText +=
      'display:flex;align-items:flex-end;justify-content:space-between';
    const lbl = D.el('div', '', header, 'Marketingdata');
    lbl.style.cssText =
      'font-size:28px;font-weight:600;color:#5A5A57;letter-spacing:-.01em;line-height:1';
    const num = D.el('div', '', header, '0');
    num.style.cssText =
      'font-size:46px;font-weight:800;color:#151515;letter-spacing:-.03em;' +
      'line-height:1;font-variant-numeric:tabular-nums';
    r.header = header; r.lbl = lbl; r.num = num;

    /* ---------------- chart, back layer ---------------- */
    const back = D.svgLayer(cam);
    const backG = D.svg('g', {}, back);
    r.backG = backG;

    const defs = D.svg('defs', {}, back);
    const clip = D.svg('clipPath', { id: 'b5-area-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
    r.clipRect = D.svg('rect', {
      x: PX0 - 6, y: PY_TOP - 40, width: 0, height: (PY_BOT - PY_TOP) + 60,
    }, clip);

    r.gridG = D.svg('g', {}, backG);
    GRID_Y.forEach((y) => D.svg('line', {
      x1: PX0, y1: y, x2: PX1, y2: y,
      stroke: '#EFEFE9', 'stroke-width': 1.6,
    }, r.gridG));

    r.baseline = D.revealPath(D.svg('path', {
      d: `M ${PX0} ${PY_BOT} L ${PX1} ${PY_BOT}`,
      stroke: '#E1E1DA', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none',
    }, backG));

    const lineD = smoothPath(NODES);
    r.area = D.svg('path', {
      d: `${lineD} L ${PX1} ${PY_BOT} L ${PX0} ${PY_BOT} Z`,
      fill: 'rgba(49,91,255,.085)', stroke: 'none',
      'clip-path': 'url(#b5-area-clip)',
    }, backG);

    /* ---------------- the swarm ---------------- */
    const dotsLayer = D.svgLayer(cam);
    const dotsG = D.svg('g', {}, dotsLayer);
    r.dotsG = dotsG;

    // A hidden reference copy of the trend line, only used to sample targets.
    const probe = D.svg('path', { d: lineD, fill: 'none', stroke: 'none' }, dotsLayer);
    const probeLen = probe.getTotalLength ? probe.getTotalLength() : 600;

    const K = N_DOTS - Math.floor(N_DOTS / 4);   // number of "signal" points
    let ki = 0;
    r.dots = [];

    for (let i = 0; i < N_DOTS; i++) {
      const h1 = hash01(i, 11);
      const h2 = hash01(i, 23);
      const h3 = hash01(i, 37);
      const h4 = hash01(i, 51);
      const h5 = hash01(i, 67);
      const h6 = hash01(i, 83);

      // Entry: top, right or bottom edge — never across the headline column.
      let ex, ey;
      if (h1 < 0.42) {                      // right
        ex = 2000 + h2 * 190;
        ey = lerp(150, 930, h3);
      } else if (h1 < 0.71) {               // top
        ex = lerp(400, 1810, h2);
        ey = -70 - h3 * 190;
      } else {                              // bottom
        ex = lerp(400, 1810, h2);
        ey = 1150 + h3 * 190;
      }

      // Unorganised cloud filling the card.
      const cx0 = lerp(CLOUD_L, CLOUD_R, h4);
      const cy0 = lerp(CLOUD_T, CLOUD_B, h5);

      const keep = i % 4 !== 3;
      let fx, fy, sweepU, fadeAt, fadeDur, fill, alpha, rad;

      if (keep) {
        const u = clamp((ki + 0.5 + (h3 - 0.5) * 0.85) / K, 0, 1);
        ki++;
        const pt = D.pointOn(probe, u, probeLen);
        fx = pt.x + (h6 - 0.5) * 7;
        fy = pt.y + (h2 - 0.5) * 27;
        sweepU = u;
        fadeAt = 2.02 + u * 0.20;
        fadeDur = 0.44;
        fill = D.C.blue;
        alpha = 0.42 + h5 * 0.48;
        rad = 3.0 + h6 * 1.7;
      } else {
        // Noise: pushed outward from the card centre, then gone.
        fx = cx0 + (cx0 - CARD_CX) * 0.30;
        fy = cy0 + (cy0 - CARD_CY) * 0.34;
        sweepU = clamp((cx0 - CLOUD_L) / (CLOUD_R - CLOUD_L), 0, 1);
        fadeAt = 1.24 + sweepU * 0.46;
        fadeDur = 0.40;
        fill = '#B6B9C2';
        alpha = 0.32 + h5 * 0.32;
        rad = 2.5 + h6 * 1.5;
      }

      const node = D.svg('circle', {
        cx: ex, cy: ey, r: rad.toFixed(2), fill, opacity: 0,
      }, dotsG);

      r.dots.push({
        node, ex, ey, cx0, cy0, fx, fy, alpha,
        t1: 0.13 + h1 * 0.30 + i * 0.0011,          // edge -> cloud
        t2: 0.98 + sweepU * 0.62 + h4 * 0.06,       // cloud -> order (L→R sweep)
        appearAt: 0.11 + h1 * 0.30 + i * 0.0011,
        fadeAt, fadeDur,
      });
    }

    /* ---------------- chart, front layer ---------------- */
    const front = D.svgLayer(cam);
    const frontG = D.svg('g', {}, front);
    r.frontG = frontG;

    r.guide = D.svg('line', {
      x1: LAST.x, y1: LAST.y, x2: LAST.x, y2: LAST.y,
      stroke: D.C.blue, 'stroke-width': 2.2,
      'stroke-dasharray': '3 9', 'stroke-linecap': 'round', opacity: 0,
    }, frontG);

    r.line = D.revealPath(D.svg('path', {
      d: lineD, stroke: D.C.blue, 'stroke-width': 5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
    }, frontG));

    r.halo = D.svg('circle', {
      cx: LAST.x, cy: LAST.y, r: 10, fill: 'none',
      stroke: D.C.blue, 'stroke-width': 2.4, opacity: 0,
    }, frontG);

    r.marks = NODES.map((n, k) => D.svg('circle', {
      cx: n.x, cy: n.y, r: k === NODES.length - 1 ? 10 : 8.5,
      fill: k === NODES.length - 1 ? D.C.blue : '#FFFFFF',
      stroke: D.C.blue, 'stroke-width': 4, opacity: 0,
    }, frontG));

    /* ---------------- "Mønster fundet" pill ---------------- */
    const pill = D.el('div', '', cam);
    pill.style.cssText =
      'display:inline-flex;align-items:center;gap:10px;padding:12px 22px;' +
      `border-radius:999px;background:${D.C.blue};color:#fff;white-space:nowrap;` +
      'box-shadow:0 10px 26px rgba(49,91,255,.30)';
    pill.appendChild(D.icon('spark', 22, 2.4));
    const ptxt = D.el('div', '', pill, 'Mønster fundet');
    ptxt.style.cssText = 'font-size:28px;font-weight:700;letter-spacing:-.015em';
    D.place(pill, PILL_X, PILL_Y);
    r.pill = pill;

    /* ---------------- left column ---------------- */
    const block = D.el('div', '', cam);
    D.place(block, LEFT_X + LEFT_W / 2, 540, LEFT_W);
    block.style.textAlign = 'left';
    r.block = block;

    r.kick = clipLine(block, 'ANALYSE OG INDSIGT', 30,
      'font-size:22px;font-weight:700;letter-spacing:.2em;line-height:30px;color:#9A9A95');

    const H = 'font-size:100px;font-weight:800;letter-spacing:-.035em;line-height:118px';
    r.hl1 = clipLine(block, 'Bedre', 118, H + ';color:#151515', 28);
    r.hl2 = clipLine(block, 'indsigter', 118, H + ';color:#151515', 0);

    const supWrap = D.el('div', '', block);
    supWrap.style.cssText = 'margin-top:56px;will-change:transform';
    r.supWrap = supWrap;
    const S = 'font-size:34px;font-weight:500;letter-spacing:-.012em;line-height:48px;color:#5A5A57';
    r.sup1 = clipLine(supWrap, 'Store datamængder bliver til', 48, S);
    r.sup2 = clipLine(supWrap, 'tydelige mønstre.', 48, S);

    /* ---------------- the blue rule under "indsigter" ---------------- */
    const m = D.stageCenter(r.hl2.span);
    const ulW = Math.max(60, m.w - 5);   // trim the trailing side bearing
    const ul = D.el('div', '', cam);
    ul.style.cssText =
      `position:absolute;left:${LEFT_X}px;top:${(m.y + m.h / 2 + 6).toFixed(1)}px;` +
      `width:${ulW.toFixed(1)}px;height:9px;border-radius:5px;background:${D.C.blue};` +
      'transform-origin:0% 50%;will-change:transform,opacity';
    r.ul = ul;

    return r;
  },

  render(t, r) {
    /* ---------------- camera: one settle out of the whip-up -------------- */
    r.cam.style.transform = `scale(${lerp(1.022, 1, seg(t, 0, 0.8, easeOutQuint)).toFixed(5)})`;
    r.cam.style.opacity = '1';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---------------- the card settles last out of the transition -------- */
    const cardIn = spring(clamp(t / 0.66), { freq: 1.05, damping: 0.70 });
    const cdy = lerp(38, 0, cardIn);

    D.setT(r.card, { x: 0, y: cdy, s: 1, o: 1, blur: 0 });
    D.setT(r.header, { x: 0, y: cdy, s: 1, o: 1, blur: 0 });
    D.setS(r.backG, { x: 0, y: cdy, s: 1, o: 1 });
    D.setS(r.frontG, { x: 0, y: cdy, s: 1, o: 1 });

    /* ---------------- card header: label + counting total ---------------- */
    const lblP = spring(clamp((t - 0.16) / 0.5), { freq: 1.1, damping: 0.72 });
    D.setT(r.lbl, {
      x: 0, y: lerp(16, 0, lblP), s: 1,
      o: seg(t, 0.16, 0.20, easeOutCubic), centered: false,
    });

    const countP = seg(t, 0.38, 0.92, easeOutQuint);
    r.num.textContent = daNum(Math.round(TOTAL * countP));
    const numSay = pulse(t, 1.38, 0.46, easeOutCubic);
    D.setT(r.num, {
      x: 0, y: lerp(18, 0, spring(clamp((t - 0.38) / 0.5), { freq: 1.1, damping: 0.7 })),
      s: 1 + 0.035 * numSay,
      o: seg(t, 0.38, 0.18, easeOutCubic), centered: false, origin: '100% 50%',
    });

    /* ---------------- grid + baseline: the empty dashboard --------------- */
    r.gridG.setAttribute('opacity', seg(t, 0.20, 0.42, easeOutCubic).toFixed(4));
    r.baseline.set(seg(t, 0.18, 0.46, easeOutQuint));

    /* ---------------- the swarm ------------------------------------------ */
    // One group-level blur derived from the median travel — zero once settled.
    const flyFn = (u) => 760 * seg(u, 0.30, 0.44, easeOutCubic);
    const snapFn = (u) => 190 * seg(u, 1.28, 0.44, easeInOutCubic);
    const swarmBlur =
      clamp(Math.abs(M.velocity(flyFn, t)) * 0.0042, 0, 5.5) +
      clamp(Math.abs(M.velocity(snapFn, t)) * 0.0042, 0, 1.8);
    r.dotsG.style.filter = swarmBlur > 0.05 ? `blur(${swarmBlur.toFixed(2)}px)` : 'none';

    for (let i = 0; i < r.dots.length; i++) {
      const d = r.dots[i];
      const p1 = seg(t, d.t1, 0.46, easeOutCubic);
      const p2 = seg(t, d.t2, 0.44, easeInOutCubic);
      const bx = lerp(d.ex, d.cx0, p1);
      const by = lerp(d.ey, d.cy0, p1);
      const o = seg(t, d.appearAt, 0.14, easeOutCubic) *
                (1 - seg(t, d.fadeAt, d.fadeDur, easeInOutCubic)) * d.alpha;
      d.node.setAttribute('cx', lerp(bx, d.fx, p2).toFixed(2));
      d.node.setAttribute('cy', lerp(by, d.fy, p2).toFixed(2));
      d.node.setAttribute('opacity', o.toFixed(4));
    }

    /* ---------------- the line draws through the condensing cloud -------- */
    const drawP = seg(t, 1.20, 0.74, linear);
    r.line.set(drawP);
    r.line.node.style.opacity = seg(t, 1.20, 0.10, easeOutCubic).toFixed(4);
    r.clipRect.setAttribute('width', (drawP * (PX1 - PX0 + 14)).toFixed(2));
    r.area.setAttribute('opacity', seg(t, 1.26, 0.40, easeOutCubic).toFixed(4));

    /* ---------------- node markers pop, left to right -------------------- */
    for (let k = 0; k < r.marks.length; k++) {
      const at = 1.30 + k * 0.076;
      const p = spring(clamp((t - at) / 0.46), { freq: 1.2, damping: 0.62 });
      const say = k === r.marks.length - 1 ? pulse(t, 2.46, 0.52, easeOutCubic) : 0;
      D.setS(r.marks[k], {
        x: 0, y: 0, s: p * (1 + 0.22 * say),
        o: seg(t, at, 0.14, easeOutCubic),
        ox: NODES[k].x, oy: NODES[k].y,
      });
    }

    /* ---------------- the highlighted point --------------------------- */
    const guideP = seg(t, 2.16, 0.44, easeOutCubic);
    r.guide.setAttribute('y2', lerp(LAST.y, PY_BOT, guideP).toFixed(2));
    r.guide.setAttribute('opacity', (0.6 * seg(t, 2.16, 0.18, easeOutCubic)).toFixed(4));

    const haloP = seg(t, 2.44, 0.66, easeOutQuint);
    r.halo.setAttribute('r', lerp(11, 40, haloP).toFixed(2));
    r.halo.setAttribute('opacity', (0.55 * (1 - haloP) * smoothstep(2.40, 2.48, t)).toFixed(4));

    /* ---------------- "Mønster fundet" lands on the second cue ----------- */
    const pillIn = spring(clamp((t - 2.42) / 0.62), { freq: 1.05, damping: 0.64 });
    const pillV = Math.abs(M.velocity(
      (u) => lerp(30, 0, spring(clamp((u - 2.42) / 0.62), { freq: 1.05, damping: 0.64 })), t));
    D.setT(r.pill, {
      x: 0, y: cdy + lerp(30, 0, pillIn),
      s: lerp(0.80, 1, pillIn),
      o: seg(t, 2.42, 0.18, easeOutCubic),
      blur: clamp(pillV * 0.004, 0, 6),
    });

    /* ---------------- left column ---------------------------------------- */
    D.setT(r.block, { x: 0, y: 0, s: 1, o: 1 });

    // The headline opens a gap between the kicker and the supporting line.
    const open = spring(clamp((t - 2.92) / 0.72), { freq: 1.0, damping: 0.70 });
    D.setT(r.kick.wrap, { x: 0, y: lerp(138, 0, open), s: 1, o: 1, centered: false });
    D.setT(r.supWrap, { x: 0, y: lerp(-138, 0, open), s: 1, o: 1, centered: false });

    const kickP = spring(clamp((t - 0.14) / 0.54), { freq: 1.05, damping: 0.72 });
    D.setT(r.kick.inner, { x: 0, y: lerp(32, 0, kickP), s: 1, o: 1, centered: false });

    const supLine = (ref, at, d = 0.60) => {
      const fn = (u) => lerp(ref.h + 8, 0,
        spring(clamp((u - at) / d), { freq: 1.05, damping: 0.72 }));
      D.setT(ref.inner, {
        x: 0, y: fn(t), s: 1, o: 1,
        blur: clamp(Math.abs(M.velocity(fn, t)) * 0.0035, 0, 5),
        centered: false,
      });
    };
    supLine(r.sup1, 0.80);          // "store datamængder"
    supLine(r.sup2, 2.00);          // "finde mønstre"
    supLine(r.hl1, 3.16, 0.52);     // "bedre"
    supLine(r.hl2, 3.42, 0.52);     // "indsigter"

    // "indsigter" turns blue as it is spoken, with the rule sweeping under it.
    const blueP = seg(t, 3.74, 0.34, easeOutCubic);
    r.hl1.span.style.color = '#151515';
    r.hl2.span.style.color = inkToBlue(blueP);

    const sweep = seg(t, 3.78, 0.38, easeOutQuint);
    D.setT(r.ul, {
      x: 0, y: 0, sx: sweep, sy: 1,
      o: Math.min(1, sweep * 26), centered: false,
    });
  },
};
