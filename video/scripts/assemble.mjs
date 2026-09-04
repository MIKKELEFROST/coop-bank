#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   assemble.mjs — averages subframe samples into motion-blurred frames and
   encodes the master MP4.

   With samples=N, capture.mjs writes N images per output frame. ffmpeg's
   tmix filter averages a sliding window of N, so the average belonging to
   output frame k sits at input index k*N + (N-1). trim + framestep pick
   exactly those, which is the whole motion-blur step.

   Usage
     node scripts/assemble.mjs
     node scripts/assemble.mjs --crf 16 --out out/film.mp4
     node scripts/assemble.mjs --audio track.m4a
   --------------------------------------------------------------------------- */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};

const FRAMES = path.resolve(ROOT, arg("frames", "out/frames"));
const OUT = path.resolve(ROOT, arg("out", "out/film.mp4"));
const CRF = arg("crf", "17");
const AUDIO = arg("audio", null);

/* -- Find a capable ffmpeg -------------------------------------------------
   Playwright ships a stripped ffmpeg with neither libx264 nor tmix, so a
   binary being present is not enough — it has to be checked. */
function findFfmpeg() {
  const cands = [];
  if (process.env.FFMPEG) cands.push(process.env.FFMPEG);
  cands.push("ffmpeg");
  try {
    cands.push(
      execSync(
        'python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"',
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      ).trim()
    );
  } catch {}

  for (const c of cands) {
    if (!c) continue;
    try {
      const enc = execFileSync(c, ["-hide_banner", "-encoders"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const filt = execFileSync(c, ["-hide_banner", "-filters"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (enc.includes("libx264") && / tmix /.test(filt)) return c;
    } catch {}
  }
  throw new Error(
    "no ffmpeg with libx264 + tmix found. Set FFMPEG=/path/to/ffmpeg, or " +
      "pip install imageio-ffmpeg."
  );
}

const manifestPath = path.join(FRAMES, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  throw new Error(`no manifest at ${manifestPath} — run capture.mjs first`);
}
const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const ffmpeg = findFfmpeg();

fs.mkdirSync(path.dirname(OUT), { recursive: true });

/* Averaging chain. With samples=1 there is nothing to average, so the filter
   collapses to a plain format conversion. */
const vf =
  m.samples > 1
    ? `tmix=frames=${m.samples},trim=start_frame=${m.samples - 1},` +
      `setpts=PTS-STARTPTS,framestep=${m.samples},format=yuv420p`
    : `format=yuv420p`;

const args = [
  "-y",
  "-hide_banner",
  "-loglevel", "error",
  "-stats",
  // Read subframes at samples x target rate so timing stays honest.
  "-framerate", String(m.fps * m.samples),
  "-i", path.join(FRAMES, "s_%06d.png"),
];

if (AUDIO) args.push("-i", path.resolve(ROOT, AUDIO));

args.push(
  "-vf", vf,
  "-r", String(m.fps),
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", String(CRF),
  "-pix_fmt", "yuv420p",
  // Colour metadata tagged explicitly: the references are bt709 and an
  // untagged file will drift on some players.
  "-colorspace", "bt709",
  "-color_primaries", "bt709",
  "-color_trc", "bt709",
  "-movflags", "+faststart"
);

if (AUDIO) args.push("-c:a", "aac", "-b:a", "192k", "-shortest");

args.push(OUT);

console.log(`ffmpeg   ${ffmpeg}`);
console.log(`blur     ${m.samples} samples/frame, shutter ${m.shutter}`);
console.log(`encode   ${m.total} frames @ ${m.fps}fps -> ${path.relative(ROOT, OUT)}`);

execFileSync(ffmpeg, args, { stdio: "inherit" });

const bytes = fs.statSync(OUT).size;
console.log(`done     ${(bytes / 1e6).toFixed(2)} MB`);
