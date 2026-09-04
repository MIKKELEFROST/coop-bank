/**
 * Beat 12 · 01:02.5–01:15.0 — Konklusion og ledelsesspørgsmål (THE CLOSING BEAT)
 *
 * VO (absolutte cues):
 *   62.8  "Fælles for dem er, at AI ikke bare genererer."
 *   65.6  "AI arbejder sammen med os og udfører opgaver."
 *   68.6  "Er fremtidens marketingchef den, der beslutter,"
 *   70.8  "hvilke agenter der skal tændes og slukkes?"
 *
 * Struktur (lokal t, 0 … 12.5):
 *   0.0 – 1.5   de fire agentkort fra beat 11 samler sig om Marketing-navet
 *   1.5 – 2.6   kortene folder sig ind i navet, som rejser mod højre
 *   2.0 – 3.3   kinetisk typografi bygger "AI genererer ikke bare."
 *   3.3 – 4.4   SIGNATURTRÆKKET: "genererer" / "ikke bare." skydes ud til højre,
 *               "arbejder" / "sammen med os." kommer ind fra venstre bag en maske
 *   4.8 – 5.5   navets fire bjælker bliver grønne — "udfører opgaver"
 *   5.6 – 6.3   navet folder sig ud til et agentkontrolpanel
 *   6.5 – 8.4   en menneskestyret markør tænder, slukker og prioriterer
 *   8.5 – 9.3   alt kører ud af billedet; slutspørgsmålet lander
 *   9.3 – 12.5  ABSOLUT STILSTAND — intet flytter, skalerer, slører eller fader
 */

import * as M from '../motion.js';
import * as D from '../design.js';
import { brandmark } from '../assets.js';

const {
  seg, spring, clamp, lerp, easeOutQuint, easeOutCubic, easeInOutCubic,
  easeInCubic, pulse,
} = M;

const C = D.C;

/* ------------------------------------------------------------------ *
 * Local helpers — built from design.js primitives only
 * ------------------------------------------------------------------ */

/** Deterministic hex → hex colour mix. */
function mix(a, b, p) {
  const q = clamp(p);
  const A = parseInt(a.slice(1), 16);
  const B = parseInt(b.slice(1), 16);
  const r = Math.round(((A >> 16) & 255) + ((((B >> 16) & 255) - ((A >> 16) & 255)) * q));
  const g = Math.round(((A >> 8) & 255) + ((((B >> 8) & 255) - ((A >> 8) & 255)) * q));
  const l = Math.round((A & 255) + (((B & 255) - (A & 255)) * q));
  return `rgb(${r}, ${g}, ${l})`;
}

/* The four agents, echoing beat 11's cluster: same titles, same hub. */
const AGENTS = [
  { title: 'Webudvikling',           icon: 'code',  color: C.blue,    tint: C.cardBlue,   x: 516,  y: 318, link: [860, 422, 560, 376] },
  { title: 'Idéudvikling & content', icon: 'spark', color: '#A9740B', tint: C.cardYellow, x: 1404, y: 318, link: [1060, 422, 1360, 376] },
  { title: 'Tone of Voice',          icon: 'voice', color: '#1E8A4E', tint: C.cardGreen,  x: 516,  y: 762, link: [860, 658, 560, 704] },
  { title: 'Strategi & analyse',     icon: 'chart', color: C.red,     tint: C.cardRed,    x: 1404, y: 762, link: [1060, 658, 1360, 704] },
];
AGENTS.forEach((a) => {
  a.dirX = a.x < 960 ? -1 : 1;
  a.dirY = a.y < 540 ? -1 : 1;
});

/* Control-panel rows. onAt/offAt drive the knob purely from t. */
const ROWS = [
  { label: 'Webudvikling',  tint: C.cardBlue,   onAt: 5.74, onDur: 0.30, offAt: 99, offDur: 0.2, click: -99 },
  { label: 'Content',       tint: C.cardYellow, onAt: 6.62, onDur: 0.22, offAt: 99, offDur: 0.2, click: 6.60 },
  { label: 'Tone of Voice', tint: C.cardGreen,  onAt: 5.82, onDur: 0.30, offAt: 7.22, offDur: 0.22, click: 7.20 },
  { label: 'Strategi',      tint: C.cardRed,    onAt: 7.80, onDur: 0.22, offAt: 99, offDur: 0.2, click: 7.78 },
];

const PANEL = { cx: 1330, cy: 540, w: 620, h: 472, rowTop: 116, rowStep: 86, rowH: 74, inset: 22 };
const PANEL_LEFT = PANEL.cx - PANEL.w / 2;   // 1020
const PANEL_TOP = PANEL.cy - PANEL.h / 2;    // 304
const TOGGLE_CX = PANEL_LEFT + PANEL.inset + 490 + 33;                 // 1565
const rowCY = (i) => PANEL_TOP + PANEL.rowTop + i * PANEL.rowStep + PANEL.rowH / 2;

/* Human cursor path — keyframed, interpolated, a pure function of t. */
const CURSOR_KEYS = [
  { t: 6.16, x: 1860, y: 1030 },
  { t: 6.54, x: TOGGLE_CX + 14, y: rowCY(1) + 17 },
  { t: 6.92, x: TOGGLE_CX + 14, y: rowCY(1) + 17 },
  { t: 7.16, x: TOGGLE_CX + 14, y: rowCY(2) + 17 },
  { t: 7.50, x: TOGGLE_CX + 14, y: rowCY(2) + 17 },
  { t: 7.72, x: TOGGLE_CX + 14, y: rowCY(3) + 17 },
  { t: 7.92, x: TOGGLE_CX + 14, y: rowCY(3) + 17 },
  { t: 8.04, x: 1252, y: rowCY(3) + 17 },
  { t: 8.34, x: 1252, y: rowCY(2) + 17 },
  { t: 8.70, x: 1940, y: 1070 },
];

function cursorAt(t) {
  const K = CURSOR_KEYS;
  if (t <= K[0].t) return { x: K[0].x, y: K[0].y };
  for (let i = 0; i < K.length - 1; i++) {
    if (t <= K[i + 1].t) {
      const p = easeInOutCubic((t - K[i].t) / (K[i + 1].t - K[i].t));
      return { x: lerp(K[i].x, K[i + 1].x, p), y: lerp(K[i].y, K[i + 1].y, p) };
    }
  }
  const L = K[K.length - 1];
  return { x: L.x, y: L.y };
}

/* --- agent card (stage 1) --- */
function agentCard(parent, spec) {
  const root = D.el('div', 'card', parent);
  root.style.cssText += 'width:380px;padding:24px 26px;border-radius:22px;display:flex;align-items:center;gap:18px';
  const box = D.el('div', '', root);
  box.style.cssText =
    `width:58px;height:58px;border-radius:16px;flex:none;display:flex;align-items:center;` +
    `justify-content:center;background:${spec.tint};color:${spec.color}`;
  box.appendChild(D.icon(spec.icon, 29, 2.1));
  const label = D.el('div', '', root, spec.title);
  label.style.cssText = 'font-size:30px;font-weight:700;letter-spacing:-.018em;line-height:1.14';
  return { root, box, label };
}

export default {
  id: 'beat-12',

  build(root) {
    const r = {};
    r.brand = brandmark(root);

    const cam = D.el('div', '', root);
    cam.style.cssText = 'position:absolute;inset:0;transform-origin:960px 540px';
    r.cam = cam;

    /* ---------------- connector layer (behind everything) ---------------- */
    const layer = D.svgLayer(cam);
    r.links = AGENTS.map((a) => D.revealPath(D.svg('path', {
      d: M.curveH(a.link[0], a.link[1], a.link[2], a.link[3], 0.60),
      stroke: a.color, 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none',
    }, layer)));

    /* ---------------- the Marketing hub plate ---------------- */
    const plate = D.el('div', '', cam);
    D.place(plate, 960, 540, 320, 240);
    plate.style.cssText +=
      'background:#fff;border:1px solid ' + C.line + ';border-radius:30px;box-shadow:' + D.SHADOW[3] + ';';
    r.plate = plate;

    const hubTop = D.el('div', '', plate);
    hubTop.style.cssText =
      'position:absolute;left:0;top:30px;width:100%;height:58px;display:flex;align-items:center;justify-content:center;gap:16px';
    const core = D.agentCore(hubTop, 56);
    core.root.style.flex = 'none';
    r.core = core;
    const hubLabel = D.el('div', '', hubTop, 'Marketing');
    hubLabel.style.cssText = 'font-size:34px;font-weight:800;letter-spacing:-.024em';
    r.hubLabel = hubLabel;

    r.bars = AGENTS.map((a, i) => {
      const track = D.el('div', '', plate);
      track.style.cssText =
        `position:absolute;left:52px;top:${112 + i * 26}px;width:216px;height:13px;` +
        `border-radius:7px;background:#EAEAE4;overflow:hidden`;
      const fill = D.el('div', '', track);
      fill.style.cssText =
        `position:absolute;left:0;top:0;width:100%;height:100%;border-radius:7px;` +
        `background:${a.color};transform-origin:0% 50%`;
      return { track, fill };
    });

    /* ---------------- status pill under the hub ---------------- */
    const pill = D.el('div', 'chip tone-green', cam);
    D.place(pill, 1330, 702);
    const pdot = D.el('div', 'statusdot', pill);
    pdot.style.flex = 'none';
    D.el('span', '', pill, 'Udfører opgaver');
    r.pill = pill;

    /* ---------------- four agent cards ---------------- */
    r.cards = AGENTS.map((a) => {
      const c = agentCard(cam, a);
      D.place(c.root, a.x, a.y);
      return c;
    });

    /* ---------------- left kinetic type block ---------------- */
    const typeWrap = D.el('div', '', cam);
    typeWrap.style.cssText = 'position:absolute;left:236px;top:348px;width:760px;height:360px';
    r.typeWrap = typeWrap;

    const kick = D.el('div', 'kicker', typeWrap, 'FÆLLES FOR ALLE FIRE AGENTER');
    kick.style.cssText += 'position:absolute;left:0;top:0;white-space:nowrap';
    r.kick = kick;

    const clip = D.el('div', '', typeWrap);
    clip.style.cssText = 'position:absolute;left:0;top:46px;width:760px;height:300px;overflow:hidden';
    r.clip = clip;

    const TYPE = 'font-size:92px;font-weight:800;letter-spacing:-.030em;line-height:1.12;' +
                 'white-space:nowrap;position:absolute;color:' + C.ink + ';';

    const wAI = D.el('div', '', clip, 'AI');
    wAI.style.cssText = TYPE + 'left:0;top:26px';
    const wGen = D.el('div', '', clip, 'genererer');
    const wArb = D.el('div', '', clip, 'arbejder');
    const wIkke = D.el('div', '', clip, 'ikke bare.');
    wIkke.style.cssText = TYPE + 'left:0;top:142px';
    const wSam = D.el('div', '', clip, 'sammen med os.');
    wSam.style.cssText = TYPE + 'left:0;top:142px';

    // "AI" is measured once so the swap slot starts exactly after it.
    wGen.style.cssText = TYPE + 'left:0;top:26px';
    wArb.style.cssText = TYPE + 'left:0;top:26px';
    const aiW = Math.round(D.stageCenter(wAI).w);
    const slotL = aiW + 28;
    wGen.style.left = slotL + 'px';
    wArb.style.left = slotL + 'px';

    r.wAI = wAI; r.wGen = wGen; r.wArb = wArb; r.wIkke = wIkke; r.wSam = wSam;

    /* ---------------- agent control panel ---------------- */
    const panel = D.el('div', '', cam);
    D.place(panel, PANEL.cx, PANEL.cy, PANEL.w, PANEL.h);
    panel.style.cssText +=
      'background:#fff;border:1px solid ' + C.line + ';border-radius:28px;box-shadow:' + D.SHADOW[3] +
      ';overflow:hidden;transform-origin:50% 50%';
    r.panel = panel;

    const head = D.el('div', '', panel);
    head.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:104px;display:flex;align-items:center;' +
      'padding:0 32px;border-bottom:1px solid ' + C.lineSoft + '';
    const hTitle = D.el('div', '', head, 'Marketing · agentkontrol');
    hTitle.style.cssText = 'font-size:29px;font-weight:700;letter-spacing:-.020em;white-space:nowrap';
    const gap = D.el('div', '', head);
    gap.style.cssText = 'flex:1';
    const stat = D.el('div', '', head);
    stat.style.cssText = 'display:flex;align-items:center;gap:11px;flex:none';
    const sdot = D.el('div', 'statusdot', stat);
    sdot.style.flex = 'none';
    const sTxt = D.el('div', '', stat, 'AKTIV');
    sTxt.style.cssText = 'font-size:28px;font-weight:800;letter-spacing:.09em;color:#1E8A4E';
    r.head = head; r.stat = stat;

    r.rows = ROWS.map((spec, i) => {
      const row = D.el('div', '', panel);
      row.style.cssText =
        `position:absolute;left:${PANEL.inset}px;top:${PANEL.rowTop + i * PANEL.rowStep}px;` +
        `width:${PANEL.w - PANEL.inset * 2}px;height:${PANEL.rowH}px`;

      const hl = D.el('div', '', row);
      hl.style.cssText = `position:absolute;inset:0;border-radius:18px;background:${spec.tint}`;

      const label = D.el('div', '', row, spec.label);
      label.style.cssText =
        'position:absolute;left:20px;top:50%;transform:translateY(-50%);' +
        'font-size:30px;font-weight:600;letter-spacing:-.015em;white-space:nowrap';

      const mark = D.el('div', '', row);
      mark.style.cssText =
        'position:absolute;top:50%;display:flex;align-items:center;gap:8px;' +
        'padding:7px 16px;border-radius:999px;background:' + C.cardRed + ';border:1px solid #F7C3C8;' +
        'font-size:28px;font-weight:700;letter-spacing:-.01em;color:' + C.redDeep + ';white-space:nowrap;' +
        'transform-origin:0% 50%';
      D.el('span', '', mark, 'Prioriteret');

      const tog = D.el('div', 'toggle', row);
      tog.style.cssText +=
        'position:absolute;left:490px;top:50%;transform:translateY(-50%);flex:none';
      const knob = D.el('div', 'knob', tog);

      return { root: row, hl, label, mark, tog, knob };
    });

    // Place the "Prioriteret" marker right after each row label (measured once).
    r.rows.forEach((row) => {
      const lw = Math.round(D.stageCenter(row.label).w);
      row.mark.style.left = (20 + lw + 20) + 'px';
    });

    /* ---------------- the human cursor ---------------- */
    const cur = D.el('div', '', cam);
    D.place(cur, 0, 0);
    const curIcon = D.icon('cursor', 46, 3);
    const curPath = curIcon.querySelector('path');
    curPath.setAttribute('fill', C.ink);
    curPath.setAttribute('stroke', '#FFFFFF');
    curPath.setAttribute('stroke-width', '2.4');
    cur.appendChild(curIcon);
    cur.style.filter = 'drop-shadow(0 4px 10px rgba(21,21,21,.28))';
    r.cursor = cur;

    /* ---------------- the closing question ---------------- */
    const q1 = D.el('div', 'h2', cam, 'Er fremtidens marketingchef den,');
    D.place(q1, 960, 494);
    q1.style.whiteSpace = 'nowrap';
    const q2 = D.el('div', 'h2', cam, 'der tænder og slukker agenter?');
    D.place(q2, 960, 566);
    q2.style.whiteSpace = 'nowrap';
    r.q1 = q1; r.q2 = q2;

    const sign = D.el('div', 'kicker', cam, 'Coop Bank Marketing');
    D.place(sign, 960, 700);
    sign.style.whiteSpace = 'nowrap';
    r.sign = sign;

    return r;
  },

  /* ================================================================== */

  render(t, r) {
    /* ---------------- camera: one quiet settle, then absolutely still --- */
    r.cam.style.transform = `scale(${lerp(1.018, 1, seg(t, 0, 0.62, easeOutQuint)).toFixed(5)})`;
    r.cam.style.opacity = '1';
    r.cam.style.filter = 'none';

    D.setT(r.brand, { x: 0, y: 0, s: 1, o: 1, centered: false });

    /* ================= 1 · the cluster reassembles ==================== */

    // Connectors: draw outward, then retract back into the hub.
    r.links.forEach((p, i) => {
      const drawn = seg(t, 0.34 + i * 0.10, 0.48, easeOutQuint);
      const from = seg(t, 1.46 + i * 0.04, 0.42, easeInCubic);
      p.set(drawn, from);
      p.node.style.opacity = (0.9 * (1 - seg(t, 1.76, 0.30, easeOutCubic))).toFixed(4);
    });

    // The four agent cards: converge home, hold, then fold into the hub.
    r.cards.forEach((c, i) => {
      const a = AGENTS[i];
      const posX = (u) => {
        const inP = spring(clamp((u + 0.16 - i * 0.07) / 0.72), { freq: 1.05, damping: 0.66 });
        const outP = seg(u, 1.52 + i * 0.05, 0.44, easeInCubic);
        return lerp(a.dirX * 176, 0, inP) + (960 - a.x) * outP;
      };
      const posY = (u) => {
        const inP = spring(clamp((u + 0.16 - i * 0.07) / 0.72), { freq: 1.05, damping: 0.66 });
        const outP = seg(u, 1.52 + i * 0.05, 0.44, easeInCubic);
        return lerp(a.dirY * 128, 0, inP) + (540 - a.y) * outP;
      };
      const inP = spring(clamp((t + 0.16 - i * 0.07) / 0.72), { freq: 1.05, damping: 0.66 });
      const outP = seg(t, 1.52 + i * 0.05, 0.44, easeInCubic);
      const vx = M.velocity(posX, t);
      const vy = M.velocity(posY, t);
      D.setT(c.root, {
        x: posX(t), y: posY(t),
        s: lerp(0.84, 1, inP) * lerp(1, 0.30, outP),
        o: 1 - seg(t, 1.62 + i * 0.05, 0.34, easeOutCubic),
        blur: clamp(Math.hypot(vx, vy) * 0.0035, 0, 12),
      });
      c.root.style.boxShadow = D.SHADOW[2];
    });

    /* ================= 2 · the hub travels right ===================== */

    const plateX = (u) => 370 * seg(u, 1.98, 0.62, easeInOutCubic);
    const plateIn = spring(clamp(t / 0.66), { freq: 1.10, damping: 0.66 });
    const plateOut = seg(t, 5.62, 0.42, easeInCubic);           // folds out into the panel
    const plateS = lerp(0.88, 1, plateIn) * lerp(1, 0.90, seg(t, 1.98, 0.62, easeInOutCubic))
                 * lerp(1, 1.22, plateOut);
    D.setT(r.plate, {
      x: plateX(t), y: 0,
      s: plateS,
      o: (1 - seg(t, 5.70, 0.30, easeOutCubic)),
      blur: clamp(Math.abs(M.velocity(plateX, t)) * 0.0030, 0, 9),
    });

    // The core breathes open exactly once as the cluster lands.
    const ringOpen = seg(t, 0.52, 0.72, easeOutQuint);
    r.core.ring.style.transform = `scale(${(1 + 0.55 * ringOpen).toFixed(4)})`;
    r.core.ring.style.opacity = (0.55 * (1 - 0.5 * ringOpen)).toFixed(3);
    r.core.root.style.transform = `scale(${(1 + 0.06 * pulse(t, 1.98, 0.5, easeOutCubic)).toFixed(4)})`;

    // Hub bars: fill in agent colour, then turn green as tasks complete.
    r.bars.forEach((b, i) => {
      const fill = seg(t, 0.60 + i * 0.12, 0.44, easeOutQuint);
      const done = seg(t, 4.86 + i * 0.18, 0.26, easeOutCubic);
      const kick = pulse(t, 4.86 + i * 0.18, 0.42, easeOutCubic);
      b.fill.style.transform = `scale(${fill.toFixed(4)}, ${(1 + 0.30 * kick).toFixed(4)})`;
      b.fill.style.background = mix(AGENTS[i].color, C.green, done);
      b.fill.style.opacity = (0.35 + 0.65 * Math.max(fill > 0 ? 1 : 0, done)).toFixed(3);
    });

    // "Udfører opgaver" pill.
    const pillIn = spring(clamp((t - 4.78) / 0.52), { freq: 1.05, damping: 0.66 });
    D.setT(r.pill, {
      x: 0, y: lerp(30, 0, pillIn), s: lerp(0.90, 1, pillIn),
      o: seg(t, 4.78, 0.20, easeOutCubic) * (1 - seg(t, 5.60, 0.26, easeOutCubic)),
    });

    /* ================= 3 · kinetic typography ======================== */

    // The whole left column leaves to the left at the end of the beat.
    const typeX = (u) => -900 * seg(u, 8.52, 0.44, easeInCubic);
    D.setT(r.typeWrap, {
      x: typeX(t), y: 0, s: 1,
      o: 1 - seg(t, 8.72, 0.20, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(typeX, t)) * 0.0026, 0, 12),
      centered: false,
    });

    const kickIn = spring(clamp((t - 1.90) / 0.52), { freq: 1.05, damping: 0.70 });
    D.setT(r.kick, {
      x: 0, y: lerp(22, 0, kickIn), s: 1,
      o: seg(t, 1.90, 0.22, easeOutCubic),
      centered: false,
    });

    // "AI" — the anchor both statements share.
    const aiIn = spring(clamp((t - 2.06) / 0.56), { freq: 1.00, damping: 0.68 });
    D.setT(r.wAI, {
      x: 0, y: lerp(96, 0, aiIn), s: 1,
      o: seg(t, 2.06, 0.18, easeOutCubic),
      centered: false,
    });

    // Statement A words — they enter from below, then are pushed out right.
    const genY = (u) => lerp(96, 0, spring(clamp((u - 2.20) / 0.56), { freq: 1.00, damping: 0.68 }));
    const genX = (u) => 720 * seg(u, 3.36, 0.40, easeInCubic);
    D.setT(r.wGen, {
      x: genX(t), y: genY(t), s: 1,
      o: seg(t, 2.20, 0.18, easeOutCubic) * (1 - seg(t, 3.60, 0.16, easeOutCubic)),
      blur: clamp((Math.abs(M.velocity(genX, t)) + Math.abs(M.velocity(genY, t))) * 0.0030, 0, 13),
      centered: false,
    });

    const ikkeY = (u) => lerp(96, 0, spring(clamp((u - 2.52) / 0.56), { freq: 1.00, damping: 0.68 }));
    const ikkeX = (u) => 800 * seg(u, 3.42, 0.40, easeInCubic);
    D.setT(r.wIkke, {
      x: ikkeX(t), y: ikkeY(t), s: 1,
      o: seg(t, 2.52, 0.18, easeOutCubic) * (1 - seg(t, 3.66, 0.16, easeOutCubic)),
      blur: clamp((Math.abs(M.velocity(ikkeX, t)) + Math.abs(M.velocity(ikkeY, t))) * 0.0030, 0, 13),
      centered: false,
    });

    // Statement B words — they arrive from the left, behind the mask.
    const arbX = (u) => lerp(-620, 0, spring(clamp((u - 3.50) / 0.60), { freq: 1.00, damping: 0.68 }));
    D.setT(r.wArb, {
      x: arbX(t), y: 0, s: 1,
      o: seg(t, 3.50, 0.12, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(arbX, t)) * 0.0030, 0, 13),
      centered: false,
    });

    const samX = (u) => lerp(-800, 0, spring(clamp((u - 3.76) / 0.64), { freq: 1.00, damping: 0.68 }));
    D.setT(r.wSam, {
      x: samX(t), y: 0, s: 1,
      o: seg(t, 3.76, 0.12, easeOutCubic),
      blur: clamp(Math.abs(M.velocity(samX, t)) * 0.0030, 0, 13),
      centered: false,
    });

    /* ================= 4 · the agent control panel =================== */

    const panelIn = spring(clamp((t - 5.66) / 0.62), { freq: 1.05, damping: 0.66 });
    const panelX = (u) => 840 * seg(u, 8.56, 0.44, easeInCubic);
    D.setT(r.panel, {
      x: panelX(t), y: 0,
      s: lerp(0.52, 1, panelIn),
      o: seg(t, 5.66, 0.22, easeOutCubic) * (1 - seg(t, 8.76, 0.20, easeOutCubic)),
      blur: clamp(Math.abs(M.velocity(panelX, t)) * 0.0026, 0, 12),
    });

    const headIn = seg(t, 5.78, 0.30, easeOutQuint);
    D.setT(r.head, { x: 0, y: lerp(-16, 0, headIn), s: 1, o: headIn, centered: false });
    r.stat.style.opacity = seg(t, 5.94, 0.26, easeOutCubic).toFixed(4);

    r.rows.forEach((row, i) => {
      const spec = ROWS[i];

      // Slot 2 and slot 3 trade places when Strategi is prioritised.
      const swap = seg(t, 8.06, 0.32, easeInOutCubic);
      const slotDY = i === 2 ? PANEL.rowStep * swap : i === 3 ? -PANEL.rowStep * swap : 0;

      const rowIn = spring(clamp((t - (5.82 + i * 0.06)) / 0.52), { freq: 1.05, damping: 0.70 });
      const say = pulse(t, spec.click, 0.55, easeOutCubic);
      const lift = pulse(t, 8.06, 0.44, easeOutCubic) * (i === 3 ? 1 : 0);

      D.setT(row.root, {
        x: lerp(34, 0, rowIn), y: slotDY, s: 1 + 0.020 * lift,
        o: seg(t, 5.82 + i * 0.06, 0.22, easeOutCubic),
        centered: false,
      });

      // Toggle state — knob position and track colour driven only by t.
      const st = clamp(
        seg(t, spec.onAt, spec.onDur, easeOutCubic) - seg(t, spec.offAt, spec.offDur, easeOutCubic)
      );
      row.tog.style.background = mix('#DEDED7', C.green, st);
      row.knob.style.transform = `translateX(${(30 * st).toFixed(3)}px) scale(${(1 + 0.10 * say).toFixed(4)})`;
      row.label.style.color = mix(C.inkFaint, C.ink, 0.25 + 0.75 * st);

      // Row highlight: a tint flash on interaction, held on the prioritised row.
      row.hl.style.opacity = clamp(0.85 * say + (i === 3 ? 0.55 * seg(t, 8.14, 0.26, easeOutCubic) : 0)).toFixed(4);

      // "Prioriteret" marker.
      const markIn = spring(clamp((t - 8.14) / 0.34), { freq: 1.05, damping: 0.66 });
      const markOn = i === 3 ? 1 : 0;
      row.mark.style.opacity = (markOn * seg(t, 8.14, 0.18, easeOutCubic)).toFixed(4);
      row.mark.style.transform =
        `translateY(-50%) scale(${(markOn ? lerp(0.72, 1, markIn) : 0.72).toFixed(4)})`;
    });

    /* ---- the human cursor ---- */
    const cp = cursorAt(t);
    const cvx = M.velocity((u) => cursorAt(u).x, t);
    const cvy = M.velocity((u) => cursorAt(u).y, t);
    const clickDip = pulse(t, 6.60, 0.22, easeOutCubic) + pulse(t, 7.20, 0.22, easeOutCubic)
                   + pulse(t, 7.78, 0.22, easeOutCubic) + pulse(t, 8.00, 0.22, easeOutCubic);
    D.setT(r.cursor, {
      x: cp.x, y: cp.y,
      s: 1 - 0.16 * clamp(clickDip),
      o: seg(t, 6.16, 0.16, easeOutCubic) * (1 - seg(t, 8.44, 0.22, easeOutCubic)),
      blur: clamp(Math.hypot(cvx, cvy) * 0.0022, 0, 10),
    });

    /* ================= 5 · the closing question ====================== */

    const q1In = spring(clamp((t - 8.92) / 0.32), { freq: 0.95, damping: 0.72 });
    D.setT(r.q1, { x: 0, y: lerp(54, 0, q1In), s: 1, o: seg(t, 8.92, 0.22, easeOutCubic) });

    const q2In = spring(clamp((t - 8.98) / 0.32), { freq: 0.95, damping: 0.72 });
    D.setT(r.q2, { x: 0, y: lerp(54, 0, q2In), s: 1, o: seg(t, 8.98, 0.22, easeOutCubic) });

    const sgIn = spring(clamp((t - 9.08) / 0.20), { freq: 1.0, damping: 0.75 });
    D.setT(r.sign, { x: 0, y: lerp(14, 0, sgIn), s: 1, o: seg(t, 9.08, 0.20, easeOutCubic) });
  },
};
