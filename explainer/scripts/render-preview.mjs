#!/usr/bin/env node
/**
 * render-preview.mjs — a fast low-resolution pass over the whole film.
 *
 * Used during production to watch the cut and check every transition before
 * committing to the 2250-frame full-resolution render. Same deterministic
 * seek path; only the capture scale differs.
 *
 * Usage:
 *   node scripts/render-preview.mjs              # every 2nd frame, 960x540
 *   node scripts/render-preview.mjs --step 1     # all frames
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import { FRAME_COUNT, FPS } from '../src/script-da.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const argv = process.argv.slice(2);
const STEP = Number(argv[argv.indexOf('--step') + 1]) || 2;
const OUTDIR = path.join(ROOT, 'dist/preview-frames');

const main = async () => {
  fs.rmSync(OUTDIR, { recursive: true, force: true });
  fs.mkdirSync(OUTDIR, { recursive: true });

  const { server, url } = await start(0);
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1',
           '--font-render-hinting=none', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  // Half-resolution viewport: the stage scales itself to fit, so the whole
  // composition is captured, just smaller and much faster.
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 0.5 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}/index.html?render=1`, { waitUntil: 'load' });
  await page.addStyleTag({ content: '#stage{transform:scale(0.5)!important;transform-origin:0 0!important}' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });

  const t0 = Date.now();
  let n = 0;
  for (let i = 0; i < FRAME_COUNT; i += STEP) {
    await page.evaluate((f) => {
      window.seekToFrame(f);
      return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    }, i);
    await page.screenshot({ path: path.join(OUTDIR, `frame-${String(n).padStart(5, '0')}.png`) });
    n++;
    if (n % 100 === 0) process.stdout.write(`  ${i}/${FRAME_COUNT}  ${(n / ((Date.now() - t0) / 1000)).toFixed(1)} fps\n`);
  }
  await browser.close();
  server.close();
  if (errors.length) console.error('[preview] page errors:\n  ' + [...new Set(errors)].join('\n  '));

  console.log(`[preview] ${n} frames -> dist/preview-frames`);
  execSync(
    `FRAMES_DIR=dist/preview-frames OUT=dist/preview-lowres.mp4 FPS=${FPS / STEP} CRF=24 PRESET=veryfast bash scripts/encode-video.sh`,
    { cwd: ROOT, stdio: 'inherit' }
  );
};

main().catch((e) => { console.error(e); process.exit(1); });
