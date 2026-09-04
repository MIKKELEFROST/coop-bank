/**
 * motion.js — deterministic motion primitives.
 *
 * Hard rule for this project: nothing in here may read a clock. Every value is
 * a pure function of the time value passed in, so frame 1400 can be rendered
 * before frame 20 and produce byte-identical output.
 */

export const FPS = 30;
/** One frame, in seconds. Use `f(12)` to express "12 frames". */
export const f = (frames) => frames / FPS;

/* ------------------------------------------------------------------ *
 * Scalar helpers
 * ------------------------------------------------------------------ */

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Inverse lerp, unclamped. */
export const inv = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
/** Remap v from [a0,a1] onto [b0,b1], clamped. */
export const remap = (v, a0, a1, b0, b1) => lerp(b0, b1, clamp(inv(a0, a1, v)));

export const smoothstep = (a, b, v) => {
  const t = clamp(inv(a, b, v));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, v) => {
  const t = clamp(inv(a, b, v));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/* ------------------------------------------------------------------ *
 * Easing — all take and return 0..1
 * ------------------------------------------------------------------ */

export const linear = (t) => clamp(t);
export const easeInCubic = (t) => { t = clamp(t); return t * t * t; };
export const easeOutCubic = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeInOutCubic = (t) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutQuint = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 5); };
export const easeInQuint = (t) => { t = clamp(t); return Math.pow(t, 5); };
export const easeInOutQuint = (t) => {
  t = clamp(t);
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
};
export const easeOutQuart = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 4); };
export const easeInOutQuart = (t) => {
  t = clamp(t);
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
};
export const easeOutExpo = (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
export const easeInExpo = (t) => { t = clamp(t); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); };
export const easeInOutExpo = (t) => {
  t = clamp(t);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
};
export const easeOutSine = (t) => Math.sin((clamp(t) * Math.PI) / 2);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;

/**
 * Overshoot ease. `amount` is the peak overshoot as a fraction (0.05 = 5%).
 * House style caps at ~0.07 — see the motion guidelines in README.md.
 */
export const easeOutBack = (t, amount = 0.05) => {
  t = clamp(t);
  // Classic back-out with c1 solved so the peak lands near `amount`.
  const c1 = amount * 10.0;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Critically-tuned damped spring, evaluated analytically so it is a pure
 * function of t (no integration state, no order dependence).
 *
 * @param {number} t  progress 0..1 across `duration`
 * @param {object} o  {freq: oscillations across the duration, damping: 0..1}
 * @returns 0..1, settling on 1
 */
export const spring = (t, o = {}) => {
  const { freq = 1.35, damping = 0.62 } = o;
  t = clamp(t);
  if (t >= 1) return 1;
  const w = freq * Math.PI * 2;
  const z = clamp(damping, 0.05, 0.999);
  const wd = w * Math.sqrt(1 - z * z);
  const env = Math.exp(-z * w * t);
  const v = 1 - env * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  // Blend to exactly 1 at the tail so the settle is clean and hold frames are static.
  return lerp(v, 1, smoothstep(0.82, 1, t));
};

/* ------------------------------------------------------------------ *
 * Timing
 * ------------------------------------------------------------------ */

/**
 * Segment progress. The workhorse of every scene.
 *   seg(t, 0.4, 0.5, easeOutQuint) -> 0..1 over [0.4s, 0.9s]
 */
export const seg = (t, start, dur, ease = easeInOutCubic) =>
  ease(clamp(dur <= 0 ? (t >= start ? 1 : 0) : (t - start) / dur));

/** Segment that runs backwards: 1 -> 0 over [start, start+dur]. */
export const segOut = (t, start, dur, ease = easeInOutCubic) => 1 - seg(t, start, dur, ease);

/** Staggered start time for item i. */
export const stagger = (i, per, base = 0) => base + i * per;

/**
 * A pulse that rises and falls: 0 -> 1 -> 0 across [start, start+dur].
 * Used for the "word is spoken" card accents.
 */
export const pulse = (t, start, dur, ease = easeOutCubic) => {
  const p = clamp((t - start) / dur);
  if (p <= 0 || p >= 1) return 0;
  return p < 0.4 ? ease(p / 0.4) : 1 - ease((p - 0.4) / 0.6);
};

/** 1 while t is inside the window, 0 outside, with soft shoulders. */
export const window_ = (t, start, end, fade = 0.16) =>
  smoothstep(start, start + fade, t) * (1 - smoothstep(end - fade, end, t));

/**
 * Numeric derivative of any deterministic value function — the basis of
 * velocity-driven motion blur. Central difference over one frame.
 */
export const velocity = (fn, t, dt = f(1)) => (fn(t + dt) - fn(t - dt)) / (2 * dt);

/**
 * Motion blur in px from a position function, in px/second.
 * `k` scales px/s into blur px; capped so fast moves stay legible.
 */
export const blurFromVelocity = (fn, t, k = 0.0075, cap = 26) =>
  clamp(Math.abs(velocity(fn, t)) * k, 0, cap);

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random — seeded, never Math.random()
 * ------------------------------------------------------------------ */

/** mulberry32: same seed always yields the same stream. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Single hashed value in 0..1 from an integer index — no state at all. */
export const hash01 = (i, salt = 0) => {
  let t = (i + salt * 374761393 + 1) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* ------------------------------------------------------------------ *
 * Path helpers
 * ------------------------------------------------------------------ */

/** Cubic bezier point at u (0..1) for four {x,y} control points. */
export function bezier(p0, p1, p2, p3, u) {
  const m = 1 - u;
  const a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, d = u * u * u;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/** Build an "S" curve path string between two points with a horizontal bend. */
export function curveH(x1, y1, x2, y2, bend = 0.5) {
  const dx = (x2 - x1) * bend;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Vertical-bend variant. */
export function curveV(x1, y1, x2, y2, bend = 0.5) {
  const dy = (y2 - y1) * bend;
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}

export default {
  FPS, f, clamp, lerp, inv, remap, smoothstep, smootherstep,
  linear, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuint, easeInQuint,
  easeInOutQuint, easeOutQuart, easeInOutQuart, easeOutExpo, easeInExpo,
  easeInOutExpo, easeOutSine, easeInOutSine, easeOutBack, spring,
  seg, segOut, stagger, pulse, window_, velocity, blurFromVelocity,
  rng, hash01, bezier, curveH, curveV,
};
