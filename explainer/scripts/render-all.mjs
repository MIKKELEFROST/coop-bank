#!/usr/bin/env node
/**
 * render-all.mjs — the full production run, end to end.
 *
 *   1. scan assets + write asset-report.md
 *   2. emit the voiceover manuscript, timing JSON and SRT
 *   3. render all 2250 frames at 1920x1080
 *   4. encode the MP4
 *   5. build the storyboard contact sheet
 *   6. probe the result and check resolution / fps / duration
 *
 * Usage: node scripts/render-all.mjs [--skip-frames]
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFrames } from './render-frames.mjs';
import { FRAME_COUNT, FPS, DURATION } from '../src/script-da.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = process.argv.includes('--skip-frames');
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

const step = (n, label) => console.log(`\n\x1b[1m[${n}/6] ${label}\x1b[0m`);

step(1, 'Assets');
run('node scripts/scan-assets.mjs');

step(2, 'Voiceover-leverancer');
run('node scripts/voiceover.mjs');

step(3, `Frames (${FRAME_COUNT} @ 1920x1080)`);
if (SKIP) {
  console.log('  sprunget over (--skip-frames)');
} else {
  fs.rmSync(path.join(ROOT, 'dist/frames'), { recursive: true, force: true });
  const r = await renderFrames({ from: 0, to: FRAME_COUNT - 1, out: 'dist/frames' });
  if (r.errors.length) {
    console.error('\nafbrudt: siden rapporterede fejl under renderingen');
    process.exit(1);
  }
}

step(4, 'Encode MP4');
run('bash scripts/encode-video.sh');

step(5, 'Storyboard contact sheet');
run('node scripts/contact-sheet.mjs');

step(6, 'Verifikation');
const ffmpeg = execFileSync('node', ['-e', "process.stdout.write(require('@ffmpeg-installer/ffmpeg').path)"], { cwd: ROOT }).toString();
const out = path.join(ROOT, 'dist/coop-bank-ai-agenter-preview.mp4');
const probe = execFileSync(ffmpeg, ['-hide_banner', '-i', out], { stdio: ['ignore', 'pipe', 'pipe'] , encoding: 'utf8'})
  .concat('');
const info = (() => {
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', out], { stdio: ['ignore', 'pipe', 'pipe'] });
    return '';
  } catch (e) { return String(e.stderr || ''); }
})();
const text = probe + info;

const checks = [
  ['1920x1080', /1920x1080/.test(text)],
  ['30 fps', /\b30 fps\b/.test(text)],
  ['yuv420p', /yuv420p/.test(text)],
  ['h264', /h264|H\.264/.test(text)],
  [`~${DURATION}s`, /Duration: 00:01:15\.0/.test(text)],
];
checks.forEach(([k, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${k}`));
console.log('\n' + text.split('\n').filter((l) => /Duration|Stream/.test(l)).join('\n'));

const bad = checks.filter(([, ok]) => !ok);
if (bad.length) {
  console.error(`\n[render-all] ${bad.length} kontrol(ler) fejlede: ${bad.map(([k]) => k).join(', ')}`);
  process.exit(1);
}
console.log('\n[render-all] færdig.');
