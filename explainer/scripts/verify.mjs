#!/usr/bin/env node
/**
 * verify.mjs — proves the page is order-independent.
 *
 * Renders a sample of frames twice: once in ascending order, once in a
 * shuffled order (seeded, so the check itself is reproducible), then compares
 * the two sets byte for byte. Any scene that leaks state between frames — a
 * property written only inside an `if`, a value accumulated across calls —
 * shows up as a mismatch here.
 *
 * Also fails on page errors and on frames that came out effectively blank.
 *
 * Usage: node scripts/verify.mjs [--samples 36]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderFrames } from './render-frames.mjs';
import { BEATS, FPS, FRAME_COUNT } from '../src/script-da.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const SAMPLES = Number((argv[argv.indexOf('--samples') + 1]) || 36);

const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

/** Seeded shuffle so the verification run is itself deterministic. */
function shuffle(arr, seed = 20260904) {
  const a = arr.slice();
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleFrames(n) {
  const out = new Set();
  // Every beat boundary ± a couple of frames — transitions are where state
  // leaks show up first.
  BEATS.forEach((b) => {
    const s = Math.round(b.start * FPS);
    [s, s + 3, s + 9, Math.round((b.start + (b.end - b.start) * 0.5) * FPS)].forEach((f) => {
      if (f >= 0 && f < FRAME_COUNT) out.add(f);
    });
  });
  // …plus an even spread across the rest of the film.
  for (let i = 0; i < n; i++) out.add(Math.round((i / n) * (FRAME_COUNT - 1)));
  out.add(0); out.add(FRAME_COUNT - 1);
  return [...out].sort((a, b) => a - b);
}

async function main() {
  const list = sampleFrames(SAMPLES);
  console.log(`[verify] sampling ${list.length} frames`);

  const dirA = 'dist/.verify-a';
  const dirB = 'dist/.verify-b';
  for (const d of [dirA, dirB]) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });

  console.log('[verify] pass 1 — ascending order');
  const a = await renderFrames({ list, out: dirA, quiet: true });
  console.log('[verify] pass 2 — shuffled order');
  const b = await renderFrames({ list: shuffle(list), out: dirB, quiet: true });

  const problems = [];
  if (a.errors.length) problems.push(...a.errors.map((e) => `page error: ${e}`));
  if (b.errors.length) problems.push(...b.errors.map((e) => `page error: ${e}`));

  let mismatched = 0;
  const beatOf = (f) => {
    const t = f / FPS;
    let k = 1;
    BEATS.forEach((x, i) => { if (t >= x.start) k = i + 1; });
    return k;
  };

  for (const f of list) {
    const name = `frame-${String(f).padStart(5, '0')}.png`;
    const fa = path.join(ROOT, dirA, name);
    const fb = path.join(ROOT, dirB, name);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { problems.push(`missing capture for frame ${f}`); continue; }
    if (md5(fa) !== md5(fb)) {
      mismatched++;
      problems.push(`NON-DETERMINISTIC frame ${f} (beat ${beatOf(f)}, t=${(f / FPS).toFixed(2)}s)`);
    }
    // A PNG of a flat single-colour 1920x1080 frame lands near ~8 kB; well
    // below that means something failed to draw at all.
    const size = fs.statSync(fa).size;
    if (size < 7000) problems.push(`frame ${f} (beat ${beatOf(f)}) looks blank — ${size} bytes`);
  }

  fs.rmSync(path.join(ROOT, dirA), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, dirB), { recursive: true, force: true });

  if (problems.length) {
    console.error(`\n[verify] FAILED — ${problems.length} problem(s):`);
    [...new Set(problems)].forEach((p) => console.error('  · ' + p));
    process.exit(1);
  }
  console.log(`\n[verify] OK — ${list.length} frames identical in both orders, no page errors, none blank.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
