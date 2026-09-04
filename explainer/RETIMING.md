# Retiming — at forlænge filmen uden at den hakker

Når speaken skal passe, skal der lægges tid til billedsiden. I et
klipprogram kan det kun gøres ved at **fryse et billede**: det samme frame
vises 45 gange i træk, bevægelsen står stille, og så sætter den i gang igen.
Det er dét, der hakker.

Det her projekt har ikke den begrænsning. Siden er en ren funktion af tiden, og
`seekToTime()` tager et vilkårligt kommatal. Vi kan altså rendere billeder på
tidspunkter der aldrig har eksisteret — 43,6133 s, 43,6289 s — så bevægelsen
bare kører **langsommere**. Intet duplikeres, intet står stille, og så er der
ikke noget at hakke i.

## Hvorfor et frys hakker netop i denne film

`npm run motion` måler, hvor stor en del af billedet der ændrer sig fra frame
til frame. Målt på masteren:

| | |
| --- | --- |
| Median | 0,65 % af billedet ændrer sig hvert frame |
| Eneste lange stilstand | 71,80–74,97 s (3,17 s, slutbilledet) |
| Næstlængste | 48,67–49,97 s (1,30 s) |
| Beat 9 (41,5–46,0) | kun 0,63 s stilstand i alt |

Filmen er altså i **næsten konstant bevægelse**. Der er ingen steder i beat 9
at gemme et frys — derfor ses det med det samme.

## De to værktøjer

### 1. Mål hvad der blev gjort ved filmen

```bash
node scripts/match-cut.mjs dit-klip.mp4
```

Et omklip er en monoton time-warp af masteren: rækkefølgen holdes, nogle
frames gentages. Det er præcis den struktur **dynamic time warping** antager,
så DTW finder sammenhængen optimalt i stedet for at gætte frame for frame —
hvilket betyder noget her, fordi lange stræk af filmen ligner sig selv fra
frame til frame, og et nærmeste-nabo-match derfor er tvetydigt.

Søgningen er båndbegrænset omkring diagonalen, så den er O(N × bånd) frem for
O(N × M).

Ud kommer `dist/measured-warp.json`: hvor meget tid der er lagt ind, og hvor.

**Efterprøvet:** et syntetisk klip med et kendt indgreb (+1,500 s ved master
43,333 s og +1,233 s ved 49,000 s) blev genfundet som +1,500 s ved 43,367 s og
+1,233 s ved 48,800 s — altså 1 frame galt på det første og 6 frames på det
andet. Det andet ligger inde i stilstanden 48,67–49,97 s, hvor et match per
definition er tvetydigt: er det tvetydigt for algoritmen, er det også
usynligt for øjet.

### 2. Render den blødt igen

```bash
node scripts/retime.mjs --curve dist/measured-warp.json
```

Den regner på indsætnings**raten** r(m) = d(add)/dm, altså hvor mange sekunder
der lægges til pr. sekund af masteren. Et frys er en uendelig rate. Den
begrænses til en maksimalværdi, og det overskydende skubbes ud til de nærmeste
frames der har plads — nærmeste først, så tiden bliver liggende så tæt på hvor
du lagde den som muligt. Summen bevares nøjagtigt, så **filmen beholder sin
længde**.

Loftet er lokalt: hvor billedet står stille, er et frys usynligt, og så løsnes
loftet. Det koster ingenting at lade tiden blive liggende dér.

Til sidst rundes hjørnerne af, så hastighedsskiftet er glidende.

Uden et målt klip kan indgrebet også beskrives direkte:

```bash
node scripts/retime.mjs --hold 43.5:2.74:7.0 --fit 77.74 --plan
```

— læg 2,74 s til omkring master 43,5 s, fordelt over en rampe på 7 s. `--plan`
regner og rapporterer uden at rendere.

## Hvad du får at vide, før der renderes

```
  timingen afviger fra dit klip her — alt udenfor ligger præcis som hos dig:
    master 42.97-43.77s   op til 0.74s
    master 48.70-48.90s   op til 0.55s
```

Uden for de vinduer er de to versioner ens **på frame-niveau**, så alt hvad
lyden er sat efter derude lander nøjagtigt hvor det gjorde. Inde i et vindue
overdriver tallet risikoen: dit frys holder ét billede i hele sin længde, og
den bløde version passerer gennem samme billede inden for samme spand. Det der
reelt flytter sig, er materiale *tæt på* frysningen, men ikke inde i den.

## Kontrol af at det er rigtigt

Uden for ramperne er warpen identiteten plus et helt antal frames. De frames
**skal** derfor komme ud bit-identiske med masteren — og det tjekkes med md5
mod `dist/frames/` efter hver render frem for at blive påstået:

```
[retime] identitetstjek: 2042/2042 frames identiske med masteren
                         (290 frames er nye mellemtider)
```

`add` snappes til hele frames, netop for at det kan lade sig gøre. Og
mellemtider snappes tilbage til den eksakte frame-tid når de rammer én:
`invert()` er en halveringssøgning og lander nogle få femtosekunder ved siden
af — alt for lidt til at ses, men nok til at skubbe en afrundet pixelværdi i en
transform over en grænse, så ét bogstav rasteriseres anderledes.

## Filer

| | |
| --- | --- |
| `scripts/motion-energy.mjs` | måler hvor filmen er i bevægelse (`dist/motion-energy.json`) |
| `scripts/match-cut.mjs` | udleder indgrebet fra et omklip (`dist/measured-warp.json`) |
| `scripts/retime.mjs` | renderer den blødt igen + `dist/retime-map.json` |
| `dist/retime-map.json` | master-tid for hvert eneste output-frame, og beats i ny tid |

Output er **stumt** (`SILENT=1`), 1920×1080, 30 fps, yuv420p, H.264 — klar til
at lægge lyd på.
