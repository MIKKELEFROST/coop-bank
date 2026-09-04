# Lydbrief — Coop Bank · Marketing og AI-agenter

Filmen er færdig og renderet: 75,0 sekunder, 1920×1080, 30 fps. Den er stum.
Dette dokument beskriver, hvad der skal optages og skaffes, og hvordan det
lægges på.

Manuskript med timing pr. beat: `dist/voiceover-manus.txt`
Maskinlæsbar timing og cue-liste: `dist/voiceover-timing.json`
Undertekster: `dist/voiceover-da.srt`

---

## 1. Speak

**209 ord. 75 sekunder. Gennemsnit 167 ord i minuttet.**

### Hvem

Anbefaling: en intern stemme — dig eller Nicole. Filmens pointe er, at
*mennesket sætter rammerne og godkender*. Hvis fortællerstemmen tydeligt er
syntetisk, modsiger lyden budskabet i samme øjeblik det fremsættes. Til en
intern ledelsespræsentation signalerer en intern stemme desuden ejerskab af
arbejdet bedre end en indlejet speaker.

### Tone

Rolig, troværdig, intelligent, fremadskuende. Ledelsesniveau — ikke
reklamestemme. Ingen påtaget begejstring. Det afsluttende spørgsmål lukkes
ikke af; det skal stå åbent.

### Alternativ: ElevenLabs Voice Design

Referencevideoen (`snaptik_7638517755234225415_v3.mp4`) er målt akustisk. Se
"Stemmeanalyse" nederst for tallene. Prompt til Voice Design:

```
Native Danish, rigsdansk (standard københavnsk, uden regional dialekt).
Male, 35-45. Studio quality.
Persona: confident product narrator. Emotion: calm, assured, quietly engaged.
Low-pitched, warm chest-resonant timbre with a close, forward proximity and a
clean noise-free signal. Even, controlled delivery with narrow dynamic
variation and no rising sell-tone; unhurried and measured pacing with crisp
consonants and a gentle downward inflection at the end of each statement.
```

**Preview-tekst** (brug filmens egen åbning — så hører du stemmen på den
rigtige tekst, og teksten understøtter prompten frem for at modarbejde den):

```
Marketing er ved at ændre sig. Ikke kun gennem nye værktøjer, men gennem
AI-agenter. En AI-agent kan selv planlægge, søge information, træffe
beslutninger og udføre handlinger for at nå et mål. Det ændrer vores
arbejdsgange – og på sigt også vores roller og hvor mange vi skal være.
```

**Guidance Scale: 35-40 %.** Sproglig troskab er det vigtigste her — et dansk
output der glider mod engelsk prosodi er ubrugeligt, så prompten skal følges
stramt. Går kvaliteten ned, så prøv 30 %.

ElevenLabs anbefaler selv Professional Voice Clones frem for Voice Design, når
resultatet skal være produktionsklart. Findes der en dansk PVC i deres Voice
Library, der rammer beskrivelsen ovenfor, så tag den i stedet.

### Sådan optages det

- Optag **hver beat som sin egen take** med et halvt sekunds stilhed før og
  efter. Så kan replikkerne placeres præcist på tiderne i timing-filen uden at
  strække lyden.
- Stille rum. Bløde flader (gardiner, sofa, tøj) dæmper rumklang — et
  soveværelse eller et mødelokale med tæppe er bedre end et hårdt kontor.
- Mikrofonen ca. 20 cm fra munden, lidt ved siden af, så p- og b-lyde ikke
  slår i membranen.
- Et par gode takes af hver linje. Vælg den roligste, ikke den hurtigste.
- Lever som **WAV, 48 kHz** hvis muligt. MP3 virker også.

### Tempo pr. beat

De fleste beats har luft. Fire er tætpakkede og skal enten leveres let
komprimeret eller have lov at glide et par tiendedele ind over næste klip —
billedet holder stille netop dér:

| Beat | Ord/min | Levering |
| --- | --- | --- |
| 3 · Værktøjer → Bemanding | 204 | komprimeret |
| 4 · Mindre afdeling | 190 | let komprimeret |
| 8 · Fra udføre til lede | 190 | let komprimeret |
| 1 · Åbning | 187 | let komprimeret |
| 9 · Tillid og kontrol | 187 | let komprimeret |
| 10 · Sådan bruger vi | 180 | let komprimeret |
| Resten | 144–170 | normal |

Produktnavne udtales som på engelsk: Claude, Webflow, MCP, TonePilot,
CMO Copilot.

Læg filen som **`assets/audio/voiceover-da.wav`** (eller `.mp3`).

---

## 2. Musik

**Ét gennemgående spor. Ingen redigering nødvendig — filmen er 75 sekunder.**

Musikken kan ikke genereres i dette projekt og skal skaffes fra et
licensbibliotek: Epidemic Sound, Artlist eller Musicbed. Til intern brug
dækker en almindelig licens.

### Hvad du skal lede efter

- 80–95 BPM
- Ingen vokal
- Ingen melodisk hook i forgrunden — sporet skal bære, ikke fortælle
- Blød synth-pad plus en let puls. Minimal percussion, intet stort drop
- Et naturligt løft omkring **0:50** (beat 11, hvor de fire agenter samles)
- Udtynding fra **1:08**, så slutspørgsmålet står i næsten stilhed

Søgeord der plejer at ramme rigtigt: *minimal corporate technology*,
*subtle ambient pulse*, *understated tech*, *quiet innovation*.

Undgå: alt med håndklap, "inspirerende" klaverakkorder, eller en opbygning
mod et klimaks. Filmen slutter på et åbent spørgsmål — musikken må ikke
konkludere på dens vegne.

Læg filen som **`assets/audio/music.wav`** (eller `.mp3`). Er den længere end
75 sekunder, klippes den automatisk med en udtoning.

---

## 3. Lydeffekter (valgfrit)

`dist/voiceover-timing.json` indeholder 30 cues med præcise tider — whooshes
ved overgangene, interface-klik når kort lander, ét kort glitch ved 41,6 s.

**Brug 8–10 af dem, ikke alle 30.** De vigtigste:

| Tid | Effekt |
| --- | --- |
| 0,72 s | Den røde cirkel lander |
| 15,1 s | "Bemanding" accelererer mod kameraet |
| 24,4 s | "Mønster fundet" lander |
| 33,4 s | Coop Bank-resultatet træder frem |
| 41,62 s | Glitch-impact — filmens eneste |
| 46,0 s | Vertikal wipe op, den mørke scene forlader billedet |
| 50,4 s | Marketing-hub stiger op nedefra |
| 66,0 s | Ordskiftet "genererer" → "arbejder sammen med os" |

Alle 30 gør det travlt og trækker filmen mod reklamefilm.

Samles til ét spor og lægges som **`assets/audio/sfx.wav`**.

---

## 4. Sådan lægges lyden på

```bash
npm run mix
```

Det tager omkring 7 sekunder. Billedsiden bliver **ikke** renderet igen —
video-strømmen kopieres, og kun lyden bygges. Du kan derfor prøve dig frem med
mixet så ofte du vil.

Resultatet er `dist/coop-bank-ai-agenter.mp4`.

### Hvad mixet gør

- **Speak** er ankeret: højpasfilter ved 80 Hz mod rumlen, og en let
  kompression der holder niveauet stabilt uden at lyde bearbejdet.
- **Musik** ligger 18 dB under og bliver **automatisk dæmpet, når der tales**
  (sidechain — den følger den faktiske optagelse, så en take der løber lidt
  længere stadig ducker rigtigt). Målt på testsignal: 5 dB dæmpning under tale.
- **Effekter** ligger 9 dB under og duckes ikke — korte lyde skal skære igennem.
- **Bussen** normaliseres til −16 LUFS med true peak −1,5 dBTP og en limiter.

### Justeringer

```bash
MUSIC_DB=-22 npm run mix     # dæmpere musik
DUCK_RATIO=10 npm run mix    # musikken går længere væk under tale
LUFS=-14 npm run mix         # højere samlet niveau (rum med rigtigt anlæg)
```

Duckingens dybde bør sættes mod den rigtige optagelse — syntetiske testtoner
forudsiger ikke, hvordan rigtig tale driver en kompressor.

---

## 5. Stemmeanalyse af referencevideoen

Målt på `snaptik_7638517755234225415_v3.mp4` (18,65 s). Videoen er selv en
motion-graphics-explainer med speak over grafik — ingen synlig taler — så
karakteristikken er udledt akustisk, ikke visuelt.

| Parameter | Måling | Hvad det betyder |
| --- | --- | --- |
| Grundtone (F0) | Tæt klynge ved **100–125 Hz** | Mandsstemme, lidt dybere end gennemsnittet (~120 Hz) |
| Talehastighed | **3,65 stavelser/sek** | Behersket og uforhastet — ikke en energisk reklamestemme |
| Loudness | −17,5 LUFS, LRA **4,1 LU** | Kraftigt komprimeret, meget jævnt niveau |
| Crest factor | 6,0 | Bekræfter kompressionen — tæt, "forward" lyd |
| True peak | 0,0 dBFS | Hårdt limitet, moderne creator-lyd |
| Pauser | Få og korte | Sammenhængende flow, ingen dramatiske ophold |
| Baggrund | Tydelig energi under 120 Hz | Der ligger musik under speaken |

### Én ting du skal tage stilling til

Referencen taler **3,65 stavelser i sekundet**. Vores manuskript kører 167 ord i
minuttet, hvilket svarer til ca. **4,7 stavelser i sekundet** — altså mærkbart
hurtigere. Du kan ikke få begge dele.

Enten:

- **Behold filmen som den er** og accepter at speaken bliver hurtigere og mere
  drivende end referencen. Beat 3, 4, 8 og 9 er allerede tætpakkede.
- **Eller kort manuskriptet ned** med ca. 20 % (fra 209 til ~175 ord), så den
  rolige levering fra referencen kan holdes hele vejen. Det kræver, at jeg
  omskriver de fire tætte beats og justerer cue-tiderne — billedsiden behøver
  ikke renderes om.

Min anbefaling er den anden. Referencens ro er en stor del af grunden til, at
den virker troværdig, og det er præcis den kvalitet, der bærer på et
ledelsesmøde. Filmens tempo er højt nok visuelt til, at speaken godt må trække
den ned.
