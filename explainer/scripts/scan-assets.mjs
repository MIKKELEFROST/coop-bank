#!/usr/bin/env node
/**
 * scan-assets.mjs — inspect assets/, write assets/manifest.json (consumed by
 * the browser) and asset-report.md (found / used / missing / fallbacks).
 * Missing assets never block a render.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');

const EXPECTED = [
  { key: 'reference', file: 'assets/reference/reference-saas-explainer.mp4', use: 'Referencestil for tempo og motion-grammatik', fallback: 'Motion-grammatikken er skrevet ud fra briefens beskrivelse: 0,5–1,2 s pr. visuelt skift, 0,3–0,6 s transitioner, spring/overshoot, hastighedsbaseret blur.' },
  { key: 'logoSvg', file: 'assets/brand/coop-bank-logo.svg', use: 'Brandmærke i hjørnet + slutbillede', fallback: 'Rent tekstmærke "COOP BANK · MARKETING" med rød prik. Der opfindes ikke et logo.' },
  { key: 'logoPng', file: 'assets/brand/coop-bank-logo.png', use: 'Brandmærke (fallback for SVG)', fallback: 'Som ovenfor.' },
  { key: 'guidelines', file: 'assets/brand/brand-guidelines.pdf', use: 'Farver, typografi, tone', fallback: 'Briefens fallback-tokens anvendes (#F6F6F3 / #151515 / #E30613 / #315BFF / #48C77A / #FFC84A + lyse kortfarver).' },
  { key: 'fontsDir', file: 'assets/brand/fonts', use: 'Officiel Coop Bank-skrift', dir: true, fallback: 'Inter (SIL OFL) pakket lokalt i assets/brand/fonts/ fra npm-pakken @fontsource/inter. Ingen ekstern font-CDN.' },
  { key: 'wfWebflow', file: 'assets/workflows/webflow-claude-mcp.png', use: 'Beat 11 · kort 1 (Mikkel · Claude · Webflow · MCP)', fallback: 'Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst.' },
  { key: 'wfContent', file: 'assets/workflows/nicole-content-agent.png', use: 'Beat 11 · kort 2 (Nicole · AI-agent)', fallback: 'Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst.' },
  { key: 'wfTone', file: 'assets/workflows/tonepilot.png', use: 'Beat 11 · kort 3 (TonePilot)', fallback: 'Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst.' },
  { key: 'wfCmo', file: 'assets/workflows/cmo-copilot.png', use: 'Beat 11 · kort 4 (CMO Copilot)', fallback: 'Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst.' },
  { key: 'personMikkel', file: 'assets/people/mikkel.png', use: 'Lille cirkulær avatar ved navnet "Mikkel" (beat 11)', fallback: 'Monogram-cirkel "MF". Konceptet bygger ikke på portrætter.' },
  { key: 'personNicole', file: 'assets/people/nicole.png', use: 'Lille cirkulær avatar ved navnet "Nicole" (beat 11)', fallback: 'Monogram-cirkel "N". Konceptet bygger ikke på portrætter.' },
  { key: 'audioWav', file: 'assets/audio/voiceover-da.wav', use: 'Dansk voiceover, muxes ind i den endelige MP4', fallback: 'Stum visuel preview + manuskript, timing-JSON og SRT i dist/. Ingen browser-talesyntese.' },
  { key: 'audioMp3', file: 'assets/audio/voiceover-da.mp3', use: 'Dansk voiceover (fallback for WAV)', fallback: 'Som ovenfor.' },
  { key: 'music', file: 'assets/audio/music.mp3', use: 'Diskret baggrundsmusik (valgfri)', fallback: 'Ingen musik. Mixet er forberedt i scripts/encode-video.sh.' },
  { key: 'sfx', file: 'assets/audio/sfx.mp3', use: 'Sound design: whoosh, klik, impact, ét glitch i beat 9 (valgfri)', fallback: 'Ingen effekter. Cue-liste ligger i dist/voiceover-timing.json.' },
];

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

const found = {};
const missing = [];
for (const e of EXPECTED) {
  const abs = path.join(ROOT, e.file);
  const ok = fs.existsSync(abs) && (e.dir ? fs.readdirSync(abs).length > 0 : fs.statSync(abs).size > 0);
  if (ok) found[e.key] = e.file; else missing.push(e);
}

const allFiles = walk(path.join(ROOT, 'assets'));
fs.writeFileSync(
  path.join(ROOT, 'assets/manifest.json'),
  JSON.stringify({ found, missing: missing.map((m) => m.key), files: allFiles }, null, 2)
);

/* ---------------- asset-report.md ---------------- */

const fonts = walk(path.join(ROOT, 'assets/brand/fonts'));
const L = [];
L.push('# Asset-rapport');
L.push('');
L.push('_Coop Bank · “Marketing og AI-agenter” · deterministisk explainer-video._');
L.push('');
L.push('Genereret af `npm run assets` (`scripts/scan-assets.mjs`). Rapporten beskriver hvad der blev fundet i `assets/`, hvad der bliver brugt i videoen, hvad der mangler, og hvilken fallback der er anvendt i stedet. **Manglende assets blokerer ikke en render.**');
L.push('');
L.push('## 1. Assets fundet');
L.push('');
if (allFiles.length === 0) {
  L.push('_Ingen filer i `assets/` ud over de lokalt bundlede skrifter (se punkt 4)._');
} else {
  L.push('| Fil | Størrelse |');
  L.push('| --- | --- |');
  for (const f of allFiles) {
    const s = fs.statSync(path.join(ROOT, 'assets', f)).size;
    L.push(`| \`assets/${f}\` | ${(s / 1024).toFixed(1)} kB |`);
  }
}
L.push('');
L.push('## 2. Assets brugt i videoen');
L.push('');
const usedRows = EXPECTED.filter((e) => found[e.key]);
if (usedRows.length === 0) {
  L.push('| Asset | Anvendelse |');
  L.push('| --- | --- |');
  L.push('| `assets/brand/fonts/inter-latin-*.woff2` | Al typografi i videoen. Bundlet lokalt, ingen ekstern CDN. |');
} else {
  L.push('| Asset | Anvendelse |');
  L.push('| --- | --- |');
  for (const e of usedRows) L.push(`| \`${e.file}\` | ${e.use} |`);
  L.push('| `assets/brand/fonts/inter-latin-*.woff2` | Al typografi i videoen. Bundlet lokalt, ingen ekstern CDN. |');
}
L.push('');
L.push('## 3. Manglende assets');
L.push('');
L.push('| Forventet asset | Skulle bruges til | Status |');
L.push('| --- | --- | --- |');
for (const e of missing) L.push(`| \`${e.file}\` | ${e.use} | Ikke leveret |`);
L.push('');
L.push('## 4. Anvendte fallbacks');
L.push('');
L.push('| Manglende asset | Fallback |');
L.push('| --- | --- |');
for (const e of missing) L.push(`| \`${e.file}\` | ${e.fallback} |`);
L.push('');
L.push('### Skrifttype');
L.push('');
L.push('Der er ikke leveret en officiel Coop Bank-skrift. Videoen bruger **Inter** (SIL Open Font License 1.1) — en moderne grotesk, der matcher briefens krav. Filerne er hentet fra npm-pakken `@fontsource/inter` og **kopieret ind i repoet** under `assets/brand/fonts/`, så renderen aldrig er afhængig af en ekstern font-CDN:');
L.push('');
for (const f of fonts) L.push(`- \`assets/brand/fonts/${f}\``);
L.push('');
L.push('Vægtene 400/500/600/700/800/900 dækker brødtekst, kort, mellemrubrikker og hovedoverskrifter. Latin-subsettet indeholder Æ/Ø/Å.');
L.push('');
L.push('### Logo');
L.push('');
L.push('Der er **ikke** hentet, tegnet eller opfundet et Coop Bank-logo. Hvor et logo ville stå, vises i stedet et rent typografisk mærke — `COOP BANK · MARKETING` med en rød prik — og på slutbilledet teksten `Coop Bank Marketing`. Lægges `assets/brand/coop-bank-logo.svg` (eller `.png`) ind i repoet, bliver den automatisk brugt i stedet, uden kodeændringer.');
L.push('');
L.push('### Workflow-screenshots (beat 11)');
L.push('');
L.push('Der er ikke leveret autentiske screenshots. Beat 11 viser derfor **rekonstruerede** grænseflader: hvert agentkort kan foldes ud til et afrundet applikationsvindue tegnet i HTML/CSS/SVG, med al læsbar tekst sat som rigtig dansk HTML-tekst. Produktnavnene Claude, Webflow, MCP, TonePilot og CMO Copilot står uændret.');
L.push('');
L.push('Lægges rigtige screenshots ind under `assets/workflows/` med de forventede filnavne, indsættes de automatisk i vinduerne (`src/scenes/beat11.js` læser `assets.js`). Før det gøres, skal personhenførbare og fortrolige oplysninger maskeres eller sløres i selve billedfilerne — koden beskærer og maskerer, men kan ikke vurdere indholdet.');
L.push('');
L.push('### Voiceover');
L.push('');
if (found.audioWav || found.audioMp3) {
  L.push('Voiceover-fil fundet. Den muxes ind i den endelige MP4 af `scripts/encode-video.sh`.');
} else {
  L.push('Der er ikke leveret en voiceover-fil. Videoen renderes derfor som **stum visuel preview**, og der bruges **ikke** browser-talesyntese. I stedet leveres:');
  L.push('');
  L.push('- `dist/voiceover-manus.txt` — indtalingsklart dansk manuskript med regi og timing');
  L.push('- `dist/voiceover-timing.json` — maskinlæsbar timing pr. beat og pr. replik + cue-liste til sound design');
  L.push('- `dist/voiceover-da.srt` — undertekster i dansk');
  L.push('');
  L.push('Lægges `assets/audio/voiceover-da.wav` (eller `.mp3`) ind, muxer `npm run encode` den automatisk ind i MP4-filen.');
}
L.push('');
L.push('### Referencevideo');
L.push('');
if (found.reference) {
  L.push('Referencevideoen er leveret og er gennemgået inden implementeringen.');
} else {
  L.push('`assets/reference/reference-saas-explainer.mp4` er ikke leveret. Motion-grammatikken er i stedet implementeret direkte efter briefens beskrivelse: minimalistisk off-white baggrund, kinetisk typografi, UI-kort, forbundne SVG-linjer, hurtige præcise skift (0,3–0,6 s) efterfulgt af læsehold, kontrolleret spring/overshoot (maks. ca. 4–7 %), hastighedsbaseret motion blur, whip-pans, scene-zooms og én kort mørk kontrastsekvens (beat 9).');
}
L.push('');
L.push('## 5. Persondata og fortrolighed');
L.push('');
L.push('Videoen indeholder ingen personhenførbare oplysninger ud over fornavnene **Mikkel** og **Nicole**, som indgår i briefens tekst til beat 11. Der bruges ingen portrætter, medmindre de lægges i `assets/people/`; i så fald vises de udelukkende som små cirkulære avatarer ved siden af navnene.');
L.push('');

fs.writeFileSync(path.join(ROOT, 'asset-report.md'), L.join('\n'));
// The brief asks for asset-report.md at the delivery root as well.
fs.writeFileSync(path.join(REPO, 'asset-report.md'), L.join('\n'));

console.log(`[assets] found ${Object.keys(found).length}, missing ${missing.length}`);
console.log('[assets] wrote assets/manifest.json, asset-report.md');
