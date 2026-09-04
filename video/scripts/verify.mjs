#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   verify.mjs — proves the renderer is reproducible before anyone invests time
   in content.

   THE CONTRACT UNDER TEST
   A render is a forward pass from a cold start. Two such passes must produce
   byte-identical pixels, and a partial render must splice into a full one.

   That contract is narrower than "any seek to t gives the same pixels", and
   deliberately so. Chromium rasterises a blurred or 3D-transformed layer
   differently depending on that layer's history, and GSAP's set() does not
   restore the pre-set value when a timeline is seeked backwards past it.
   Neither is reachable from the capture path, which only ever walks forward
   (and warms over skipped frames when --from is used). Test C measures the
   backward-seek divergence and reports it, but does not fail on it.

     A  cold forward pass vs cold forward pass  -> must match   (the contract)
     B  warmed partial render vs full render    -> must match   (--from splice)
     C  forward vs backward scrubbing           -> informational
   --------------------------------------------------------------------------- */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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
  throw new Error("playwright not found");
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
};

function serve(root) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(root, rel === "/" ? "/composition/index.html" : rel);
      fs.readFile(file, (err, buf) => {
        if (err) return res.writeHead(404).end();
        res.writeHead(200, {
          "content-type": MIME[path.extname(file)] || "application/octet-stream",
          "cache-control": "no-store",
        });
        res.end(buf);
      });
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

const LAUNCH_ARGS = [
  "--force-device-scale-factor=1",
  "--disable-lcd-text",
  "--font-render-hinting=none",
  "--disable-font-subpixel-positioning",
  "--hide-scrollbars",
  "--force-color-profile=srgb",
  "--disable-gpu",
];

const { chromium } = loadPlaywright();

async function open(url) {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

/** Seek, then wait for one committed compositor frame. Mirrors capture.mjs. */
async function seek(page, t) {
  await page.evaluate(async (tt) => {
    window.__setTime(tt);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, t);
}

/** Walks frames 0..last in order, hashing only the frames in `want`. */
async function forwardPass(url, fps, last, want) {
  const { browser, page } = await open(url);
  const out = new Map();
  const wanted = new Set(want);
  for (let n = 0; n <= last; n++) {
    await seek(page, n / fps);
    if (wanted.has(n)) out.set(n, sha(await page.screenshot({ animations: "disabled" })));
  }
  await browser.close();
  return out;
}

/** Mimics `capture.mjs --from`: warm silently over skipped frames, then hash. */
async function partialPass(url, fps, from, to) {
  const { browser, page } = await open(url);
  for (let n = 0; n < from; n++) {
    await seek(page, n / fps);
  }
  const out = new Map();
  for (let n = from; n <= to; n++) {
    await seek(page, n / fps);
    out.set(n, sha(await page.screenshot({ animations: "disabled" })));
  }
  await browser.close();
  return out;
}

/** Seeks the given times in the given order, hashing each. */
async function scrubPass(url, times) {
  const { browser, page } = await open(url);
  const out = new Map();
  for (const t of times) {
    await seek(page, t);
    out.set(t.toFixed(4), sha(await page.screenshot({ animations: "disabled" })));
  }
  await browser.close();
  return out;
}

/* -- Run ------------------------------------------------------------------- */
const server = await serve(ROOT);
const url = `http://127.0.0.1:${server.address().port}/composition/index.html`;

const { browser: b0, page: p0 } = await open(url);
const { fps, duration, beats } = await p0.evaluate(() => ({
  fps: window.__film.fps,
  duration: window.__duration,
  beats: window.__film.beats.map((b) => ({ id: b.id, at: b.at, dur: b.dur })),
}));
await b0.close();

const lastFrame = Math.round(duration * fps) - 1;

// Sample every beat boundary plus a spread across the film.
const probe = new Set();
for (const b of beats) {
  probe.add(Math.round(b.at * fps));
  probe.add(Math.round((b.at + b.dur / 2) * fps));
  probe.add(Math.min(lastFrame, Math.round((b.at + b.dur) * fps) - 1));
}
for (let n = 0; n <= lastFrame; n += 37) probe.add(n);
const want = [...probe].filter((n) => n >= 0 && n <= lastFrame).sort((a, b) => a - b);

let failed = 0;

console.log(`verify   ${duration}s @ ${fps}fps, ${lastFrame + 1} frames`);
console.log(`         ${want.length} probe frames\n`);

console.log(`A  cold forward pass x2 (the render contract)`);
const A1 = await forwardPass(url, fps, lastFrame, want);
const A2 = await forwardPass(url, fps, lastFrame, want);
let badA = [];
for (const [n, h] of A1) if (A2.get(n) !== h) badA.push(n);
console.log(
  badA.length === 0
    ? `   PASS  ${A1.size}/${A1.size} frames byte-identical across two processes`
    : `   FAIL  ${badA.length}/${A1.size} differ: frames ${badA.slice(0, 10).join(", ")}`
);
if (badA.length) failed++;

const from = Math.round(beats[4].at * fps);
const to = Math.min(lastFrame, from + 45);
console.log(`\nB  partial render frames ${from}..${to} vs full render`);
const P = await partialPass(url, fps, from, to);
const F = await forwardPass(url, fps, lastFrame, [...P.keys()]);
let badB = [];
for (const [n, h] of P) if (F.get(n) !== h) badB.push(n);
console.log(
  badB.length === 0
    ? `   PASS  ${P.size}/${P.size} frames splice cleanly`
    : `   FAIL  ${badB.length}/${P.size} differ: frames ${badB.slice(0, 10).join(", ")}`
);
if (badB.length) failed++;

const times = want.map((n) => n / fps);
console.log(`\nC  forward vs backward scrubbing (informational)`);
const S1 = await scrubPass(url, times);
const S2 = await scrubPass(url, [...times].reverse());
let badC = 0;
for (const [k, h] of S1) if (S2.get(k) !== h) badC++;
console.log(
  `   ${badC}/${S1.size} frames differ when scrubbed backwards.\n` +
    `   Expected and not a render defect: GSAP set() does not revert on a\n` +
    `   backward seek, and blurred layers rasterise from history. The capture\n` +
    `   path never seeks backwards.`
);

server.close();

const distinct = new Set(A1.values()).size;
console.log(`\ndistinct frames  ${distinct}/${A1.size} (repeats are static beats — expected)`);

if (failed === 0) {
  console.log(`\nREPRODUCIBLE — the render contract holds.`);
  process.exit(0);
}
console.log(`\nBROKEN — ${failed} contract test(s) failed.`);
process.exit(1);
