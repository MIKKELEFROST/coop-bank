#!/usr/bin/env node
/**
 * match-cut.mjs — work out what an editor did to the film, frame by frame.
 *
 * Given a re-cut version of this film, this recovers the mapping from its
 * frames back to master time. That mapping IS the edit: where it advances one
 * master frame per output frame nothing was changed; where it stalls, time was
 * inserted; the stall length is how much.
 *
 * The recovered curve is written as a warp spec that scripts/retime.mjs can
 * render — smoothly, at the same length, so an existing audio mix still fits.
 *
 * HOW THE MATCH IS DONE
 * ---------------------
 * A re-cut is a monotone time-warp of the master: frames keep their order, some
 * are repeated. That is exactly the structure dynamic time warping assumes, so
 * DTW recovers the alignment optimally rather than by nearest-neighbour guessing
 * — which matters here, because long stretches of this film look nearly
 * identical from one frame to the next and a per-frame nearest match is
 * ambiguous. DTW resolves that ambiguity using the whole sequence.
 *
 * The search is banded: an editor's insertions are bounded (a few seconds), so
 * only alignments within BAND frames of the running diagonal are considered.
 * That turns an O(N*M) problem into O(N*BAND).
 *
 * Usage:
 *   node scripts/match-cut.mjs deres-klip.mp4
 *   node scripts/match-cut.mjs deres-klip.mp4 --out dist/measured-warp.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DURATION, FPS } from '../src/script-da.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;

// Matching resolution. Small enough that a whole film fits in memory several
// times over, large enough to tell two adjacent frames of this film apart.
const W = 48, H = 27, PX = W * H;
// How far from the running diagonal an alignment may stray, in frames. 6 s of
// inserted time at 30 fps is 180; 300 leaves generous headroom.
const BAND = Number(process.env.BAND || 300);

/** Decode any video (or a frame folder) to a flat greyscale sequence at FPS. */
function decode(src) {
  const isDir = fs.existsSync(src) && fs.statSync(src).isDirectory();
  const input = isDir
    ? ['-framerate', String(FPS), '-start_number', '0', '-i', path.join(src, 'frame-%05d.png')]
    : ['-i', src];
  const r = spawnSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', ...input,
    // Force the master frame rate so both sequences are indexed in the same
    // units; the editor's file may well be 29.97.
    '-vf', `fps=${FPS},scale=${W}:${H}:flags=area,format=gray`,
    '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 30 });
  if (!r.stdout || !r.stdout.length) {
    throw new Error(`could not decode ${src}\n${String(r.stderr).slice(0, 800)}`);
  }
  const n = Math.floor(r.stdout.length / PX);
  return { buf: r.stdout, n };
}

/** Mean absolute difference between frame a of A and frame b of B. */
const dist = (A, a, B, b) => {
  let s = 0;
  const p = a * PX, q = b * PX;
  for (let i = 0; i < PX; i++) s += Math.abs(A[p + i] - B[q + i]);
  return s / PX;
};

/**
 * Banded DTW. Rows are the editor's frames, columns are master frames.
 * Steps allowed at each cell:
 *   diagonal — one output frame, one master frame: normal playback
 *   up       — one output frame, no master frame: a hold (inserted time)
 *   left     — no output frame, one master frame: frames were removed
 * A hold costs a small penalty so that, where the picture is genuinely static
 * and every alignment fits equally well, the match prefers to keep playing
 * rather than to invent a stall.
 */
function align(cut, master) {
  const N = cut.n, M = master.n;
  const HOLD = Number(process.env.HOLD_PENALTY || 0.35);
  const SKIP = Number(process.env.SKIP_PENALTY || 0.35);
  const INF = Infinity;

  // Only cells within BAND of the diagonal are reachable, stored per row.
  const lo = new Int32Array(N), hi = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const centre = Math.round((i * (M - 1)) / Math.max(1, N - 1));
    lo[i] = Math.max(0, centre - BAND);
    hi[i] = Math.min(M - 1, centre + BAND);
  }

  let prev = new Float64Array(hi[0] - lo[0] + 1).fill(INF);
  const back = [];
  for (let j = lo[0]; j <= hi[0]; j++) {
    // Starting anywhere in the first row's band would let the match skip the
    // opening; the cut and the master both start at time zero, so anchor there.
    prev[j - lo[0]] = j === 0 ? dist(cut.buf, 0, master.buf, 0) : INF;
  }
  back.push(new Uint8Array(hi[0] - lo[0] + 1));

  for (let i = 1; i < N; i++) {
    const width = hi[i] - lo[i] + 1;
    const cur = new Float64Array(width).fill(INF);
    const bk = new Uint8Array(width);
    for (let k = 0; k < width; k++) {
      const j = lo[i] + k;
      const d = dist(cut.buf, i, master.buf, j);
      // 0 = diagonal, 1 = hold (same master frame as the row above), 2 = skip
      let best = INF, from = 0;
      const pk = j - lo[i - 1];
      if (pk - 1 >= 0 && pk - 1 < prev.length && prev[pk - 1] + d < best) { best = prev[pk - 1] + d; from = 0; }
      if (pk >= 0 && pk < prev.length && prev[pk] + d + HOLD < best) { best = prev[pk] + d + HOLD; from = 1; }
      if (k > 0 && cur[k - 1] + d + SKIP < best) { best = cur[k - 1] + d + SKIP; from = 2; }
      cur[k] = best; bk[k] = from;
    }
    prev = cur; back.push(bk);
  }

  // Backtrack from the last output frame against the last master frame.
  const pathOut = new Int32Array(N);
  let i = N - 1, j = Math.min(M - 1, hi[N - 1]);
  while (i >= 0) {
    pathOut[i] = j;
    const k = j - lo[i];
    const step = k >= 0 && k < back[i].length ? back[i][k] : 0;
    if (i === 0) break;
    if (step === 2) { j = Math.max(lo[i], j - 1); continue; }
    if (step === 0) j = Math.max(0, j - 1);
    i--;
  }
  return pathOut;
}

function main() {
  const src = process.argv[2];
  const outArg = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'dist/measured-warp.json';
  if (!src || !fs.existsSync(src)) {
    console.error('usage: node scripts/match-cut.mjs <deres-klip.mp4> [--out dist/measured-warp.json]');
    process.exit(1);
  }

  const masterSrc = fs.existsSync(path.join(ROOT, 'dist/frames/frame-00000.png'))
    ? path.join(ROOT, 'dist/frames')
    : path.join(ROOT, 'dist/coop-bank-ai-agenter-preview.mp4');

  console.log(`[match] master  ${path.relative(ROOT, masterSrc)}`);
  const master = decode(masterSrc);
  console.log(`[match] klip    ${src}`);
  const cut = decode(src);
  console.log(`[match] ${cut.n} frames (${(cut.n / FPS).toFixed(2)}s) mod ${master.n} frames (${(master.n / FPS).toFixed(2)}s)`);
  console.log(`[match] justerer … (bånd ±${BAND} frames)`);

  const p = align(cut, master);

  // add(m) — output seconds inserted by the time we reach master time m.
  const samples = [];
  let lastMaster = -1;
  for (let i = 0; i < cut.n; i++) {
    const m = p[i] / FPS, o = i / FPS;
    if (p[i] !== lastMaster) { samples.push({ m: +m.toFixed(4), add: +(o - m).toFixed(4) }); lastMaster = p[i]; }
  }
  // Anchor both ends so the curve covers the whole master timeline.
  if (samples[0].m > 0) samples.unshift({ m: 0, add: 0 });
  const totalInserted = cut.n / FPS - master.n / FPS;
  samples.push({ m: DURATION, add: +totalInserted.toFixed(4) });

  // Where did the time go? Report per master second, so the edit is legible.
  console.log(`\n[match] klippet er ${(cut.n / FPS).toFixed(2)}s — ${totalInserted >= 0 ? '+' : ''}${totalInserted.toFixed(2)}s i forhold til masteren\n`);
  console.log('  master-sek   tilføjet');
  const perSec = new Map();
  for (const s of samples) {
    const b = Math.floor(s.m);
    perSec.set(b, Math.max(perSec.get(b) ?? 0, s.add));
  }
  const keys = [...perSec.keys()].sort((a, b) => a - b);
  let prevAdd = 0;
  for (const k of keys) {
    const d = perSec.get(k) - prevAdd;
    if (d >= 0.05) console.log(`  ${String(k).padStart(6)}-${String(k + 1).padEnd(4)}  +${d.toFixed(2)}s`);
    prevAdd = perSec.get(k);
  }

  const out = path.resolve(ROOT, outArg);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    note: `målt fra ${path.basename(src)}`,
    source: path.basename(src),
    cutFrames: cut.n, cutDuration: +(cut.n / FPS).toFixed(4),
    masterDuration: +(master.n / FPS).toFixed(4),
    inserted: +totalInserted.toFixed(4),
    samples,
  }, null, 2));
  console.log(`\n[match] skrev ${path.relative(ROOT, out)}`);
  console.log(`[match] render den blødt med:\n         node scripts/retime.mjs --curve ${path.relative(ROOT, out)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
