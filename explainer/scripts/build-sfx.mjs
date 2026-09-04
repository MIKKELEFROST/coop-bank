#!/usr/bin/env node
/**
 * build-sfx.mjs — synthesise the film's sound design and place it on the
 * timeline, producing assets/audio/sfx.wav.
 *
 * Every sound is generated parametrically from ffmpeg's own oscillators and
 * noise sources with an explicit seed, so the stem is as reproducible as the
 * picture: same command, same bytes. Nothing is sampled or downloaded.
 *
 * The film's motion is abstract UI — objects landing, cards clicking in,
 * whip-pans between beats, one glitch. That is exactly the class of sound
 * synthesis does well; there is no naturalistic foley here to fake.
 *
 * Design rules:
 *   - A whoosh on every beat transition, weighted by how big the move is.
 *     They are meant to be felt rather than heard.
 *   - Accents only on moments the picture genuinely marks: an object landing,
 *     a status resolving, the one glitch.
 *   - No sound on card entrances. Clicking every card in is what turns a
 *     considered film into an advert.
 *
 * Usage:  node scripts/build-sfx.mjs
 *         SFX_OUT=dist/sfx-test.wav node scripts/build-sfx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DURATION } from '../src/script-da.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;
const OUT = path.join(ROOT, process.env.SFX_OUT || 'assets/audio/sfx.wav');
const TMP = path.join(ROOT, 'dist/.sfx');

const ff = (args) => {
  try {
    return execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args],
      { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error('[sfx] ffmpeg failed:\n' + String(e.stderr || e.stdout || e.message));
    process.exit(1);
  }
};

/**
 * Mean level of a rendered file, in dBFS. Each cue is normalised to a common
 * reference before placement, so the `db` column of the cue sheet is a real
 * design decision rather than an accident of how much energy a given
 * bandpass happened to pass. Without this, a bright click measured 14 dB
 * louder than a low impact that was set 7 dB above it.
 */
function measureRms(file) {
  // spawnSync, not execFileSync: ffmpeg prints volumedetect to stderr and exits
  // 0, so the exec helper's success path would hand back an empty stdout.
  const r = spawnSync(FFMPEG,
    ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' });
  const m = String(r.stderr || '').match(/mean_volume:\s*(-?[\d.]+) dB/);
  if (!m) throw new Error('could not measure ' + path.basename(file));
  return parseFloat(m[1]);
}

/** Every cue is brought to this mean level before its design gain is applied. */
const REF_RMS = -20;

/* ------------------------------------------------------------------ *
 * Voices — each returns the ffmpeg arguments that render one sound
 * ------------------------------------------------------------------ */

/** Air moving past the camera. `size` scales length and weight. */
const whoosh = (file, { seed, size = 1, tone = 900, colour = 'pink' }) => {
  const d = (0.34 * size).toFixed(3);
  // The band opens then closes across the move, which reads as travel rather
  // than as a burst of noise.
  const sweep = `bandpass=f=${tone}:width_type=o:w=2.4`;
  ff(['-f', 'lavfi', '-i', `anoisesrc=d=${d}:c=${colour}:a=0.75:seed=${seed}`,
      '-af', `${sweep},volume='min(1,t*${(9 / size).toFixed(2)})*exp(-${(3.1 / size).toFixed(2)}*t)':eval=frame,` +
             `afade=t=out:st=${(d * 0.72).toFixed(3)}:d=${(d * 0.28).toFixed(3)}`,
      '-ar', '48000', file]);
};

/** Something with mass arriving. Low body plus a short transient. */
const impact = (file, { seed, freq = 68, size = 1 }) => {
  const d = (0.5 * size).toFixed(3);
  ff(['-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${d}`,
      '-f', 'lavfi', '-i', `anoisesrc=d=${d}:c=brown:a=0.6:seed=${seed}`,
      '-filter_complex',
      `[0:a]volume='exp(-${(7 / size).toFixed(2)}*t)':eval=frame[b];` +
      `[1:a]lowpass=f=1500,volume='exp(-26*t)*0.5':eval=frame[t];` +
      `[b][t]amix=inputs=2,volume=2`,
      '-ar', '48000', file]);
};

/** An interface acknowledging something. Short, dry, no tail. */
const click = (file, { seed, tone = 2200, bright = 1 }) => {
  ff(['-f', 'lavfi', '-i', `anoisesrc=d=0.09:c=white:a=0.6:seed=${seed}`,
      '-af', `highpass=f=${tone},bandpass=f=${(tone * 1.6).toFixed(0)}:width_type=o:w=${(2.2 * bright).toFixed(2)},` +
             `volume='exp(-75*t)':eval=frame`,
      '-ar', '48000', file]);
};

/** The single glitch at the cut into the dark sequence. */
const glitch = (file, { seed }) => {
  ff(['-f', 'lavfi', '-i', `anoisesrc=d=0.26:c=white:a=0.8:seed=${seed}`,
      '-af', `acrusher=bits=3:mode=log:aa=0,bandpass=f=1500:width_type=o:w=3.2,` +
             `volume='exp(-9*t)*(0.55+0.45*sin(180*t))':eval=frame`,
      '-ar', '48000', file]);
};

/* ------------------------------------------------------------------ *
 * The cue sheet
 * `db` is this cue's level relative to the stem; the mix stage then places
 * the whole stem 9 dB under the voice.
 * ------------------------------------------------------------------ */

const CUES = [
  // --- transitions: one per beat boundary, weighted by the size of the move
  { t: 4.50,  db: -19, note: 'beat 2 · zoomThrough',   make: (f) => whoosh(f, { seed: 101, size: 1.25, tone: 780 }) },
  { t: 10.50, db: -21, note: 'beat 3 · whipLeft',      make: (f) => whoosh(f, { seed: 102, size: 0.95, tone: 1100 }) },
  { t: 15.50, db: -14, note: 'beat 4 · scaleThrough',  make: (f) => whoosh(f, { seed: 103, size: 1.7, tone: 620 }) },
  { t: 21.50, db: -20, note: 'beat 5 · whipUp',        make: (f) => whoosh(f, { seed: 104, size: 1.1, tone: 1000 }) },
  { t: 26.00, db: -21, note: 'beat 6 · whipLeft',      make: (f) => whoosh(f, { seed: 105, size: 0.9, tone: 1150 }) },
  { t: 30.50, db: -19, note: 'beat 7 · zoomThrough',   make: (f) => whoosh(f, { seed: 106, size: 1.2, tone: 820 }) },
  { t: 35.50, db: -21, note: 'beat 8 · whipLeft',      make: (f) => whoosh(f, { seed: 107, size: 0.95, tone: 1080 }) },
  { t: 46.00, db: -13, note: 'beat 10 · wipeUp',       make: (f) => whoosh(f, { seed: 109, size: 1.8, tone: 700, colour: 'white' }) },
  { t: 50.00, db: -19, note: 'beat 11 · pushUp',       make: (f) => whoosh(f, { seed: 110, size: 1.3, tone: 760 }) },
  { t: 62.50, db: -20, note: 'beat 12 · crossScale',   make: (f) => whoosh(f, { seed: 111, size: 1.15, tone: 880 }) },

  // --- accents: only where the picture genuinely marks a moment
  { t: 0.72,  db: -8,  note: 'den røde cirkel lander',            make: (f) => impact(f, { seed: 201, freq: 74, size: 0.9 }) },
  { t: 15.12, db: -7,  note: '"Bemanding" mod kameraet',          make: (f) => impact(f, { seed: 202, freq: 58, size: 1.3 }) },
  { t: 24.40, db: -10, note: '"Mønster fundet" lander',           make: (f) => click(f, { seed: 203, tone: 2400 }) },
  { t: 33.40, db: -10, note: 'Coop Bank-resultatet træder frem',  make: (f) => click(f, { seed: 204, tone: 1900, bright: 1.3 }) },
  { t: 41.62, db: -8,  note: 'glitch — filmens eneste',           make: (f) => glitch(f, { seed: 205 }) },
  { t: 50.42, db: -8,  note: 'Marketing-hub stiger op',           make: (f) => impact(f, { seed: 206, freq: 64, size: 1.15 }) },
  { t: 66.05, db: -10, note: 'ordskiftet i beat 12',              make: (f) => click(f, { seed: 207, tone: 2100 }) },
  { t: 69.30, db: -11, note: 'kontakt slås til',                  make: (f) => click(f, { seed: 208, tone: 2600, bright: 0.8 }) },
];

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const sorted = [...CUES].sort((a, b) => a.t - b.t);
console.log(`[sfx] rendering ${sorted.length} cues`);
sorted.forEach((c, i) => {
  c.file = path.join(TMP, `c${String(i).padStart(2, '0')}.wav`);
  c.make(c.file);
  c.norm = REF_RMS - measureRms(c.file);   // corrective gain, in dB
});

// A silent bed of exactly DURATION seconds defines the stem's length, which is
// more robust than padding and trimming: `apad` is unbounded and this ffmpeg
// build trips an assertion when `-t` trims an unbounded stream.
const N = sorted.length;
const inputs = [
  '-f', 'lavfi', '-t', String(DURATION), '-i', 'anullsrc=r=48000:cl=stereo',
  ...sorted.flatMap((c) => ['-i', c.file]),
];
const delays = sorted.map((c, i) => {
  const ms = Math.round(c.t * 1000);
  // +1 because the silent bed is input 0.
  const gain = (c.db + c.norm).toFixed(2);
  // `apad` keeps every cue stream alive for the whole film. Without it the
  // short cue files end early, and amix renormalises over the inputs still
  // running — which made identical design levels drift 12 dB louder across
  // the 75 seconds. With no input ever dropping out, amix divides by a
  // constant and the compensation below is exact.
  return `[${i + 1}:a]aformat=channel_layouts=stereo,adelay=${ms}|${ms},` +
         `volume=${gain}dB,apad[d${i}];`;
}).join('');
const mixIn = '[0:a]' + sorted.map((_, i) => `[d${i}]`).join('');
// amix scales by 1/(N+1); the level is restored afterwards and a limiter
// catches the few places cues overlap.
const filter =
  delays +
  `${mixIn}amix=inputs=${N + 1}:duration=first:dropout_transition=0,` +
  `volume=${N + 1},alimiter=limit=0.9,` +
  `aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo`;

ff([...inputs, '-filter_complex', filter, OUT]);
fs.rmSync(TMP, { recursive: true, force: true });

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`[sfx] wrote ${path.relative(ROOT, OUT)} (${kb} kB, ${DURATION}s)`);
console.log('\n  time    level  cue');
sorted.forEach((c) => console.log(
  `  ${c.t.toFixed(2).padStart(5)}s  ${String(c.db).padStart(3)} dB  ` +
  `(norm ${c.norm >= 0 ? '+' : ''}${c.norm.toFixed(1)})  ${c.note}`));
