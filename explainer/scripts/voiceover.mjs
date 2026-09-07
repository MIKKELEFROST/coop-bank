#!/usr/bin/env node
/**
 * voiceover.mjs — emits the three voiceover deliverables from the single
 * source of truth in src/script-da.js:
 *
 *   dist/voiceover-manus.txt    recording-ready Danish manuscript + direction
 *   dist/voiceover-timing.json  machine-readable timing + sound-design cues
 *   dist/voiceover-da.srt       Danish subtitles
 *
 * No speech synthesis is used anywhere in this project. If an actual recording
 * is dropped into assets/audio/, scripts/encode-video.sh muxes it in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEATS, CUES, VO_DIRECTION, FPS, DURATION, FRAME_COUNT } from '../src/script-da.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

const TARGET_WPM = 163;
const countWords = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const tc = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
const mmss = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};

/* ------------------------------------------------------------------ *
 * Per-beat delivery analysis
 * ------------------------------------------------------------------ */

const beatRows = BEATS.map((b) => {
  const words = countWords(b.vo);
  const dur = b.end - b.start;
  const naturalSec = (words / TARGET_WPM) * 60;
  const requiredWpm = (words / dur) * 60;
  return {
    beat: b.n, id: b.id, title: b.title,
    start: b.start, end: b.end, duration: +dur.toFixed(2),
    startFrame: Math.round(b.start * FPS), endFrame: Math.round(b.end * FPS) - 1,
    words,
    naturalDurationSec: +naturalSec.toFixed(2),
    requiredWpm: Math.round(requiredWpm),
    delivery: requiredWpm <= 168 ? 'normal'
      : requiredWpm <= 195 ? 'let komprimeret'
      : 'komprimeret',
    vo: b.vo,
    onScreen: b.onScreen,
  };
});

const totalWords = beatRows.reduce((a, r) => a + r.words, 0);
const avgWpm = (totalWords / DURATION) * 60;

/* ------------------------------------------------------------------ *
 * Sound-design cues (optional layer — never competing with the VO)
 * ------------------------------------------------------------------ */

const sfx = [];
BEATS.forEach((b, i) => {
  if (i === 0) return;
  sfx.push({ t: +b.start.toFixed(2), type: 'whoosh', note: `Overgang til beat ${b.n} — kort, blød, lavt niveau` });
});
sfx.push({ t: 0.72, type: 'impact', note: 'Den røde cirkel lander (beat 1)' });
[6.0, 6.9, 7.9, 8.9].forEach((t, i) => sfx.push({ t, type: 'click', note: `Funktionskort ${i + 1} aktiveres (beat 2)` }));
sfx.push({ t: 15.1, type: 'impact', note: '"Bemanding" accelererer mod kameraet (beat 3)' });
sfx.push({ t: 24.4, type: 'click', note: '"Mønster fundet" lander (beat 5)' });
[27.2, 28.4, 29.6].forEach((t, i) => sfx.push({ t, type: 'click', note: `Optimeringsgennemløb ${i + 1} (beat 6)` }));
sfx.push({ t: 33.4, type: 'click', note: 'Coop Bank-resultatet træder frem (beat 7)' });
[37.0, 38.0, 39.0].forEach((t, i) => sfx.push({ t, type: 'click', note: `Opgave ${i + 1} overdrages til agent (beat 8)` }));
sfx.push({ t: 41.62, type: 'glitch', note: 'ÉT kort glitch-impact ved skiftet til den mørke sekvens (beat 9) — filmens eneste' });
sfx.push({ t: 46.0, type: 'whoosh', note: 'Vertikal wipe op — den mørke scene forlader billedet (beat 10)' });
sfx.push({ t: 50.4, type: 'impact', note: 'Marketing-hub stiger op nedefra (beat 11)' });
[53.4, 56.4, 59.0].forEach((t, i) => sfx.push({ t, type: 'click', note: `Agentkort ${i + 2} lander (beat 11)` }));
[66.0, 67.2].forEach((t, i) => sfx.push({ t, type: 'click', note: `Ordskift "genererer" → "arbejder sammen med os" (beat 12)` }));
[69.0, 69.8, 70.6].forEach((t, i) => sfx.push({ t, type: 'click', note: `Kontakt slås til/fra i agentkontrolpanelet (beat 12)` }));
sfx.sort((a, b) => a.t - b.t);

/* ------------------------------------------------------------------ *
 * dist/voiceover-manus.txt
 * ------------------------------------------------------------------ */

const W = 78;
const line = (c = '=') => c.repeat(W);
const wrap = (s, indent = '') => {
  const out = [];
  let cur = indent;
  for (const w of s.split(' ')) {
    if ((cur + w).length > W - 1) { out.push(cur.trimEnd()); cur = indent; }
    cur += w + ' ';
  }
  if (cur.trim()) out.push(cur.trimEnd());
  return out.join('\n');
};

const man = [];
man.push(line());
man.push('COOP BANK · MARKETING OG AI-AGENTER');
man.push('Voiceover-manuskript · dansk');
man.push(line());
man.push('');
man.push(`Varighed          75,0 sekunder (${FRAME_COUNT} frames ved ${FPS} fps)`);
man.push(`Antal beats       ${BEATS.length}`);
man.push(`Antal ord         ${totalWords}`);
man.push(`Gennemsnit        ${avgWpm.toFixed(0)} ord i minuttet`);
man.push(`Målgruppe         Intern ledelsespræsentation, Coop Bank`);
man.push('');
man.push(line('-'));
man.push('REGI');
man.push(line('-'));
man.push('');
man.push(`Sprog       ${VO_DIRECTION.language}`);
man.push(`Tone        ${VO_DIRECTION.tone}`);
man.push(`Tempo       ${VO_DIRECTION.pace}`);
man.push('');
VO_DIRECTION.notes.forEach((n) => man.push(wrap('· ' + n, '  ').replace(/^ {2}·/, '·')));
man.push('');
man.push(line('-'));
man.push('MANUSKRIPT');
man.push(line('-'));
man.push('');
beatRows.forEach((r) => {
  man.push(`BEAT ${String(r.beat).padStart(2, '0')}   ${mmss(r.start)} – ${mmss(r.end)}   (${r.duration.toFixed(1)} s · frame ${r.startFrame}–${r.endFrame})`);
  man.push(`         ${r.title}`);
  man.push('');
  man.push(wrap(r.vo, '         '));
  man.push('');
  man.push(`         [ ${r.words} ord · ${r.requiredWpm} ord/min · levering: ${r.delivery} ]`);
  man.push(`         På skærmen: ${r.onScreen.join(' / ')}`);
  man.push('');
});
man.push(line('-'));
man.push('BEMÆRKNINGER TIL INDTALING');
man.push(line('-'));
man.push('');
man.push(wrap('Manuskriptet er skrevet, så det passer til billedsiden beat for beat. Fire beats (3, 4, 8 og 9) er tekstmæssigt tætpakkede og kræver et lidt hurtigere tempo end gennemsnittet, eller at replikken får lov at glide et par tiendedele ind over det følgende klip. Det er tilsigtet — billedet holder stille netop dér.'));
man.push('');
man.push(wrap('Optag gerne hver beat som en selvstændig take med 0,5 sekunds stilhed før og efter. Så kan replikkerne placeres præcist på de tider, der står i dist/voiceover-timing.json, uden at strække lyden.'));
man.push('');
man.push(wrap('Når filen er klar, lægges den som assets/audio/voiceover-da.wav (eller .mp3) og "npm run encode" mixer den automatisk ind i den færdige MP4.'));
man.push('');
fs.writeFileSync(path.join(DIST, 'voiceover-manus.txt'), man.join('\n'));

/* ------------------------------------------------------------------ *
 * dist/voiceover-timing.json
 * ------------------------------------------------------------------ */

const lines = CUES.map((c, i) => {
  const next = CUES[i + 1] ? CUES[i + 1].t : DURATION;
  const words = countWords(c.text);
  return {
    index: i + 1,
    start: +c.t.toFixed(2),
    end: +Math.min(next - 0.08, c.t + (words / TARGET_WPM) * 60 + 0.35).toFixed(2),
    startFrame: Math.round(c.t * FPS),
    words,
    text: c.text,
  };
});

fs.writeFileSync(path.join(DIST, 'voiceover-timing.json'), JSON.stringify({
  project: 'Coop Bank · Marketing og AI-agenter',
  language: 'da-DK',
  fps: FPS,
  duration: DURATION,
  frameCount: FRAME_COUNT,
  targetWpm: TARGET_WPM,
  measuredAverageWpm: +avgWpm.toFixed(1),
  totalWords,
  direction: VO_DIRECTION,
  audioPresent: fs.existsSync(path.join(ROOT, 'assets/audio/voiceover-da.wav'))
    || fs.existsSync(path.join(ROOT, 'assets/audio/voiceover-da.mp3')),
  beats: beatRows,
  lines,
  soundDesign: {
    note: 'Valgfrit lag. Musik og effekter må aldrig konkurrere med speaken — hold dem mindst 12 dB under.',
    music: 'Diskret elektronisk SaaS-underlægning, uden melodi i forgrunden. Dæmp 3 dB under hver replik.',
    cues: sfx,
  },
}, null, 2));

/* ------------------------------------------------------------------ *
 * dist/voiceover-da.srt
 * ------------------------------------------------------------------ */

const srt = lines.map((l, i) =>
  `${i + 1}\n${tc(l.start)} --> ${tc(l.end)}\n${l.text}\n`
).join('\n');
fs.writeFileSync(path.join(DIST, 'voiceover-da.srt'), srt);

console.log(`[vo] ${totalWords} ord · ${avgWpm.toFixed(0)} ord/min · ${lines.length} undertekster`);
console.log('[vo] wrote dist/voiceover-manus.txt, dist/voiceover-timing.json, dist/voiceover-da.srt');
