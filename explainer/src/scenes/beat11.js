/**
 * Beat 11 · 00:50.0–01:02.5 — "Fire agenter. Ét samlet marketingsystem."
 *
 * VO (local t):
 *   0.30 "Mikkel udvikler i Webflow med Claude og MCP."
 *   3.40 "Nicole bruger en agent til idéer og content."
 *   6.40 "TonePilot sikrer vores tone of voice."
 *   9.00 "CMO Copilot sparrer om strategi, analyse og beslutninger."
 *
 * Composition: a centred constellation. The "Marketing" hub sits at (960, 560)
 * with four agent cards in the corners of the cluster, each joined to the hub by
 * a short curved connector. The headline holds the top of the frame.
 *
 * Motion:
 *  1. The hub RISES FROM BELOW the frame with overshoot and a velocity-derived
 *     vertical smear — the beat's signature move.
 *  2. Each card then grows out of the hub on its own VO cue while its connector
 *     draws from the hub outward.
 *  3. Each card expands into an application window: the window starts as an exact
 *     copy of the card's rectangle and grows — a crop, not a fade — into an
 *     880×486 surface at frame centre with a small rotateY unfold and SHADOW[4],
 *     while the constellation behind it dims and defocuses. It holds ~1.1 s with
 *     four interior events, then collapses back into its card and the card's
 *     status chip appears.
 *  4. Finale: four task tokens leave the hub together, ride the connectors and
 *     land on the cards; each arrival flips that card's status chip green.
 *     The frame is then completely still.
 *
 * Assets: if assets/workflows/*.png are supplied, `has()` is checked at BUILD
 * time and the window shows the screenshot instead of the drawn reconstruction.
 * `avatar()` falls back to a monogram disc when no portrait is supplied.
 *
 * Determinism: no DOM is created in render(); every animated property is written
 * on every call and derives from `t` alone.
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark, avatar, has, url } from '../assets.js';

const { seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
        smoothstep, pulse } = M;

const C = D.C;

/* ------------------------------------------------------------------ *
 * Layout — stage coordinates
 * ------------------------------------------------------------------ */

const HEAD_Y = 158;

const CARD = { w: 430, h: 308, pad: 26 };
const HUB = { cx: 960, cy: 560, w: 392, h: 194 };   // 764..1156 · 463..657
const WIN = { cx: 960, cy: 556, w: 880, h: 486 };   // 520..1400 · 313..799

/* Hub ports and card attachment points for the four connectors. */
const PORT = [
  { hx: 764,  hy: 502, ax: 671,  ay: 424 },
  { hx: 1156, hy: 502, ax: 1249, ay: 424 },
  { hx: 764,  hy: 618, ax: 671,  ay: 756 },
  { hx: 1156, hy: 618, ax: 1249, ay: 756 },
];

/* ------------------------------------------------------------------ *
 * Content — the four agents, in spoken order
 * ------------------------------------------------------------------ */

const AGENTS = [
  {
    key: 'web',
    title: 'Webudvikling',
    sub: 'Mikkel · Claude · Webflow · MCP',
    body: 'Udvikler og opdaterer hjemmesiden hurtigere.',
    status: 'Opgave udført',
    icon: 'code', color: C.blue, tint: C.cardBlue, edge: '#C6D6FF',
    person: { key: 'personMikkel', initials: 'MF' },
    asset: 'wfWebflow', winTitle: 'Webflow · Claude · MCP',
    cx: 456, cy: 400,
    tIn: 0.88, tOpen: 1.66, tClose: 2.90, tChip: 3.18,
  },
  {
    key: 'content',
    title: 'Idéudvikling & content',
    sub: 'Nicole · AI-agent',
    body: 'Udvikler idéer og følger vores brandretning.',
    status: 'Udkast klar',
    icon: 'pen', color: C.red, tint: C.cardRed, edge: '#F7C3C8',
    person: { key: 'personNicole', initials: 'N' },
    asset: 'wfContent', winTitle: 'Idé- og contentagent',
    cx: 1464, cy: 400,
    tIn: 3.50, tOpen: 4.28, tClose: 5.52, tChip: 5.80,
  },
  {
    key: 'tone',
    title: 'Tone of Voice',
    sub: 'TonePilot',
    body: 'Sikrer en ensartet tone i kommunikationen.',
    status: 'Tone godkendt',
    icon: 'voice', color: '#2FA55F', tint: C.cardGreen, edge: '#BFEACF',
    person: null,
    asset: 'wfTone', winTitle: 'TonePilot',
    cx: 456, cy: 780,
    tIn: 6.42, tOpen: 7.20, tClose: 8.44, tChip: 8.72,
  },
  {
    key: 'cmo',
    title: 'Strategi & analyse',
    sub: 'CMO Copilot',
    body: 'Sparring om strategi, analyse og beslutninger.',
    status: 'Indsigt klar',
    icon: 'target', color: '#B98505', tint: C.cardYellow, edge: '#F5DEA8',
    person: null,
    asset: 'wfCmo', winTitle: 'CMO Copilot',
    cx: 1464, cy: 780,
    tIn: 9.00, tOpen: 9.78, tClose: 10.82, tChip: 11.10,
  },
];

const OPEN_DUR = 0.40;
const CLOSE_DUR = 0.34;

/* Finale — the four task tokens leaving the hub. */
const TOK_DEP = 11.28;
const TOK_PER = 0.07;
const TOK_DUR = 0.50;
const tokDep = (i) => TOK_DEP + i * TOK_PER;
const tokArr = (i) => tokDep(i) + TOK_DUR;

/* Headline, word by word. Only one accent colour. */
const HEADWORDS = [
  { text: 'Fire',              red: false },
  { text: 'agenter.',          red: false },
  { text: 'Ét',                red: true  },
  { text: 'samlet',            red: true  },
  { text: 'marketingsystem.',  red: true  },
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

/** Window expansion progress 0 → 1 → 0 for agent i. */
const winP = (u, a) =>
  seg(u, a.tOpen, OPEN_DUR, easeInOutCubic) * (1 - seg(u, a.tClose, CLOSE_DUR, easeInOutCubic));
/** Window visibility (a hard, fast on/off around the crop). */
const winVis = (u, a) =>
  smoothstep(a.tOpen - 0.02, a.tOpen + 0.07, u)
  * (1 - smoothstep(a.tClose + CLOSE_DUR - 0.09, a.tClose + CLOSE_DUR, u));

/* ------------------------------------------------------------------ *
 * Small DOM helpers (design.js primitives only)
 * ------------------------------------------------------------------ */

function abs(parent, css) {
  const n = D.el('div', '', parent);
  n.style.cssText = 'position:absolute;' + css;
  return n;
}
function absT(parent, text, css) {
  const n = D.el('div', '', parent, text);
  n.style.cssText = 'position:absolute;' + css;
  return n;
}
function iconIn(parent, name, size, stroke, color) {
  const b = D.el('div', '', parent);
  b.style.cssText =
    `display:flex;align-items:center;justify-content:center;flex:none;color:${color}`;
  b.appendChild(D.icon(name, size, stroke));
  return b;
}
/** A filled green tick disc. */
function tickDisc(parent, size = 34) {
  const n = D.el('div', '', parent);
  n.style.cssText =
    `width:${size}px;height:${size}px;border-radius:50%;flex:none;background:${C.green};` +
    'display:flex;align-items:center;justify-content:center;color:#fff';
  n.appendChild(D.icon('check', Math.round(size * 0.56), 3.4));
  return n;
}

export default {
  id: 'beat-11',

  build(root) {
    const r = {};

    /* An opaque ground so beat 10 is genuinely pushed off the top of frame
       by the incoming pushUp rather than cross-dissolved through. */
    const bd = D.el('div', 'backdrop', root);
    bd.style.background = C.bg;
    r.bd = bd;

    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px';
    r.cam = cam;

    /* ---------------- headline ---------------- */
    const h = D.el('div', 'h2', cam);
    D.place(h, 960, HEAD_Y);
    h.style.whiteSpace = 'nowrap';
    r.headWords = HEADWORDS.map((w, i) => {
      const outer = D.el('span', 'w-outer', h);
      const inner = D.el('span', 'w', outer, w.text);
      if (w.red) inner.style.color = C.red;
      if (i < HEADWORDS.length - 1) h.appendChild(document.createTextNode(' '));
      return inner;
    });
    r.head = h;

    /* ---------------- the constellation ---------------- */
    const cluster = D.el('div', '', cam);
    cluster.style.cssText = 'position:absolute;inset:0;transform-origin:960px 560px';
    r.cluster = cluster;

    // connectors, behind everything in the cluster
    const layer = D.svgLayer(cluster);
    r.conns = AGENTS.map((a, i) => {
      const p = PORT[i];
      const node = D.svg('path', {
        d: M.curveH(p.hx, p.hy, p.ax, p.ay, 0.5),
        stroke: a.color, 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none',
      }, layer);
      return D.revealPath(node);
    });

    /* ---------------- hub ---------------- */
    const hub = D.el('div', '', cluster);
    D.place(hub, HUB.cx, HUB.cy, HUB.w, HUB.h);
    hub.style.cssText +=
      `border-radius:30px;background:#fff;border:1px solid ${C.line};` +
      `box-shadow:${D.SHADOW[4]};display:flex;flex-direction:column;` +
      'align-items:center;justify-content:center;padding:22px';
    r.hub = hub;
    r.hubBlur = D.makeDirBlur('b11hub');

    const hring = D.el('div', '', hub);
    hring.style.cssText =
      `position:absolute;inset:-10px;border-radius:40px;border:2.5px solid ${C.red};` +
      'pointer-events:none';
    r.hring = hring;

    const hdisc = D.el('div', '', hub);
    hdisc.style.cssText =
      `width:46px;height:46px;border-radius:50%;flex:none;background:${C.red};` +
      'display:flex;align-items:center;justify-content:center;color:#fff;' +
      'box-shadow:0 4px 12px rgba(227,6,19,.22)';
    hdisc.appendChild(D.icon('people', 24, 2.2));
    r.hdisc = hdisc;

    const htitle = D.el('div', '', hub, 'Marketing');
    htitle.style.cssText =
      'margin-top:12px;font-size:46px;font-weight:800;letter-spacing:-.028em;' +
      `line-height:52px;color:${C.ink};white-space:nowrap`;
    r.htitle = htitle;

    const hsub = D.el('div', '', hub, 'Retning · kontrol · prioritering');
    hsub.style.cssText =
      'margin-top:6px;font-size:23px;font-weight:600;letter-spacing:-.006em;' +
      `line-height:28px;color:${C.inkSoft};white-space:nowrap`;
    r.hsub = hsub;

    // port dots on the hub edges
    r.ports = AGENTS.map((a, i) => {
      const d = D.el('div', '', cluster);
      D.place(d, PORT[i].hx, PORT[i].hy, 14, 14);
      d.style.cssText += `border-radius:50%;background:${a.color}`;
      return d;
    });

    /* ---------------- four agent cards ---------------- */
    r.cards = AGENTS.map((a) => buildCard(cluster, a));

    /* ---------------- travelling tokens (above the cards) ---------------- */
    r.tokens = AGENTS.map((a) => {
      const n = D.el('div', '', cluster);
      D.place(n, 0, 0, 36, 36);
      n.style.cssText +=
        `border-radius:50%;background:${a.color};display:flex;align-items:center;` +
        'justify-content:center;box-shadow:0 4px 14px rgba(21,21,21,.18)';
      const dot = D.el('div', '', n);
      dot.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#fff';
      return n;
    });

    /* ---------------- application windows (above the cluster) ---------------- */
    const winWrap = D.el('div', '', cam);
    winWrap.style.cssText = 'position:absolute;inset:0;perspective:1700px';
    r.winWrap = winWrap;
    r.wins = AGENTS.map((a) => buildWindow(winWrap, a));

    return r;
  },

  render(t, r) {
    /* ---------------- camera ---------------- */
    const settle = seg(t, 0, 0.72, easeOutQuint);
    const outPush = seg(t, 12.10, 0.55, M.easeInCubic);
    r.cam.style.transform = `scale(${(lerp(1.030, 1, settle) + 0.012 * outPush).toFixed(5)})`;
    r.cam.style.opacity = '1';
    r.bd.style.opacity = '1';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---------------- headline ---------------- */
    D.setT(r.head, { x: 0, y: 0, s: 1, o: 1 });
    for (let i = 0; i < r.headWords.length; i++) {
      const at = 0.05 + i * 0.055;
      const fn = (u) => lerp(96, 0, spring(clamp((u - at) / 0.58), { freq: 1.02, damping: 0.70 }));
      D.setT(r.headWords[i], {
        x: 0, y: fn(t), s: 1,
        o: seg(t, at, 0.16, easeOutCubic),
        blur: clamp(Math.abs(M.velocity(fn, t)) * 0.0055, 0, 8),
        centered: false,
      });
    }

    /* ---------------- window focus drives the cluster's depth of field ---- */
    let focus = 0;
    for (let i = 0; i < AGENTS.length; i++) focus += winVis(t, AGENTS[i]);
    focus = clamp(focus);

    D.setT(r.cluster, {
      x: 0, y: 0, s: lerp(1, 0.982, focus), o: lerp(1, 0.34, focus),
      blur: 3.4 * focus, centered: false,
    });

    /* ---------------- hub: rises from below frame ---------------- */
    const hubY = (u) =>
      lerp(620, 0, spring(clamp((u - 0.18) / 0.70), { freq: 1.05, damping: 0.66 }));
    const hubImpact = pulse(t, 0.46, 0.34, easeOutCubic);
    const send = pulse(t, TOK_DEP - 0.04, 0.46, easeOutCubic);
    D.setT(r.hub, {
      x: 0, y: hubY(t),
      sx: (1 + 0.035 * hubImpact) * (1 + 0.020 * send),
      sy: (1 - 0.045 * hubImpact) * (1 + 0.020 * send),
      o: seg(t, 0.16, 0.10, easeOutCubic),
      blur: 0,
    });
    r.hubBlur.set(r.hub, 0, clamp(Math.abs(M.velocity(hubY, t)) * 0.0050, 0, 14));
    r.hub.style.boxShadow = D.SHADOW[4];

    r.hring.style.opacity = clamp(0.10 * seg(t, 0.70, 0.40, easeOutCubic) + 0.85 * send).toFixed(4);
    r.hring.style.transform = `scale(${(1 + 0.030 * send).toFixed(4)})`;

    D.setT(r.hdisc, { x: 0, y: 0, s: 1 + 0.10 * send, o: 1, centered: false });
    D.setT(r.htitle, { x: 0, y: 0, s: 1, o: 1, centered: false });
    D.setT(r.hsub, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ---------------- connectors, ports, cards, tokens ---------------- */
    for (let i = 0; i < AGENTS.length; i++) {
      const a = AGENTS[i];
      const dep = tokDep(i), arr = tokArr(i);

      /* connector draw + finale brightening */
      const draw = seg(t, a.tIn + 0.06, 0.46, easeOutQuint);
      const live = smoothstep(dep - 0.10, dep + 0.10, t) * (1 - smoothstep(arr + 0.30, arr + 0.60, t));
      r.conns[i].set(draw);
      r.conns[i].node.style.opacity = (draw > 0.02 ? lerp(0.80, 1, live) : 0).toFixed(4);
      r.conns[i].node.style.strokeWidth = lerp(5, 6.4, live).toFixed(2);

      /* hub port dot */
      const portIn = spring(clamp((t - (a.tIn + 0.02)) / 0.44), { freq: 1.2, damping: 0.62 });
      D.setT(r.ports[i], {
        x: 0, y: hubY(t), s: lerp(0.2, 1, portIn) * (1 + 0.45 * pulse(t, dep, 0.32, easeOutCubic)),
        o: seg(t, a.tIn + 0.02, 0.14, easeOutCubic),
      });

      /* card */
      const card = r.cards[i];
      const dx0 = (HUB.cx - a.cx) * 0.40;
      const dy0 = (HUB.cy - a.cy) * 0.40;
      const inP = (u) => spring(clamp((u - a.tIn) / 0.62), { freq: 1.06, damping: 0.64 });
      const p = inP(t);
      const vx = M.velocity((u) => lerp(dx0, 0, inP(u)), t);
      const vy = M.velocity((u) => lerp(dy0, 0, inP(u)), t);
      const land = pulse(t, arr, 0.44, easeOutCubic);
      const say = pulse(t, a.tIn + 0.10, 0.60, easeOutCubic);
      const held = winVis(t, a);

      D.setT(card.root, {
        x: lerp(dx0, 0, p),
        y: lerp(dy0, 0, p) - 8 * land,
        s: lerp(0.72, 1, p) * (1 + 0.030 * land) * lerp(1, 0.965, held),
        o: seg(t, a.tIn, 0.16, easeOutCubic),
        blur: clamp(Math.hypot(vx, vy) * 0.0030, 0, 8),
      });
      card.root.style.boxShadow = D.SHADOW[(land > 0.18 || say > 0.30) ? 3 : 2];
      card.root.style.borderColor = mix(C.line, a.edge, clamp(0.35 * say + 0.75 * land));

      const iconP = spring(clamp((t - (a.tIn + 0.10)) / 0.46), { freq: 1.22, damping: 0.60 });
      D.setT(card.iconBox, {
        x: 0, y: 0, s: lerp(0.45, 1, iconP) * (1 + 0.07 * land), o: 1, centered: false,
      });
      D.setT(card.disc, {
        x: 0, y: 0, s: lerp(0.5, 1, spring(clamp((t - (a.tIn + 0.16)) / 0.46), { freq: 1.2, damping: 0.62 })),
        o: seg(t, a.tIn + 0.16, 0.16, easeOutCubic), centered: false,
      });
      const subP = seg(t, a.tIn + 0.20, 0.30, easeOutCubic);
      D.setT(card.title, { x: 0, y: 0, s: 1, o: seg(t, a.tIn + 0.12, 0.22, easeOutCubic), centered: false });
      D.setT(card.sub, { x: lerp(-14, 0, subP), y: 0, s: 1, o: subP, centered: false });
      const bodyP = seg(t, a.tIn + 0.30, 0.32, easeOutCubic);
      D.setT(card.body, { x: 0, y: lerp(10, 0, bodyP), s: 1, o: bodyP, centered: false });

      /* status chip: appears neutral, turns green when its token lands */
      const chipP = spring(clamp((t - a.tChip) / 0.50), { freq: 1.15, damping: 0.62 });
      const green = smoothstep(arr - 0.05, arr + 0.11, t);
      D.setT(card.chip, {
        x: 0, y: 0,
        s: lerp(0.62, 1, chipP) * (1 + 0.10 * land),
        o: seg(t, a.tChip, 0.18, easeOutCubic),
        centered: false,
      });
      card.chip.style.background = mix('#FFFFFF', C.cardGreen, green);
      card.chip.style.borderColor = mix('#E4E4DE', '#BFEACF', green);
      card.chipText.style.color = mix('#8E8E88', '#1E8A4E', green);
      const tickP = spring(clamp((t - arr) / 0.42), { freq: 1.25, damping: 0.58 });
      card.chipTick.style.opacity = green.toFixed(4);
      card.chipTick.style.transform = `scale(${(lerp(0.2, 1, tickP) * (1 + 0.22 * land)).toFixed(4)})`;
      card.chipTick.style.width = lerp(0, 30, green).toFixed(2) + 'px';

      /* token riding the connector */
      const uT = 0.06 + 0.88 * seg(t, dep, TOK_DUR, easeInOutCubic);
      const pt = D.pointOn(r.conns[i].node, uT, r.conns[i].len);
      const tokVis = smoothstep(dep - 0.07, dep + 0.03, t) * (1 - smoothstep(arr - 0.05, arr + 0.03, t));
      D.setT(r.tokens[i], {
        x: pt.x, y: pt.y,
        s: lerp(0.5, 1, seg(t, dep, 0.18, easeOutCubic)) * lerp(1, 0.7, seg(t, arr - 0.14, 0.14, easeOutCubic)),
        o: tokVis,
      });
    }

    /* ---------------- application windows ---------------- */
    for (let i = 0; i < AGENTS.length; i++) {
      const a = AGENTS[i];
      const w = r.wins[i];
      const p = winP(t, a);
      const vis = winVis(t, a);
      const side = a.cx < HUB.cx ? -1 : 1;

      const cxF = (u) => lerp(a.cx, WIN.cx, winP(u, a));
      const cyF = (u) => lerp(a.cy, WIN.cy, winP(u, a));
      const bx = clamp(Math.abs(M.velocity(cxF, t)) * 0.0038, 0, 10);
      const by = clamp(Math.abs(M.velocity(cyF, t)) * 0.0038, 0, 8);

      w.root.style.width = lerp(CARD.w, WIN.w, p).toFixed(2) + 'px';
      w.root.style.height = lerp(CARD.h, WIN.h, p).toFixed(2) + 'px';
      w.root.style.transform =
        `translate(-50%,-50%) translate3d(${(cxF(t) - WIN.cx).toFixed(2)}px,${(cyF(t) - WIN.cy).toFixed(2)}px,0) ` +
        `rotateY(${lerp(side * 9, 0, p).toFixed(3)}deg)`;
      w.root.style.opacity = vis.toFixed(4);
      w.root.style.filter = (bx + by) > 0.05 ? `blur(${Math.max(bx, by).toFixed(2)}px)` : 'none';
      w.root.style.boxShadow = D.SHADOW[4];

      for (let k = 0; k < w.items.length; k++) {
        const it = w.items[k];
        const at = a.tOpen + it.at;
        const ip = spring(clamp((t - at) / 0.44), { freq: 1.15, damping: 0.66 });
        const o = seg(t, at, 0.16, easeOutCubic);
        if (it.sy0 != null) {
          D.setT(it.node, {
            x: 0, y: 0, sx: 1, sy: lerp(it.sy0, 1, ip), o, centered: false,
          });
        } else {
          D.setT(it.node, {
            x: lerp(it.dx || 0, 0, ip), y: lerp(it.dy || 0, 0, ip),
            s: lerp(it.s0 != null ? it.s0 : 1, 1, ip), o, centered: false,
          });
        }
      }

      w.tick(t, a.tOpen);
    }
  },
};

/* ================================================================== *
 * Card
 * ================================================================== */

function buildCard(parent, a) {
  const root = D.el('div', '', parent);
  D.place(root, a.cx, a.cy, CARD.w, CARD.h);
  root.style.cssText +=
    `border-radius:26px;background:#fff;border:1px solid ${C.line};` +
    `padding:${CARD.pad}px;box-shadow:${D.SHADOW[2]}`;

  /* head: icon box · title · person or agent disc */
  const head = D.el('div', '', root);
  head.style.cssText = 'display:flex;align-items:center;gap:14px;height:70px';

  const iconBox = D.el('div', '', head);
  iconBox.style.cssText =
    `width:52px;height:52px;border-radius:15px;flex:none;display:flex;` +
    `align-items:center;justify-content:center;background:${a.tint};color:${a.color}`;
  iconBox.appendChild(D.icon(a.icon, 27, 2.1));

  const titleWrap = D.el('div', '', head);
  titleWrap.style.cssText =
    'flex:1;min-width:0;height:70px;display:flex;align-items:center';
  const title = D.el('div', '', titleWrap, a.title);
  title.style.cssText =
    `font-size:29px;font-weight:700;letter-spacing:-.020em;line-height:35px;color:${C.ink}`;

  let disc;
  if (a.person) {
    disc = avatar(head, a.person.key, a.person.initials, 44);
  } else {
    disc = D.el('div', '', head);
    disc.style.cssText =
      'width:44px;height:44px;border-radius:50%;flex:none;background:#fff;' +
      `border:1px solid ${C.line};display:flex;align-items:center;justify-content:center`;
    const dot = D.el('div', '', disc);
    dot.style.cssText = `width:16px;height:16px;border-radius:50%;background:${C.red}`;
  }

  const sub = D.el('div', '', root, a.sub);
  sub.style.cssText =
    `margin-top:14px;height:32px;font-size:25px;font-weight:600;line-height:32px;` +
    `letter-spacing:-.010em;color:${C.inkSoft};white-space:nowrap;overflow:hidden`;

  const body = D.el('div', '', root, a.body);
  body.style.cssText =
    `margin-top:12px;height:68px;font-size:28px;font-weight:500;line-height:34px;` +
    `letter-spacing:-.012em;color:${C.inkSoft};overflow:hidden`;

  const chip = D.el('div', '', root);
  chip.style.cssText =
    'margin-top:18px;height:42px;display:inline-flex;align-items:center;gap:8px;' +
    `padding:0 18px;border-radius:999px;background:#fff;border:1px solid ${C.line};` +
    'transform-origin:0 50%';
  const chipTick = D.el('div', '', chip);
  chipTick.style.cssText =
    `width:30px;height:30px;flex:none;overflow:hidden;display:flex;align-items:center;` +
    `justify-content:center;color:${C.green}`;
  chipTick.appendChild(D.icon('check', 22, 3.2));
  const chipText = D.el('div', '', chip, a.status);
  chipText.style.cssText =
    'font-size:24px;font-weight:700;letter-spacing:-.010em;white-space:nowrap';

  return { root, iconBox, title, disc, sub, body, chip, chipTick, chipText };
}

/* ================================================================== *
 * Application windows
 * ================================================================== */

function buildWindow(parent, a) {
  const w = D.appWindow(parent, { w: WIN.w, h: WIN.h, title: a.winTitle, radius: 22 });
  D.place(w.root, WIN.cx, WIN.cy, WIN.w, WIN.h);
  w.root.style.willChange = 'transform, opacity, filter';
  w.title.style.fontSize = '22px';
  w.title.style.color = C.inkSoft;

  /* If an authentic workflow screenshot was supplied, use it (checked at build
     time); otherwise draw the interface. */
  if (has(a.asset)) {
    const img = document.createElement('img');
    img.src = url(a.asset);
    img.style.cssText =
      `position:absolute;left:0;top:0;width:${WIN.w}px;height:${WIN.h - 52}px;object-fit:cover;object-position:left top`;
    w.body.appendChild(img);
    return { root: w.root, body: w.body, items: [], tick: () => {} };
  }

  if (a.key === 'web') return winWebflow(w);
  if (a.key === 'content') return winContent(w);
  if (a.key === 'tone') return winTone(w);
  return winCmo(w);
}

/* ---------- 1 · Webflow / Claude / MCP editor ---------- */

function winWebflow(w) {
  const b = w.body;
  const items = [];

  const side = abs(b, 'left:0;top:0;width:250px;height:100%;background:#FAFAF7;border-right:1px solid #EDEDE8');
  absT(side, 'PROJEKT', 'left:24px;top:22px;font-size:18px;font-weight:700;letter-spacing:.18em;color:#9A9A95');

  const navs = ['Sider', 'Komponenter', 'Stil'];
  navs.forEach((label, i) => {
    const row = abs(side, `left:16px;top:${68 + i * 54}px;width:218px;height:46px;border-radius:12px;` +
      `display:flex;align-items:center;padding:0 14px;background:${i === 0 ? '#EDEDE8' : 'transparent'}`);
    const tx = D.el('div', '', row, label);
    tx.style.cssText = `font-size:25px;font-weight:600;letter-spacing:-.012em;color:${i === 0 ? C.ink : C.inkSoft}`;
  });

  const pub = abs(side, 'left:16px;top:334px;width:218px;height:56px;border-radius:14px;' +
    `display:flex;align-items:center;justify-content:center;background:${C.blue}`);
  const pubT = D.el('div', '', pub, 'Udgiv');
  pubT.style.cssText = 'font-size:26px;font-weight:700;letter-spacing:-.012em;color:#fff';

  const canvas = abs(b, 'left:250px;top:0;width:630px;height:100%;background:#F1F1EC');
  const page = abs(canvas, 'left:28px;top:26px;width:574px;height:382px;background:#fff;' +
    'border-radius:14px;border:1px solid #E4E4DE;overflow:hidden');

  const nav = abs(page, 'left:0;top:0;width:574px;height:48px;background:#151515');
  abs(nav, 'left:20px;top:18px;width:12px;height:12px;border-radius:50%;background:#E30613');
  abs(nav, 'left:44px;top:21px;width:74px;height:7px;border-radius:4px;background:#4A4A4A');
  abs(nav, 'left:430px;top:21px;width:54px;height:7px;border-radius:4px;background:#3A3A3A');
  abs(nav, 'left:496px;top:21px;width:54px;height:7px;border-radius:4px;background:#3A3A3A');

  abs(page, 'left:28px;top:80px;width:296px;height:24px;border-radius:6px;background:#D6D6CE');
  abs(page, 'left:28px;top:116px;width:228px;height:15px;border-radius:5px;background:#E6E6E0');
  abs(page, 'left:28px;top:145px;width:180px;height:15px;border-radius:5px;background:#EDEDE8');

  const hero = abs(page, 'left:348px;top:76px;width:198px;height:118px;border-radius:10px;' +
    `background:${C.cardBlue};border:1px solid #C6D6FF`);
  items.push({ node: hero, at: 0.44, s0: 0.62 });

  const blocks = [0, 1, 2].map((i) =>
    abs(page, `left:${28 + i * 177}px;top:228px;width:164px;height:92px;border-radius:10px;` +
      'background:#F4F4F0;border:1px solid #E7E7E0'));

  const pill = abs(b, 'left:584px;top:352px;height:46px;border-radius:999px;background:#fff;' +
    `border:1px solid ${C.line};box-shadow:${D.SHADOW[2]};display:flex;align-items:center;` +
    'gap:10px;padding:0 20px');
  const pdot = D.el('div', '', pill);
  pdot.style.cssText = `width:13px;height:13px;border-radius:50%;flex:none;background:${C.green}`;
  const ptx = D.el('div', '', pill, 'Ændringer udgivet');
  ptx.style.cssText = `font-size:24px;font-weight:700;letter-spacing:-.012em;color:${C.ink};white-space:nowrap`;
  items.push({ node: pill, at: 0.76, dy: 14, s0: 0.92 });

  const cur = abs(b, 'left:0;top:0;width:30px;height:30px;display:flex');
  const curIcon = D.icon('cursor', 30, 2);
  curIcon.querySelector('path').setAttribute('fill', C.ink);
  cur.appendChild(curIcon);

  const tick = (t, open) => {
    const cp = seg(t, open + 0.26, 0.32, easeInOutCubic);
    const flash = pulse(t, open + 0.60, 0.40, easeOutCubic);
    cur.style.left = lerp(486, 118, cp).toFixed(2) + 'px';
    cur.style.top = lerp(206, 358, cp).toFixed(2) + 'px';
    D.setT(cur, {
      x: 0, y: 0, s: 1 - 0.16 * flash,
      o: seg(t, open + 0.20, 0.14, easeOutCubic) * (1 - seg(t, open + 0.86, 0.20, easeOutCubic)),
      centered: false,
    });
    pub.style.background = mix(C.blue, '#1E3BC9', flash);
    D.setT(pub, { x: 0, y: 0, s: 1 - 0.035 * flash, o: 1, centered: false });

    const tint = smoothstep(open + 0.90, open + 1.04, t);
    blocks.forEach((bl, i) => {
      const q = i === 2 ? tint : 0;
      bl.style.background = mix('#F4F4F0', C.cardBlue, q);
      bl.style.borderColor = mix('#E7E7E0', '#C6D6FF', q);
      D.setT(bl, { x: 0, y: 0, s: 1 + 0.035 * pulse(t, open + 0.92, 0.36, easeOutCubic) * (i === 2 ? 1 : 0), o: 1, centered: false });
    });
  };

  return { root: w.root, body: b, items, tick };
}

/* ---------- 2 · idé- og contentagent ---------- */

function winContent(w) {
  const b = w.body;
  const items = [];

  absT(b, 'Idéer til kampagne', `left:34px;top:24px;font-size:34px;font-weight:800;letter-spacing:-.024em;color:${C.ink}`);
  absT(b, 'BRANDRETNING AKTIV', 'right:34px;top:32px;font-size:18px;font-weight:700;letter-spacing:.16em;color:#9A9A95');

  const ROWS = [
    'Ny kampagnevinkel til opsparing',
    'Kort video til LinkedIn',
    'Nyhedsbrev om budgetlægning',
  ];
  ROWS.forEach((label, i) => {
    const row = abs(b, `left:34px;top:${88 + i * 88}px;width:812px;height:76px;border-radius:14px;` +
      'background:#FBFBF9;border:1px solid #EDEDE8;display:flex;align-items:center;padding:0 20px;gap:16px');
    const n = D.el('div', '', row, String(i + 1));
    n.style.cssText =
      `width:40px;height:40px;border-radius:12px;flex:none;background:${C.cardRed};` +
      `color:${C.redDeep};display:flex;align-items:center;justify-content:center;` +
      'font-size:22px;font-weight:800';
    const tx = D.el('div', '', row, label);
    tx.style.cssText =
      `flex:1;min-width:0;font-size:28px;font-weight:600;letter-spacing:-.014em;color:${C.ink};white-space:nowrap`;
    const tag = D.el('div', '', row, 'Udkast');
    tag.style.cssText =
      'flex:none;padding:7px 16px;border-radius:999px;background:#EFEFEA;' +
      `font-size:21px;font-weight:700;color:${C.inkSoft}`;
    items.push({ node: row, at: 0.34 + i * 0.16, dx: -26, s0: 0.97 });
  });

  const bar = abs(b, `left:34px;top:356px;width:812px;height:54px;border-radius:14px;` +
    `background:${C.cardGreen};border:1px solid #BFEACF;display:flex;align-items:center;` +
    'padding:0 18px;gap:14px');
  tickDisc(bar, 32);
  const btx = D.el('div', '', bar, 'Udkast klar – følger brandretningen');
  btx.style.cssText = `font-size:26px;font-weight:700;letter-spacing:-.014em;color:#186B3E`;
  items.push({ node: bar, at: 0.90, dy: 16, s0: 0.96 });

  return { root: w.root, body: b, items, tick: () => {} };
}

/* ---------- 3 · TonePilot ---------- */

function winTone(w) {
  const b = w.body;
  const items = [];

  absT(b, 'Tone of voice', `left:34px;top:24px;font-size:30px;font-weight:800;letter-spacing:-.024em;color:${C.ink}`);

  function panel(left, label, text, tone, filled) {
    const p = abs(b, `left:${left}px;top:84px;width:380px;height:220px;border-radius:18px;` +
      `background:${tone.bg};border:1px solid ${tone.edge}`);
    absT(p, label, `left:24px;top:20px;font-size:19px;font-weight:700;letter-spacing:.18em;color:${tone.label}`);
    const tx = absT(p, text, `left:24px;top:60px;width:332px;font-size:28px;font-weight:600;` +
      `line-height:36px;letter-spacing:-.014em;color:${tone.ink}`);
    const meter = abs(p, 'left:24px;top:168px;display:flex;gap:8px');
    for (let i = 0; i < 3; i++) {
      const seg3 = D.el('div', '', meter);
      seg3.style.cssText =
        `width:56px;height:9px;border-radius:5px;background:${i < filled ? tone.meter : '#DEDED7'}`;
    }
    return { p, tx, meter };
  }

  const before = panel(34, 'FØR', 'Vi tilbyder attraktive vilkår på opsparing.',
    { bg: '#FBFBF9', edge: '#E7E7E0', label: '#9A9A95', ink: C.inkSoft, meter: '#C4C4BC' }, 1);
  const after = panel(466, 'EFTER', 'Din opsparing vokser – enkelt og trygt.',
    { bg: C.cardGreen, edge: '#BFEACF', label: '#4E8F6C', ink: C.ink, meter: C.green }, 3);

  items.push({ node: before.tx, at: 0.38, dy: 12 });
  items.push({ node: after.tx, at: 0.70, dx: 22 });
  items.push({ node: after.meter, at: 0.82, dx: -14 });

  const arrow = abs(b, 'left:414px;top:172px;width:52px;height:44px;display:flex;' +
    `align-items:center;justify-content:center;color:${C.ink}`);
  arrow.appendChild(D.icon('arrow', 34, 2.4));

  const bar = abs(b, 'left:34px;top:330px;width:812px;height:56px;border-radius:14px;' +
    `background:#fff;border:1px solid ${C.line};display:flex;align-items:center;padding:0 18px;gap:14px`);
  tickDisc(bar, 32);
  const btx = D.el('div', '', bar, 'Tone justeret til Coop Banks stemme');
  btx.style.cssText = `font-size:26px;font-weight:700;letter-spacing:-.014em;color:${C.ink}`;
  items.push({ node: bar, at: 0.94, dy: 16, s0: 0.96 });

  const tick = (t, open) => {
    const move = pulse(t, open + 0.56, 0.44, easeOutCubic);
    D.setT(arrow, {
      x: 14 * move, y: 0, s: 1 + 0.10 * move,
      o: seg(t, open + 0.52, 0.16, easeOutCubic), centered: false,
    });
    const glow = smoothstep(open + 0.66, open + 0.82, t);
    after.p.style.borderColor = mix('#BFEACF', C.green, glow * 0.7);
    D.setT(after.p, { x: 0, y: 0, s: 1 + 0.012 * pulse(t, open + 0.70, 0.40, easeOutCubic), o: 1, centered: false });
    D.setT(before.p, { x: 0, y: 0, s: 1, o: lerp(1, 0.72, glow), centered: false });
  };

  return { root: w.root, body: b, items, tick };
}

/* ---------- 4 · CMO Copilot ---------- */

const KPI = [
  { v: '+18 %', l: 'Konvertering', tone: C.cardGreen, edge: '#BFEACF', ink: '#1E8A4E' },
  { v: '−12 %', l: 'Pris pr. lead', tone: C.cardBlue, edge: '#C6D6FF', ink: '#2547C4' },
  { v: '+24 %', l: 'Synlighed',    tone: C.cardYellow, edge: '#F5DEA8', ink: '#8A6410' },
];
const BARS = [46, 60, 52, 76, 68, 94, 118];

function winCmo(w) {
  const b = w.body;
  const items = [];

  KPI.forEach((k, i) => {
    const tile = abs(b, `left:${28 + i * 282}px;top:24px;width:260px;height:116px;border-radius:16px;` +
      `background:${k.tone};border:1px solid ${k.edge}`);
    absT(tile, k.v, `left:20px;top:14px;font-size:40px;font-weight:800;letter-spacing:-.028em;color:${k.ink}`);
    absT(tile, k.l, `left:20px;top:70px;font-size:23px;font-weight:600;letter-spacing:-.010em;color:${C.inkSoft}`);
    items.push({ node: tile, at: 0.34 + i * 0.12, dy: 18, s0: 0.94 });
  });

  absT(b, 'Effekt pr. uge', `left:28px;top:158px;font-size:22px;font-weight:700;letter-spacing:.02em;color:${C.inkSoft}`);
  const chart = abs(b, 'left:28px;top:196px;width:500px;height:132px');
  abs(chart, `left:0;top:131px;width:500px;height:1px;background:${C.line}`);
  BARS.forEach((hgt, i) => {
    const bar = abs(chart, `left:${i * 76}px;top:${131 - hgt}px;width:44px;height:${hgt}px;` +
      `border-radius:8px 8px 3px 3px;background:${i >= 5 ? C.blue : '#DEDED7'};transform-origin:50% 100%`);
    items.push({ node: bar, at: 0.62 + i * 0.035, sy0: 0.06 });
  });

  const ins = abs(b, `left:552px;top:196px;width:300px;height:132px;border-radius:16px;` +
    `background:${C.cardYellow};border:1px solid #F5DEA8;padding:18px`);
  const insHead = D.el('div', '', ins);
  insHead.style.cssText = 'display:flex;align-items:center;gap:10px';
  iconIn(insHead, 'spark', 22, 2.2, '#8A6410');
  const insLab = D.el('div', '', insHead, 'ANBEFALING');
  insLab.style.cssText = 'font-size:18px;font-weight:800;letter-spacing:.16em;color:#8A6410';
  const insTx = D.el('div', '', ins, 'Flyt budget til opsparing.');
  insTx.style.cssText =
    `margin-top:12px;font-size:26px;font-weight:700;line-height:32px;letter-spacing:-.014em;color:${C.ink}`;
  items.push({ node: ins, at: 0.90, dx: 22, s0: 0.95 });

  const bar = abs(b, 'left:28px;top:352px;width:824px;height:52px;border-radius:14px;' +
    `background:#fff;border:1px solid ${C.line};display:flex;align-items:center;padding:0 18px;gap:14px`);
  const dot = D.el('div', '', bar);
  dot.style.cssText = `width:13px;height:13px;border-radius:50%;flex:none;background:${C.green}`;
  const btx = D.el('div', '', bar, 'Indsigt klar til beslutning');
  btx.style.cssText = `font-size:25px;font-weight:700;letter-spacing:-.014em;color:${C.ink}`;

  return { root: w.root, body: b, items, tick: () => {} };
}
