#!/usr/bin/env node
/**
 * retime.mjs — make the film longer without ever freezing a frame.
 *
 * WHY THIS EXISTS
 * ---------------
 * To make a voiceover fit, time has to be added to the picture. An editor in an
 * NLE can only do that by holding a frame: the same image is shown 45 times in a
 * row, motion stops dead, then snaps back. That is the judder.
 *
 * This project does not have that limitation. The page is a pure function of
 * time and `seekToTime()` accepts any fractional second, so we can render frames
 * at instants that never existed — 43.6133 s, 43.6289 s — and the movement
 * simply runs slower. Nothing is duplicated, nothing stops, so nothing judders.
 *
 * THE WARP
 * --------
 * Work in the direction master -> output, because that makes monotonicity free.
 *
 *   W(m) = m + SUM_k  add_k * S(u_k),   u_k = clamp((m - (at_k - R_k/2)) / R_k)
 *
 * S is smootherstep, S(u) = 6u^5 - 15u^4 + 10u^3, which is C2 continuous: its
 * value, slope AND curvature are zero at both ends. So the film eases into the
 * slow section and out of it with no perceptible change of gear.
 *
 *   W'(m) = 1 + SUM_k (add_k / R_k) * S'(u_k),   S'(u) = 30u^2 (1-u)^2
 *
 * Since add_k >= 0, W' >= 1 everywhere: W is strictly increasing, so it inverts
 * uniquely and the output can never run backwards. Total output length is
 * exactly 75 + SUM add_k, because each S goes cleanly from 0 to 1.
 *
 * Playback speed at output time o is dm/do = 1 / W'(m). At the centre of a hold
 * that is 1 / (1 + 1.875 * add / R) — with add = 1.5 s over R = 2.0 s the film
 * runs at 0.42x through the hold. Slow, continuous, and never zero.
 *
 * SYNC
 * ----
 * Outside every ramp W is the identity plus a whole number of frames, so those
 * frames come out bit-identical to the master render and everything after the
 * last hold keeps its spacing exactly. `add` is snapped to whole frames to
 * guarantee that, and the script verifies it by md5 afterwards rather than
 * asserting it.
 *
 * Usage:
 *   node scripts/retime.mjs --hold 43.6:1.5:2.0 --plan     # report, no render
 *   node scripts/retime.mjs --spec retime.json
 *   node scripts/retime.mjs --spec retime.json --fit 77.74 # scale to a length
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DURATION, FPS, BEATS, CUES } from '../src/script-da.js';
import { renderFrames } from './render-frames.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ *
 * The warp
 * ------------------------------------------------------------------ */

const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
const S = (u) => { const t = clamp01(u); return t * t * t * (t * (t * 6 - 15) + 10); };
const dS = (u) => { const t = clamp01(u); const q = t * (1 - t); return 30 * q * q; };
// Peak of dS, at u = 0.5. Used to report the slowest playback speed.
const DS_PEAK = 1.875;

export function makeWarp(holds, master = DURATION) {
  const H = holds.map((h) => ({ ...h, from: h.at - h.ramp / 2 }));
  const added = H.reduce((a, h) => a + h.add, 0);

  const W = (m) => H.reduce((acc, h) => acc + h.add * S((m - h.from) / h.ramp), m);
  const dW = (m) => H.reduce((acc, h) => acc + (h.add / h.ramp) * dS((m - h.from) / h.ramp), 1);

  // W is continuous and strictly increasing, so bisection is unconditionally
  // safe here — no derivative, no starting guess, no chance of diverging.
  const invert = (o) => {
    let lo = 0, hi = master;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (W(mid) < o) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  return { W, dW, invert, holds: H, added, master, outDuration: master + added };
}

/* ------------------------------------------------------------------ *
 * The warp, measured rather than specified
 *
 * When the editor's own cut is available, scripts/match-cut.mjs measures how
 * much time they inserted and where, as a cumulative curve add(m): master time
 * -> seconds of output time inserted up to that point. Their curve has vertical
 * steps in it, one per freeze — a step is a stopped picture, which is precisely
 * what we are removing.
 *
 * So work on the insertion RATE r(m) = d(add)/dm and convolve it with a smooth
 * kernel. Convolution with a kernel that sums to 1 preserves the total inserted
 * time exactly, so the film keeps its length and everything after the last
 * insertion keeps its sync; it only spreads each step over a wider stretch of
 * master time. Widen the kernel until the slowest playback speed clears
 * `minSpeed`, and the judder is gone by construction.
 *
 * The cost is a bounded sync error: within the smoothed region the picture can
 * sit up to (inserted seconds)/2 away from where the editor put it, decaying to
 * zero outside the kernel's support. The report prints that number so it can be
 * weighed rather than discovered.
 * ------------------------------------------------------------------ */

/** Smootherstep-shaped bump of `w` samples, normalised to sum 1. */
function kernel(w) {
  const n = Math.max(1, w | 1);
  if (n === 1) return [1];
  const k = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    // A raised-cosine-like bump with zero value AND zero slope at both ends, so
    // the smoothed rate has no corners.
    const u = (i + 0.5) / n;
    const v = dS(u);
    k.push(v);
    sum += v;
  }
  return k.map((v) => v / sum);
}

function convolve(r, k) {
  const n = r.length, h = (k.length - 1) >> 1;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < k.length; j++) {
      const p = i + j - h;
      if (p >= 0 && p < n) s += r[p] * k[j];   // outside the film counts as zero
    }
    out[i] = s;
  }
  return out;
}

// Matches motion-energy.mjs: under this share of the frame changing, the picture
// counts as still and a held frame there cannot be seen.
const REST_FRAC = 0.0015;
// Corner-rounding width, in frames, applied after the rate has been capped.
const SOFT = 9;

export function makeCurveWarp(samples, opts = {}) {
  const master = opts.master ?? DURATION;
  const minSpeed = opts.minSpeed ?? 0.35;
  const motion = opts.motion ?? null;
  const N = Math.round(master * FPS) + 1;
  const dm = 1 / FPS;

  // 1. Resample the measured curve onto the frame grid and force it to be
  //    non-decreasing. Frame matching is noisy and can step backwards; a warp
  //    that ran backwards would play the film in reverse for a moment.
  const xs = samples.map((s) => s.m), ys = samples.map((s) => s.add);
  const add0 = new Float64Array(N);
  let seg = 0, running = 0;
  for (let i = 0; i < N; i++) {
    const m = i * dm;
    while (seg < xs.length - 2 && xs[seg + 1] < m) seg++;
    const x0 = xs[seg], x1 = xs[seg + 1] ?? x0 + 1e-9;
    const f = x1 > x0 ? clamp01((m - x0) / (x1 - x0)) : 0;
    running = Math.max(running, ys[seg] + f * ((ys[seg + 1] ?? ys[seg]) - ys[seg]));
    add0[i] = running;
  }
  // Snap the measured total to whole frames. Frame matching resolves to a frame
  // anyway, and it means everything after the last insertion is offset from the
  // master by an exact number of frames — so those frames come out bit-identical
  // and the identity check below has something real to test.
  const total = Math.round(add0[N - 1] * FPS) / FPS;

  // 2. Differentiate to the insertion rate.
  const r0 = new Float64Array(N - 1);
  for (let i = 0; i < N - 1; i++) r0[i] = (add0[i + 1] - add0[i]) / dm;

  // 3. Cap the insertion rate — but only where the picture is actually moving.
  //    A freeze on a still picture is invisible, so spreading THAT one out would
  //    move the edit away from where the editor put it and buy nothing. Where
  //    the picture is still the cap is loosened instead of removed, so the fill
  //    below still prefers to spread rather than pile everything on one frame.
  const capMoving = 1 / minSpeed - 1;
  const caps = new Float64Array(N - 1);
  for (let i = 0; i < N - 1; i++) {
    const still = motion ? (motion[Math.min(motion.length - 1, i)] ?? 1) < REST_FRAC : false;
    caps[i] = still ? capMoving * 8 : capMoving;
  }

  // Push whatever exceeds the cap outward into the nearest cells that have room,
  // nearest first. Total inserted time is conserved exactly — it is only moved.
  const spill = (r) => {
    for (let i = 0; i < r.length; i++) {
      if (!(r[i] > caps[i])) continue;
      let excess = r[i] - caps[i];
      r[i] = caps[i];
      for (let d = 1; d < r.length && excess > 1e-12; d++) {
        for (const j of [i - d, i + d]) {
          if (j < 0 || j >= r.length) continue;
          const room = caps[j] - r[j];
          if (!(room > 0)) continue;
          const take = Math.min(room, excess);
          r[j] += take; excess -= take;
          if (excess <= 1e-12) break;
        }
      }
    }
  };

  const r = Float64Array.from(r0);
  spill(r);
  // The fill leaves square corners where it stopped; smoothing rounds them off
  // so the change of speed is gradual, and a second pass puts back anything that
  // the smoothing pushed over the cap again.
  const soft = convolve(r, kernel(SOFT));
  for (let i = 0; i < r.length; i++) r[i] = soft[i];
  spill(r);

  // 4. Integrate back, and rescale so the total inserted time — and therefore
  //    the output duration — is exactly what was measured. Smoothing near the
  //    ends of the film can shed a little mass outside the domain; this puts it
  //    back rather than letting the film come out short.
  const add = new Float64Array(N);
  for (let i = 1; i < N; i++) add[i] = add[i - 1] + r[i - 1] * dm;
  const scale = add[N - 1] > 0 ? total / add[N - 1] : 1;
  for (let i = 0; i < N; i++) add[i] *= scale;

  // Two different "slowest": on a moving picture it is the thing that could be
  // seen; on a still picture a near-stop is by definition invisible, so the two
  // must not be reported as one number.
  let slowest = 1, slowestMoving = 1, spread = 0;
  for (let i = 0; i < r.length; i++) {
    const speed = 1 / (1 + r[i] * scale);
    slowest = Math.min(slowest, speed);
    const still = motion ? (motion[Math.min(motion.length - 1, i)] ?? 1) < REST_FRAC : false;
    if (!still) slowestMoving = Math.min(slowestMoving, speed);
    if (r[i] * scale > 0.01) spread += dm;
  }

  const at = (arr, m) => {
    const x = Math.min(Math.max(m * FPS, 0), N - 1);
    const i = Math.floor(x), f = x - i;
    return i >= N - 1 ? arr[N - 1] : arr[i] + f * (arr[i + 1] - arr[i]);
  };

  const W = (m) => m + at(add, m);
  const dW = (m) => 1 + scale * r[Math.min(r.length - 1, Math.max(0, Math.floor(m * FPS)))];
  const invert = (o) => {
    let lo = 0, hi = master;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (W(mid) < o) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  // Where, and by how much, this differs from the editor's own cut. Outside
  // these windows the two are the same to within a frame, so anything cued to
  // the audio out there keeps landing exactly where it did.
  //
  // Inside a window the number overstates the risk: an editor's freeze holds one
  // image for its whole length, and this version passes through that same image
  // somewhere inside that same span. What genuinely moves is material near the
  // freeze but not inside it.
  const TOL = 0.05;
  let maxDev = 0;
  const diverge = [];
  let open = null;
  for (let i = 0; i < N; i++) {
    const d = Math.abs(add[i] - add0[i]);
    maxDev = Math.max(maxDev, d);
    if (d > TOL && open === null) open = { from: i * dm, max: d };
    else if (d > TOL) open.max = Math.max(open.max, d);
    else if (open) { diverge.push({ ...open, to: i * dm }); open = null; }
  }
  if (open) diverge.push({ ...open, to: master });

  return {
    W, dW, invert, master, added: total, outDuration: master + total,
    holds: [], curve: { add, r, scale, maxDev, minSpeed, slowest, slowestMoving, spread, diverge },
  };
}

/* ------------------------------------------------------------------ *
 * Spec
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const o = { holds: [], spec: null, plan: false, fit: null, quiet: false,
              out: 'dist/retimed-frames', mp4: 'dist/coop-bank-ai-agenter-retimet.mp4' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hold') {
      const [at, add, ramp] = argv[++i].split(':').map(Number);
      o.holds.push({ at, add, ramp: ramp || 2.0 });
    } else if (a === '--spec') o.spec = argv[++i];
    else if (a === '--curve') o.curve = argv[++i];
    else if (a === '--min-speed') o.minSpeed = Number(argv[++i]);
    else if (a === '--fit') o.fit = Number(argv[++i]);
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--mp4') o.mp4 = argv[++i];
    // Output frame rate, if the edit suite's sequence is not 30. Accepts
    // "29.97" or the exact "30000/1001" — NTSC rates are not really decimals,
    // and rounding one costs a frame of drift every half hour.
    else if (a === '--out-fps') o.outFps = argv[++i];
    else if (a === '--plan') o.plan = true;
    else if (a === '--quiet') o.quiet = true;
  }
  return o;
}

/** Snap every `add` to a whole frame so the identity regions stay exact. */
function snap(holds, fit) {
  let hs = holds.map((h) => ({ ...h }));
  if (fit != null) {
    const want = fit - DURATION;
    const have = hs.reduce((a, h) => a + h.add, 0);
    if (have <= 0) throw new Error('--fit needs at least one hold with add > 0');
    hs = hs.map((h) => ({ ...h, add: h.add * (want / have) }));
  }
  return hs.map((h) => ({ ...h, add: Math.round(h.add * FPS) / FPS }));
}

function validate(w) {
  const errs = [];
  for (const h of w.holds) {
    if (!(h.ramp > 0)) errs.push(`hold at ${h.at}: ramp must be > 0`);
    if (h.add < 0) errs.push(`hold at ${h.at}: add must be >= 0`);
    if (h.from < 0) errs.push(`hold at ${h.at}: ramp starts before 0 (${h.from.toFixed(2)}s)`);
    if (h.from + h.ramp > w.master) errs.push(`hold at ${h.at}: ramp ends past ${w.master}s`);
  }
  // Strict monotonicity, checked rather than assumed.
  let prev = -Infinity;
  for (let i = 0; i <= 20000; i++) {
    const v = w.W((i / 20000) * w.master);
    if (!(v > prev)) { errs.push(`W is not strictly increasing near m=${((i / 20000) * w.master).toFixed(3)}s`); break; }
    prev = v;
  }
  const end = w.W(w.master);
  if (Math.abs(end - w.outDuration) > 1e-9) {
    errs.push(`W(${w.master}) = ${end.toFixed(9)}, expected ${w.outDuration.toFixed(9)}`);
  }
  return errs;
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

function loadMotion() {
  const f = path.join(ROOT, 'dist/motion-energy.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

function report(w, frames, outFps = FPS, outFpsLabel = String(FPS)) {
  const motion = loadMotion();
  const busy = (a, b) => {
    if (!motion) return null;
    const f0 = Math.max(0, Math.round(a * FPS)), f1 = Math.min(motion.n - 1, Math.round(b * FPS));
    if (f1 < f0) return 0;
    let s = 0; for (let i = f0; i <= f1; i++) s += motion.frac[i];
    return s / (f1 - f0 + 1);
  };

  console.log(`\n[retime] master ${w.master.toFixed(3)}s  ->  output ${w.outDuration.toFixed(3)}s ` +
              `(+${w.added.toFixed(3)}s, ${frames} frames @ ${outFpsLabel} fps` +
              `${Math.abs(outFps - FPS) > 1e-9 ? ` = ${(frames / outFps).toFixed(3)}s` : ''})\n`);

  if (w.curve) {
    const { spread, minSpeed, slowestMoving, diverge } = w.curve;
    console.log(`  målt fra klippet. Den tilføjede tid er fordelt over ${spread.toFixed(2)}s af filmen.`);
    console.log(`  hvor billedet bevæger sig, spilles der aldrig langsommere end ` +
                `${(slowestMoving * 100).toFixed(0)}% (grænse ${(minSpeed * 100).toFixed(0)}%).`);
    if (diverge.length) {
      console.log('\n  timingen afviger fra dit klip her — alt udenfor ligger præcis som hos dig:');
      diverge.forEach((d) => console.log(
        `    master ${d.from.toFixed(2)}-${d.to.toFixed(2)}s   op til ${d.max.toFixed(2)}s`));
    } else {
      console.log('\n  timingen er identisk med dit klip hele vejen.');
    }
    console.log('');
    console.log('  hvor tiden er lagt (sekunder tilføjet pr. 5s af masteren):');
    for (let a = 0; a < w.master; a += 5) {
      const b = Math.min(a + 5, w.master);
      const d = w.W(b) - b - (w.W(a) - a);
      if (d < 0.005) continue;
      const e = busy(a, b);
      console.log(`    ${a.toFixed(0).padStart(3)}-${b.toFixed(0).padEnd(3)}s  +${d.toFixed(3)}s` +
        (e == null ? '' : `   billedet bevæger sig ${(e * 100).toFixed(2)}%/frame`));
    }
  }

  if (w.holds.length) console.log('  hold ved   tilføjet   rampe    master-vindue      langsomst   billedet bevæger sig');
  for (const h of w.holds) {
    const a = h.from, b = h.from + h.ramp;
    const speed = 1 / (1 + (h.add / h.ramp) * DS_PEAK);
    const e = busy(a, b);
    console.log(`  ${h.at.toFixed(2).padStart(7)}s ${('+' + h.add.toFixed(3) + 's').padStart(10)} ` +
      `${(h.ramp.toFixed(2) + 's').padStart(7)}  ${a.toFixed(2)}-${b.toFixed(2)}s`.padEnd(20) +
      `   ${(speed * 100).toFixed(0).padStart(4)}%     ` +
      (e == null ? '(kør motion-energy)' : `${(e * 100).toFixed(2)}% af billedet/frame`));
    if (h.why) console.log(`            ${h.why}`);
  }

  // The most extreme slowdown anywhere, sampled densely rather than assumed from
  // the per-hold formula, so overlapping ramps are caught.
  let peak = 1;
  for (let i = 0; i <= 40000; i++) peak = Math.max(peak, w.dW((i / 40000) * w.master));
  console.log(`\n  langsomste afspilning i hele filmen: ${(100 / peak).toFixed(0)}% af normal hastighed`);
  console.log(`  (et frys i en NLE er 0% — det er dét, der hakker)`);

  console.log('\n  beat   master        ->  output');
  for (const b of BEATS) {
    const s = w.W(b.start), e = w.W(b.end);
    const shift = s - b.start;
    console.log(`  ${String(b.n).padStart(4)}   ${b.start.toFixed(2).padStart(6)}-${b.end.toFixed(2).padEnd(6)} -> ` +
      `${s.toFixed(2).padStart(6)}-${e.toFixed(2).padEnd(6)}  ${(shift >= 0 ? '+' : '') + shift.toFixed(2)}s  ${b.title}`);
  }
}

/* ------------------------------------------------------------------ *
 * Frame plan
 * ------------------------------------------------------------------ */

export function planFrames(w, outFps = FPS) {
  const n = Math.round(w.outDuration * outFps);
  const times = [];
  let prev = -1;
  for (let j = 0; j < n; j++) {
    const o = j / outFps;
    // Never hand seekToTime a value it would clamp; the last output frame sits
    // just inside the master's final instant.
    let m = Math.min(w.invert(o), w.master - 1e-6);

    // Where the warp is the identity, snap to the master frame time exactly.
    // invert() is a bisection and lands a few femtoseconds off — far too small
    // to see, but enough to push a transform's rounded pixel value over a
    // boundary and rasterise one glyph differently. Snapping makes those frames
    // bit-identical to the master render instead of merely indistinguishable.
    const near = Math.round(m * FPS);
    const identity = Math.abs(m * FPS - near) < 1e-6 && near >= 0 && near < Math.round(w.master * FPS);
    if (identity) m = near / FPS;

    if (!(m > prev)) throw new Error(`frame ${j}: master time ${m} did not advance past ${prev}`);
    prev = m;
    // Playback speed here, for velocity-derived motion blur. Where the warp is
    // the identity this is exactly 1, so those frames render precisely as the
    // master did — which is what makes the byte-identity check below meaningful.
    const scale = identity ? 1 : 1 / w.dW(m);
    times.push({ i: j, t: m, scale, identity: identity ? near : null });
  }
  return times;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

async function main() {
  const o = parseArgs(process.argv.slice(2));
  let holds = o.holds;
  let samples = null;
  let note = '';
  if (o.curve) {
    const c = JSON.parse(fs.readFileSync(path.resolve(ROOT, o.curve), 'utf8'));
    samples = c.samples || c;
    note = c.note || '';
  }
  if (o.spec) {
    const spec = JSON.parse(fs.readFileSync(path.resolve(ROOT, o.spec), 'utf8'));
    holds = spec.holds || [];
    samples = spec.samples || spec.curve || samples;
    note = spec.note || note;
  }
  if (!holds.length && !samples) {
    console.error('usage: node scripts/retime.mjs --hold <at>:<add>[:<ramp>] ... [--fit SEC] [--plan]');
    console.error('       node scripts/retime.mjs --spec retime.json');
    console.error('       node scripts/retime.mjs --curve dist/measured-warp.json [--min-speed 0.35]');
    process.exit(1);
  }

  const mo = loadMotion();
  const w = samples
    ? makeCurveWarp(samples, { minSpeed: o.minSpeed ?? 0.35, motion: mo ? mo.frac : null })
    : makeWarp(snap(holds, o.fit));
  const errs = validate(w);
  if (errs.length) {
    console.error('[retime] invalid warp:');
    errs.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }

  // "29.97" means 30000/1001 in every edit suite that offers it; treat the
  // decimal as shorthand for the exact rational rather than as a literal.
  const fpsArg = o.outFps ?? String(FPS);
  const outFpsExact = /^29\.97$/.test(fpsArg) ? '30000/1001'
    : /^59\.94$/.test(fpsArg) ? '60000/1001'
    : /^23\.976$/.test(fpsArg) ? '24000/1001' : fpsArg;
  const outFps = outFpsExact.includes('/')
    ? Number(outFpsExact.split('/')[0]) / Number(outFpsExact.split('/')[1])
    : Number(outFpsExact);
  if (!(outFps > 0)) { console.error(`[retime] ugyldig --out-fps: ${fpsArg}`); process.exit(1); }

  const times = planFrames(w, outFps);
  if (note) console.log(`\n[retime] ${note}`);
  report(w, times.length, outFps, outFpsExact);

  const mapFile = path.join(ROOT, 'dist/retime-map.json');
  fs.mkdirSync(path.dirname(mapFile), { recursive: true });
  fs.writeFileSync(mapFile, JSON.stringify({
    fps: outFpsExact,
    masterFps: FPS,
    masterDuration: w.master,
    outDuration: w.outDuration,
    frames: times.length,
    holds: w.holds.map(({ at, add, ramp, why }) => ({ at, add, ramp, why: why || null })),
    curve: w.curve ? {
      source: 'measured', spreadSec: +w.curve.spread.toFixed(3),
      minSpeed: w.curve.minSpeed, slowestPlayback: +w.curve.slowest.toFixed(4), slowestWhereMoving: +w.curve.slowestMoving.toFixed(4),
      maxDeviationFromCutSec: +w.curve.maxDev.toFixed(4),
    } : null,
    beats: BEATS.map((b) => ({
      id: b.id, n: b.n, title: b.title,
      master: [b.start, b.end],
      output: [+w.W(b.start).toFixed(4), +w.W(b.end).toFixed(4)],
    })),
    // The spoken cues moved with the picture. Without this the timing JSON and
    // the SRT still describe the 75 s master, and every line after the inserted
    // time would be read off in the wrong place.
    cues: CUES.map((c) => ({ master: c.t, output: +w.W(c.t).toFixed(4), text: c.text })),
    // Full frame -> master-time map, so any later sync question can be answered
    // without re-deriving the warp.
    masterTimeByFrame: times.map((x) => +x.t.toFixed(5)),
  }, null, 2));
  console.log(`\n[retime] skrev ${path.relative(ROOT, mapFile)}`);

  // Subtitles on the retimed timeline. Each cue's end is carried through the
  // warp too rather than being start + a fixed duration: inside the ramp a line
  // occupies more output time than master time, and a subtitle that vanished
  // early would be the one visible sign of that.
  const tc = (sec) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };
  const srt = CUES.map((c, i) => {
    const nextMaster = CUES[i + 1] ? CUES[i + 1].t : w.master;
    const words = c.text.trim().split(/\s+/).length;
    const endMaster = Math.min(nextMaster - 0.08, c.t + (words / 167) * 60 + 0.35);
    return `${i + 1}\n${tc(w.W(c.t))} --> ${tc(w.W(endMaster))}\n${c.text}\n`;
  }).join('\n');
  const srtFile = path.join(ROOT, 'dist/voiceover-da-retimet.srt');
  fs.writeFileSync(srtFile, srt);
  console.log(`[retime] skrev ${path.relative(ROOT, srtFile)} (${CUES.length} replikker på den nye tidslinje)`);

  if (o.plan) { console.log('[retime] --plan: intet renderet'); return; }

  const outDir = path.join(ROOT, o.out);
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(`\n[retime] renderer ${times.length} frames -> ${o.out}`);
  const r = await renderFrames({ list: times.map(({ i, t, scale }) => ({ i, t, scale })), out: o.out, quiet: o.quiet });
  if (r.errors.length) { console.error('[retime] page errors — stopper'); process.exit(1); }

  // Verification: every output frame that landed exactly on a master frame must
  // be byte-identical to it. This checks the warp arithmetic and the renderer's
  // determinism at the same time, against 2000+ independent references.
  const masterDir = path.join(ROOT, 'dist/frames');
  if (fs.existsSync(masterDir)) {
    let checked = 0, bad = 0;
    for (const x of times) {
      if (x.identity == null) continue;
      const a = path.join(outDir, `frame-${String(x.i).padStart(5, '0')}.png`);
      const b = path.join(masterDir, `frame-${String(x.identity).padStart(5, '0')}.png`);
      if (!fs.existsSync(b)) continue;
      checked++;
      if (md5(a) !== md5(b)) { bad++; if (bad <= 5) console.error(`  MISMATCH frame ${x.i} vs master ${x.identity}`); }
    }
    console.log(`\n[retime] identitetstjek: ${checked - bad}/${checked} frames identiske med masteren` +
                `  (${times.length - checked} frames er nye mellemtider)`);
    if (bad) process.exitCode = 1;
  }

  // The point of the whole exercise, checked rather than assumed: the retimed
  // film must not contain more repeated frames than the master already does.
  //
  // A repeated frame is not automatically judder — this film holds a card still
  // for a few frames all the time, and roughly one frame in seven of the master
  // is identical to the one before it. What would be judder is retiming ADDING
  // repeats. So the honest measure is the rate, against the master's own.
  const rate = (dir, n) => {
    let prevHash = null, dup = 0, seen = 0;
    for (let i = 0; i < n; i++) {
      const f = path.join(dir, `frame-${String(i).padStart(5, '0')}.png`);
      if (!fs.existsSync(f)) { prevHash = null; continue; }
      const h = md5(f);
      if (h === prevHash) dup++;
      seen++;
      prevHash = h;
    }
    return { dup, seen };
  };

  const out = rate(outDir, times.length);
  const pct = (x) => `${(100 * x.dup / Math.max(1, x.seen)).toFixed(2)}%`;
  let line = `[retime] hakketjek: ${out.dup} gentagne frames af ${out.seen} (${pct(out)})`;
  if (fs.existsSync(masterDir)) {
    const ref = rate(masterDir, Math.round(w.master * FPS));
    line += `  — masteren selv: ${ref.dup} af ${ref.seen} (${pct(ref)})`;
    const worse = out.dup / Math.max(1, out.seen) - ref.dup / Math.max(1, ref.seen);
    line += worse > 0.01 ? '  <-- FLERE end masteren, undersøg' : '  — ingen tilføjet stilstand';
    if (worse > 0.01) process.exitCode = 1;
  }
  console.log(line);

  const enc = spawnSync('bash', [path.join(ROOT, 'scripts/encode-video.sh')], {
    stdio: 'inherit',
    env: { ...process.env, FRAMES_DIR: o.out, OUT: o.mp4, SILENT: '1', FPS: outFpsExact },
  });
  if (enc.status !== 0) process.exit(enc.status || 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
