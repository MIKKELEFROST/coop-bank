/**
 * Beat 8 · 00:35.5–00:41.5 — "Fra selv at udføre – til at lede arbejdet"
 *
 * VO: "Vores rolle flytter sig fra at udføre alt selv til i højere grad at
 *      lede, kontrollere og prioritere AI-agenter."
 * Cues (local t): 0.20 "Vores rolle flytter sig fra at udføre alt selv"
 *                 2.90 "til i højere grad at lede, kontrollere og prioritere AI-agenter."
 *
 * Composition: three columns at mid height. Left is a white card, "Manuel
 * opgaveliste", with four ticked checkbox rows. Centre is a red-bordered,
 * highly elevated card — the human: a red "M" avatar, the label "Menneskelig
 * retning og godkendelse" and three approval ticks. Right is the column
 * "Opgaver fordelt til agenter": three dashed slots that fill with tinted agent
 * rows. Two dark circular arrow buttons sit in the gaps between the columns.
 *
 * Motion: three tasks leave the manual list one at a time. A task token lifts
 * off its row and rides a bezier that is constructed so all three routes cross
 * exactly through the human card's centre — the token passes *behind* the card,
 * the card lifts and its red ring flares, one approval tick flips green, and the
 * token comes out the other side and lands in the agent column, where the row
 * materialises out of its dashed slot and ticks green. The source row dims and
 * its checkbox empties as the token departs. "Find nye idéer" never leaves: it
 * stays sharp and ticked with the human. On the second cue the bottom line
 * builds word by word: "Lede · kontrollere · prioritere".
 *
 * Determinism: the route geometry is static, the token rides it with
 * D.pointOn(path, u) — arc-length parameterised, exactly the same parameter the
 * connector reveal uses, so head and line always coincide — and every colour,
 * opacity, transform and shadow below is written on every call from t alone.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
        smoothstep, pulse } = M;

/* ------------------------------------------------------------------ *
 * Layout — stage coordinates
 * ------------------------------------------------------------------ */

const L = { cx: 486, cy: 572, w: 424, h: 396, pad: 26 };   // 274..698 · 374..770
const ROW_TOP = 96, ROW_H = 64, ROW_GAP = 6;
const rowY = (i) => L.cy - L.h / 2 + ROW_TOP + ROW_H / 2 + i * (ROW_H + ROW_GAP);
// 502, 572, 642, 712

/** Stage x of a task row's label — the token lifts off exactly on top of it. */
const ROW_LABEL_X = L.cx - L.w / 2 + L.pad + 32 + 16;       // 348
/** Left inset of a token's own label (padding + dot + gap). */
const TOK_LABEL_INSET = 22 + 14 + 14;                       // 50

const H = { cx: 960, cy: 532, w: 280, h: 310 };             // 820..1100 · 377..687

const R = { cx: 1430, w: 452, h: 76 };                      // 1204..1656
const DST_Y = [478, 572, 666];
const HEAD_Y = 412;

const BTN = [759, 1152];
const BTN_Y = 532;

/* ------------------------------------------------------------------ *
 * Content
 * ------------------------------------------------------------------ */

const TASKS = [
  'Analysér kampagne',
  'Find nye idéer',
  'Skriv første udkast',
  'Kontrollér tone',
];

const AGENTS = [
  { label: 'Dataagent · analyse',   icon: 'db',    color: D.C.blue,  tint: D.C.cardBlue,  edge: '#C6D6FF' },
  { label: 'Contentagent · udkast', icon: 'pen',   color: D.C.red,   tint: D.C.cardRed,   edge: '#F7C3C8' },
  { label: 'TonePilot · kontrol',   icon: 'voice', color: '#2FA55F', tint: D.C.cardGreen, edge: '#BFEACF' },
];

/** The three delegations. `src` indexes TASKS, `dst` indexes AGENTS. */
const XF = [
  { src: 0, dst: 0, dep: 1.70, dur: 0.58 },   // arrives 2.28
  { src: 2, dst: 1, dep: 2.35, dur: 0.55 },   // arrives 2.90
  { src: 3, dst: 2, dep: 2.98, dur: 0.55 },   // arrives 3.53
];
const arrOf = (k) => XF[k].dep + XF[k].dur;
const midOf = (k) => XF[k].dep + XF[k].dur * 0.5;

/**
 * When a token reaches each arrow button, as a fraction of its travel *time*
 * (the ease is already inverted here, so these are not path fractions).
 */
const BTN_P = [0.407, 0.586];

/** Bottom line, word by word, on the second cue. */
const CLOSERS = [
  { text: 'Lede',        at: 3.86, sep: false },
  { text: '·',           at: 4.20, sep: true  },
  { text: 'kontrollere', at: 4.26, sep: false },
  { text: '·',           at: 4.72, sep: true  },
  { text: 'prioritere',  at: 4.78, sep: false },
];

const HEADWORDS = [
  { text: 'Fra',      red: false },
  { text: 'selv',     red: false },
  { text: 'at',       red: false },
  { text: 'udføre',   red: false },
  { text: '–',        red: false },
  { text: 'til',      red: false },
  { text: 'at',       red: false },
  { text: 'lede',     red: true  },
  { text: 'arbejdet', red: true  },
];

/* ------------------------------------------------------------------ *
 * Pure helpers
 * ------------------------------------------------------------------ */

const rgbOf = (h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];
function mix(a, b, k) {
  const A = rgbOf(a), B = rgbOf(b), q = clamp(k);
  return `rgb(${Math.round(lerp(A[0], B[0], q))},${Math.round(lerp(A[1], B[1], q))},${Math.round(lerp(A[2], B[2], q))})`;
}

/**
 * Route from a manual row to an agent row. The two control points share a y
 * chosen so the curve passes through exactly (960, 520) at u = 0.5 — the centre
 * of the human card. All three routes therefore cross inside the human.
 */
function routeD(sy, dy) {
  const cy = ((H.cy * 8) - sy - dy) / 6;
  return `M ${L.cx} ${sy} C 860 ${cy.toFixed(2)}, 1059.33 ${cy.toFixed(2)}, ${R.cx} ${dy}`;
}

/* ------------------------------------------------------------------ *
 * Components
 * ------------------------------------------------------------------ */

function taskRow(parent, label, top) {
  const root = D.el('div', '', parent);
  root.style.cssText =
    `position:absolute;left:0;top:${top}px;width:${L.w}px;height:${ROW_H}px;` +
    `display:flex;align-items:center;padding:0 ${L.pad}px`;

  const box = D.el('div', '', root);
  box.style.cssText =
    'width:32px;height:32px;border-radius:9px;flex:none;display:flex;' +
    `align-items:center;justify-content:center;border:2px solid ${D.C.ink};` +
    `background:${D.C.ink};color:#fff`;
  const chk = D.el('div', '', box);
  chk.style.cssText = 'display:flex;align-items:center;justify-content:center';
  chk.appendChild(D.icon('check', 18, 3.2));

  const lab = D.el('div', '', root, label);
  lab.style.cssText =
    'margin-left:16px;font-size:28px;font-weight:600;letter-spacing:-.014em;' +
    `color:${D.C.ink};white-space:nowrap`;

  return { root, box, chk, lab };
}

function destRow(parent, spec, y) {
  const root = D.el('div', '', parent);
  D.place(root, R.cx, y, R.w, R.h);
  root.style.cssText +=
    `border-radius:18px;background:${spec.tint};border:1px solid ${spec.edge};` +
    'display:flex;align-items:center;padding:0 18px';

  const ib = D.el('div', '', root);
  ib.style.cssText =
    'width:34px;height:34px;border-radius:10px;flex:none;background:#fff;' +
    `display:flex;align-items:center;justify-content:center;color:${spec.color}`;
  ib.appendChild(D.icon(spec.icon, 20, 2.2));

  const lab = D.el('div', '', root, spec.label);
  lab.style.cssText =
    'margin-left:12px;flex:1;font-size:28px;font-weight:700;letter-spacing:-.016em;' +
    `color:${D.C.ink};white-space:nowrap`;

  const tick = D.el('div', '', root);
  tick.style.cssText =
    `width:32px;height:32px;border-radius:50%;flex:none;background:${D.C.green};` +
    'display:flex;align-items:center;justify-content:center;color:#fff';
  tick.appendChild(D.icon('check', 18, 3.4));

  return { root, ib, lab, tick };
}

function taskToken(parent, label, color) {
  const root = D.el('div', '', parent);
  D.place(root, 0, 0);
  root.style.cssText +=
    'display:flex;align-items:center;gap:14px;padding:13px 22px;border-radius:16px;' +
    `background:#fff;border:1px solid ${D.C.line};box-shadow:${D.SHADOW[3]};white-space:nowrap`;
  const dot = D.el('div', '', root);
  dot.style.cssText = `width:14px;height:14px;border-radius:50%;flex:none;background:${color}`;
  const lab = D.el('div', '', root, label);
  lab.style.cssText =
    `font-size:28px;font-weight:700;letter-spacing:-.016em;color:${D.C.ink}`;
  return { root, dot, lab };
}

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

export default {
  id: 'beat-08',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px';
    r.cam = cam;

    /* ---------------- kicker ---------------- */
    const kickClip = D.el('div', '', cam);
    D.place(kickClip, 960, 128);
    kickClip.style.cssText += 'overflow:hidden;padding:5px 4px';
    const kick = D.el('div', 'kicker', kickClip, 'VORES ROLLE FLYTTER SIG');
    kick.style.cssText += 'white-space:nowrap;line-height:30px';
    r.kickClip = kickClip; r.kick = kick;

    /* ---------------- headline ---------------- */
    const h = D.el('div', 'h2', cam);
    D.place(h, 960, 204);
    h.style.whiteSpace = 'nowrap';
    r.hWords = HEADWORDS.map((w, i) => {
      const outer = D.el('span', 'w-outer', h);
      const inner = D.el('span', 'w', outer, w.text);
      if (w.red) inner.style.color = D.C.red;
      if (w.text === '–') inner.style.color = '#A6A6A0';
      if (i < HEADWORDS.length - 1) h.appendChild(document.createTextNode(' '));
      return inner;
    });
    r.h = h;

    /* ---------------- route layer (behind everything) ---------------- */
    const layer = D.svgLayer(cam);
    r.routes = XF.map((x) => {
      const p = D.svg('path', {
        d: routeD(rowY(x.src), DST_Y[x.dst]),
        stroke: AGENTS[x.dst].color, 'stroke-width': 3.5,
        'stroke-linecap': 'round', fill: 'none',
      }, layer);
      return D.revealPath(p);
    });

    /* ---------------- LEFT · manual task list ---------------- */
    const lcard = D.el('div', '', cam);
    D.place(lcard, L.cx, L.cy, L.w, L.h);
    lcard.style.cssText +=
      `border-radius:24px;background:#fff;border:1px solid ${D.C.line};` +
      `box-shadow:${D.SHADOW[2]}`;
    r.lcard = lcard;

    const ltitle = D.el('div', '', lcard, 'Manuel opgaveliste');
    ltitle.style.cssText =
      `position:absolute;left:${L.pad}px;top:24px;font-size:32px;font-weight:800;` +
      `letter-spacing:-.022em;line-height:40px;color:${D.C.ink};white-space:nowrap`;
    r.ltitle = ltitle;

    const lrule = D.el('div', '', lcard);
    lrule.style.cssText =
      `position:absolute;left:${L.pad}px;top:78px;width:${L.w - L.pad * 2}px;` +
      'height:1px;background:#EDEDE8;transform-origin:0 50%';
    r.lrule = lrule;

    r.taskRows = TASKS.map((label, i) =>
      taskRow(lcard, label, ROW_TOP + i * (ROW_H + ROW_GAP)));

    /* ---------------- RIGHT · agent column ---------------- */
    const rhead = D.el('div', '', cam, 'Opgaver fordelt til agenter');
    D.place(rhead, R.cx, HEAD_Y, R.w);
    rhead.style.cssText +=
      `text-align:left;font-size:30px;font-weight:800;letter-spacing:-.022em;` +
      `line-height:40px;color:${D.C.ink};white-space:nowrap`;
    r.rhead = rhead;

    r.slots = DST_Y.map((y) => {
      const s = D.el('div', '', cam);
      D.place(s, R.cx, y, R.w, R.h);
      s.style.cssText += 'border-radius:18px;border:2px dashed #D8D8D0;background:transparent';
      return s;
    });

    r.destRows = AGENTS.map((spec, i) => destRow(cam, spec, DST_Y[i]));

    /* ---------------- arrow buttons ---------------- */
    r.btns = BTN.map((bx) => {
      const b = D.el('div', '', cam);
      D.place(b, bx, BTN_Y, 52, 52);
      b.style.cssText +=
        `border-radius:50%;background:${D.C.ink};display:flex;align-items:center;` +
        `justify-content:center;color:#fff;box-shadow:${D.SHADOW[2]}`;
      const ar = D.el('div', '', b);
      ar.style.cssText = 'display:flex;align-items:center;justify-content:center';
      ar.appendChild(D.icon('arrow', 24, 2.6));
      return { root: b, arrow: ar };
    });

    /* ---------------- the three travelling tokens ---------------- */
    r.tokens = XF.map((x) => taskToken(cam, TASKS[x.src], AGENTS[x.dst].color));
    // Stacking order. Without this the tokens are created last and therefore
    // paint over everything, so a token in the final third of its flight sat on
    // top of the agent row above its destination and clipped the human card's
    // edge. Tokens now travel *behind* both columns — which is what the route
    // was designed for — and only read in the open gap between them.
    r.tokens.forEach((tok) => { tok.root.style.zIndex = '2'; });
    r.lcard.style.zIndex = '4';
    r.slots.forEach((s) => { s.style.zIndex = '4'; });
    r.destRows.forEach((d) => { d.root.style.zIndex = '5'; });
    r.tokenBlur = XF.map((_, i) => D.makeDirBlur('b8tok' + i));
    // A token starts life sitting exactly on its source row — its own label
    // over the row's label — so the departure reads as the row lifting out of
    // the list rather than as a second copy of the text appearing beside it.
    r.tokenOff = r.tokens.map((tok) =>
      (ROW_LABEL_X - TOK_LABEL_INSET) + D.stageCenter(tok.root).w / 2 - L.cx);

    /* ---------------- CENTRE · the human (topmost) ---------------- */
    const hc = D.el('div', '', cam);
    D.place(hc, H.cx, H.cy, H.w, H.h);
    hc.style.cssText +=
      `border-radius:28px;background:#fff;border:2px solid ${D.C.red};` +
      `box-shadow:${D.SHADOW[4]};display:flex;flex-direction:column;align-items:center;` +
      'padding:26px 20px;z-index:6';
    r.hc = hc;

    const hring = D.el('div', '', hc);
    hring.style.cssText =
      `position:absolute;inset:-9px;border-radius:36px;border:2.5px solid ${D.C.red};` +
      'pointer-events:none';
    r.hring = hring;

    const av = D.el('div', '', hc);
    av.style.cssText =
      `width:74px;height:74px;border-radius:50%;flex:none;background:${D.C.red};` +
      'display:flex;align-items:center;justify-content:center;color:#fff;' +
      'font-size:34px;font-weight:800;letter-spacing:-.02em;' +
      'box-shadow:0 4px 12px rgba(227,6,19,.20)';
    av.textContent = 'M';
    r.avatar = av;

    const hlab = D.el('div', '', hc, 'Menneskelig retning og godkendelse');
    hlab.style.cssText =
      'margin-top:18px;text-align:center;font-size:28px;font-weight:700;' +
      `letter-spacing:-.016em;line-height:36px;color:${D.C.ink}`;
    r.hlab = hlab;

    const spacer = D.el('div', '', hc);
    spacer.style.cssText = 'flex:1';

    const hrule = D.el('div', '', hc);
    hrule.style.cssText = 'width:100%;height:1px;background:#EDEDE8;flex:none';
    r.hrule = hrule;

    const ticks = D.el('div', '', hc);
    ticks.style.cssText =
      'margin-top:15px;display:flex;align-items:center;gap:16px;flex:none';
    r.hticks = XF.map(() => {
      const w = D.el('div', '', ticks);
      w.style.cssText = 'display:flex;align-items:center;justify-content:center';
      w.appendChild(D.icon('check', 26, 3.4));
      return w;
    });
    r.ticksRow = ticks;

    /* ---------------- bottom line ---------------- */
    const bl = D.el('div', '', cam);
    D.place(bl, 960, 892);
    bl.style.cssText += 'white-space:nowrap;text-align:center';
    r.closers = CLOSERS.map((c, i) => {
      const outer = D.el('span', 'w-outer', bl);
      const inner = D.el('span', 'w', outer, c.text);
      inner.style.cssText =
        'font-size:48px;font-weight:800;letter-spacing:-.026em;line-height:1.1;' +
        `color:${c.sep ? '#C4C4BC' : D.C.ink}`;
      if (i < CLOSERS.length - 1) bl.appendChild(document.createTextNode(' '));
      return inner;
    });
    r.bl = bl;

    return r;
  },

  render(t, r) {
    /* ---------------- camera ---------------- */
    const settle = seg(t, 0, 0.72, easeOutQuint);
    const outPush = seg(t, 5.35, 0.65, M.easeInCubic);
    r.cam.style.transform = `scale(${(lerp(1.035, 1, settle) + 0.014 * outPush).toFixed(5)})`;
    r.cam.style.opacity = '1';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---------------- kicker: a clip reveal ---------------- */
    const kp = seg(t, 0.04, 0.40, easeOutQuint);
    r.kickClip.style.height = (kp * 40).toFixed(2) + 'px';
    D.setT(r.kickClip, { x: 0, y: 0, s: 1, o: kp > 0.02 ? 1 : 0 });
    D.setT(r.kick, { x: 0, y: lerp(34, 0, kp), s: 1, o: 1, centered: false });

    /* ---------------- headline builds word by word ---------------- */
    r.hWords.forEach((w, i) => {
      const at = 0.10 + i * 0.042;
      const fn = (u) => lerp(76, 0, spring(clamp((u - at) / 0.56), { freq: 1.05, damping: 0.70 }));
      D.setT(w, {
        x: 0, y: fn(t), s: 1,
        o: seg(t, at, 0.16, easeOutCubic),
        blur: clamp(Math.abs(M.velocity(fn, t)) * 0.006, 0, 8),
        centered: false,
      });
    });

    /* ---------------- per-transfer state (pure in t) ---------------- */
    const U   = XF.map((x) => seg(t, x.dep, x.dur, easeInOutCubic));
    const UF  = XF.map((x) => (u) => seg(u, x.dep, x.dur, easeInOutCubic));
    const ARR = XF.map((_, k) => arrOf(k));
    const MID = XF.map((_, k) => midOf(k));

    /* "a token is inside the human right now" — drives the card's flare */
    const through = clamp(XF.reduce((s, _, k) => s + pulse(t, MID[k] - 0.06, 0.44, easeOutCubic), 0), 0, 1);
    /* one deliberate beat before the first delegation: the human decides */
    const decide = pulse(t, 1.40, 0.46, easeOutCubic);
    /* the final "AI-agenter" accent */
    const finale = pulse(t, 5.30, 0.62, easeOutCubic);

    /* ---------------- LEFT card ---------------- */
    const lIn = spring(clamp((t - 0.34) / 0.62), { freq: 1.08, damping: 0.66 });
    const lInFn = (u) => lerp(38, 0, spring(clamp((u - 0.34) / 0.62), { freq: 1.08, damping: 0.66 }));
    D.setT(r.lcard, {
      x: 0, y: lInFn(t), s: lerp(0.93, 1, lIn),
      o: seg(t, 0.34, 0.18, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(lInFn, t)) * 0.005, 0, 6),
    });
    r.lcard.style.boxShadow = D.SHADOW[2];

    const ltP = seg(t, 0.44, 0.30, easeOutCubic);
    D.setT(r.ltitle, { x: 0, y: lerp(12, 0, ltP), s: 1, o: ltP, centered: false });
    r.lrule.style.transform = `scaleX(${seg(t, 0.52, 0.36, easeOutQuint).toFixed(5)})`;
    r.lrule.style.opacity = '1';

    // How far each row has been handed over. Row 1 never leaves.
    const gone = TASKS.map((_, i) => {
      const k = XF.findIndex((x) => x.src === i);
      return k < 0 ? 0 : seg(t, XF[k].dep + 0.02, 0.30, easeOutCubic);
    });

    r.taskRows.forEach((row, i) => {
      const at = 0.52 + i * 0.07;
      const inP = spring(clamp((t - at) / 0.55), { freq: 1.1, damping: 0.70 });
      const g = gone[i];
      D.setT(row.root, {
        x: lerp(-26, 0, inP), y: 0, s: 1,
        o: seg(t, at, 0.16, easeOutCubic) * lerp(1, 0.72, g),
        centered: false,
      });
      const tick = seg(t, at + 0.12, 0.22, easeOutCubic);
      row.box.style.background = mix(D.C.ink, '#FFFFFF', g);
      row.box.style.borderColor = mix(D.C.ink, '#D2D2CA', g);
      row.chk.style.opacity = (tick * (1 - g)).toFixed(4);
      row.chk.style.transform = `scale(${lerp(0.4, 1, spring(clamp((t - (at + 0.12)) / 0.42), { freq: 1.2, damping: 0.62 })).toFixed(4)})`;
      row.lab.style.color = mix(D.C.ink, '#ADADA6', g);
    });

    /* ---------------- RIGHT column ---------------- */
    const rhP = spring(clamp((t - 1.06) / 0.58), { freq: 1.05, damping: 0.70 });
    D.setT(r.rhead, {
      x: 0, y: lerp(26, 0, rhP), s: 1,
      o: seg(t, 1.06, 0.20, easeOutCubic),
    });

    r.slots.forEach((s, j) => {
      const at = 1.10 + j * 0.06;
      const inP = spring(clamp((t - at) / 0.5), { freq: 1.1, damping: 0.68 });
      const eaten = seg(t, ARR[j] - 0.22, 0.18, easeOutCubic);
      D.setT(s, {
        x: 0, y: 0, s: lerp(0.94, 1, inP) * lerp(1, 1.04, eaten),
        o: seg(t, at, 0.20, easeOutCubic) * (1 - eaten),
      });
    });

    r.destRows.forEach((row, j) => {
      const a = ARR[j];
      const inP = spring(clamp((t - (a - 0.16)) / 0.50), { freq: 1.12, damping: 0.64 });
      const land = pulse(t, a, 0.40, easeOutCubic);
      D.setT(row.root, {
        x: lerp(20, 0, inP), y: 0,
        s: lerp(0.92, 1, inP) * (1 + 0.030 * land + 0.022 * finale),
        o: seg(t, a - 0.16, 0.14, easeOutCubic),
      });
      row.root.style.boxShadow = D.SHADOW[1];
      // Contents arrive with the row; only the green tick is staged after it.
      row.ib.style.opacity = '1';
      row.lab.style.opacity = '1';
      const tp = spring(clamp((t - (a + 0.02)) / 0.44), { freq: 1.2, damping: 0.60 });
      row.tick.style.opacity = seg(t, a + 0.02, 0.14, easeOutCubic).toFixed(4);
      row.tick.style.transform = `scale(${(lerp(0.25, 1, tp) * (1 + 0.14 * land)).toFixed(4)})`;
    });

    /* ---------------- routes + travelling tokens ---------------- */
    r.routes.forEach((route, k) => {
      const u = U[k];
      const rest = seg(t, ARR[k], 0.42, easeOutCubic);
      const alpha = lerp(0.92, 0.22, rest);
      route.set(clamp(u), 0.22);
      route.node.style.opacity = (u > 0.235 ? alpha : 0).toFixed(4);
      route.node.style.strokeWidth = lerp(4, 2.6, rest).toFixed(2);
    });

    const dt = M.f(1);
    r.tokens.forEach((tok, k) => {
      const x = XF[k];
      const u = U[k];
      const node = r.routes[k].node;
      const len = r.routes[k].len;
      const p = D.pointOn(node, u, len);
      const pA = D.pointOn(node, UF[k](t - dt), len);
      const pB = D.pointOn(node, UF[k](t + dt), len);
      const vx = (pB.x - pA.x) / (2 * dt);
      const vy = (pB.y - pA.y) / (2 * dt);

      // Hand-off windows: the token is fully gone before its destination row
      // materialises, so the two never sit on top of each other.
      const vis = smoothstep(x.dep - 0.14, x.dep - 0.02, t)
        * (1 - smoothstep(ARR[k] - 0.20, ARR[k] - 0.06, t));
      const born = seg(t, x.dep - 0.10, 0.24, easeOutCubic);
      const merge = seg(t, ARR[k] - 0.26, 0.20, easeOutCubic);
      const off = r.tokenOff[k] * (1 - smoothstep(0, 0.15, u));
      D.setT(tok.root, {
        x: p.x + off, y: p.y,
        s: lerp(0.94, 1.0, born) * lerp(1, 0.90, merge),
        o: vis,
      });
      // A light smear only — the token carries text that has to stay readable
      // for most of the flight, so this is well under the house cap.
      r.tokenBlur[k].set(
        tok.root,
        clamp(Math.abs(vx) * 0.00090, 0, 5),
        clamp(Math.abs(vy) * 0.00090, 0, 3.5),
      );
      tok.root.style.boxShadow = D.SHADOW[u > 0.05 ? 3 : 2];
    });

    /* ---------------- arrow buttons ---------------- */
    r.btns.forEach((b, j) => {
      // Peaks just before the token reaches the button, so the flash is already
      // decaying by the time the travelling card slides over it.
      const flash = clamp(XF.reduce((s, x) => s + pulse(t, x.dep + x.dur * BTN_P[j] - 0.21, 0.34, easeOutCubic), 0), 0, 1);
      const at = 1.26 + j * 0.08;
      const inP = spring(clamp((t - at) / 0.50), { freq: 1.18, damping: 0.64 });
      D.setT(b.root, {
        x: 0, y: 0, s: lerp(0.30, 1, inP) * (1 + 0.13 * flash),
        o: seg(t, at, 0.16, easeOutCubic),
      });
      b.root.style.background = mix(D.C.ink, D.C.red, flash);
      b.root.style.boxShadow = flash > 0.25 ? D.SHADOW[3] : D.SHADOW[2];
      D.setT(b.arrow, { x: 9 * flash, y: 0, s: 1, o: 1, centered: false });
    });

    /* ---------------- CENTRE · the human ---------------- */
    const hIn = spring(clamp((t - 0.78) / 0.66), { freq: 1.05, damping: 0.64 });
    const hInFn = (u) => lerp(46, 0, spring(clamp((u - 0.78) / 0.66), { freq: 1.05, damping: 0.64 }));
    D.setT(r.hc, {
      x: 0, y: hInFn(t) - 6 * through,
      s: lerp(0.88, 1, hIn) * (1 + 0.030 * through + 0.014 * decide + 0.016 * finale),
      o: seg(t, 0.78, 0.18, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(hInFn, t)) * 0.005, 0, 7),
    });
    r.hc.style.boxShadow = D.SHADOW[4];
    r.hc.style.borderColor = mix('#F0A4AB', D.C.red, clamp(0.45 + 0.55 * clamp(through + decide), 0, 1));

    const ringBase = 0.13 * seg(t, 1.04, 0.4, easeOutCubic);
    r.hring.style.opacity = clamp(ringBase + 0.90 * through + 0.70 * decide + 0.55 * finale, 0, 1).toFixed(4);
    r.hring.style.transform = `scale(${(1 + 0.016 * (1 - clamp(through + decide))).toFixed(4)})`;

    // The card's contents ride in with the card itself — a red frame that is
    // briefly empty reads as a rendering fault, not as an entrance.
    const avP = spring(clamp((t - 0.80) / 0.54), { freq: 1.2, damping: 0.60 });
    D.setT(r.avatar, {
      x: 0, y: 0, s: lerp(0.55, 1, avP) * (1 + 0.06 * through),
      o: 1, centered: false,
    });
    const hlP = seg(t, 0.84, 0.30, easeOutCubic);
    D.setT(r.hlab, { x: 0, y: lerp(12, 0, hlP), s: 1, o: 1, centered: false });
    r.hrule.style.opacity = '1';
    D.setT(r.ticksRow, { x: 0, y: 0, s: 1, o: seg(t, 0.98, 0.26, easeOutCubic), centered: false });

    r.hticks.forEach((w, k) => {
      const on = smoothstep(MID[k] - 0.07, MID[k] + 0.07, t);
      const pop = pulse(t, MID[k], 0.38, easeOutCubic);
      w.style.color = mix('#D4D4CC', D.C.green, on);
      w.style.transform = `scale(${(1 + 0.30 * pop).toFixed(4)})`;
      w.style.opacity = (0.55 + 0.45 * on).toFixed(4);
    });

    /* ---------------- bottom line ---------------- */
    r.closers.forEach((w, i) => {
      const at = CLOSERS[i].at;
      const fn = (u) => lerp(58, 0, spring(clamp((u - at) / 0.58), { freq: 1.05, damping: 0.68 }));
      const say = pulse(t, at + 0.04, 0.46, easeOutCubic);
      D.setT(w, {
        x: 0, y: fn(t), s: 1 + (CLOSERS[i].sep ? 0 : 0.035 * say),
        o: seg(t, at, 0.16, easeOutCubic),
        blur: clamp(Math.abs(M.velocity(fn, t)) * 0.005, 0, 6),
        centered: false,
      });
    });
  },
};
