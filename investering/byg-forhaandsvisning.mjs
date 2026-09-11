#!/usr/bin/env node
/**
 * Bygger forhaandsvisning/index.html: den rigtige /investering-side fra coopbank.dk
 * med afkastberegneren sat ind lige over sektionen "Kom i gang på få minutter".
 *
 *   node investering/byg-forhaandsvisning.mjs
 *
 * Kilden til beregneren er afkastberegner.html — blokken mellem KLIP-markørerne.
 * Den kopieres herfra, så der kun er ét sted at rette den.
 *
 * Siden hentes live hver gang, så forhåndsvisningen følger med, når Coop Bank
 * ændrer noget. Den er et øjebliksbillede til gennemsyn, ikke en kopi der skal
 * publiceres: CSS, skrifter og billeder hentes fra Coops eget CDN, interne links
 * peger via <base> tilbage på coopbank.dk, og siden er sat til noindex.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HER = dirname(fileURLToPath(import.meta.url));
const KILDE = 'https://coopbank.dk/investering';
const BLOK_FIL = `${HER}/afkastberegner.html`;
const UD_FIL = `${HER}/forhaandsvisning/index.html`;
const ANKER = 'Kom i gang på få minutter';

// Scripts der ikke skal køre i en forhåndsvisning: samtykkebanner og måling.
const FJERN_SCRIPTS = /<script\b[^>]*\b(?:src|id)="[^"]*(?:cookieinformation|googletagmanager|google-analytics|gtag|clarity\.ms|hotjar)[^"]*"[^>]*>\s*<\/script>/gi;

function hentBlok(fil) {
  const start = fil.indexOf('KLIP HER – START PÅ EMBED');
  const slut = fil.indexOf('KLIP HER – SLUT PÅ EMBED');
  if (start === -1 || slut === -1) throw new Error('KLIP-markørerne findes ikke i afkastberegner.html');
  const efterStart = fil.indexOf('-->', start) + 3;
  const førSlut = fil.lastIndexOf('<!--', slut);
  return fil.slice(efterStart, førSlut).trim();
}

const html = await fetch(KILDE, {
  headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' },
}).then((r) => {
  if (!r.ok) throw new Error(`${KILDE} svarede ${r.status}`);
  return r.text();
});
console.log(`hentet: ${KILDE} — ${html.length} tegn`);

const blok = hentBlok(await readFile(BLOK_FIL, 'utf8'));
console.log(`beregner: ${blok.length} tegn fra afkastberegner.html`);

// Ryd op først, så alle positioner herunder gælder den færdige tekst.
const renset = html.replace(FJERN_SCRIPTS, '');
let ud = renset;
console.log(`fjernede samtykke/måling: ${html.length - renset.length} tegn`);

// Find sektionen med ankeret, og gå tilbage til dens <section>-start.
const antalAnkre = ud.split(ANKER).length - 1;
if (antalAnkre !== 1) throw new Error(`Fandt "${ANKER}" ${antalAnkre} gange — forventede præcis én`);
const ankerPos = ud.indexOf(ANKER);
const sektionPos = ud.lastIndexOf('<section', ankerPos);
if (sektionPos === -1) throw new Error('Fandt ingen <section> før ankeret');
const afstand = ankerPos - sektionPos;
if (afstand > 12000) throw new Error(`Nærmeste <section> ligger ${afstand} tegn før ankeret — sidens opbygning er ændret`);
console.log(`indsættelsespunkt: ${afstand} tegn før "${ANKER}"`);

ud = ud.slice(0, sektionPos) + '\n' + blok + '\n' + ud.slice(sektionPos);

// Kontroller indsættelsen, mens ankeret stadig kun står ét sted.
const tjekIndsæt = [
  ['beregneren er med', ud.includes('class="cbx-section"')],
  ['kun én beregner', ud.split('class="cbx-section"').length - 1 === 1],
  ['beregneren ligger før ankeret', ud.indexOf('cbx-section') < ud.indexOf(ANKER)],
  ['resten af siden er urørt', ud.replace('\n' + blok + '\n', '') === renset],
];

const hovedSlut = ud.indexOf('>', ud.indexOf('<head')) + 1;
if (hovedSlut === 0) throw new Error('Fandt ingen <head>');

const stempel = new Date().toISOString().slice(0, 16).replace('T', ' ');
const hoved = `
<!-- FORHÅNDSVISNING. Kopi af ${KILDE} hentet ${stempel} UTC, med afkastberegneren
     sat ind over trin-sektionen. Ikke til publicering.
     Bygget af investering/byg-forhaandsvisning.mjs — ret ikke i denne fil. -->
<base href="https://coopbank.dk/">
<meta name="robots" content="noindex,nofollow">`;

ud = ud.slice(0, hovedSlut) + hoved + ud.slice(hovedSlut);

for (const [navn, ok] of [...tjekIndsæt,
  ['base er sat', ud.includes('<base href="https://coopbank.dk/">')],
  ['noindex er sat', ud.includes('content="noindex,nofollow"')],
  // Selve banner-scriptet skal være væk. Sidens egen kode, der læser samtykke-cookien,
  // bliver stående — uden banneret finder den intet samtykke og gør ingenting.
  ['samtykkebanneret er fjernet', !/policy\.app\.cookieinformation\.com/i.test(ud)],
]) {
  console.log(`  ${ok ? '\u2713' : '\u2717'} ${navn}`);
  if (!ok) throw new Error(`Kontrollen "${navn}" fejlede — skrev ingenting`);
}

await mkdir(dirname(UD_FIL), { recursive: true });
await writeFile(UD_FIL, ud);
console.log(`skrev: ${UD_FIL} — ${ud.length} tegn`);
