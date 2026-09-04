/**
 * design.js — the shared visual system every scene builds from.
 *
 * Two jobs:
 *   1. Tokens (colour, type, elevation) so twelve scenes look like one film.
 *   2. DOM/SVG factories + the per-frame setters that scenes call in render().
 *
 * Contract for setters: a setter always writes EVERY property it owns. Scenes
 * must never rely on a value left behind by a previous frame, because frames
 * are rendered in arbitrary order.
 */

/* ------------------------------------------------------------------ *
 * Tokens
 * ------------------------------------------------------------------ */

export const C = {
  bg: '#F6F6F3',
  bgDeep: '#EFEFEA',
  ink: '#151515',
  inkSoft: '#5A5A57',
  inkFaint: '#9A9A95',
  red: '#E30613',
  redDeep: '#B00410',
  blue: '#315BFF',
  green: '#48C77A',
  yellow: '#FFC84A',
  cardRed: '#FFD9DC',
  cardBlue: '#DCE7FF',
  cardGreen: '#DDF7E5',
  cardYellow: '#FFEFC9',
  white: '#FFFFFF',
  line: '#E4E4DE',
  lineSoft: '#EDEDE8',
  darkBg: '#0B0B0C',
  darkPanel: '#141416',
  darkLine: '#2A2A2E',
  darkInk: '#F4F4F1',
  darkInkSoft: '#8E8E93',
};

export const STAGE = { w: 1920, h: 1080, cx: 960, cy: 540 };

/** Elevation ramp. Index 0 is flat-on-page, 4 is "floating above the film". */
export const SHADOW = [
  'none',
  '0 1px 2px rgba(21,21,21,.05), 0 2px 6px rgba(21,21,21,.04)',
  '0 2px 6px rgba(21,21,21,.06), 0 8px 20px rgba(21,21,21,.06)',
  '0 6px 16px rgba(21,21,21,.08), 0 20px 44px rgba(21,21,21,.09)',
  '0 12px 30px rgba(21,21,21,.10), 0 38px 80px rgba(21,21,21,.12)',
];

/* ------------------------------------------------------------------ *
 * DOM factories
 * ------------------------------------------------------------------ */

/** Create an element. `cls` may be a space separated list. */
export function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

export const NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/** Full-stage SVG layer with a 1920x1080 user space. */
export function svgLayer(parent, cls = '') {
  const s = svg('svg', {
    class: 'layer ' + cls,
    viewBox: `0 0 ${STAGE.w} ${STAGE.h}`,
    width: STAGE.w, height: STAGE.h,
    fill: 'none',
  }, parent);
  return s;
}

/**
 * Absolutely-position a node by its CENTRE at stage coordinates.
 * All scene layout is centre-based so overshoot/scale never shifts anchors.
 */
export function place(node, x, y, w, h) {
  node.style.position = 'absolute';
  node.style.left = x + 'px';
  node.style.top = y + 'px';
  if (w != null) node.style.width = w + 'px';
  if (h != null) node.style.height = h + 'px';
  node.style.transform = 'translate(-50%,-50%)';
  node.style.willChange = 'transform, opacity, filter';
  return node;
}

/* ------------------------------------------------------------------ *
 * Per-frame setters
 * ------------------------------------------------------------------ */

/**
 * The workhorse. Writes transform, opacity and blur in one go.
 * Because `place()` already centres the node with translate(-50%,-50%), the
 * transform below re-applies that offset before the animated part.
 *
 * @param {HTMLElement} n
 * @param {object} t {x,y,s,sx,sy,r,o,blur,skew,z}
 */
export function setT(n, t = {}) {
  const {
    x = 0, y = 0, s = 1, sx = null, sy = null, r = 0, o = 1,
    blur = 0, skew = 0, centered = true, origin = null,
  } = t;
  const base = centered ? 'translate(-50%,-50%) ' : '';
  const scale = sx != null || sy != null
    ? `scale(${(sx != null ? sx : s).toFixed(5)},${(sy != null ? sy : s).toFixed(5)})`
    : `scale(${s.toFixed(5)})`;
  n.style.transform =
    `${base}translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) ` +
    (r ? `rotate(${r.toFixed(4)}deg) ` : '') +
    (skew ? `skewX(${skew.toFixed(4)}deg) ` : '') +
    scale;
  n.style.opacity = o.toFixed(4);
  n.style.filter = blur > 0.02 ? `blur(${blur.toFixed(3)}px)` : 'none';
  if (origin) n.style.transformOrigin = origin;
  return n;
}

/** Same as setT but for SVG nodes (no -50% base offset, uses the SVG box). */
export function setS(n, t = {}) {
  const { x = 0, y = 0, s = 1, r = 0, o = 1, ox = 0, oy = 0 } = t;
  n.setAttribute(
    'transform',
    `translate(${(x + ox).toFixed(3)} ${(y + oy).toFixed(3)}) ` +
    (r ? `rotate(${r.toFixed(4)}) ` : '') +
    `scale(${s.toFixed(5)}) translate(${(-ox).toFixed(3)} ${(-oy).toFixed(3)})`
  );
  n.setAttribute('opacity', o.toFixed(4));
  return n;
}

/**
 * Directional motion blur. CSS blur() is isotropic; this gives a real
 * horizontal/vertical smear for whip-pans and fast object moves.
 * Call once at build time, then use the returned setter each frame.
 */
let _dirBlurSeq = 0;
export function makeDirBlur(scopeId) {
  const defs = document.getElementById('global-defs');
  const id = `mb-${scopeId}-${_dirBlurSeq++}`;
  const filt = svg('filter', {
    id, x: '-60%', y: '-60%', width: '220%', height: '220%',
    'color-interpolation-filters': 'sRGB',
  }, defs);
  const b = svg('feGaussianBlur', { stdDeviation: '0 0', in: 'SourceGraphic' }, filt);
  return {
    id,
    /** @param {HTMLElement|SVGElement} node @param {number} bx @param {number} by */
    set(node, bx, by = 0) {
      const X = Math.max(0, bx), Y = Math.max(0, by);
      b.setAttribute('stdDeviation', `${X.toFixed(3)} ${Y.toFixed(3)}`);
      const use = X > 0.03 || Y > 0.03;
      if (node) node.style.filter = use ? `url(#${id})` : 'none';
      return use;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

/**
 * Split a string into word spans for kinetic typography.
 * Returns the span array; spaces are preserved as separate inline nodes so
 * the line still wraps and measures like normal text.
 */
export function words(container, text, cls = 'w') {
  const out = [];
  const parts = String(text).split(' ');
  parts.forEach((wtext, i) => {
    const outer = el('span', 'w-outer', container);
    const inner = el('span', cls, outer, wtext);
    out.push(inner);
    if (i < parts.length - 1) container.appendChild(document.createTextNode(' '));
  });
  return out;
}

/** Split into character spans (used sparingly — only for short accents). */
export function chars(container, text, cls = 'ch') {
  return String(text).split('').map((c) => {
    const s = el('span', cls, container, c === ' ' ? ' ' : c);
    s.style.display = 'inline-block';
    return s;
  });
}

/* ------------------------------------------------------------------ *
 * Component factories — the recurring objects of the film
 * ------------------------------------------------------------------ */

/**
 * Rounded application-style card.
 * @returns {{root:HTMLElement, title:HTMLElement, sub:HTMLElement, body:HTMLElement, badge:HTMLElement, icon:HTMLElement}}
 */
export function card(parent, o = {}) {
  const {
    w = 340, title = '', sub = '', body = '', badge = '', tone = 'white',
    icon = null, pad = 26, radius = 22, align = 'left',
  } = o;
  const root = el('div', 'card tone-' + tone, parent);
  root.style.width = w + 'px';
  root.style.padding = pad + 'px';
  root.style.borderRadius = radius + 'px';
  root.style.textAlign = align;

  let head = null, iconEl = null;
  if (icon || title) {
    head = el('div', 'card-head', root);
    if (icon) {
      iconEl = el('div', 'card-icon', head);
      iconEl.appendChild(icon);
    }
    if (title) el('div', 'card-title', head, title);
  }
  const subEl = sub ? el('div', 'card-sub', root, sub) : null;
  const bodyEl = body ? el('div', 'card-body', root, body) : null;
  const badgeEl = badge ? el('div', 'card-badge', root, badge) : null;

  return {
    root,
    head,
    icon: iconEl,
    title: head ? head.querySelector('.card-title') : null,
    sub: subEl,
    body: bodyEl,
    badge: badgeEl,
  };
}

/** Small pill / chip. */
export function chip(parent, text, tone = 'white') {
  const n = el('div', 'chip tone-' + tone, parent, text);
  return n;
}

/** A window chrome frame — used for "app" surfaces and screenshot stand-ins. */
export function appWindow(parent, o = {}) {
  const { w = 620, h = 400, title = '', radius = 20 } = o;
  const root = el('div', 'appwin', parent);
  root.style.width = w + 'px';
  root.style.height = h + 'px';
  root.style.borderRadius = radius + 'px';
  const bar = el('div', 'appwin-bar', root);
  const dots = el('div', 'appwin-dots', bar);
  for (let i = 0; i < 3; i++) el('span', 'dot d' + i, dots);
  const t = el('div', 'appwin-title', bar, title);
  const body = el('div', 'appwin-body', root);
  return { root, bar, title: t, body };
}

/** The agent core: the red circle that becomes the film's protagonist. */
export function agentCore(parent, size = 120) {
  const root = el('div', 'agent-core', parent);
  root.style.width = size + 'px';
  root.style.height = size + 'px';
  const ring = el('div', 'agent-ring', root);
  const dot = el('div', 'agent-dot', root);
  return { root, ring, dot };
}

/* ------------------------------------------------------------------ *
 * Vector icons — simple strokes, never emoji
 * ------------------------------------------------------------------ */

const ICONS = {
  plan: 'M5 4h11l3 3v13H5z M16 4v3h3 M8 12h8 M8 16h5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16.5 16.5 21 21',
  decide: 'M12 3l8 5v8l-8 5-8-5V8z M8.5 12l2.5 2.5L16 9.5',
  execute: 'M13 2 4 14h6l-1 8 9-12h-6z',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M4 20h16',
  spark: 'M12 3v5 M12 16v5 M3 12h5 M16 12h5 M6.2 6.2l3.3 3.3 M14.5 14.5l3.3 3.3 M17.8 6.2l-3.3 3.3 M9.5 14.5l-3.3 3.3',
  shield: 'M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z',
  check: 'M4.5 12.5 10 18 20 6',
  pen: 'M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z',
  voice: 'M4 9v6h4l5 4V5L8 9H4z M17 8.5a5 5 0 0 1 0 7 M19.8 6a9 9 0 0 1 0 12',
  target: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
  code: 'M8.5 7 3.5 12l5 5 M15.5 7l5 5-5 5 M13.5 4l-3 16',
  layers: 'M12 3 3 8l9 5 9-5-9-5z M3 13l9 5 9-5 M3 17.5l9 5 9-5',
  cursor: 'M5 3l14 7.5-6.2 1.6L9.8 19z',
  arrow: 'M4 12h15 M13.5 6.5 20 12l-6.5 5.5',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5 M17 5.2a3.5 3.5 0 0 1 0 6.6 M18 14.8c2.2.6 3.5 2.3 3.5 5.2',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6z',
  lock: 'M6 10V8a6 6 0 1 1 12 0v2 M4.5 10h15v11h-15z M12 14.5v2.5',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  wave: 'M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0',
  db: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
};

/** Returns an <svg> node for a named icon, coloured by currentColor. */
export function icon(name, size = 24, stroke = 2) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name] || ICONS.spark);
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', stroke);
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  s.appendChild(p);
  return s;
}

export const iconNames = Object.keys(ICONS);

/* ------------------------------------------------------------------ *
 * SVG path reveal
 * ------------------------------------------------------------------ */

/**
 * Prepare a <path> for dash-based reveal. Call once at build time.
 * @returns {{node:SVGPathElement, len:number, set:(p:number, from?:number)=>void}}
 */
export function revealPath(pathNode) {
  const len = pathNode.getTotalLength ? pathNode.getTotalLength() : 1000;
  pathNode.style.strokeDasharray = `${len}`;
  pathNode.style.strokeDashoffset = `${len}`;
  return {
    node: pathNode,
    len,
    /**
     * @param {number} p  0..1 drawn fraction
     * @param {number} from 0..1 start of the drawn window (for travelling dashes)
     */
    set(p, from = 0) {
      const a = Math.max(0, Math.min(1, from));
      const b = Math.max(a, Math.min(1, p));
      const seglen = (b - a) * len;
      pathNode.style.strokeDasharray = `${seglen} ${len + 10}`;
      pathNode.style.strokeDashoffset = `${-a * len}`;
      pathNode.style.opacity = seglen > 0.5 ? '1' : '0';
    },
  };
}

/**
 * Centre of a node in stage coordinates (0..1920, 0..1080), independent of
 * whether the preview is scaled to fit the window.
 *
 * Measured with getBoundingClientRect so `place()`'s centring translate and
 * any wrapper transforms are already included. Scenes are visible while
 * build() runs (timeline.js hides them afterwards), so rects are real.
 */
export function stageCenter(node) {
  const stage = document.getElementById('stage');
  const sr = stage.getBoundingClientRect();
  const k = sr.width / STAGE.w || 1;
  const r = node.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2 - sr.left) / k,
    y: (r.top + r.height / 2 - sr.top) / k,
    w: r.width / k,
    h: r.height / k,
  };
}

/** Point along a path at 0..1 — for objects that travel a connector. */
export function pointOn(pathNode, p, len) {
  const L = len != null ? len : pathNode.getTotalLength();
  const pt = pathNode.getPointAtLength(Math.max(0, Math.min(1, p)) * L);
  return { x: pt.x, y: pt.y };
}

export default {
  C, STAGE, SHADOW, el, svg, svgLayer, place, setT, setS, makeDirBlur,
  words, chars, card, chip, appWindow, agentCore, icon, iconNames,
  revealPath, pointOn, stageCenter, NS,
};
