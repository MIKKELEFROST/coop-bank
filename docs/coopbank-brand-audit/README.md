# Brandrevision af coopbank.dk

Gennemgang af **alle 418 sider** på coopbank.dk målt mod Coop Banks to brandokumenter:

- `Coop Bank Design guidelines` (18.08.2025, 36 sider)
- `Tone of voice` (9 slides)

Sitet er hentet 8. september 2026, kort efter seneste publicering.

**Læs rapporten:** [`rapport.html`](rapport.html) — åbn filen i en browser.
**Præsentation:** [`coopbank-brandrevision.pptx`](coopbank-brandrevision.pptx) — 16 slides med hovedfundene.
**Implementering:** [`implementering-kopisite.md`](implementering-kopisite.md) — hvad der er ændret på kopi-sitet, og hvad der ikke kunne lade sig gøre.

---

## Hovedkonklusion

Sitet følger ikke de to dokumenter 100 %. Men billedet er ikke, at guiden ignoreres —
det er, at guiden er implementeret som *mulighed* frem for som *standard*.

Tonen er stærkest dér, hvor der er skrevet nyt: forsiden, kategorisiderne og
"Om Coop Bank" rammer budskabshierarkiet præcist. Afvigelserne samler sig tre steder:

1. **Boligområdets primærbudskab.** `/bolig` bruger ordret den sætning, tone of
   voice-oplægget udpeger som problemet: *"Det skal være billigt at være boligejer"*.
2. **Det gamle SEO-lag** af produktlandingssider under `/laan/` og de 45 sidetitler
   med klikmarkører (`»`, "Klik her", "Ansøg nu").
3. **Designsystemet i Webflow,** hvor guidens farve-, skrift- og formregler er
   oprettet, men ikke taget i brug.

## Nøgletal

| Måling | Resultat |
|---|---|
| Tekst i Coop Bordeaux (guidens primære skriftfarve) | **15 af 2.373 tekstelementer — 0,6 %** |
| Flader i Coop Pampas eller Satin Linen | **0** på tværs af 12 renderede sider |
| Hjørner med guidens 6 px radius | **0** af 1.088 målte radier |
| Farver i designsystemet | **39** — guiden definerer 7 |
| Sider med pris/bonus/"bedst i test" som H1 | **23 af 418 — 5,5 %** |
| H1'er der tiltaler kunden (du/dig/din) | **72 af 418 — 17 %** |
| Sider uden rådgiver/kontakt i eget indhold | **253 af 418 — 60,5 %** |
| Sidetitler med klik-/salgsmarkører | **45 af 418 — 10,8 %** |
| `<img>` med tom alt-tekst | **2.658 af 3.836** |
| Skrifttyper i brug | **3** — Porteron, Proxima Nova (formularer), systemstak i widgets |
| Verificerede tekststeder (bilag A) | **255** af 325 rå fund, på 195 sider |

## Fund

**Del A — tone of voice (13 fund)**

| # | Fund | Alvor |
|---|---|---|
| A1 | Boligområdets primærbudskab er præcis den sætning, oplægget beder os vende om | Kritisk |
| A2 | 23 sider har pris, bonus eller "bedst i test" som overskrift | Væsentlig |
| A3 | Sidetitlerne taler i en anden stemme end siderne selv | Væsentlig |
| A4 | 22 sider åbner med et produktnavn i stedet for en kundesituation | Væsentlig |
| A5 | Rådgiveren nævnes ikke på 253 af 418 sider | Væsentlig |
| A6 | De lovpligtige tekster er ikke oversat til menneskesprog | Væsentlig |
| A7 | Fagsproget står uoversat, og ordbogen er ikke linket fra produktsiderne | Mindre |
| A8 | Enkelte salgs- og hastemarkører bryder den rolige tone | Mindre |
| A9 | Formularerne — dér hvor kunden handler — er skrevet i rent systemsprog | Kritisk |
| A10 | Metabeskrivelserne er sitets mest ureviderede tekstflade | Væsentlig |
| A11 | 404-siden er en blindgyde uden en vej videre | Væsentlig |
| A12 | Sproglige inkonsistenser der står på alle 418 sider | Væsentlig |
| A13 | Teaser-moduler spreder samme tekst ud over fremmede sektioner | Mindre |

**Del B — designguide (15 fund)**

| # | Fund | Alvor |
|---|---|---|
| B1 | Guidens primære skriftfarve bruges på 0,6 % af teksten | Kritisk |
| B2 | Coop Pampas og Satin Linen bruges ikke som flade | Kritisk |
| B3 | Guidens 6 px-radius findes ikke i systemet | Væsentlig |
| B4 | Paletten er vokset fra 7 til 39 farver | Væsentlig |
| B5 | Coop Red bruges ikke som handlingsfarve — det gør den komplementære grøn | Væsentlig |
| B6 | Samme knap har to farver alt efter hvilken side man står på | Væsentlig |
| B7 | Sub-brand-logoet følger ikke logoarkitekturen | Væsentlig |
| B8 | Infokasse-princippet er ikke implementeret | Væsentlig |
| B9 | Hver side bærer ~17 KB fremmed CSS med farver uden for paletten | Væsentlig |
| B10 | Billedstilen holder — med to undtagelser og et alt-tekst-problem | Mindre |
| B11 | Ét af guidens fem skriftsnit er ikke uploadet | Mindre |
| B12 | Designsystemet har efterladenskaber, der stadig sendes i produktion | Mindre |
| B13 | Formularerne kører et helt selvstændigt designsystem med en tredje skrifttype | Kritisk |
| B14 | Coop Bordeaux bruges aldrig som flade — footeren kører på klonen | Væsentlig |
| B15 | Guidens fjerde tekstniveau, manchetten, findes ikke i systemet | Mindre |

**Bilag A** rummer alle **255 verificerede tekststeder** med URL, ordret citat, regelhenvisning
og et konkret omskrivningsforslag. De 325 rå fund fra den sidevise gennemgang er hvert især
kontrolleret af en uafhængig instans, der har slået citatet op i kildeteksten; 70 blev afvist
som overfortolkning eller uverificerbare.

Rapporten indeholder desuden et afsnit om **hvad der følger guiden** — de steder,
hvor arbejdet allerede er gjort, og som resten af sitet kan rettes ind efter — og en
kontrasttabel, der tester designguidens egen undtagelsesklausul for web.

## Mapper

```
rapport.html                  Rapporten. Selvstændig HTML-fil med indlejrede billeder.
coopbank-brandrevision.pptx   Præsentation, 16 slides med hovedfundene.
billeder/                     Sammenligninger side om side: guide vs. site.
data/                         Alle måledata, så hvert tal i rapporten kan slås efter.
```

### data/

| Fil | Indhold |
|---|---|
| `alle-418-urls.txt` | Sitemap-udtrækket der definerer omfanget |
| `h1-inventar-alle-sider.txt` | Alle 418 H1'er, klassificeret pr. sektion |
| `sidetitler-og-metadata.json` | Titel, description og Open Graph for alle sider |
| `maalte-stilarter-desktop.json` | Beregnede stilarter fra browseren, 12 sider |
| `maalte-stilarter-mobil.json` | Samme, 5 sider på 390 px |
| `webflow-css-variabler.json` | Alle 141 CSS-variabler fra produktions-CSS |
| `measured_tokens.md` | Tokentabeller med markering af hvad der findes i guiden |
| `quant_tone.txt` | Optællinger: pris-H1, rådgiverdækning, administrativt sprog |
| `quant_meta.txt` | Optællinger: sidetitler, klikmarkører, dubletter |
| `quant_sprog.txt` | Optællinger: tiltale, fagbegreber, udråbstegn |
| `tone-of-voice-fund-bekraeftede.json` | De 255 verificerede tekststeder |
| `tone-of-voice-fund-afviste.json` | De 70 afviste fund, med begrundelse |
| `design-fund-raa.json` | Designfundene fra de syv dimensionsgennemgange |
| `design_guide.md`, `tone_of_voice.md` | Kildematerialet, udtrukket og struktureret |

## Metode og forbehold

- **Tekstgennemgangen dækker alle 418 sider.** Optællinger af overskrifter, titler og
  ordforekomster er komplette.
- **Farve- og formmålingerne dækker 12 repræsentative sider** på desktop og 5 på mobil.
  Et tal som "0 forekomster af Pampas" gælder strengt taget de 12 sider.
- **Global navigation og footer** er filtreret fra den sidevise gennemgang for ikke at
  blive talt 418 gange, og vurderet separat.
- **Guidens eget forbehold** på s.23–25 om tilpasning af farvevalg og -kombinationer til
  digitale muligheder er lagt til grund og nævnt eksplicit i de fund, hvor det er relevant.
- **Mobil er kun målt på 5 sider.** Designfundene er reelt desktop-fund med fem mobile stikprøver.
- **Tabelindhold (`<td>`/`<th>`) er ikke i tekstkorpusset.** Prislister og rentetabeller er
  vurderet på design, men ikke læst som tekst.
- **Cookie-samtykkebanneret er ikke vurderet.** Det er den første tekst og designflade,
  enhver besøgende møder, og bør revideres som en selvstændig opgave.
- **Rapporten vurderer efterlevelse, ikke performance.** Om et prisbudskab konverterer
  bedre end et rådgivningsbudskab er ikke undersøgt.
