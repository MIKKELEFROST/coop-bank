# Asset-rapport

_Coop Bank · “Marketing og AI-agenter” · deterministisk explainer-video._

Genereret af `npm run assets` (`scripts/scan-assets.mjs`). Rapporten beskriver hvad der blev fundet i `assets/`, hvad der bliver brugt i videoen, hvad der mangler, og hvilken fallback der er anvendt i stedet. **Manglende assets blokerer ikke en render.**

## 1. Assets fundet

| Fil | Størrelse |
| --- | --- |
| `assets/brand/fonts/inter-latin-400-normal.woff2` | 23.1 kB |
| `assets/brand/fonts/inter-latin-500-normal.woff2` | 23.7 kB |
| `assets/brand/fonts/inter-latin-600-normal.woff2` | 23.9 kB |
| `assets/brand/fonts/inter-latin-700-normal.woff2` | 23.8 kB |
| `assets/brand/fonts/inter-latin-800-normal.woff2` | 23.8 kB |
| `assets/brand/fonts/inter-latin-900-normal.woff2` | 23.3 kB |
| `assets/manifest.json` | 0.6 kB |

## 2. Assets brugt i videoen

| Asset | Anvendelse |
| --- | --- |
| `assets/brand/fonts` | Officiel Coop Bank-skrift |
| `assets/brand/fonts/inter-latin-*.woff2` | Al typografi i videoen. Bundlet lokalt, ingen ekstern CDN. |

## 3. Manglende assets

| Forventet asset | Skulle bruges til | Status |
| --- | --- | --- |
| `assets/reference/reference-saas-explainer.mp4` | Referencestil for tempo og motion-grammatik | Ikke leveret |
| `assets/brand/coop-bank-logo.svg` | Brandmærke i hjørnet + slutbillede | Ikke leveret |
| `assets/brand/coop-bank-logo.png` | Brandmærke (fallback for SVG) | Ikke leveret |
| `assets/brand/brand-guidelines.pdf` | Farver, typografi, tone | Ikke leveret |
| `assets/workflows/webflow-claude-mcp.png` | Beat 11 · kort 1 (Mikkel · Claude · Webflow · MCP) | Ikke leveret |
| `assets/workflows/nicole-content-agent.png` | Beat 11 · kort 2 (Nicole · AI-agent) | Ikke leveret |
| `assets/workflows/tonepilot.png` | Beat 11 · kort 3 (TonePilot) | Ikke leveret |
| `assets/workflows/cmo-copilot.png` | Beat 11 · kort 4 (CMO Copilot) | Ikke leveret |
| `assets/people/mikkel.png` | Lille cirkulær avatar ved navnet "Mikkel" (beat 11) | Ikke leveret |
| `assets/people/nicole.png` | Lille cirkulær avatar ved navnet "Nicole" (beat 11) | Ikke leveret |
| `assets/audio/voiceover-da.wav` | Dansk voiceover, muxes ind i den endelige MP4 | Ikke leveret |
| `assets/audio/voiceover-da.mp3` | Dansk voiceover (fallback for WAV) | Ikke leveret |
| `assets/audio/music.mp3` | Diskret baggrundsmusik (valgfri) | Ikke leveret |
| `assets/audio/sfx.mp3` | Sound design: whoosh, klik, impact, ét glitch i beat 9 (valgfri) | Ikke leveret |

## 4. Anvendte fallbacks

| Manglende asset | Fallback |
| --- | --- |
| `assets/reference/reference-saas-explainer.mp4` | Motion-grammatikken er skrevet ud fra briefens beskrivelse: 0,5–1,2 s pr. visuelt skift, 0,3–0,6 s transitioner, spring/overshoot, hastighedsbaseret blur. |
| `assets/brand/coop-bank-logo.svg` | Rent tekstmærke "COOP BANK · MARKETING" med rød prik. Der opfindes ikke et logo. |
| `assets/brand/coop-bank-logo.png` | Som ovenfor. |
| `assets/brand/brand-guidelines.pdf` | Briefens fallback-tokens anvendes (#F6F6F3 / #151515 / #E30613 / #315BFF / #48C77A / #FFC84A + lyse kortfarver). |
| `assets/workflows/webflow-claude-mcp.png` | Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst. |
| `assets/workflows/nicole-content-agent.png` | Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst. |
| `assets/workflows/tonepilot.png` | Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst. |
| `assets/workflows/cmo-copilot.png` | Abstrakt UI-rekonstruktion i HTML/CSS/SVG med dansk grænsefladetekst. |
| `assets/people/mikkel.png` | Monogram-cirkel "MF". Konceptet bygger ikke på portrætter. |
| `assets/people/nicole.png` | Monogram-cirkel "N". Konceptet bygger ikke på portrætter. |
| `assets/audio/voiceover-da.wav` | Stum visuel preview + manuskript, timing-JSON og SRT i dist/. Ingen browser-talesyntese. |
| `assets/audio/voiceover-da.mp3` | Som ovenfor. |
| `assets/audio/music.mp3` | Ingen musik. Mixet er forberedt i scripts/encode-video.sh. |
| `assets/audio/sfx.mp3` | Ingen effekter. Cue-liste ligger i dist/voiceover-timing.json. |

### Skrifttype

Der er ikke leveret en officiel Coop Bank-skrift. Videoen bruger **Inter** (SIL Open Font License 1.1) — en moderne grotesk, der matcher briefens krav. Filerne er hentet fra npm-pakken `@fontsource/inter` og **kopieret ind i repoet** under `assets/brand/fonts/`, så renderen aldrig er afhængig af en ekstern font-CDN:

- `assets/brand/fonts/inter-latin-400-normal.woff2`
- `assets/brand/fonts/inter-latin-500-normal.woff2`
- `assets/brand/fonts/inter-latin-600-normal.woff2`
- `assets/brand/fonts/inter-latin-700-normal.woff2`
- `assets/brand/fonts/inter-latin-800-normal.woff2`
- `assets/brand/fonts/inter-latin-900-normal.woff2`

Vægtene 400/500/600/700/800/900 dækker brødtekst, kort, mellemrubrikker og hovedoverskrifter. Latin-subsettet indeholder Æ/Ø/Å.

### Logo

Der er **ikke** hentet, tegnet eller opfundet et Coop Bank-logo. Hvor et logo ville stå, vises i stedet et rent typografisk mærke — `COOP BANK · MARKETING` med en rød prik — og på slutbilledet teksten `Coop Bank Marketing`. Lægges `assets/brand/coop-bank-logo.svg` (eller `.png`) ind i repoet, bliver den automatisk brugt i stedet, uden kodeændringer.

### Workflow-screenshots (beat 11)

Der er ikke leveret autentiske screenshots. Beat 11 viser derfor **rekonstruerede** grænseflader: hvert agentkort kan foldes ud til et afrundet applikationsvindue tegnet i HTML/CSS/SVG, med al læsbar tekst sat som rigtig dansk HTML-tekst. Produktnavnene Claude, Webflow, MCP, TonePilot og CMO Copilot står uændret.

Lægges rigtige screenshots ind under `assets/workflows/` med de forventede filnavne, indsættes de automatisk i vinduerne (`src/scenes/beat11.js` læser `assets.js`). Før det gøres, skal personhenførbare og fortrolige oplysninger maskeres eller sløres i selve billedfilerne — koden beskærer og maskerer, men kan ikke vurdere indholdet.

### Voiceover

Der er ikke leveret en voiceover-fil. Videoen renderes derfor som **stum visuel preview**, og der bruges **ikke** browser-talesyntese. I stedet leveres:

- `dist/voiceover-manus.txt` — indtalingsklart dansk manuskript med regi og timing
- `dist/voiceover-timing.json` — maskinlæsbar timing pr. beat og pr. replik + cue-liste til sound design
- `dist/voiceover-da.srt` — undertekster i dansk

Lægges `assets/audio/voiceover-da.wav` (eller `.mp3`) ind, muxer `npm run encode` den automatisk ind i MP4-filen.

### Referencevideo

`assets/reference/reference-saas-explainer.mp4` er ikke leveret. Motion-grammatikken er i stedet implementeret direkte efter briefens beskrivelse: minimalistisk off-white baggrund, kinetisk typografi, UI-kort, forbundne SVG-linjer, hurtige præcise skift (0,3–0,6 s) efterfulgt af læsehold, kontrolleret spring/overshoot (maks. ca. 4–7 %), hastighedsbaseret motion blur, whip-pans, scene-zooms og én kort mørk kontrastsekvens (beat 9).

## 5. Persondata og fortrolighed

Videoen indeholder ingen personhenførbare oplysninger ud over fornavnene **Mikkel** og **Nicole**, som indgår i briefens tekst til beat 11. Der bruges ingen portrætter, medmindre de lægges i `assets/people/`; i så fald vises de udelukkende som små cirkulære avatarer ved siden af navnene.
