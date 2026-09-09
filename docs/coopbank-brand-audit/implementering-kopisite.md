# Implementering af brandrevisionen på kopi-sitet

Rapporten i `rapport.html` beskriver, hvad der ikke følger designguiden og tone of
voice. Dette dokument er logbogen over, hvad der rent faktisk er **ændret** — hvor,
med hvilke værdier, og hvad der er verificeret bagefter.

## Hvilket site

| | |
|---|---|
| Site | **9.9.26 Copy of Coop Bank** |
| Site-id | `6aa10ba3f39a215db44cea4e` |
| Domæner | ingen (upubliceret kopi) |

Produktionssitet `694a6f40021364d1efffc3a5` (coopbank.dk) er **ikke rørt**. Alt
nedenstående ligger udelukkende på kopien og kan gennemses, før noget flyttes videre.

---

## 1. Designtokens

| Token | Før | Efter |
|---|---|---|
| `Color Primitives/green-400` | `#64d78c` | **`#63d78c`** (guidens værdi) |
| `Color Primitives/bordeaux` | `#5c2833` | **`#55252f`** (guidens værdi) |
| `Color Primitives/color` (`#dbadb7`) | navnløs | omdøbt til **`bordeaux-200`** |
| `Border radius/Brand (6px)` | fandtes ikke | **oprettet** — `variable-8add1ece-…` |
| `Abstract/Manchet (16px)` | fandtes ikke | **oprettet** — guidens fjerde tekstniveau |

`Weight/light (300)` er **ikke** slettet. Der findes ingen Porteron Light-fil på
sitet, så vægten kan ikke rendere som andet end en fallback — men en sletning er
destruktiv og bør bekræftes af jer først.

## 2. SEO-laget — 97 sider

Titler og beskrivelser er skrevet om på 97 statiske sider, så de holder op med at
råbe og i stedet siger, hvad siden er.

* Fire kald: 26 + 32 + 39 sider, plus ét rettelseskald.
* **Verifikation:** sider 0–199 gennemsøgt for de hårde markører `»`, `Klik her`,
  `Ansøg nu`, `✅` → **0 fund**.
* Eksempler: `/bolig` → „Bolig – tryg rådgivning hele vejen til nøglerne | Coop Bank",
  `/laan` → „Lån penge – find lånet der passer til din økonomi | Coop Bank".

## 3. Sideindhold — 13 overskrifter

**`/bolig`-heroen** (fund A1). Prisbudskabet lå øverst, rådgiveren nede på siden.
De byttede plads:

> **Før:** „Det skal være billigt at være boligejer"
> **Efter:** „Boligbeslutningen er den største, du træffer. Du skal ikke træffe den alene."

Manchetten er tilsvarende skiftet til den certificerede boligrådgiver, med bonus og
KundeKroner som det sekundære.

Teksten ligger i **component props**, ikke i sidens elementer — `set_text` virker
ikke her; det kræver `data_component_props_tool`.

**Rene produktnavne som H1.** Modellen fandtes allerede på sitet:
`Coop Konto. Gør hverdagen lidt lettere.` Samme greb er lagt på de tolv øvrige.
Hver kundesætning siger noget, manchetten nedenunder *ikke* allerede siger:

| Side | Ny H1 |
|---|---|
| `/konti/basal-konti` | Basale konti. Du har ret til en konto — også når din situation er speciel. |
| `/konti/boerneopsparing` | Børneopsparing. Det du lægger til side nu, betyder noget senere. |
| `/konti/boligloenkonto` | BoligLønkonto. Kontoen til dig, der har realkreditlån hos os. |
| `/konti/budgetkonto` | Budgetkonto. Så ved du, hvad der er tilbage til dig selv. |
| `/konti/juniorkonto` | Juniorkonto. Dit barn lærer at holde styr på sine egne penge. |
| `/konti/kassekredit` | Kassekredit. Der er luft, når du får brug for den. |
| `/konti/loenkonto` | Lønkonto. Alt det faste kører af sig selv. |
| `/konti/nemkonto` | NemKonto. Du bestemmer selv, hvor pengene lander. |
| `/konti/opsparingskonto` | Opsparingskonto. Saml din opsparing ét sted. |
| `/kort/mastercard-debet` | Mastercard Debet. Betalingskort og Coop-kort i ét. |
| `/kort/mastercard-kredit` | Mastercard Kredit. Du behøver ikke vente til lønningsdagen. |
| `/kort/visa-dankort` | Visa/Dankort. Færre kort i pungen. |

Ingen af dem indeholder et prisløfte, et udråbstegn eller en klikmarkør.

## 4. Tekstfarve → Coop Bordeaux (fund B1)

Guiden, ordret: *„Farven på font er primært Coop Bordeaux. På mørk baggrund er den
primære farve på font Coop Pampas."* Målingen viste 15 ud af 2.373 tekstknuder i
bordeaux — 0,6 %.

Tre ændringer dækker sitet:

1. `body`-taggets `color` → tokenet **`Text/bordeaux`**. Det er arvefarven for al
   tekst, der ikke selv sætter noget.
2. `Color Primitives/black` → peger nu på bordeaux-primitivet, **omdøbt til `ink`**.
3. `Color Primitives/neutral-1000` → samme, **omdøbt til `ink-strong`**.

De to sidste er nødvendige, fordi `h1`–`h6` binder de primitiver direkte. Webflows
Data-API kan kun ramme ét style pr. navn, og `default-h1`…`default-h6` er ikke det,
den rammer — så tokenlaget var den eneste vej ind. Navnene er ændret med, så
paletten ikke påstår „black" og leverer bordeaux.

**Kontrast, efterregnet (WCAG):**

| Tekst | på hvid | på Pampas | på Satin |
|---|---|---|---|
| Coop Bordeaux `#55252f` | **12,41** | **11,38** | **10,40** |
| tidligere grå `#4c4d52` | 8,43 | 7,73 | 7,06 |

Alle over AAA-grænsen på 7,0. Skiftet **forbedrer** altså kontrasten — det koster
ikke tilgængelighed at følge guiden her.

Uden for tekst rammer omlægningen kun fire små accenter: en prik, en aktiv
filterchip, en aktiv indholdsfortegnelses-markering og en fondsprik. Alle bliver
bordeaux i stedet for sorte, hvilket er på brand.

## 5. Fladefarver → Pampas og Satin Linen (fund B2)

Målingen: Pampas og Satin Linen brugt som flade **0 gange**. I stedet lå der to
kølige grå — `#f5f5f6` og `#e5e5e8` — der er nærmest identiske tvillinger til
brandets varme neutraler.

**38 styles er bundet om**, ikke ved at ændre primitiverne, men enkeltvis, så
neutralskalaen består til kanter og streger:

* **33 → `Background/satin light`** (`#f6f5f1`, Pampas): kort, sektionsflader,
  beregnere, FAQ-hero, navigationskort, prissammenligning m.fl.
* **5 → `Background/satin`** (`#edebe3`, Satin Linen): FAQ-wrappere, jobliste,
  beregner-info, sløret baggrundslag.

**Verifikation:** forespørgsel efter styles, der stadig bruger de to grå som
`background-color` → **0 tilbage**.

## 6. Radius → 6 px (guidens punkt om afrundede hjørner)

Guiden: *„Billedbokse og farvede kasser har afrundede hjørner med en radius på 6 px."*
Målingen: **0 ud af 1.088** radius-deklarationer var 6 px; sitet kører en egen skala
på 4/8/12/16/20/24/32 px.

Det nye `Border radius/Brand (6px)`-token er lagt på **34 farvede kasser** — de
samme flader som i punkt 5.

Undtaget bevidst: `.icon_wrapper` og `.icon-button` (runde ikonknapper, `Circle`),
`.layer-blur_social-proof` (har ingen radius) og `.bg-gray` (sætter kun baggrund).

> **Dette er den mest synlige ændring i hele omgangen.** Kortene går fra bløde
> 16–24 px til skarpe 6 px, og det ændrer sitets karakter mærkbart. Guiden er
> entydig på punktet, så det er implementeret — men det er værd at se på med egne
> øjne. De gamle tokens står urørte, så en fortrydelse er en ombinding, ikke et
> genopbygningsarbejde.

---

## Ikke gennemført — og hvorfor

**B6 · Knapperne på forsiden styres af indsat custom code.**
Blokeret. Webflow-MCP'ens værktøjer eksponerer ikke sidens custom code
(head-embed), så CSS'en kan hverken læses eller fjernes herfra. Den skal ryddes i
Webflow Designer. To ting hører med, når nogen alligevel er inde:

* Knapsystemet findes i **tre dubletter** — `.button`, `.button-2` og `.button-3` —
  hver med sit sæt varianter. Custom coden adresserer alle tre, netop fordi de er
  tre.
* Custom coden ligger i **forsidens head**, men headeren er global. Koden følger med
  ved enhver publicering — også til produktionen.

**B5 · Er handlingsfarven Coop Red eller grøn?**
Brandbeslutning, ikke en implementeringsdetalje. Den hænger sammen med, at
**linkfarven i dag er `#2243ee`** — en blå, der ikke findes i guidens lukkede palet
på syv farver. Begge dele bør afgøres samlet, og så kan de bindes på én gang.

**B7 · Logo-lockup for sub-brands.** Brandbeslutning.

**B13 · Formularerne (etrack1).** Ligger uden for Webflow. De kører fortsat Proxima
Nova, `#be1011`/`#cc0000`/`#448a44` og 5 px radius, med nul forekomster af Coop Red
eller Coop Bordeaux. Det kræver adgang til etrack1's stylesheet.

## Løse ender, der er værd at kende

* `.bg-gray` og `.contact-card.is-gray` hedder stadig „gray", men leverer nu satin.
  Klassenavne kan omdøbes i Designer; det er ikke gjort her, fordi custom code kan
  referere til dem.
* `default-h1`…`default-h6` er ramt gennem tokenlaget, ikke bundet direkte om. Vil
  man have det helt rent, sætter man farven på de seks tag-styles i Designer og
  ruller `ink`/`ink-strong` tilbage til sort.
