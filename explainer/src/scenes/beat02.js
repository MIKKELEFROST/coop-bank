/**
 * Beat 2 · 00:04.5–00:10.5 — "En AI-agent kan selv …"
 *
 * VO: "En AI-agent kan selv planlægge, søge information, træffe beslutninger
 *      og udføre handlinger for at nå et mål."
 *
 * Motion: beat 1's red circle becomes the agent core on a rounded plate; four
 * function cards unfold around it; one connector system draws outward and each
 * card pulses on its spoken word. The connector carries on past the right edge
 * and pulls the composition into beat 3.
 *
 * Together with beat01.js this is the reference for the other scenes: bespoke
 * components assembled from design.js primitives, everything written per frame.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic, pulse } = M;

/** The four capabilities, in spoken order. `at` is local seconds. */
const FUNCS = [
  { key: 'plan',  label: 'Planlæg', icon: 'plan',    tone: 'blue',   color: D.C.blue,   x: 546,  y: 386, at: 1.36, dir: -1 },
  { key: 'seek',  label: 'Søg',     icon: 'search',  tone: 'red',    color: D.C.red,    x: 1374, y: 386, at: 2.34, dir: 1 },
  { key: 'dec',   label: 'Beslut',  icon: 'decide',  tone: 'green',  color: D.C.green,  x: 546,  y: 706, at: 3.32, dir: -1 },
  { key: 'exec',  label: 'Udfør',   icon: 'execute', tone: 'yellow', color: D.C.yellow, x: 1374, y: 706, at: 4.30, dir: 1 },
];

function funcCard(parent, spec) {
  const root = D.el('div', 'card', parent);
  root.style.cssText +=
    'width:300px;padding:24px 28px;border-radius:22px;display:flex;align-items:center;gap:18px';
  const box = D.el('div', '', root);
  box.style.cssText =
    `width:54px;height:54px;border-radius:15px;flex:none;display:flex;align-items:center;` +
    `justify-content:center;background:${spec.tint};color:${spec.color}`;
  box.appendChild(D.icon(spec.icon, 28, 2.1));
  const label = D.el('div', '', root, spec.label);
  label.style.cssText = 'font-size:35px;font-weight:700;letter-spacing:-.018em';
  // Accent ring used for the "spoken now" pulse — always present, opacity driven.
  const ring = D.el('div', '', root);
  ring.style.cssText =
    `position:absolute;inset:-4px;border-radius:24px;border:2.5px solid ${spec.color};pointer-events:none`;
  return { root, box, label, ring };
}

const TINTS = { blue: D.C.cardBlue, red: D.C.cardRed, green: D.C.cardGreen, yellow: D.C.cardYellow };

export default {
  id: 'beat-02',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px';
    r.cam = cam;

    /* ---- headline ---- */
    const h = D.el('div', 'h2', cam, 'En AI-agent kan selv …');
    D.place(h, 960, 190);
    h.style.whiteSpace = 'nowrap';
    r.hWords = [];
    h.textContent = '';
    r.hWords = D.words(h, 'En AI-agent kan selv …');
    r.h = h;

    /* ---- connector layer (behind cards) ---- */
    const layer = D.svgLayer(cam);
    r.paths = FUNCS.map((fn) => {
      const fromX = 960 + (fn.dir > 0 ? 92 : -92);
      const fromY = 546 + (fn.y < 546 ? -54 : 54);
      const toX = fn.x + (fn.dir > 0 ? -158 : 158);
      const toY = fn.y;
      const p = D.svg('path', {
        d: M.curveH(fromX, fromY, toX, toY, 0.62),
        stroke: fn.color, 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none',
      }, layer);
      return D.revealPath(p);
    });

    // The line that leaves frame right and hands over to beat 3.
    r.exitPath = D.revealPath(D.svg('path', {
      d: 'M 1524 386 C 1700 386, 1780 318, 2060 318',
      stroke: D.C.red, 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none',
    }, layer));

    /* ---- centre plate + core ---- */
    const plate = D.el('div', 'core-plate', cam);
    D.place(plate, 960, 546, 182, 182);
    r.plate = plate;

    const core = D.agentCore(cam, 96);
    D.place(core.root, 960, 546);
    r.core = core;

    /* ---- four function cards ---- */
    r.cards = FUNCS.map((fn) => {
      const c = funcCard(cam, { ...fn, tint: TINTS[fn.tone] });
      D.place(c.root, fn.x, fn.y);
      c.root.style.position = 'absolute';
      return c;
    });

    /* ---- closing caption ---- */
    const capClip = D.el('div', '', cam);
    D.place(capClip, 960, 904);
    capClip.style.cssText += 'overflow:hidden;padding:6px 4px';
    const cap = D.el('div', '', capClip, '… for at nå et mål.');
    cap.style.cssText = 'font-size:37px;font-weight:500;color:#5A5A57;white-space:nowrap;letter-spacing:-.01em';
    r.capClip = capClip; r.cap = cap;

    return r;
  },

  render(t, r) {
    /* ---- camera: a single slow settle, then still, then a small pull ---- */
    const settle = seg(t, 0, 0.7, easeOutQuint);
    const exitPush = seg(t, 5.35, 0.65, M.easeInCubic);
    r.cam.style.transform = `scale(${(lerp(1.035, 1, settle) + 0.05 * exitPush).toFixed(5)})`;

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---- headline builds word by word ---- */
    r.hWords.forEach((w, i) => {
      const p = spring(clamp((t - (0.12 + i * 0.055)) / 0.55), { freq: 1.05, damping: 0.72 });
      D.setT(w, {
        x: 0, y: lerp(58, 0, p), s: 1,
        o: seg(t, 0.12 + i * 0.055, 0.18, easeOutCubic),
        centered: false,
      });
    });

    /* ---- plate + core ---- */
    // The core arrives already "in flight" from beat 1, so it only needs to
    // seat itself; the plate builds underneath it a beat later.
    const plateIn = spring(clamp((t - 0.34) / 0.6), { freq: 1.2, damping: 0.66 });
    D.setT(r.plate, { x: 0, y: 0, s: lerp(0.55, 1, plateIn), o: seg(t, 0.34, 0.2, easeOutCubic) });

    const coreIn = spring(clamp(t / 0.55), { freq: 1.15, damping: 0.62 });
    // A single, controlled breath when the plate lands — not a permanent float.
    const breathe = pulse(t, 0.62, 0.5, easeOutCubic);
    D.setT(r.core.root, { x: 0, y: 0, s: lerp(1.25, 1, coreIn) * (1 + 0.05 * breathe), o: 1 });
    r.core.ring.style.transform = `scale(${(1 + 0.5 * seg(t, 0.5, 0.8, easeOutQuint)).toFixed(4)})`;
    r.core.ring.style.opacity = (0.5 * (1 - 0.5 * seg(t, 0.5, 0.8, easeOutQuint))).toFixed(3);

    /* ---- connectors draw outward, staggered ---- */
    r.paths.forEach((p, i) => {
      const s = FUNCS[i].at - 0.5;
      p.set(seg(t, s, 0.46, easeOutQuint));
    });
    r.exitPath.set(seg(t, 5.3, 0.6, easeOutQuint));

    /* ---- cards unfold, then pulse on their spoken word ---- */
    r.cards.forEach((c, i) => {
      const fn = FUNCS[i];
      const inP = spring(clamp((t - fn.at + 0.28) / 0.62), { freq: 1.1, damping: 0.64 });
      const say = pulse(t, fn.at, 0.62, easeOutCubic);
      const dx = lerp(fn.dir * -82, 0, inP);
      const dy = lerp(fn.y < 546 ? -30 : 30, 0, inP);
      D.setT(c.root, {
        x: dx, y: dy,
        s: lerp(0.86, 1, inP) * (1 + 0.045 * say),
        o: seg(t, fn.at - 0.28, 0.2, easeOutCubic),
        blur: clamp(Math.abs(M.velocity((u) => lerp(fn.dir * -82, 0, spring(clamp((u - fn.at + 0.28) / 0.62), { freq: 1.1, damping: 0.64 })), t)) * 0.003, 0, 6),
      });
      c.root.style.boxShadow = say > 0.05 ? D.SHADOW[3] : D.SHADOW[2];
      c.ring.style.opacity = (say * 0.9).toFixed(3);
      c.ring.style.transform = `scale(${(1 + 0.03 * (1 - say)).toFixed(4)})`;
    });

    /* ---- caption ---- */
    const cp = seg(t, 5.06, 0.44, easeOutQuint);
    r.capClip.style.height = (cp * 56) + 'px';
    D.setT(r.capClip, { x: 0, y: 0, s: 1, o: cp > 0.02 ? 1 : 0 });
    D.setT(r.cap, { x: 0, y: lerp(42, 0, cp), s: 1, o: 1, centered: false });
  },
};
