#!/usr/bin/env node
/**
 * motion-energy.mjs — measure how much of the picture is moving, frame by frame.
 *
 * Retiming needs to know where the film is at rest. Time added where nothing
 * moves is invisible; time added mid-movement is exactly what produces judder in
 * an NLE. This measures both, so a hold can be argued for rather than guessed.
 *
 * Two numbers per frame, against the frame before it:
 *   mean — average |delta| over the whole frame. Reads overall activity, but a
 *          small element moving on a large static background barely registers.
 *   frac — the fraction of pixels that changed by at least DELTA. This is the
 *          one that matters: it detects a single card sliding in.
 *
 * Frames are decoded at 192x108 greyscale. Retiming decisions are made at the
 * scale of "is anything moving", not per-pixel, and the small size keeps a
 * 2250-frame pass to a few seconds.
 *
 * Usage:
 *   node scripts/motion-energy.mjs                       # dist/frames
 *   node scripts/motion-energy.mjs dist/retimed-frames
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { BEATS, FPS } from '../src/script-da.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;

const W = 192, H = 108, PX = W * H;
// A per-pixel step of 6/255 is around the point where a change becomes visible
// on a flat graphic; below it we are measuring compression-grade noise.
const DELTA = Number(process.env.DELTA || 6);
// Under this share of the frame changing, call the picture still.
export const REST = Number(process.env.REST || 0.0015);

export function measure(framesDir) {
  const dir = path.isAbsolute(framesDir) ? framesDir : path.join(ROOT, framesDir);
  const count = fs.readdirSync(dir).filter((f) => /^frame-\d+\.png$/.test(f)).length;
  if (!count) throw new Error(`no frames in ${dir}`);

  const r = spawnSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-start_number', '0', '-i', path.join(dir, 'frame-%05d.png'),
    '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 30 });
  const buf = r.stdout;
  const n = Math.floor(buf.length / PX);
  if (n !== count) console.warn(`[motion] decoded ${n} of ${count} frames`);

  const mean = new Float64Array(n), frac = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    let sum = 0, moved = 0;
    const a = i * PX, b = (i - 1) * PX;
    for (let p = 0; p < PX; p++) {
      const d = Math.abs(buf[a + p] - buf[b + p]);
      sum += d;
      if (d >= DELTA) moved++;
    }
    mean[i] = sum / PX;
    frac[i] = moved / PX;
  }
  // The first frame has no predecessor; treat it as the second so a still run at
  // the head of the film is not broken by an artificial spike.
  mean[0] = mean[1] || 0;
  frac[0] = frac[1] || 0;
  return { n, mean, frac };
}

/** Contiguous stretches, in seconds, where less than REST of the frame moves. */
export function stillRuns(frac, { minLen = 0.2, from = 0, to = Infinity } = {}) {
  const runs = [];
  const f0 = Math.max(0, Math.round(from * FPS));
  const f1 = Math.min(frac.length - 1, Math.round(to * FPS) - 1);
  let start = null;
  for (let i = f0; i <= f1; i++) {
    const still = frac[i] < REST;
    if (still && start === null) start = i;
    if ((!still || i === f1) && start !== null) {
      const end = still ? i : i - 1;
      if ((end - start) / FPS >= minLen) runs.push([start / FPS, end / FPS]);
      start = null;
    }
  }
  return runs;
}

/** Mean moving-pixel fraction over a master-time window — "how busy is it here". */
export function energyIn(frac, from, to) {
  const f0 = Math.max(0, Math.round(from * FPS));
  const f1 = Math.min(frac.length - 1, Math.round(to * FPS));
  if (f1 < f0) return 0;
  let s = 0;
  for (let i = f0; i <= f1; i++) s += frac[i];
  return s / (f1 - f0 + 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist/frames';
  const { n, mean, frac } = measure(dir);
  const out = path.join(ROOT, 'dist/motion-energy.json');
  fs.writeFileSync(out, JSON.stringify({
    frames: dir, fps: FPS, n, delta: DELTA, rest: REST,
    mean: Array.from(mean, (x) => +x.toFixed(4)),
    frac: Array.from(frac, (x) => +x.toFixed(5)),
  }));

  const sorted = [...frac].sort((a, b) => a - b);
  console.log(`[motion] ${n} frames fra ${dir}`);
  console.log(`  andel af billedet i bevægelse:  median ${(sorted[n >> 1] * 100).toFixed(2)}%` +
              `   p90 ${(sorted[Math.floor(n * 0.9)] * 100).toFixed(1)}%` +
              `   max ${(sorted[n - 1] * 100).toFixed(1)}%`);
  console.log(`\n  stilstand = under ${(REST * 100).toFixed(2)}% af billedet ændrer sig\n`);
  console.log('  beat  vindue        stille perioder (sek)                                 i alt');

  const all = [];
  for (const b of BEATS) {
    const runs = stillRuns(frac, { from: b.start, to: b.end });
    runs.forEach(([s, e]) => all.push({ n: b.n, s, e, len: e - s }));
    const total = runs.reduce((a, [s, e]) => a + (e - s), 0);
    console.log(`  ${String(b.n).padStart(4)}  ${String(b.start).padStart(5)}-${String(b.end).padEnd(5)}  ` +
      (runs.map(([s, e]) => `${s.toFixed(2)}-${e.toFixed(2)}`).join(' ') || '(ingen)').padEnd(52) +
      ` ${total.toFixed(2)}s`);
  }

  all.sort((a, b) => b.len - a.len);
  console.log('\n  hvor tid kan lægges usynligt (længste stilstande):');
  all.slice(0, 8).forEach((r) =>
    console.log(`    beat ${String(r.n).padStart(2)}   ${r.s.toFixed(2)}-${r.e.toFixed(2)}   ${r.len.toFixed(2)}s`));
  console.log(`\n[motion] skrev ${path.relative(ROOT, out)}`);
}
