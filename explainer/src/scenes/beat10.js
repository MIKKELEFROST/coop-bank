/**
 * Beat 10 · 00:46.0–00:50.0 — "Sådan bruger vi AI-agenter i dag"
 *
 * VO: "Og det er ikke kun fremtid. Vi arbejder allerede sådan i dag."
 * Cues (local t): 0.20 "Og det er ikke kun fremtid."
 *                 1.90 "Vi arbejder allerede sådan i dag."
 *
 * The dark beat 9 wipes upward and uncovers this frame, so the composition is
 * bright and settled from the first frame. A thin Coop-red streak rises through
 * the frame with the uncover and condenses into the short rule above the
 * headline. The two-line headline then builds word by word out of a per-line
 * mask — this is the beat's kinetic-typography moment. On the second spoken
 * line four small tinted chips snap into a single centred row, pre-announcing
 * the four agents of beat 11. From local t ≈ 2.72 to the end nothing moves at
 * all: a completely still, fully readable frame hands over to beat 11's pushUp.
 *
 * Determinism: every value is a pure function of `t`; no DOM is created in
 * render(); every property this scene owns is written on every call.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic } = M;

/* ------------------------------------------------------------------ *
 * Layout — stage coordinates
 * ------------------------------------------------------------------ */

const RULE_Y = 348;          // the short red rule above the headline
const HEAD_Y = 516;          // vertical centre of the two-line headline block
const CHIP_Y = 766;          // vertical centre of the chip row

const HEAD_SIZE = 118;       // .h1-xl
const HEAD_LINE = 140;       // line box tall enough that å / g never clip
const HEAD_OVERLAP = 18;     // pulls line 2 up to an optical 122px leading
const MASK_DROP = 136;       // travel that hides a word completely in its mask

/** Headline words, in build order. Line 0 is ink, line 1 is Coop-red. */
const L1 = 'Sådan bruger vi';
const L2 = 'AI-agenter i dag';

const WORD_AT = 0.32;        // first word — the frame is fully uncovered at ≈0.36
const WORD_PER = 0.145;      // ≈ 4.4 frames between words
const WORD_DUR = 0.50;

/** The four agents of beat 11, pre-announced as tinted chips. */
const CHIPS = [
  { text: 'Webudvikling',  icon: 'code',   tone: 'blue',   ink: '#315BFF' },
  { text: 'Idé & content', icon: 'spark',  tone: 'red',    ink: '#E30613' },
  { text: 'Tone of Voice', icon: 'voice',  tone: 'green',  ink: '#1E8A4E' },
  { text: 'Strategi',      icon: 'target', tone: 'yellow', ink: '#8A6410' },
];

const CHIP_AT = 1.80;        // first chip lands just inside "Vi arbejder …"
const CHIP_PER = 0.135;      // ≈ 4 frames
const CHIP_DUR = 0.50;

/* ------------------------------------------------------------------ *
 * Local component factories (design.js primitives only)
 * ------------------------------------------------------------------ */

/** One headline line: a nowrap line box whose word spans mask from below. */
function headLine(parent, text, color, marginTop) {
  const line = D.el('div', '', parent);
  line.style.cssText =
    `font-size:${HEAD_SIZE}px;font-weight:800;letter-spacing:-.038em;` +
    `line-height:${HEAD_LINE}px;white-space:nowrap;color:${color};` +
    `margin-top:${marginTop}px`;
  return { line, words: D.words(line, text) };
}

/** Small tinted chip with a stroked icon. */
function agentChip(parent, spec) {
  const root = D.el('div', 'chip tone-' + spec.tone, parent);
  root.style.cssText +=
    'position:relative;padding:17px 30px;border-radius:18px;font-size:32px;gap:14px';
  const ic = D.el('div', '', root);
  ic.style.cssText = `display:flex;align-items:center;flex:none;color:${spec.ink}`;
  ic.appendChild(D.icon(spec.icon, 29, 2.1));
  const label = D.el('div', '', root, spec.text);
  label.style.cssText = 'font-weight:700;letter-spacing:-.015em';
  return { root, ic, label };
}

/* ------------------------------------------------------------------ *
 * Motion curves — declared once so render() and its derivatives agree
 * ------------------------------------------------------------------ */

/**
 * Vertical offset of the red rule, in px below its resting place. It rises the
 * last 34 px into place as it opens — the only thing that travels upward with
 * the uncover, and it stays clear of the headline so it never reads as a rule
 * struck through the type.
 */
const ruleY = (u) =>
  lerp(34, 0, spring(clamp((u - 0.28) / 0.54), { freq: 1.0, damping: 0.70 }));
/** Mask offset of headline word i. */
const wordY = (u, i) =>
  lerp(MASK_DROP, 0, spring(clamp((u - (WORD_AT + i * WORD_PER)) / WORD_DUR),
    { freq: 1.02, damping: 0.68 }));
/** Vertical offset of chip i as it snaps into the row. */
const chipY = (u, i) =>
  lerp(34, 0, spring(clamp((u - (CHIP_AT + i * CHIP_PER)) / CHIP_DUR),
    { freq: 1.08, damping: 0.66 }));

export default {
  id: 'beat-10',

  build(root) {
    const r = {};

    // No backdrop of its own: the scene keeps the stage's #F6F6F3 ground so the
    // dark beat 9 above it genuinely wipes away instead of being cut off by an
    // opaque plate of ours. Everything below is therefore timed to appear only
    // once the dark panel has cleared that part of the frame.
    r.brand = brandmark(root);

    /* ---- camera ---------------------------------------------------- */
    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 500px';
    r.cam = cam;

    /* ---- the rising streak that becomes the rule ------------------- */
    const rule = D.el('div', '', cam);
    D.place(rule, 960, RULE_Y, 140, 6);
    rule.style.background = D.C.red;
    rule.style.borderRadius = '3px';
    r.rule = rule;
    r.ruleBlur = D.makeDirBlur('b10rule');

    /* ---- headline --------------------------------------------------- */
    const title = D.el('div', '', cam);
    D.place(title, 960, HEAD_Y, 1520);
    title.style.textAlign = 'center';
    r.title = title;

    const a = headLine(title, L1, D.C.ink, 0);
    const b = headLine(title, L2, D.C.red, -HEAD_OVERLAP);
    r.words = a.words.concat(b.words);
    r.lineA = a.line;
    r.lineB = b.line;

    /* ---- chip row --------------------------------------------------- */
    const row = D.el('div', '', cam);
    D.place(row, 960, CHIP_Y, 1560);
    row.style.cssText +=
      'display:flex;justify-content:center;align-items:center;gap:30px';
    r.row = row;
    r.chips = CHIPS.map((spec) => agentChip(row, spec));

    return r;
  },

  render(t, r) {
    /* ---- camera: one short settle under the wipe, then dead still --- */
    const settle = seg(t, 0.0, 0.66, easeOutQuint);
    r.cam.style.transform = `scale(${lerp(1.026, 1, settle).toFixed(5)})`;
    r.cam.style.opacity = '1';

    /* ---- brandmark: takes over the corner once beat 9's has ridden up */
    // The dark panel clears y ≈ 62 at t ≈ 0.34, so ours lands right behind it
    // and then never moves again.
    D.setT(r.brand, {
      x: 0, y: 0, s: 1,
      o: seg(t, 0.36, 0.30, easeOutCubic),
      centered: false,
    });

    /* ---- red rule opens from the centre as it rises ----------------- */
    const open = seg(t, 0.28, 0.46, easeOutQuint);
    const vy = M.velocity(ruleY, t);
    D.setT(r.rule, {
      x: 0,
      y: ruleY(t),
      sx: lerp(0.05, 1, open),
      sy: lerp(0.55, 1, seg(t, 0.28, 0.30, easeOutCubic)),
      o: seg(t, 0.28, 0.09, easeOutCubic),
      blur: 0,
    });
    // Vertical smear only while the rule genuinely travels.
    r.ruleBlur.set(r.rule, 0, clamp(Math.abs(vy) * 0.006, 0, 6));

    /* ---- headline builds word by word out of the line mask ---------- */
    for (let i = 0; i < r.words.length; i++) {
      const y = wordY(t, i);
      const wv = M.velocity((u) => wordY(u, i), t);
      D.setT(r.words[i], {
        x: 0, y, s: 1, o: 1,
        blur: clamp(Math.abs(wv) * 0.0055, 0, 8),
        centered: false,
      });
    }
    D.setT(r.title, { x: 0, y: 0, s: 1, o: 1 });

    /* ---- four chips snap into the row ------------------------------- */
    D.setT(r.row, { x: 0, y: 0, s: 1, o: 1 });
    for (let i = 0; i < r.chips.length; i++) {
      const at = CHIP_AT + i * CHIP_PER;
      const p = spring(clamp((t - at) / CHIP_DUR), { freq: 1.08, damping: 0.66 });
      const cv = M.velocity((u) => chipY(u, i), t);
      D.setT(r.chips[i].root, {
        x: 0,
        y: chipY(t, i),
        s: lerp(0.90, 1, p),
        o: seg(t, at, 0.16, easeOutCubic),
        blur: clamp(Math.abs(cv) * 0.0045, 0, 6),
        centered: false,
      });
    }
  },
};
