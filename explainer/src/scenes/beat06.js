/**
 * Beat 6 · 00:26.0–00:30.5 — "Analysér · Test · Forbedr"
 *
 * VO: "De kan løbende analysere, teste og anbefale forbedringer – hurtigere og
 *      mere ensartet."
 * Cues (local t): 0.20 "De kan løbende analysere, teste og anbefale forbedringer"
 *                 2.90 "– hurtigere og mere ensartet."
 *
 * Composition: three white UI cards in a row at mid height, joined by two dark
 * circular arrow buttons. A "pass" travels 1 → 2 → 3: the receiving card's top
 * accent bar fills, the button between them flashes red and its arrow shoots
 * forward, and the card's interface state ticks over (bar chart finds a new
 * outlier, the A/B chip flips kører → afsluttet, the percentage counts up and
 * the recommendation confirms). After the first, slow pass a loop line draws
 * back underneath the row and two much faster passes run — that acceleration is
 * the "hurtigere og mere ensartet" of the voiceover. The third pass settles and
 * the frame is then dead still for the last second.
 *
 * Every value below is a pure function of t: the pass schedule is data, card
 * state is derived from it with seg/band/pulse, and the counter text is
 * recomputed (never accumulated) on every call.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
        smoothstep, pulse } = M;

/* ------------------------------------------------------------------ *
 * Layout — all stage coordinates
 * ------------------------------------------------------------------ */

const CARD_W = 404;
const CARD_H = 326;
const CARD_Y = 620;
const CX = [470, 960, 1450];
const PAD = 30;
const INNER = CARD_W - PAD * 2;              // 344

const BTN = [
  (CX[0] + CARD_W / 2 + CX[1] - CARD_W / 2) / 2,   // 715
  (CX[1] + CARD_W / 2 + CX[2] - CARD_W / 2) / 2,   // 1205
];
const BTN_R = 27;

const CARD_BOT = CARD_Y + CARD_H / 2;        // 783

/** The loop line that runs back from card 3 to card 1, ending in an arrowhead. */
const LOOP_D =
  `M ${CX[2]} ${CARD_BOT + 12} C ${CX[2]} 892, 1230 886, 960 886 ` +
  `C 690 886, ${CX[0]} 892, ${CX[0]} ${CARD_BOT + 27}`;
const LOOP_HEAD_D =
  `M ${CX[0]} ${CARD_BOT + 9} L ${CX[0] + 10} ${CARD_BOT + 27} L ${CX[0] - 10} ${CARD_BOT + 27} Z`;

/* ------------------------------------------------------------------ *
 * The loop schedule. c = [card1, card2, card3] tick times, local seconds.
 * Pass 1 runs at speaking pace; passes 2 and 3 are deliberately much faster.
 * ------------------------------------------------------------------ */

const PASSES = [
  { c: [0.88, 1.45, 2.05], run: 0.38, pct: 12 },   // "analysere … teste … forbedringer"
  { c: [2.80, 3.02, 3.26], run: 0.16, pct: 26 },   // "– hurtigere"
  { c: [3.44, 3.62, 3.82], run: 0.14, pct: 37 },   // "og mere ensartet"
];

/** Return sweeps along the loop line, between passes. */
const RETURNS = [[2.16, 0.58], [3.30, 0.13]];

const STEPS = [
  {
    over: '01 · ANALYSÉR', title: 'Find mønstret',
    body: 'Agenten opdager afvigelser og potentiale.',
    color: D.C.blue, at: 0.24,
  },
  {
    over: '02 · TEST', title: 'Sammenlign',
    body: 'Variationer testes mod det samme mål.',
    color: '#C08A15', at: 0.33,
  },
  {
    over: '03 · FORBEDR', title: 'Vinderen skaleres',
    body: 'Anbefalingen er klar til godkendelse.',
    color: '#2FA55F', at: 0.42,
  },
];

/** Bar-chart states: resting, then one per pass. The outlier walks right. */
const BARS = [
  [16, 24, 19, 27, 21, 30, 18, 23],
  [20, 27, 15, 24, 46, 26, 22, 19],
  [23, 18, 30, 21, 28, 49, 20, 25],
  [19, 29, 22, 17, 26, 24, 31, 52],
];
const BAR_HL = [4, 5, 7];
const BAR_GREY = '#D3D3CB';
const BAR_W = 28;
const BAR_STEP = 45.15;

/* ------------------------------------------------------------------ *
 * Small pure helpers
 * ------------------------------------------------------------------ */

const rgbOf = (h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];
function mix(a, b, k) {
  const A = rgbOf(a), B = rgbOf(b), q = clamp(k);
  return `rgb(${Math.round(lerp(A[0], B[0], q))},${Math.round(lerp(A[1], B[1], q))},${Math.round(lerp(A[2], B[2], q))})`;
}
/** 1 inside [a,b], 0 outside, soft shoulders — a pure window on t. */
const band = (t, a, b, fade = 0.05) =>
  smoothstep(a - fade, a + fade, t) * (1 - smoothstep(b - fade, b + fade, t));

/**
 * Per-card "this step is the current one" weight. The off ramp of one card is
 * the on ramp of the next, so the three weights always sum to exactly one once
 * the loop has started — which keeps the headline slider from ever dipping out.
 */
const HANDOVER = 0.18;
function activeWindows(i) {
  return PASSES.map((p, k) => {
    const on = p.c[i];
    const off = i < 2
      ? p.c[i + 1]
      : (k < PASSES.length - 1 ? PASSES[k + 1].c[0] : Infinity);
    return [on, off];
  });
}

/* ------------------------------------------------------------------ *
 * Components
 * ------------------------------------------------------------------ */

/** One numbered step card. Ring lives outside the clipped body. */
function stepCard(parent, spec) {
  const wrap = D.el('div', '', parent);

  const ring = D.el('div', '', wrap);
  ring.style.cssText =
    `position:absolute;inset:-6px;border-radius:30px;border:2.5px solid ${spec.color};` +
    `pointer-events:none`;

  const body = D.el('div', '', wrap);
  body.style.cssText =
    `position:absolute;inset:0;border-radius:24px;background:#fff;` +
    `border:1px solid ${D.C.line};overflow:hidden;padding:${PAD}px`;

  const accent = D.el('div', '', body);
  accent.style.cssText =
    `position:absolute;left:0;top:0;width:${CARD_W}px;height:7px;` +
    `background:${spec.color};transform-origin:0 50%`;

  const row = D.el('div', '', body);
  row.style.cssText =
    'position:relative;display:flex;align-items:center;justify-content:space-between;height:46px';
  const over = D.el('div', '', row, spec.over);
  over.style.cssText =
    `font-size:24px;font-weight:800;letter-spacing:.13em;line-height:1;color:${spec.color}`;
  const rightSlot = D.el('div', '', row);
  rightSlot.style.cssText = 'text-align:right;line-height:1';

  const title = D.el('div', '', body, spec.title);
  title.style.cssText =
    'font-size:36px;font-weight:800;letter-spacing:-.022em;line-height:44px;height:44px;' +
    'color:#151515;white-space:nowrap;margin-top:12px;overflow:hidden';

  const text = D.el('div', '', body, spec.body);
  text.style.cssText =
    'font-size:29px;font-weight:500;letter-spacing:-.008em;line-height:39px;height:80px;' +
    'color:#5A5A57;margin-top:10px;overflow:hidden';

  const foot = D.el('div', '', body);
  foot.style.cssText =
    `position:absolute;left:${PAD}px;bottom:26px;width:${INNER}px;height:52px`;

  return { wrap, ring, body, accent, over, rightSlot, title, text, foot };
}

/** A fixed-size status chip whose alternative states are stacked and faded. */
function statusChip(parent, w, states) {
  const root = D.el('div', '', parent);
  root.style.cssText =
    `position:absolute;left:0;top:1px;width:${w}px;height:50px;border-radius:14px;` +
    `background:#FBFBF8;border:1px solid ${D.C.line}`;
  const rows = states.map((s) => {
    const row = D.el('div', '', root);
    row.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;gap:12px;padding:0 20px';
    if (s.icon) {
      const ic = D.el('span', '', row);
      ic.style.cssText = `display:flex;align-items:center;color:${s.color};flex:none`;
      ic.appendChild(D.icon(s.icon, 24, 2.8));
    } else {
      const dot = D.el('span', '', row);
      dot.style.cssText =
        `width:14px;height:14px;border-radius:50%;flex:none;background:${s.color}`;
    }
    const lab = D.el('span', '', row, s.text);
    lab.style.cssText =
      `font-size:28px;font-weight:700;letter-spacing:-.012em;white-space:nowrap;color:${s.ink}`;
    return row;
  });
  return { root, rows };
}

export default {
  id: 'beat-06',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 560px';
    r.cam = cam;

    /* ---------------- headline ---------------- */
    const h = D.el('div', 'h2', cam);
    D.place(h, 960, 246);
    h.style.whiteSpace = 'nowrap';
    const PARTS = ['Analysér', '·', 'Test', '·', 'Forbedr'];
    r.hParts = PARTS.map((txt, i) => {
      const outer = D.el('span', 'w-outer', h);
      const inner = D.el('span', 'w', outer, txt);
      if (txt === '·') inner.style.color = '#BEBEB6';
      if (i < PARTS.length - 1) h.appendChild(document.createTextNode(' '));
      return inner;
    });
    r.h = h;

    /* ---------------- active-step slider under the headline ---------------- */
    const slider = D.el('div', '', cam);
    D.place(slider, 960, 300, 10, 6);
    slider.style.cssText += `background:${D.C.red};border-radius:3px`;
    r.slider = slider;
    // A horizontal-only smear: the bar travels sideways, so an isotropic blur
    // would just dissolve it into a stain.
    r.sliderBlur = D.makeDirBlur('b6slider');

    /* ---------------- sub-line ---------------- */
    const subWrap = D.el('div', '', cam);
    D.place(subWrap, 960, 348);
    subWrap.style.cssText += 'overflow:hidden;padding:5px 6px';
    const sub = D.el('div', '', subWrap, 'Løbende optimering – hurtigere og mere ensartet.');
    sub.style.cssText =
      'font-size:32px;font-weight:500;color:#5A5A57;letter-spacing:-.012em;' +
      'white-space:nowrap;line-height:44px';
    r.subWrap = subWrap; r.sub = sub;

    /* ---------------- connector layer, behind the cards ---------------- */
    const layer = D.svgLayer(cam);

    r.stubs = BTN.map((bx) => D.svg('line', {
      x1: bx - 50, y1: CARD_Y, x2: bx + 50, y2: CARD_Y,
      stroke: '#DBDBD3', 'stroke-width': 3, 'stroke-linecap': 'round',
    }, layer));

    r.loopBase = D.revealPath(D.svg('path', {
      d: LOOP_D, stroke: '#D5D5CC', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'butt',
    }, layer));
    r.loopChase = D.revealPath(D.svg('path', {
      d: LOOP_D, stroke: D.C.red, 'stroke-width': 4.5, fill: 'none', 'stroke-linecap': 'round',
    }, layer));
    r.loopHead = D.svg('path', {
      d: LOOP_HEAD_D, fill: '#C9C9C0', stroke: 'none',
    }, layer);

    /* ---------------- three cards ---------------- */
    r.cards = STEPS.map((spec, i) => {
      const c = stepCard(cam, spec);
      D.place(c.wrap, CX[i], CARD_Y, CARD_W, CARD_H);
      return c;
    });

    /* card 1 — bar chart */
    const chart = D.svg('svg', {
      viewBox: '0 0 344 55', width: 344, height: 55, fill: 'none',
    }, r.cards[0].foot);
    chart.style.cssText = 'position:absolute;left:0;bottom:-2px;overflow:visible';
    r.bars = BARS[0].map((_, i) => D.svg('rect', {
      x: (i * BAR_STEP).toFixed(2), y: 0, width: BAR_W, height: 10, rx: 5, fill: BAR_GREY,
    }, chart));
    r.chartBase = D.svg('rect', {
      x: 0, y: 52.5, width: 344, height: 2, fill: D.C.line,
    }, chart);

    /* card 2 — A/B status chip */
    r.abChip = statusChip(r.cards[1].foot, 296, [
      { text: 'A / B · klar',      color: '#C9C9C1', ink: '#8A8A84' },
      { text: 'A / B · kører',     color: D.C.yellow, ink: '#8A6410' },
      { text: 'A / B · afsluttet', color: D.C.green,  ink: '#1E8A4E' },
    ]);

    /* card 3 — percentage + recommendation chip */
    const pct = D.el('div', '', r.cards[2].rightSlot, '+37%');
    pct.style.cssText =
      `font-size:38px;font-weight:800;letter-spacing:-.03em;line-height:1;color:#2FA55F`;
    r.pct = pct;

    r.recChip = statusChip(r.cards[2].foot, 258, [
      { text: 'Afventer',  color: '#C9C9C1', ink: '#8A8A84' },
      { text: 'Anbefalet', color: '#2FA55F', ink: '#1E8A4E', icon: 'check' },
    ]);

    /* ---------------- two arrow buttons ---------------- */
    r.btns = BTN.map((bx) => {
      const b = D.el('div', '', cam);
      D.place(b, bx, CARD_Y, BTN_R * 2, BTN_R * 2);
      b.style.cssText +=
        `border-radius:50%;background:${D.C.ink};display:flex;align-items:center;` +
        `justify-content:center;color:#fff;box-shadow:${D.SHADOW[2]}`;
      const ar = D.el('div', '', b);
      ar.style.cssText = 'display:flex;align-items:center;justify-content:center';
      ar.appendChild(D.icon('arrow', 26, 2.6));
      return { root: b, arrow: ar };
    });

    /* ---------------- iteration counter, sitting on the loop line -------- */
    const cnt = D.el('div', '', cam);
    D.place(cnt, 960, 886);
    cnt.style.cssText +=
      `display:flex;align-items:center;gap:12px;padding:9px 22px;border-radius:14px;` +
      `background:#fff;border:1px solid ${D.C.line};box-shadow:${D.SHADOW[1]};white-space:nowrap`;
    const cntLab = D.el('span', '', cnt, 'Gennemløb');
    cntLab.style.cssText = 'font-size:26px;font-weight:600;color:#5A5A57;letter-spacing:-.01em';
    const cntNum = D.el('span', '', cnt, '1');
    cntNum.style.cssText = `font-size:28px;font-weight:800;color:${D.C.red};letter-spacing:-.01em`;
    r.counter = cnt; r.cntNum = cntNum;

    /* ---------------- measured headline geometry (static layout) --------- */
    r.wordBox = [0, 2, 4].map((i) => D.stageCenter(r.hParts[i]));

    /* ---------------- precomputed schedules ---------------- */
    r.win = [0, 1, 2].map(activeWindows);

    return r;
  },

  render(t, r) {
    /* ---------------- camera: one settle out of the whipLeft ------------- */
    const settle = seg(t, 0, 0.72, easeOutQuint);
    r.cam.style.transform = `scale(${lerp(1.03, 1, settle).toFixed(5)})`;
    r.cam.style.opacity = '1';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---------------- headline builds, word by word ---------------------- */
    r.hParts.forEach((w, i) => {
      const at = 0.02 + i * 0.045;
      const p = spring(clamp((t - at) / 0.56), { freq: 1.05, damping: 0.70 });
      const fn = (u) => lerp(78, 0, spring(clamp((u - at) / 0.56), { freq: 1.05, damping: 0.70 }));
      D.setT(w, {
        x: 0, y: lerp(78, 0, p), s: 1,
        o: seg(t, at, 0.16, easeOutCubic),
        blur: clamp(Math.abs(M.velocity(fn, t)) * 0.006, 0, 8),
        centered: false,
      });
    });

    /* ---------------- sub-line: a clip reveal, not a fade ---------------- */
    const subP = seg(t, 0.26, 0.44, easeOutQuint);
    r.subWrap.style.height = (subP * 54).toFixed(2) + 'px';
    D.setT(r.subWrap, { x: 0, y: 0, s: 1, o: subP > 0.02 ? 1 : 0 });
    D.setT(r.sub, { x: 0, y: lerp(46, 0, subP), s: 1, o: 1, centered: false });

    /* ---------------- which step is current, right now ------------------- */
    const act = [0, 1, 2].map((i) => clamp(
      r.win[i].reduce((sum, w) => sum
        + seg(t, w[0], HANDOVER, easeOutCubic)
        - (w[1] === Infinity ? 0 : seg(t, w[1], HANDOVER, easeOutCubic)), 0), 0, 1));
    const actSum = act[0] + act[1] + act[2];
    const tick = [0, 1, 2].map((i) =>
      clamp(PASSES.reduce((s, p) => s + pulse(t, p.c[i], 0.40, easeOutCubic), 0), 0, 1));

    /* ---------------- headline slider tracks the current step ------------ */
    const sliderOn = seg(t, PASSES[0].c[0] - 0.10, 0.26, easeOutCubic);
    const wsum = Math.max(actSum, 1e-4);
    const sx = (r.wordBox[0].x * act[0] + r.wordBox[1].x * act[1] + r.wordBox[2].x * act[2]) / wsum;
    const sw = (r.wordBox[0].w * act[0] + r.wordBox[1].w * act[1] + r.wordBox[2].w * act[2]) / wsum;
    const sxSafe = actSum > 1e-3 ? sx : r.wordBox[0].x;
    const swSafe = actSum > 1e-3 ? sw : r.wordBox[0].w;
    r.slider.style.width = (swSafe + 16).toFixed(2) + 'px';
    const slideFn = (u) => {
      const a = [0, 1, 2].map((i) => clamp(
        r.win[i].reduce((sum, w) => sum
          + seg(u, w[0], HANDOVER, easeOutCubic)
          - (w[1] === Infinity ? 0 : seg(u, w[1], HANDOVER, easeOutCubic)), 0), 0, 1));
      const s = Math.max(a[0] + a[1] + a[2], 1e-4);
      return (r.wordBox[0].x * a[0] + r.wordBox[1].x * a[1] + r.wordBox[2].x * a[2]) / s;
    };
    D.setT(r.slider, { x: sxSafe - 960, y: 0, s: 1, o: sliderOn, blur: 0 });
    r.sliderBlur.set(r.slider, clamp(Math.abs(M.velocity(slideFn, t)) * 0.0026, 0, 11), 0);

    /* ---------------- connector stubs + loop line ------------------------ */
    const stubOn = seg(t, 0.52, 0.32, easeOutCubic);
    r.stubs.forEach((s) => s.setAttribute('opacity', stubOn.toFixed(4)));

    const loopP = seg(t, 2.10, 0.44, easeOutQuint);
    r.loopBase.set(loopP);
    r.loopBase.node.style.opacity = (loopP > 0.004 ? 0.95 : 0).toFixed(3);
    // The arrowhead flashes as the returning sweep lands and the next pass starts.
    const headHit = clamp(RETURNS.reduce((s, ret) =>
      s + pulse(t, ret[0] + ret[1] - 0.07, 0.30, easeOutCubic), 0), 0, 1);
    r.loopHead.setAttribute('opacity', (0.95 * seg(t, 2.46, 0.24, easeOutCubic)).toFixed(4));
    r.loopHead.setAttribute('fill', mix('#C9C9C0', D.C.red, headHit));

    // Travelling highlight on the loop line, once between each pair of passes.
    // One monotone progress value, reset to zero in the quiet gap at t = 3.00.
    const retU = clamp(
      seg(t, RETURNS[0][0], RETURNS[0][1], easeInOutCubic)
      - seg(t, 3.00, 0.02, easeInOutCubic)
      + seg(t, RETURNS[1][0], RETURNS[1][1], easeInOutCubic)
    );
    const retOn = clamp(RETURNS.reduce((s, ret) =>
      s + band(t, ret[0] - 0.02, ret[0] + ret[1] + 0.04, 0.045), 0), 0, 1);
    const WIN = 0.24;
    const u = clamp(retU) * (1 + WIN);
    r.loopChase.set(clamp(u), clamp(u - WIN));
    r.loopChase.node.style.opacity = (retOn * 0.95).toFixed(3);

    /* ---------------- the three cards ------------------------------------ */
    r.cards.forEach((c, i) => {
      const spec = STEPS[i];
      const inFn = (uu) => lerp(52, 0, spring(clamp((uu - spec.at) / 0.62), { freq: 1.05, damping: 0.66 }));
      const inP = spring(clamp((t - spec.at) / 0.62), { freq: 1.05, damping: 0.66 });
      const a = act[i];
      const k = tick[i];

      D.setT(c.wrap, {
        x: 0,
        y: inFn(t) - 7 * a,
        s: lerp(0.90, 1, inP) * (1 + 0.020 * a + 0.026 * k),
        o: seg(t, spec.at, 0.18, easeOutCubic),
        blur: clamp(Math.abs(M.velocity(inFn, t)) * 0.005, 0, 7),
      });
      c.body.style.boxShadow = a > 0.30 ? D.SHADOW[4] : D.SHADOW[2];
      c.ring.style.opacity = clamp(0.26 * a + 0.80 * k, 0, 1).toFixed(3);
      c.ring.style.transform = `scale(${(1 + 0.012 * (1 - clamp(a + k, 0, 1))).toFixed(4)})`;

      // Top accent bar: fills on the tick, snaps back as the next card takes over.
      const fill = clamp(r.win[i].reduce((s, w) => s
        + seg(t, w[0], 0.26, easeOutCubic)
        - (w[1] === Infinity ? 0 : seg(t, w[1] + 0.02, 0.10, easeOutCubic)), 0), 0, 1);
      c.accent.style.transform = `scaleX(${fill.toFixed(5)})`;
      c.accent.style.opacity = clamp(0.25 + 0.75 * a, 0, 1).toFixed(3);
      c.over.style.opacity = (0.74 + 0.26 * clamp(a + 0.5 * k, 0, 1)).toFixed(3);
    });

    /* ---------------- card 1: the bar chart finds the outlier ------------ */
    const stepAt = PASSES.map((p) => p.c[0]);
    r.chartBase.setAttribute('opacity', seg(t, STEPS[0].at + 0.06, 0.24, easeOutCubic).toFixed(4));
    r.bars.forEach((bar, i) => {
      let hgt = BARS[0][i];
      for (let k = 0; k < PASSES.length; k++) {
        hgt += (BARS[k + 1][i] - BARS[k][i]) * seg(t, stepAt[k], 0.30, easeOutCubic);
      }
      let hot = 0;
      for (let k = 0; k < PASSES.length; k++) {
        if (BAR_HL[k] === i) {
          const off = k < PASSES.length - 1 ? stepAt[k + 1] : Infinity;
          hot += seg(t, stepAt[k] + 0.06, 0.22, easeOutCubic)
            - (off === Infinity ? 0 : seg(t, off, 0.18, easeOutCubic));
        }
      }
      hot = clamp(hot);
      bar.setAttribute('y', (52 - hgt).toFixed(2));
      bar.setAttribute('height', hgt.toFixed(2));
      bar.setAttribute('fill', mix(BAR_GREY, D.C.blue, hot));
      bar.setAttribute('opacity', (0.72 + 0.28 * hot).toFixed(3));
    });

    /* ---------------- card 2: the A/B chip flips state ------------------- */
    const firstAB = PASSES[0].c[1];
    const wRun = clamp(PASSES.reduce((s, p) => s + band(t, p.c[1], p.c[1] + p.run, 0.05), 0), 0, 1);
    const wKlar = clamp(1 - smoothstep(firstAB - 0.05, firstAB + 0.05, t), 0, 1);
    const wDone = clamp(1 - wKlar - wRun, 0, 1);
    const abW = [wKlar, wRun, wDone];
    r.abChip.rows.forEach((row, i) => { row.style.opacity = abW[i].toFixed(4); });
    r.abChip.root.style.background = mix('#FBFBF8', D.C.cardYellow, wRun * 0.85);
    r.abChip.root.style.borderColor = mix(D.C.line, '#EBC983', wRun * 0.9);
    r.abChip.root.style.opacity = seg(t, STEPS[1].at + 0.06, 0.22, easeOutCubic).toFixed(4);

    /* ---------------- card 3: the figure counts up, then confirms -------- */
    const c3 = PASSES.map((p) => p.c[2]);
    let v = 0;
    for (let k = 0; k < PASSES.length; k++) {
      const prev = k === 0 ? 0 : PASSES[k - 1].pct;
      v += (PASSES[k].pct - prev) * seg(t, c3[k], k === 0 ? 0.34 : 0.22, easeOutCubic);
    }
    const pctOn = seg(t, c3[0] - 0.06, 0.20, easeOutCubic);
    const pctKick = clamp(PASSES.reduce((s, p) => s + pulse(t, p.c[2], 0.42, easeOutCubic), 0), 0, 1);
    r.pct.textContent = '+' + Math.round(v) + '%';
    D.setT(r.pct, {
      x: 0, y: -2 * pctKick, s: 1 + 0.10 * pctKick, o: pctOn,
      centered: false, origin: '100% 50%',
    });

    const recDone = smoothstep(c3[0] - 0.05, c3[0] + 0.05, t);
    r.recChip.rows[0].style.opacity = (1 - recDone).toFixed(4);
    r.recChip.rows[1].style.opacity = recDone.toFixed(4);
    r.recChip.root.style.background = mix('#FBFBF8', D.C.cardGreen, recDone * 0.9);
    r.recChip.root.style.borderColor = mix(D.C.line, '#B4E6C7', recDone);
    r.recChip.root.style.opacity = seg(t, STEPS[2].at + 0.06, 0.22, easeOutCubic).toFixed(4);
    r.recChip.root.style.transform = `scale(${(1 + 0.035 * pctKick * recDone).toFixed(4)})`;
    r.recChip.root.style.transformOrigin = '0% 50%';

    /* ---------------- the two arrow buttons --------------------------- */
    r.btns.forEach((b, j) => {
      const target = j === 0 ? 1 : 2;
      const flash = clamp(PASSES.reduce((s, p) => s + pulse(t, p.c[target] - 0.15, 0.34, easeOutCubic), 0), 0, 1);
      const bAt = 0.56 + j * 0.10;
      const inP = spring(clamp((t - bAt) / 0.52), { freq: 1.15, damping: 0.64 });
      D.setT(b.root, {
        x: 0, y: 0,
        s: lerp(0.35, 1, inP) * (1 + 0.12 * flash),
        o: seg(t, bAt, 0.16, easeOutCubic),
      });
      b.root.style.background = mix(D.C.ink, D.C.red, flash);
      b.root.style.boxShadow = flash > 0.25 ? D.SHADOW[3] : D.SHADOW[2];
      D.setT(b.arrow, { x: 11 * flash, y: 0, s: 1, o: 1, centered: false });
    });

    /* ---------------- iteration counter --------------------------------- */
    const n = 1 + (t >= PASSES[1].c[0] ? 1 : 0) + (t >= PASSES[2].c[0] ? 1 : 0);
    r.cntNum.textContent = String(n);
    const cntIn = spring(clamp((t - 2.14) / 0.54), { freq: 1.1, damping: 0.68 });
    const cntKick = clamp(pulse(t, PASSES[1].c[0], 0.34, easeOutCubic)
      + pulse(t, PASSES[2].c[0], 0.34, easeOutCubic), 0, 1);
    D.setT(r.counter, {
      x: 0, y: lerp(18, 0, cntIn), s: lerp(0.86, 1, cntIn) * (1 + 0.05 * cntKick),
      o: seg(t, 2.14, 0.22, easeOutCubic),
    });
  },
};
