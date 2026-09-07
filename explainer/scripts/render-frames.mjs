#!/usr/bin/env node
/**
 * render-frames.mjs — deterministic frame capture.
 *
 * For every frame index: seekToFrame(i) -> wait for the explicit frame-ready
 * signal -> screenshot -> next. Frames may be rendered in any order; the page
 * derives its entire state from the frame index alone.
 *
 * Usage:
 *   node scripts/render-frames.mjs                 # all 2250 frames
 *   node scripts/render-frames.mjs 450             # one frame
 *   node scripts/render-frames.mjs 0 300           # inclusive range
 *   node scripts/render-frames.mjs 0 2249 --scale 0.5 --out dist/preview-frames
 *   node scripts/render-frames.mjs --beats         # one frame per beat
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function parseArgs(argv) {
  const o = { from: null, to: null, out: 'dist/frames', scale: 1, beats: false, quiet: false };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--scale') o.scale = Number(argv[++i]);
    else if (a === '--beats') o.beats = true;
    else if (a === '--quiet') o.quiet = true;
    else if (/^-?\d+$/.test(a)) pos.push(Number(a));
  }
  if (pos.length === 1) { o.from = pos[0]; o.to = pos[0]; }
  else if (pos.length >= 2) { o.from = pos[0]; o.to = pos[1]; }
  return o;
}

export async function renderFrames(opts = {}) {
  const o = { out: 'dist/frames', scale: 1, quiet: false, ...opts };
  const outDir = path.isAbsolute(o.out) ? o.out : path.join(ROOT, o.out);
  fs.mkdirSync(outDir, { recursive: true });

  const { server, url } = await start(0);
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--force-device-scale-factor=1',
      '--font-render-hinting=none',
      '--disable-font-subpixel-positioning',
      '--disable-lcd-text',
      '--hide-scrollbars',
      '--disable-background-timer-throttling',
      '--force-color-profile=srgb',
      '--deterministic-mode',
      // Reproducibility across frame order. Chromium reuses previously
      // rasterised tile content and picks a layer's raster scale from the
      // transform it first saw, so a frame could come out a few hundredths of
      // a percent different depending on which frame preceded it. These force
      // every frame to rasterise from scratch, on the CPU, at its own scale.
      '--disable-partial-raster',
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-checker-imaging',
      '--disable-image-animation-resync',
      '--disable-composited-antialiasing',
    ],
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(`${url}/index.html?render=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  const meta = await page.evaluate(() => ({
    frames: window.getFrameCount(),
    fps: window.getFps(),
    duration: window.getDuration(),
  }));

  let list = opts.list;
  if (!list) {
    const from = o.from == null ? 0 : Math.max(0, o.from);
    const to = o.to == null ? meta.frames - 1 : Math.min(meta.frames - 1, o.to);
    list = [];
    for (let i = from; i <= to; i++) list.push(i);
  }

  // Two ways to name a capture. A bare integer is a frame on the master
  // timeline. `{ i, t, scale }` is an output frame index `i` captured at master
  // time `t` seconds — that is what a retimed render needs, because its frames
  // sit *between* master frames and there is no integer that names them.
  // `scale` is the playback speed there, which velocity-derived motion blur
  // needs; it defaults to normal speed.
  const items = list.map((x) => (typeof x === 'number'
    ? { i: x, t: null, scale: 1 }
    : { scale: 1, ...x }));

  const t0 = Date.now();
  const written = [];
  for (let n = 0; n < items.length; n++) {
    const { i, t, scale } = items[n];
    // 1. set the exact frame  2. wait for the frame-ready signal  3. capture
    await page.evaluate(({ f, sec, spd }) => {
      // Detach the stage before seeking and re-attach after. This tears down
      // every compositor layer, so the frame is rasterised from nothing but its
      // own state — no tile or raster-scale carried over from whichever frame
      // happened to be rendered before it.
      //
      // LOAD-BEARING. It looks like belt and braces next to the `body.render`
      // guard in styles.css, but that guard only resets will-change and
      // backface-visibility. Two scenes still use real 3D transforms —
      // beat07.js:333 translate3d, and beat11.js:297/464 perspective + rotateY
      // for the window unfold, which is a deliberate part of the design — and
      // those force layer promotion on their own, where no CSS reset reaches
      // them. Remove these six lines and frame order starts to matter again.
      const stage = document.getElementById('stage');
      const parent = stage.parentNode;
      const anchor = stage.nextSibling;
      parent.removeChild(stage);
      if (sec == null) window.seekToFrame(f); else window.seekToTime(sec, spd);
      parent.insertBefore(stage, anchor);
      void stage.offsetWidth;

      document.documentElement.dataset.frameReady = '0';
      return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
        document.documentElement.dataset.frameReady = String(f);
        res();
      })));
    }, { f: i, sec: t, spd: scale });
    await page.waitForFunction(
      (f) => document.documentElement.dataset.frameReady === String(f),
      i, { timeout: 20000 }
    );

    const file = path.join(outDir, `frame-${String(i).padStart(5, '0')}.png`);
    const shot = { path: file, type: 'png', animations: 'disabled' };
    if (o.scale !== 1) {
      shot.clip = { x: 0, y: 0, width: 1920, height: 1080 };
      shot.scale = 'css';
    }
    await page.screenshot(shot);
    written.push(file);

    if (!o.quiet && (n % 50 === 0 || n === items.length - 1)) {
      const done = n + 1;
      const rate = done / ((Date.now() - t0) / 1000);
      const eta = (items.length - done) / Math.max(rate, 0.001);
      process.stdout.write(
        `  frame ${String(i).padStart(5, '0')}  ${done}/${items.length}  ` +
        `${rate.toFixed(1)} fps  eta ${(eta / 60).toFixed(1)} min\n`
      );
    }
  }

  await browser.close();
  server.close();

  if (errors.length) {
    console.error('\n[render] page errors detected:');
    [...new Set(errors)].slice(0, 20).forEach((e) => console.error('  ' + e));
  }
  return { written, errors: [...new Set(errors)], meta, ms: Date.now() - t0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = parseArgs(process.argv.slice(2));
  const run = async () => {
    if (o.beats) {
      const { BEATS, FPS } = await import('../src/script-da.js');
      // A representative frame from each beat: 55 % in, safely past the
      // incoming transition and inside the readable hold.
      const list = BEATS.map((b) => Math.round((b.start + (b.end - b.start) * 0.55) * FPS));
      return renderFrames({ ...o, list, out: o.out === 'dist/frames' ? 'dist/beats' : o.out });
    }
    return renderFrames(o);
  };
  run().then((r) => {
    console.log(`\n[render] ${r.written.length} frames in ${(r.ms / 1000).toFixed(1)}s -> ${path.dirname(r.written[0] || '')}`);
    if (r.errors.length) process.exitCode = 1;
  }).catch((e) => { console.error(e); process.exit(1); });
}
