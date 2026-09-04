#!/usr/bin/env node
/**
 * build-sfx.mjs — place library sounds on the timeline, producing
 * assets/audio/sfx.wav.
 *
 * The cue sheet is not invented. It reproduces the 21 placements from the
 * client's own edit (Min_film_4.mp4) — identified by envelope cross-correlation
 * against the split pack, at their measured relative levels — and adds the
 * moments they had not reached yet.
 *
 * What to add was decided by measuring the film rather than by taste: every
 * frame was compared with the one before it, and the peaks of that motion
 * curve are where the picture actually moves. Two of the largest peaks in the
 * whole film were silent — the vertical wipe at 46.3 s (the second biggest
 * event after the glitch) and the push into beat 11 at 50.0 s — along with
 * beats 6 and 10 entirely.
 *
 * The client's vocabulary is followed exactly:
 *   hit-07  beat transitions          anchor level
 *   hit-02  cards and elements landing   -6 dB
 *   hit-05  the beat 12 statements       +1 dB
 *   whoosh  large travelling moves      quieter, and started early so the
 *                                       energy peaks on the move
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

function measureRms(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' });
  const m = String(r.stderr || '').match(/mean_volume:\s*(-?[\d.]+) dB/);
  if (!m) throw new Error('could not measure ' + path.basename(file));
  return parseFloat(m[1]);
}

/** Every sound is normalised here before its design gain, so dB means dB. */
const REF_RMS = -20;

/* ------------------------------------------------------------------ *
 * Levels, expressed as the client mixed them. `TRANS` is the anchor.
 * ------------------------------------------------------------------ */
const L = {
  TRANS: -14,      // hit-07 on a beat transition
  ELEM: -20.3,     // hit-02 as a card or element lands
  QUIET: -33.6,    // their subtlest accents
  OPEN: -11,       // the opening impact
  STATE: -12.8,    // hit-05 under the beat 12 statements
  WHOOSH_S: -30.6, // their quiet whoosh
  WHOOSH_L: -19.9, // their louder whoosh
};

/* ------------------------------------------------------------------ *
 * The cue sheet. `src` marks where each cue came from.
 * ------------------------------------------------------------------ */
const CUES = [
  // ---- beat 1 ----
  { t: 0.31,  f: 'impact-01.wav', lead: 0.04, db: L.OPEN,     src: 'klient', note: 'titlen sætter sig' },
  { t: 1.03,  f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'tilføjet', note: 'AI-agenter bygges' },

  // ---- beat 2: they marked the transition and all four cards ----
  { t: 4.60,  f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'klient', note: 'overgang til beat 2' },
  { t: 5.98,  f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'klient', note: 'Planlæg' },
  { t: 6.98,  f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'klient', note: 'Søg' },
  { t: 7.91,  f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'klient', note: 'Beslut' },
  { t: 8.85,  f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'klient', note: 'Udfør' },

  // ---- beat 3 ----
  { t: 10.84, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'klient', note: 'overgang + Værktøjer' },
  { t: 15.07, f: 'hit-07.wav',    lead: 0.05, db: L.TRANS,    src: 'tilføjet', note: '"Bemanding" mod kameraet' },

  // ---- beat 4 ----
  { t: 15.71, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'klient', note: 'overgang til beat 4' },
  { t: 17.26, f: 'whoosh-01.wav', lead: 0.30, db: L.WHOOSH_S, src: 'klient', note: 'rækkevidden vokser' },

  // ---- beat 5 ----
  { t: 21.68, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'klient', note: 'overgang til beat 5' },

  // ---- beat 6: the client left this beat silent ----
  { t: 26.20, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'tilføjet', note: 'overgang til beat 6' },

  // ---- beat 7 ----
  { t: 30.69, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'klient', note: 'overgang til beat 7' },

  // ---- beat 8 ----
  { t: 35.73, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'klient', note: 'overgang til beat 8' },

  // ---- beat 9: the film's largest movement ----
  { t: 41.54, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'klient', note: 'glitch — den mørke sekvens' },

  // ---- beat 10: silent in the client edit, and the second largest move ----
  { t: 46.27, f: 'whoosh-03.wav', lead: 0.42, db: L.WHOOSH_L, src: 'tilføjet', note: 'lodret wipe op' },
  { t: 46.30, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'tilføjet', note: 'wipen lander' },

  // ---- beat 11 ----
  { t: 50.00, f: 'hit-07.wav',    lead: 0.04, db: L.TRANS,    src: 'tilføjet', note: 'overgang til beat 11' },
  { t: 50.50, f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'tilføjet', note: 'Marketing-hub sætter sig' },
  { t: 51.72, f: 'hit-02.wav',    lead: 0.03, db: L.QUIET,    src: 'klient', note: 'agentkort 1' },
  { t: 53.07, f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'tilføjet', note: 'agentkort 2' },
  { t: 54.39, f: 'hit-02.wav',    lead: 0.03, db: L.QUIET,    src: 'klient', note: 'kort folder ud' },
  { t: 55.70, f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'tilføjet', note: 'agentkort 3' },
  { t: 60.80, f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'tilføjet', note: 'opgaver gennem systemet' },

  // ---- beat 12 ----
  { t: 61.32, f: 'hit-05.wav',    lead: 0.04, db: L.STATE,    src: 'klient', note: 'systemet samles' },
  { t: 63.03, f: 'hit-05.wav',    lead: 0.04, db: L.STATE,    src: 'klient', note: 'overgang til beat 12' },
  { t: 64.83, f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'tilføjet', note: '"AI genererer ikke bare"' },
  { t: 66.13, f: 'hit-02.wav',    lead: 0.03, db: L.ELEM,     src: 'tilføjet', note: 'ordskiftet' },
  { t: 67.11, f: 'whoosh-13.wav', lead: 0.35, db: L.WHOOSH_L, src: 'klient', note: 'systemet bliver kontrolpanel' },
  { t: 69.17, f: 'hit-02.wav',    lead: 0.03, db: L.QUIET,    src: 'klient', note: 'kontakt 1' },
  { t: 69.74, f: 'hit-02.wav',    lead: 0.03, db: L.QUIET,    src: 'klient', note: 'kontakt 2' },
  { t: 70.38, f: 'hit-02.wav',    lead: 0.03, db: L.QUIET,    src: 'klient', note: 'kontakt 3' },
  // Nothing after 70.4: the closing question has to stand completely still.
];

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

if (!fs.existsSync(LIB)) {
  console.error(`[sfx] ${path.relative(ROOT, LIB)} not found — run scripts/split-sfx-pack.mjs first`);
  process.exit(1);
}
const missing = [...new Set(CUES.map((c) => c.f))].filter((f) => !fs.existsSync(path.join(LIB, f)));
if (missing.length) { console.error('[sfx] missing: ' + missing.join(', ')); process.exit(1); }

const sorted = [...CUES].sort((a, b) => (a.t - a.lead) - (b.t - b.lead));
const rms = new Map();
for (const f of new Set(sorted.map((c) => c.f))) rms.set(f, measureRms(path.join(LIB, f)));

const N = sorted.length;
const inputs = [
  '-f', 'lavfi', '-t', String(DURATION), '-i', 'anullsrc=r=48000:cl=stereo',
  ...sorted.flatMap((c) => ['-i', path.join(LIB, c.f)]),
];
const delays = sorted.map((c, i) => {
  const ms = Math.round(Math.max(0, c.t - c.lead) * 1000);
  const gain = (c.db + (REF_RMS - rms.get(c.f))).toFixed(2);
  // apad keeps each stream alive so amix never renormalises over the survivors.
  return `[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,` +
         `adelay=${ms}|${ms},volume=${gain}dB,apad[d${i}];`;
}).join('');
const mixIn = '[0:a]' + sorted.map((_, i) => `[d${i}]`).join('');
const filter = delays +
  `${mixIn}amix=inputs=${N + 1}:duration=first:dropout_transition=0,` +
  `volume=${N + 1},alimiter=limit=0.9,` +
  `aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
ff([...inputs, '-filter_complex', filter, OUT]);

const fromClient = sorted.filter((c) => c.src === 'klient').length;
console.log(`[sfx] ${N} cues -> ${path.relative(ROOT, OUT)} ` +
            `(${fromClient} fra din klipning, ${N - fromClient} tilføjet)\n`);
console.log('   tid     niveau  lyd              kilde      hvad');
sorted.forEach((c) => console.log(
  `  ${c.t.toFixed(2).padStart(6)}s ${c.db.toFixed(1).padStart(7)}  ${c.f.padEnd(15)} ` +
  `${c.src.padEnd(9)} ${c.note}`));
