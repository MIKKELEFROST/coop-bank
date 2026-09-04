#!/usr/bin/env node
/**
 * build-sfx.mjs — place library sounds on the timeline, producing
 * assets/audio/sfx.wav.
 *
 * The sounds come from assets/audio/sfx-library/ (the purchased pack, split by
 * scripts/split-sfx-pack.mjs). Nothing is synthesised: an earlier attempt to
 * generate these from oscillators and noise sounded like noise, because that
 * is what it was.
 *
 * Density follows the supplied reference video, which carries four audible
 * events in 18.65 s — one per 4.7 s. Scaled to 75 s that would be about
 * sixteen; this uses eleven, since a leadership film holds longer than a
 * social one. The reference marks only one of its three picture cuts, so this
 * marks only the three largest moves rather than every transition.
 *
 * Timing follows it too: in the reference a sound lands 0.28 s BEFORE the cut
 * it belongs to. Whooshes here are therefore offset earlier by their `lead`,
 * so their energy peaks on the cut instead of starting there.
 *
 * Usage:  node scripts/build-sfx.mjs        (npm run sfx)
 *         SFX_OUT=dist/sfx-test.wav node scripts/build-sfx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DURATION } from '../src/script-da.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;
const LIB = path.join(ROOT, 'assets/audio/sfx-library');
const OUT = path.join(ROOT, process.env.SFX_OUT || 'assets/audio/sfx.wav');

const ff = (args) => {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) {
    console.error('[sfx] ffmpeg failed:\n' + String(r.stderr || ''));
    process.exit(1);
  }
};

/** Mean level in dBFS, so the cue sheet's dB column is a real decision. */
function measureRms(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' });
  const m = String(r.stderr || '').match(/mean_volume:\s*(-?[\d.]+) dB/);
  if (!m) throw new Error('could not measure ' + path.basename(file));
  return parseFloat(m[1]);
}

const REF_RMS = -20;

/* ------------------------------------------------------------------ *
 * The cue sheet
 *
 * `t`    where the sound should be FELT, on the film's timeline
 * `lead` how far before `t` it starts, so its energy peaks on the beat
 * `db`   level after normalisation; the mix then places the whole stem
 *        9 dB under the voice
 * ------------------------------------------------------------------ */

const CUES = [
  // --- objects landing -------------------------------------------------
  { t: 0.72,  file: 'impact-08.wav', lead: 0.05, db: -13, note: 'den røde cirkel lander' },
  { t: 15.12, file: 'impact-02.wav', lead: 0.10, db: -10, note: '"Bemanding" mod kameraet' },
  { t: 50.42, file: 'impact-02.wav', lead: 0.10, db: -12, note: 'Marketing-hub stiger op' },

  // --- the three largest moves only; the other eight cuts stay silent ---
  { t: 21.50, file: 'whoosh-11.wav', lead: 0.42, db: -21, note: 'beat 5 · whipUp' },
  { t: 46.00, file: 'whoosh-03.wav', lead: 0.40, db: -17, note: 'beat 10 · vertikal wipe op' },
  { t: 50.00, file: 'whoosh-13.wav', lead: 0.45, db: -22, note: 'beat 11 · pushUp' },

  // --- the one dark cut -------------------------------------------------
  { t: 41.62, file: 'impact-06.wav', lead: 0.06, db: -10, note: 'glitch — filmens eneste' },

  // --- small interface confirmations -----------------------------------
  { t: 24.40, file: 'click-01.wav',  lead: 0.03, db: -17, note: '"Mønster fundet" lander' },
  { t: 33.40, file: 'click-01.wav',  lead: 0.03, db: -17, note: 'Coop Bank-resultatet træder frem' },
  { t: 66.05, file: 'swish-01.wav',  lead: 0.05, db: -19, note: 'ordskiftet i beat 12' },
  { t: 69.30, file: 'click-01.wav',  lead: 0.03, db: -20, note: 'kontakt slås til' },
];

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

if (!fs.existsSync(LIB)) {
  console.error(`[sfx] ${path.relative(ROOT, LIB)} not found — run scripts/split-sfx-pack.mjs first`);
  process.exit(1);
}
const missing = [...new Set(CUES.map((c) => c.file))].filter((f) => !fs.existsSync(path.join(LIB, f)));
if (missing.length) {
  console.error('[sfx] missing from the library: ' + missing.join(', '));
  process.exit(1);
}

const sorted = [...CUES].sort((a, b) => (a.t - a.lead) - (b.t - b.lead));
const rms = new Map();
for (const f of new Set(sorted.map((c) => c.file))) rms.set(f, measureRms(path.join(LIB, f)));

const N = sorted.length;
const inputs = [
  '-f', 'lavfi', '-t', String(DURATION), '-i', 'anullsrc=r=48000:cl=stereo',
  ...sorted.flatMap((c) => ['-i', path.join(LIB, c.file)]),
];

const delays = sorted.map((c, i) => {
  const at = Math.max(0, c.t - c.lead);
  const ms = Math.round(at * 1000);
  const gain = (c.db + (REF_RMS - rms.get(c.file))).toFixed(2);
  // apad keeps every stream alive for the whole film. Without it the short
  // files end early and amix renormalises over whatever is still running,
  // which drifts identical design levels louder as the film goes on.
  return `[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,` +
         `adelay=${ms}|${ms},volume=${gain}dB,apad[d${i}];`;
}).join('');

const mixIn = '[0:a]' + sorted.map((_, i) => `[d${i}]`).join('');
const filter =
  delays +
  `${mixIn}amix=inputs=${N + 1}:duration=first:dropout_transition=0,` +
  `volume=${N + 1},alimiter=limit=0.9,` +
  `aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
ff([...inputs, '-filter_complex', filter, OUT]);

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`[sfx] ${N} cues from the library -> ${path.relative(ROOT, OUT)} (${kb} kB, ${DURATION}s)\n`);
console.log('   føles ved   starter    niveau  lyd              hvad');
sorted.forEach((c) => console.log(
  `  ${c.t.toFixed(2).padStart(7)}s ${(c.t - c.lead).toFixed(2).padStart(8)}s ` +
  `${String(c.db).padStart(6)} dB  ${c.file.padEnd(15)} ${c.note}`));
