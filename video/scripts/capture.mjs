#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   capture.mjs — deterministic frame capture.

   Serves composition/ over localhost (ES modules will not load over file://),
   opens it in headless Chromium at exactly 1920x1080, then for every frame
   seeks the GSAP timeline to an exact time and screenshots.

   Motion blur is real, not faked: each output frame is captured as N subframe
   samples spread across the shutter interval, which assemble.mjs averages.
   Set --samples 1 to turn it off for fast preview renders.

   Usage
     node scripts/capture.mjs                          # full film, 4 samples
     node scripts/capture.mjs --samples 1              # fast, no motion blur
     node scripts/capture.mjs --from 7.0 --to 9.0      # just the dead stop
     node scripts/capture.mjs --scale 0.5              # half-res preview
   --------------------------------------------------------------------------- */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/* -- Locate Playwright ----------------------------------------------------
   Mirrors the resolution order used by Higgsfield's own sandbox scripts, so
   this runs unchanged locally and inside sandbox_exec. */
function loadPlaywright() {
  const roots = [path.join(ROOT, "node_modules"), process.env.NODE_PATH];
  try {
    roots.push(execSync("npm root -g", { encoding: "utf8" }).trim());
  } catch {}
  for (const r of roots) {
    if (!r) continue;
    try {
      return createRequire(path.join(r, "x.js"))("playwright");
    } catch {}
  }
  throw new Error("playwright not found (npm i -g playwright, or add locally)");
}

/* -- Args ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const num = (name, dflt) => Number(arg(name, dflt));

const SAMPLES = Math.max(1, Math.round(num("samples", 4)));
const SHUTTER = num("shutter", 0.5);
const SCALE = num("scale", 1);
const OUTDIR = path.resolve(ROOT, arg("out", "out/frames"));

/* -- Static server --------------------------------------------------------- */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(root, rel === "/" ? "/composition/index.html" : rel);
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404).end("not found: " + rel);
          return;
        }
        res.writeHead(200, {
          "content-type": MIME[path.extname(file)] || "application/octet-stream",
          "cache-control": "no-store",
        });
        res.end(buf);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* -- Main ------------------------------------------------------------------ */
const { chromium } = loadPlaywright();

const server = await serve(ROOT);
const port = server.address().port;
const url = `http://127.0.0.1:${port}/composition/index.html`;

const browser = await chromium.launch({
  args: [
    // Stable rasterisation across runs and machines.
    "--force-device-scale-factor=1",
    "--disable-lcd-text",
    "--font-render-hinting=none",
    "--disable-font-subpixel-positioning",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "--disable-gpu",
  ],
});

const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: SCALE,
  reducedMotion: "no-preference",
  colorScheme: "light",
});

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
await page.evaluate(() => document.fonts.ready);

const fps = await page.evaluate(() => window.__film.fps);
const duration = await page.evaluate(() => window.__duration);

const FROM = num("from", 0);
const TO = num("to", duration);
const first = Math.round(FROM * fps);
const last = Math.min(Math.round(TO * fps), Math.round(duration * fps)) - 1;
const total = last - first + 1;

fs.rmSync(OUTDIR, { recursive: true, force: true });
fs.mkdirSync(OUTDIR, { recursive: true });

console.log(
  `capture  ${total} frames  ${first}..${last}  @${fps}fps  ` +
    `samples=${SAMPLES} shutter=${SHUTTER} scale=${SCALE}`
);

/* Warm the timeline.
   Chromium's rasterisation of a blurred or 3D-transformed layer depends on
   that layer's history, so seeking straight to frame 400 does not reliably
   produce the same pixels as walking there one frame at a time. Verified: a
   cold jump differed from a forward walk on frames carrying an active blur.
   Walking the skipped frames (no screenshots) makes a --from render take the
   identical path a full render takes, so partial re-renders splice cleanly. */
if (first > 0) {
  process.stdout.write(`  warming timeline over ${first} skipped frames... `);
  for (let n = 0; n < first; n++) {
    await page.evaluate((tt) => window.__setTime(tt), n / fps);
  }
  process.stdout.write("done\n");
}

const started = Date.now();
let written = 0;

for (let n = first; n <= last; n++) {
  for (let s = 0; s < SAMPLES; s++) {
    // Spread samples across the open shutter. With SAMPLES=1 this collapses to
    // the frame's own instant, which is what a zero-blur render should be.
    const offset = SAMPLES === 1 ? 0 : (s / SAMPLES) * SHUTTER;
    const t = (n + offset) / fps;
    /* Seek, then let the compositor produce one full frame before capturing.
       Without this barrier the screenshot occasionally races the commit and
       returns the previous frame's raster for composited subtrees — it showed
       up as an intermittent 3-in-42 failure that moved between runs, which is
       exactly what a race looks like and exactly what a layer-history bug does
       not. Two rAFs: the first fires before the commit, the second after. */
    await page.evaluate(async (tt) => {
      window.__setTime(tt);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, t);
    const idx = String(written).padStart(6, "0");
    await page.screenshot({
      path: path.join(OUTDIR, `s_${idx}.png`),
      animations: "disabled",
    });
    written++;
  }
  if ((n - first) % 30 === 0 || n === last) {
    const done = n - first + 1;
    const rate = done / ((Date.now() - started) / 1000);
    process.stdout.write(
      `\r  frame ${done}/${total}  ${rate.toFixed(1)} fps  ` +
        `eta ${Math.round((total - done) / Math.max(rate, 0.01))}s   `
    );
  }
}

process.stdout.write("\n");
await browser.close();
server.close();

fs.writeFileSync(
  path.join(OUTDIR, "manifest.json"),
  JSON.stringify(
    { fps, samples: SAMPLES, shutter: SHUTTER, scale: SCALE, first, last, total, written },
    null,
    2
  )
);

console.log(`wrote ${written} subframes -> ${path.relative(ROOT, OUTDIR)}`);
console.log(`took ${((Date.now() - started) / 1000).toFixed(1)}s`);
