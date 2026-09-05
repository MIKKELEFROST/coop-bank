#!/usr/bin/env node
/**
 * split-sfx-pack.mjs — split a compilation of sound effects into one file per
 * sound, and name each by what it actually is.
 *
 * Packs usually arrive as a single audio file with the sounds separated by
 * silence. This finds those gaps, cuts each sound out with a little headroom
 * so attacks are not clipped, then measures it and puts the character in the
 * filename — a folder of `tick`, `whoosh` and `impact` is usable; a folder of
 * `clip-01 … clip-30` is not.
 *
 * Classification uses the same measurements that characterised the reference
 * video's sound design: where the energy sits across the spectrum, and how
 * fast the sound starts and stops.
 *
 * Usage:
 *   node scripts/split-sfx-pack.mjs <input> [outDir]
 *   node scripts/split-sfx-pack.mjs pack.mp3 assets/audio/sfx-library
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;

const INPUT = process.argv[2];
const OUTDIR = path.resolve(ROOT, process.argv[3] || 'assets/audio/sfx-library');
if (!INPUT || !fs.existsSync(INPUT)) {
  console.error('usage: node scripts/split-sfx-pack.mjs <input-audio> [outDir]');
  process.exit(1);
}

/** ffmpeg, returning stderr — where it reports analysis filters. */
const ff = (args) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return String(r.stderr || '');
};

/* ------------------------------------------------------------------ *
 * 1. Find the gaps
 * ------------------------------------------------------------------ */

// -45 dB for at least 0.2 s: quiet enough to be a real gap, short enough not
// to cut a sound in half at its own decay tail.
const NOISE_DB = process.env.NOISE_DB || '-45dB';
const MIN_GAP = Number(process.env.MIN_GAP || 0.2);

const log = ff(['-i', INPUT, '-af', `silencedetect=noise=${NOISE_DB}:d=${MIN_GAP}`, '-f', 'null', '-']);
const dur = (() => {
  const m = ff(['-i', INPUT]).match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
})();

const starts = [...log.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => parseFloat(m[1]));
const ends = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));

// A sound runs from the end of one silence to the start of the next.
const segments = [];
for (const s of ends) {
  const next = starts.find((x) => x > s);
  const end = next === undefined ? dur : next;
  if (end - s > 0.05) segments.push({ start: s, end });
}

console.log(`[split] ${path.basename(INPUT)} — ${dur.toFixed(2)}s, ${segments.length} sounds found`);

/* ------------------------------------------------------------------ *
 * 2. Measure each sound so it can be named
 * ------------------------------------------------------------------ */

const PAD_IN = 0.04;   // a little before the attack, so it is never clipped
const PAD_OUT = 0.12;  // and enough after for the tail

const bandRms = (file, lo, hi) => {
  const out = ff(['-i', file, '-af', `highpass=f=${lo},lowpass=f=${hi},volumedetect`, '-f', 'null', '-']);
  const m = out.match(/mean_volume:\s*(-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : -99;
};

/**
 * Name a sound from where its energy sits and how long it lasts.
 * `sub` is 20-120 Hz, `air` is 6-16 kHz, both relative to the whole-band level.
 */
function classify({ len, sub, mid, air, full }) {
  const subRel = sub - full;
  const airRel = air - full;
  if (len < 0.28 && airRel > -14) return 'tick';
  if (len < 0.5 && airRel > -18 && subRel < -12) return 'click';
  if (subRel > -9 && len >= 0.5) return 'impact';
  if (subRel > -9) return 'thump';
  if (len >= 0.6 && airRel > -20) return 'whoosh';
  if (len >= 0.9) return 'riser';
  if (airRel > -16) return 'swish';
  return 'hit';
}

fs.rmSync(OUTDIR, { recursive: true, force: true });
fs.mkdirSync(OUTDIR, { recursive: true });

const TMP = path.join(ROOT, 'dist/.split');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const manifest = [];
segments.forEach((seg, i) => {
  const ss = Math.max(0, seg.start - PAD_IN);
  const len = Math.min(dur - ss, seg.end - ss + PAD_OUT);
  const tmp = path.join(TMP, `s${i}.wav`);
  // A 5 ms fade at each end removes the click a hard cut would leave behind.
  ff(['-y', '-loglevel', 'error', '-ss', String(ss), '-t', String(len), '-i', INPUT,
      '-af', `afade=t=in:st=0:d=0.005,afade=t=out:st=${Math.max(0, len - 0.02).toFixed(3)}:d=0.02,` +
             `aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo`,
      tmp]);

  const full = bandRms(tmp, 20, 20000);
  const m = {
    len, full,
    sub: bandRms(tmp, 20, 120),
    mid: bandRms(tmp, 500, 4000),
    air: bandRms(tmp, 6000, 16000),
  };
  const kind = classify(m);
  const n = String(manifest.filter((x) => x.kind === kind).length + 1).padStart(2, '0');
  const name = `${kind}-${n}.wav`;
  fs.renameSync(tmp, path.join(OUTDIR, name));
  manifest.push({ name, kind, ...m, at: seg.start });
});

fs.rmSync(TMP, { recursive: true, force: true });

/* ------------------------------------------------------------------ *
 * 3. Report
 * ------------------------------------------------------------------ */

const rel = path.relative(ROOT, OUTDIR);
console.log(`[split] wrote ${manifest.length} files to ${rel}/\n`);
console.log('  fil              i pakken   længde    bas    luft   type');
manifest.forEach((x) => console.log(
  `  ${x.name.padEnd(15)} ${x.at.toFixed(2).padStart(7)}s ${x.len.toFixed(2).padStart(7)}s ` +
  `${(x.sub - x.full).toFixed(1).padStart(6)} ${(x.air - x.full).toFixed(1).padStart(6)}   ${x.kind}`));

const counts = manifest.reduce((a, x) => ({ ...a, [x.kind]: (a[x.kind] || 0) + 1 }), {});
console.log('\n  ' + Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('   '));

fs.writeFileSync(path.join(OUTDIR, 'manifest.json'), JSON.stringify({
  source: path.basename(INPUT),
  duration: dur,
  count: manifest.length,
  sounds: manifest.map(({ name, kind, at, len, sub, mid, air, full }) => ({
    name, kind,
    atInPack: +at.toFixed(3),
    length: +len.toFixed(3),
    subRel: +(sub - full).toFixed(1),
    airRel: +(air - full).toFixed(1),
  })),
}, null, 2));
