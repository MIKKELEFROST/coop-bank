#!/usr/bin/env node
/**
 * contact-sheet.mjs — render one representative frame per beat and lay them
 * out as a labelled storyboard sheet (dist/storyboard-contact-sheet.png).
 *
 * The sheet itself is composed in the browser so the labels use the same
 * bundled Inter as the film.
 *
 * Usage:
 *   node scripts/contact-sheet.mjs                 # render frames, then sheet
 *   node scripts/contact-sheet.mjs --reuse         # reuse dist/beats/*.png
 *   node scripts/contact-sheet.mjs --frames 30,120,400 --out dist/check.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { renderFrames } from './render-frames.mjs';
import { BEATS, FPS } from '../src/script-da.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const argv = process.argv.slice(2);
const arg = (name, d) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : d;
};
const REUSE = argv.includes('--reuse');
const OUT = path.join(ROOT, arg('--out', 'dist/storyboard-contact-sheet.png'));
const COLS = Number(arg('--cols', 3));

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

const custom = arg('--frames', null);
const items = custom
  ? custom.split(',').map((n) => Number(n)).map((fr) => {
      const b = BEATS.filter((x) => fr / FPS >= x.start).pop() || BEATS[0];
      return { frame: fr, id: b.id, title: b.title, time: fr / FPS };
    })
  : BEATS.map((b) => {
      // 55 % into the beat: past the incoming transition, inside the hold.
      const frame = Math.round((b.start + (b.end - b.start) * 0.55) * FPS);
      return { frame, id: b.id, title: b.title, time: frame / FPS };
    });

const dir = path.join(ROOT, 'dist/beats');

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  if (!REUSE) {
    console.log(`[sheet] rendering ${items.length} representative frames …`);
    await renderFrames({ list: items.map((i) => i.frame), out: 'dist/beats', quiet: true });
  }

  const cells = items.map((it) => {
    const file = path.join(dir, `frame-${String(it.frame).padStart(5, '0')}.png`);
    const b64 = fs.readFileSync(file).toString('base64');
    return { ...it, src: `data:image/png;base64,${b64}` };
  });

  const CELL_W = 620;
  const rows = Math.ceil(cells.length / COLS);
  const html = `<!doctype html><meta charset="utf-8">
<style>
  @font-face{font-family:Inter;font-weight:400;src:url('file://${ROOT}/assets/brand/fonts/inter-latin-400-normal.woff2') format('woff2')}
  @font-face{font-family:Inter;font-weight:600;src:url('file://${ROOT}/assets/brand/fonts/inter-latin-600-normal.woff2') format('woff2')}
  @font-face{font-family:Inter;font-weight:700;src:url('file://${ROOT}/assets/brand/fonts/inter-latin-700-normal.woff2') format('woff2')}
  *{box-sizing:border-box;margin:0}
  body{background:#E9E9E4;font-family:Inter,sans-serif;padding:40px;width:${COLS * (CELL_W + 26) + 80 - 26}px}
  header{display:flex;align-items:baseline;gap:16px;margin-bottom:26px}
  h1{font-size:26px;font-weight:700;letter-spacing:-.02em;color:#151515}
  .sub{font-size:15px;color:#6a6a66;font-weight:500}
  .grid{display:grid;grid-template-columns:repeat(${COLS},${CELL_W}px);gap:26px}
  figure{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.09)}
  img{display:block;width:100%;height:auto}
  figcaption{padding:11px 14px 13px;border-top:1px solid #EDEDE8}
  .n{font-size:15px;font-weight:700;color:#151515;letter-spacing:-.01em}
  .m{font-size:12.5px;color:#8a8a85;font-weight:500;margin-top:3px;font-variant-numeric:tabular-nums}
  .dot{width:8px;height:8px;border-radius:50%;background:#E30613;display:inline-block;margin-right:7px}
</style>
<header>
  <h1><span class="dot"></span>Coop Bank · Marketing og AI-agenter</h1>
  <div class="sub">Storyboard · 12 beats · 1920×1080 · 30 fps · 75 s · 2250 frames</div>
</header>
<div class="grid">
${cells.map((c, i) => `  <figure>
    <img src="${c.src}">
    <figcaption>
      <div class="n">${i + 1}. ${c.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
      <div class="m">${c.id} · ${fmt(c.time)} · frame ${c.frame}</div>
    </figcaption>
  </figure>`).join('\n')}
</div>`;

  const tmp = path.join(ROOT, 'dist/.sheet.html');
  fs.writeFileSync(tmp, html);

  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({ viewport: { width: COLS * (CELL_W + 26) + 54, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  fs.unlinkSync(tmp);

  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`[sheet] ${cells.length} cells (${COLS}×${rows}) -> ${path.relative(ROOT, OUT)} (${kb} kB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
