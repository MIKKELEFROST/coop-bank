/**
 * Beat 1 · 00:00–00:04.5 — "Marketing og AI-agenter"
 *
 * VO: "Marketing er ved at ændre sig. Ikke kun gennem nye værktøjer, men
 *      gennem AI-agenter."
 *
 * Motion: an almost empty frame; the word "Marketing" sits tiny at centre;
 * a Coop-red circle arrives on a diagonal with velocity blur and settles with
 * a controlled overshoot; the title builds around it; a subtle forward zoom
 * hands the frame to beat 2.
 *
 * This module is the reference implementation for the other eleven scenes:
 * build() creates every node once, render(t) writes every animated property
 * from t alone.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
        easeInCubic, smoothstep, f } = M;

export default {
  id: 'beat-01',

  build(root) {
    const refs = {};

    refs.brand = brandmark(root);

    // ---- camera: one wrapper the whole scene zooms through -----------------
    const cam = D.el('div', 'cam', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 520px';
    refs.cam = cam;

    // ---- connector + swoosh layer -----------------------------------------
    const layer = D.svgLayer(cam);
    refs.trail = D.revealPath(D.svg('path', {
      d: 'M 1590 268 C 1470 268, 1360 300, 1258 344',
      stroke: D.C.red, 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none',
    }, layer));
    refs.swoosh = D.revealPath(D.svg('path', {
      d: 'M 566 742 C 640 776, 792 786, 902 758',
      stroke: D.C.blue, 'stroke-width': 8, 'stroke-linecap': 'round', fill: 'none',
      opacity: 0.85,
    }, layer));

    // ---- kicker ------------------------------------------------------------
    const kick = D.el('div', 'kicker', cam, 'EN NY MÅDE AT ARBEJDE PÅ');
    D.place(kick, 960, 352);
    kick.style.whiteSpace = 'nowrap';
    refs.kickMask = kick;
    refs.kickWords = null; // kicker reveals as a clip, not per word

    const kickClip = D.el('div', '', cam);
    D.place(kickClip, 960, 352);
    kickClip.style.cssText += 'overflow:hidden;padding:6px 2px';
    kickClip.appendChild(kick);
    kick.style.position = 'static';
    kick.style.transform = 'none';
    refs.kickClip = kickClip;

    // ---- title -------------------------------------------------------------
    const title = D.el('div', '', cam);
    D.place(title, 960, 520);
    title.style.cssText += 'width:1500px;text-align:center';

    const l1 = D.el('div', 'h1-xl', title);
    const wMarketing = D.el('span', '', l1, 'Marketing');
    wMarketing.style.display = 'inline-block';
    l1.appendChild(document.createTextNode(' '));
    const wOg = D.el('span', '', l1, 'og');
    wOg.style.display = 'inline-block';

    const l2 = D.el('div', 'h1-xl accent-red', title);
    l2.style.marginTop = '10px';
    const l2clip = D.el('span', 'w-outer', l2);
    const wAgent = D.el('span', 'w', l2clip, 'AI-agenter');

    refs.title = title;
    refs.wMarketing = wMarketing;
    refs.wOg = wOg;
    refs.wAgent = wAgent;

    // ---- the agent circle ---------------------------------------------------
    const core = D.agentCore(cam, 74);
    D.place(core.root, 1258, 344);
    refs.core = core;
    refs.coreBlur = D.makeDirBlur('b1core');

    // ---- footer -------------------------------------------------------------
    const footClip = D.el('div', '', cam);
    D.place(footClip, 960, 884);
    footClip.style.cssText += 'overflow:hidden;padding:8px 4px';
    const foot = D.el('div', '', footClip, 'Fra enkeltstående værktøjer til aktive samarbejdspartnere');
    foot.style.cssText = 'font-size:30px;font-weight:500;color:#5A5A57;letter-spacing:-.01em;white-space:nowrap';
    refs.footClip = footClip;
    refs.foot = foot;

    // ---- measured geometry (static layout, so measured once) ----------------
    const cM = D.stageCenter(wMarketing);
    refs.mHome = cM;
    // Journey of the word from tiny-at-centre to its place in the headline.
    refs.mFrom = { x: 960 - cM.x, y: 540 - cM.y, s: 0.155 };

    return refs;
  },

  render(t, r) {
    const C = D.C;

    /* ---- camera: dead still, then a slow push at the very end ------------ */
    const push = seg(t, 3.62, 0.88, easeInCubic);
    r.cam.style.transform = `scale(${(1 + 0.075 * push).toFixed(5)})`;
    r.cam.style.opacity = '1';

    /* ---- brandmark: quiet, arrives first, never moves again -------------- */
    D.setT(r.brand, {
      x: 0, y: lerp(-14, 0, seg(t, 0.15, 0.5, easeOutQuint)),
      o: seg(t, 0.15, 0.45, easeOutCubic), s: 1, centered: false,
    });

    /* ---- the word "Marketing": tiny at centre, then takes its place ------ */
    const born = seg(t, 0.06, 0.34, easeOutCubic);          // appears
    const travel = spring(clamp((t - 0.74) / 0.72), { freq: 1.05, damping: 0.66 });
    const mx = lerp(r.mFrom.x, 0, travel);
    const my = lerp(r.mFrom.y, 0, travel);
    const ms = lerp(r.mFrom.s, 1, travel);
    // Blur only while the word is genuinely moving.
    const speed = Math.abs(M.velocity((u) => lerp(r.mFrom.y, 0, spring(clamp((u - 0.74) / 0.72), { freq: 1.05, damping: 0.66 })), t));
    D.setT(r.wMarketing, {
      x: mx, y: my, s: ms, o: born,
      blur: clamp(speed * 0.004, 0, 7),
      centered: false,
    });

    /* ---- red circle: diagonal entry, impact, settle ---------------------- */
    // Position is a pure function of t; velocity is its analytic derivative.
    const corePath = (u) => {
      const p = spring(clamp((u - 0.30) / 0.62), { freq: 1.15, damping: 0.58 });
      return { x: lerp(430, 0, p), y: lerp(-250, 0, p), p };
    };
    const cp = corePath(t);
    const vx = M.velocity((u) => corePath(u).x, t);
    const vy = M.velocity((u) => corePath(u).y, t);
    const appear = seg(t, 0.28, 0.14, easeOutCubic);
    // Impact squash: a short, non-cartoon 4% compression on landing.
    const impact = M.pulse(t, 0.72, 0.34, easeOutCubic);
    D.setT(r.core.root, {
      x: cp.x, y: cp.y,
      sx: (1 + 0.05 * impact) * lerp(0.55, 1, seg(t, 0.28, 0.5, easeOutQuint)),
      sy: (1 - 0.04 * impact) * lerp(0.55, 1, seg(t, 0.28, 0.5, easeOutQuint)),
      o: appear,
    });
    r.coreBlur.set(r.core.root, clamp(Math.abs(vx) * 0.0035, 0, 13), clamp(Math.abs(vy) * 0.0035, 0, 9));
    // The ring breathes open once, then holds — no perpetual floating.
    const ringOpen = seg(t, 0.78, 0.7, easeOutQuint);
    r.core.ring.style.transform = `scale(${(1 + 0.62 * ringOpen).toFixed(4)})`;
    r.core.ring.style.opacity = (0.55 * (1 - 0.45 * ringOpen)).toFixed(3);

    /* ---- trail line drawn behind the circle ------------------------------ */
    const trail = seg(t, 0.30, 0.55, easeOutQuint);
    r.trail.set(clamp(trail * 1.02), clamp(trail - 0.55) / 0.45 * 1.0);
    r.trail.node.style.opacity = String(clamp(seg(t, 0.3, 0.2) - seg(t, 1.55, 0.5)) * 0.9);

    /* ---- rest of the headline ------------------------------------------- */
    const ogIn = spring(clamp((t - 1.06) / 0.6), { freq: 1.1, damping: 0.7 });
    D.setT(r.wOg, { x: 0, y: lerp(46, 0, ogIn), o: seg(t, 1.06, 0.26, easeOutCubic), s: 1, centered: false });

    const agIn = spring(clamp((t - 1.24) / 0.66), { freq: 1.0, damping: 0.68 });
    D.setT(r.wAgent, {
      x: 0, y: lerp(118, 0, agIn), s: 1,
      o: seg(t, 1.24, 0.2, easeOutCubic),
      blur: clamp(Math.abs(M.velocity((u) => lerp(118, 0, spring(clamp((u - 1.24) / 0.66), { freq: 1.0, damping: 0.68 })), t)) * 0.006, 0, 8),
      centered: false,
    });

    /* ---- kicker: a clip-height reveal, not a fade ------------------------ */
    const kickP = seg(t, 1.62, 0.42, easeOutQuint);
    r.kickClip.style.height = (kickP * 40) + 'px';
    r.kickClip.style.opacity = kickP > 0.02 ? '1' : '0';
    D.setT(r.kickClip, { x: 0, y: 0, s: 1, o: kickP > 0.02 ? 1 : 0 });
    D.setT(r.kickMask, { x: 0, y: lerp(30, 0, kickP), s: 1, o: 1, centered: false });

    /* ---- blue swoosh ------------------------------------------------------ */
    r.swoosh.set(seg(t, 1.92, 0.5, easeOutQuint));

    /* ---- footer ----------------------------------------------------------- */
    const fp = seg(t, 2.12, 0.46, easeOutQuint);
    r.footClip.style.height = (fp * 48) + 'px';
    D.setT(r.footClip, { x: 0, y: 0, s: 1, o: fp > 0.02 ? 1 : 0 });
    D.setT(r.foot, { x: 0, y: lerp(38, 0, fp), s: 1, o: 1, centered: false });
  },
};
