/**
 * Beat 7 · 00:30.5–00:35.5 — "AI søger. Bliver vi fundet?"
 *
 * VO: "Når AI-agenter søger nettet efter svar, bliver vores digitale synlighed
 *      endnu vigtigere."
 * Cues (local t): 0.20 "Når AI-agenter søger nettet efter svar,"
 *                 2.50 "bliver vores digitale synlighed endnu vigtigere."
 *
 * Composition: a split frame. Left — the two-line headline with the red
 * question, a red rule and the supporting line. Right — a generic, own-brand
 * AI search surface: a rounded white card with a query row and three result
 * rows. Deliberately NOT modelled on any existing product; the two competitor
 * rows stay anonymous.
 *
 * Motion: a soft blue scanning band travels down through the three results and
 * tints each row as it passes. The Coop Bank row starts set back — faint,
 * scaled down and pushed to the right. On the second cue it moves forward:
 * full contrast, a red border, a small scale-up with overshoot and SHADOW[3].
 * The red status pill snaps in last, and the frame is still for the handover.
 *
 * Every value is a pure function of t. Row state is derived from the scan
 * position and one spring; nothing accumulates between frames.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, window_ } = M;

/* ------------------------------------------------------------------ *
 * Layout — stage coordinates
 * ------------------------------------------------------------------ */

const LEFT_W = 560;
const LEFT_CX = 545;                 // text block spans x 265 … 825
const HEAD_Y = 442;
const SUP_Y = 644;

const CARD = { w: 730, h: 632, cx: 1245, cy: 545 };
const CARD_L = CARD.cx - CARD.w / 2; // 880
const PAD = 28;
const INNER = CARD.w - PAD * 2;      // 674

const INPUT = { x: PAD, y: PAD, w: INNER, h: 76 };
const ROW = { x: PAD, w: INNER, h: 118, gap: 22, top: 132 };
const ROW_Y = [0, 1, 2].map((i) => ROW.top + i * (ROW.h + ROW.gap)); // 132 272 412
const PILL_Y = ROW_Y[2] + ROW.h + 26;                                // 556

/** The scan window: the rows area plus a small bleed, clipped and rounded. */
const CLIP = { top: ROW_Y[0] - 14, h: ROW.h * 3 + ROW.gap * 2 + 28 };  // 118, 426
const BAND_H = 150;
/** Row centres expressed inside the clip, for scan proximity. */
const ROW_C = ROW_Y.map((y) => y + ROW.h / 2 - CLIP.top);              // 73 213 353

/* ------------------------------------------------------------------ *
 * Content — every viewer-facing string is Danish
 * ------------------------------------------------------------------ */

const QUERY = 'Hvilken bank passer bedst til mine behov?';

const RESULTS = [
  { rank: '1', title: 'En større markedsaktør', desc: 'Generel information om bank og økonomi' },
  { rank: '2', title: 'Coop Bank', desc: 'Klart, relevant og dokumenteret svar', ours: true },
  { rank: '3', title: 'En anden markedsaktør', desc: 'Generel information om produkter' },
];

/** Set-back and forward states of a result row. Identical for the two others. */
const BACK = { s: 0.945, x: 18, o: 0.45 };
const FRONT = { s: 1.035, x: -10, o: 1 };
const STILL = { s: 1, x: 0, o: 1 };

/* ------------------------------------------------------------------ *
 * Schedule, local seconds
 * ------------------------------------------------------------------ */

const T = {
  kick: 0.06,
  line1: 0.10,
  line2: 0.46,
  rule: 0.98,
  card: 0.16,
  input: 0.62,
  query: 0.86,
  rows: [1.06, 1.20, 1.34],
  scan: 1.60, scanRun: 1.00,   // band hits rows at 1.86 / 2.10 / 2.34
  fwd: 2.52, fwdRun: 0.64,     // second cue: the Coop row comes forward
  sup: 3.02,
  pill: 3.86,
};

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

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */

export default {
  id: 'beat-07',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 545px';
    r.cam = cam;

    /* ---------------- left column: headline ---------------- */
    const head = D.el('div', '', cam);
    D.place(head, LEFT_CX, HEAD_Y, LEFT_W);
    head.style.textAlign = 'left';

    const l1 = D.el('div', 'h2', head);
    const l1in = D.el('span', '', l1);
    l1in.style.display = 'inline-block';
    r.w1 = D.words(l1in, 'AI søger.');

    const l2 = D.el('div', 'h2 accent-red', head);
    l2.style.marginTop = '4px';
    const l2in = D.el('span', '', l2);
    l2in.style.display = 'inline-block';
    r.w2 = D.words(l2in, 'Bliver vi fundet?');

    const rule = D.el('div', '', head);
    rule.style.cssText =
      `position:absolute;left:0;bottom:-26px;height:7px;border-radius:4px;` +
      `background:${D.C.red};transform-origin:0% 50%`;
    r.rule = rule;

    /* ---------------- left column: supporting line ---------------- */
    const sup = D.el('div', '', cam);
    D.place(sup, LEFT_CX, SUP_Y, LEFT_W);
    sup.style.cssText +=
      'text-align:left;font-size:34px;font-weight:500;color:#5A5A57;' +
      'letter-spacing:-.012em;line-height:46px';
    r.supW = D.words(sup, 'En stærk digital tilstedeværelse bliver endnu vigtigere.');

    /* ---------------- right column: label over the surface ---------------- */
    const kick = D.el('div', 'kicker', cam, 'AI-AGENTENS SØGNING');
    D.place(kick, CARD_L + 250, 186, 500);
    kick.style.textAlign = 'left';
    kick.style.whiteSpace = 'nowrap';
    r.kick = kick;

    /* ---------------- right column: the search surface ---------------- */
    const card = D.el('div', '', cam);
    D.place(card, CARD.cx, CARD.cy, CARD.w, CARD.h);
    card.style.cssText +=
      `background:#fff;border:1px solid ${D.C.line};border-radius:34px;` +
      `box-shadow:${D.SHADOW[4]};overflow:visible`;
    r.card = card;

    /* query row */
    const inp = D.el('div', '', card);
    inp.style.cssText =
      `position:absolute;left:${INPUT.x}px;top:${INPUT.y}px;width:${INPUT.w}px;` +
      `height:${INPUT.h}px;border-radius:22px;background:#F3F3EF;` +
      `border:1px solid ${D.C.line};display:flex;align-items:center;gap:16px;` +
      `padding:0 18px;overflow:hidden`;
    r.inp = inp;

    const av = D.el('div', '', inp);
    av.style.cssText =
      `width:44px;height:44px;border-radius:50%;flex:none;background:${D.C.ink};` +
      `display:flex;align-items:center;justify-content:center;color:#fff`;
    av.appendChild(D.icon('spark', 22, 2.2));
    r.av = av;

    const q = D.el('div', '', inp, QUERY);
    q.style.cssText =
      'font-size:28px;font-weight:500;color:#151515;letter-spacing:-.012em;white-space:nowrap';
    r.q = q;

    /* three result rows */
    r.rows = RESULTS.map((res, i) => {
      const wrap = D.el('div', '', card);
      wrap.style.cssText =
        `position:absolute;left:${ROW.x}px;top:${ROW_Y[i]}px;` +
        `width:${ROW.w}px;height:${ROW.h}px`;

      const box = D.el('div', '', wrap);
      box.style.cssText =
        `position:absolute;inset:0;border-radius:20px;border:2px solid ${D.C.lineSoft};` +
        `background:#FCFCFA;padding:20px 24px;overflow:hidden`;

      const title = D.el('div', '', box, res.title);
      title.style.cssText =
        'font-size:31px;font-weight:700;letter-spacing:-.018em;line-height:36px;' +
        'color:#151515;white-space:nowrap';

      const desc = D.el('div', '', box, res.desc);
      desc.style.cssText =
        'font-size:28px;font-weight:500;letter-spacing:-.008em;line-height:34px;' +
        'color:#5A5A57;margin-top:5px;white-space:nowrap';

      const rank = D.el('div', '', box, res.rank);
      rank.style.cssText =
        `position:absolute;right:22px;top:50%;transform:translateY(-50%);` +
        `font-size:34px;font-weight:800;letter-spacing:-.02em;color:${D.C.inkFaint}`;

      return { wrap, box, title, desc, rank };
    });

    /* scanning band, clipped to the results area and drawn over the rows */
    const scanClip = D.el('div', '', card);
    scanClip.style.cssText =
      `position:absolute;left:${PAD - 8}px;top:${CLIP.top}px;width:${INNER + 16}px;` +
      `height:${CLIP.h}px;border-radius:26px;overflow:hidden;pointer-events:none`;
    r.scanClip = scanClip;

    const band = D.el('div', '', scanClip);
    band.style.cssText =
      `position:absolute;left:0;top:0;width:100%;height:${BAND_H}px;` +
      `background:linear-gradient(180deg, rgba(49,91,255,0) 0%, ` +
      `rgba(49,91,255,.11) 52%, rgba(49,91,255,0) 100%)`;
    const bandLine = D.el('div', '', band);
    bandLine.style.cssText =
      `position:absolute;left:0;right:0;top:${Math.round(BAND_H * 0.52)}px;` +
      `height:2px;background:rgba(49,91,255,.42)`;
    r.band = band;

    /* the status pill, bottom right */
    const pill = D.el('div', '', card);
    pill.style.cssText =
      `position:absolute;right:${PAD}px;top:${PILL_Y}px;height:48px;display:flex;` +
      `align-items:center;gap:10px;padding:0 22px;border-radius:999px;` +
      `background:${D.C.red};color:#fff;white-space:nowrap;` +
      `box-shadow:0 6px 18px rgba(227,6,19,.28)`;
    const pIco = D.el('span', '', pill);
    pIco.style.cssText = 'display:flex;align-items:center';
    pIco.appendChild(D.icon('check', 22, 2.8));
    const pTxt = D.el('span', '', pill, 'Digital synlighed registreret');
    pTxt.style.cssText = 'font-size:24px;font-weight:700;letter-spacing:-.01em';
    r.pill = pill;

    /* ---------------- measured geometry (static layout) ---------------- */
    r.ruleW = Math.max(120, D.stageCenter(l2in).w);
    rule.style.width = r.ruleW.toFixed(1) + 'px';

    return r;
  },

  render(t, r) {
    /* ---------------- camera: one settle out of the zoomThrough ---------- */
    const settle = seg(t, 0, 0.72, easeOutQuint);
    r.cam.style.transform = `scale(${lerp(1.035, 1, settle).toFixed(5)})`;
    r.cam.style.opacity = '1';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---------------- headline, word by word ----------------------------- */
    const riseWord = (w, at, from, dur, k) => {
      const fn = (u) => lerp(from, 0, spring(clamp((u - at) / dur), { freq: 1.05, damping: 0.70 }));
      D.setT(w, {
        x: 0, y: fn(t), s: 1,
        o: seg(t, at, 0.16, easeOutCubic),
        blur: clamp(Math.abs(M.velocity(fn, t)) * k, 0, 8),
        centered: false,
      });
    };
    r.w1.forEach((w, i) => riseWord(w, T.line1 + i * 0.06, 76, 0.58, 0.006));
    r.w2.forEach((w, i) => riseWord(w, T.line2 + i * 0.055, 78, 0.60, 0.006));

    /* ---------------- red rule sweeps out under the question ------------- */
    const ruleP = seg(t, T.rule, 0.42, easeOutQuint);
    D.setT(r.rule, {
      x: 0, y: 0, sx: Math.max(ruleP, 0.0005), sy: 1,
      o: clamp(ruleP * 14), centered: false, origin: '0% 50%',
    });

    /* ---------------- supporting line ------------------------------------ */
    r.supW.forEach((w, i) => riseWord(w, T.sup + i * 0.035, 52, 0.56, 0.005));

    /* ---------------- label over the surface ----------------------------- */
    const kickP = seg(t, T.kick, 0.42, easeOutQuint);
    D.setT(r.kick, { x: 0, y: lerp(-16, 0, kickP), s: 1, o: kickP, blur: 0 });

    /* ---------------- the search surface --------------------------------- */
    const cardFn = (u) => lerp(40, 0, spring(clamp((u - T.card) / 0.66), { freq: 1.02, damping: 0.68 }));
    const cardIn = spring(clamp((t - T.card) / 0.66), { freq: 1.02, damping: 0.68 });
    D.setT(r.card, {
      x: 0, y: cardFn(t), s: lerp(0.93, 1, cardIn),
      o: seg(t, T.card, 0.20, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(cardFn, t)) * 0.004, 0, 8),
    });

    /* query row: the input seats itself, then the question wipes in ------- */
    const inpFn = (u) => lerp(20, 0, spring(clamp((u - T.input) / 0.55), { freq: 1.1, damping: 0.68 }));
    const inpIn = spring(clamp((t - T.input) / 0.55), { freq: 1.1, damping: 0.68 });
    D.setT(r.inp, {
      x: 0, y: inpFn(t), s: lerp(0.965, 1, inpIn),
      o: seg(t, T.input, 0.18, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(inpFn, t)) * 0.004, 0, 6),
      centered: false,
    });

    const avIn = spring(clamp((t - T.input - 0.10) / 0.50), { freq: 1.15, damping: 0.62 });
    D.setT(r.av, {
      x: 0, y: 0, s: lerp(0.45, 1, avIn),
      o: seg(t, T.input + 0.10, 0.14, easeOutCubic), centered: false,
    });

    const qp = seg(t, T.query, 0.44, easeOutQuint);
    r.q.style.clipPath = `inset(0 ${(100 * (1 - qp)).toFixed(3)}% 0 0)`;
    r.q.style.opacity = clamp(qp * 24).toFixed(4);

    /* ---------------- the scanning band ---------------------------------- */
    const bandC = lerp(-BAND_H * 0.53, CLIP.h + BAND_H * 0.53, clamp((t - T.scan) / T.scanRun));
    const scanOn = window_(t, T.scan - 0.02, T.scan + T.scanRun + 0.10, 0.13);
    r.band.style.transform = `translate3d(0,${(bandC - BAND_H / 2).toFixed(2)}px,0)`;
    r.band.style.opacity = scanOn.toFixed(4);

    /* ---------------- the three result rows ------------------------------ */
    const fwdSpring = (u) => spring(clamp((u - T.fwd) / T.fwdRun), { freq: 1.05, damping: 0.63 });

    r.rows.forEach((row, i) => {
      const res = RESULTS[i];
      const at = T.rows[i];
      const B = res.ours ? BACK : STILL;
      const F = res.ours ? FRONT : STILL;

      const enterFn = (u) => lerp(30, 0, spring(clamp((u - at) / 0.60), { freq: 1.05, damping: 0.68 }));
      const enterP = spring(clamp((t - at) / 0.60), { freq: 1.05, damping: 0.68 });
      const xFn = (u) => lerp(B.x, F.x, res.ours ? fwdSpring(u) : 1);

      const fwd = res.ours ? clamp(fwdSpring(t)) : 0;
      const prox = clamp(1 - Math.abs(bandC - ROW_C[i]) / 100) * scanOn * (1 - fwd);

      const vx = M.velocity(xFn, t);
      const vy = M.velocity(enterFn, t);

      D.setT(row.wrap, {
        x: xFn(t), y: enterFn(t),
        s: lerp(B.s, F.s, res.ours ? fwdSpring(t) : 1)
           * lerp(0.94, 1, enterP) * (1 + 0.014 * prox),
        o: seg(t, at, 0.18, easeOutCubic) * lerp(B.o, F.o, res.ours ? fwd : 1),
        blur: clamp((Math.abs(vx) + Math.abs(vy)) * 0.004, 0, 9),
        centered: false,
      });

      row.box.style.borderColor = mix(mix(D.C.lineSoft, D.C.blue, prox * 0.85), D.C.red, fwd);
      row.box.style.background = mix(mix('#FCFCFA', '#F0F4FF', prox * 0.85), '#FFFFFF', fwd);
      row.box.style.boxShadow =
        `0 ${(6 * fwd + 2 * prox).toFixed(2)}px ${(16 * fwd + 7 * prox).toFixed(2)}px ` +
        `rgba(21,21,21,${(0.08 * fwd + 0.05 * prox).toFixed(4)}), ` +
        `0 ${(20 * fwd).toFixed(2)}px ${(44 * fwd).toFixed(2)}px ` +
        `rgba(21,21,21,${(0.09 * fwd).toFixed(4)})`;
      row.rank.style.color = mix(mix(D.C.inkFaint, D.C.blue, prox * 0.7), D.C.red, fwd);
    });

    /* ---------------- the status pill snaps in last ---------------------- */
    const pillIn = spring(clamp((t - T.pill) / 0.44), { freq: 1.25, damping: 0.60 });
    D.setT(r.pill, {
      x: 0, y: 0, s: lerp(0.60, 1, pillIn),
      o: seg(t, T.pill, 0.14, easeOutCubic),
      centered: false, origin: '100% 50%',
    });
  },
};
