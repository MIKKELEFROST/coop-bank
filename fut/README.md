# EA FC Card Explorer

Demo-side hvor man kan bladre i og filtrere alle 20.689 spillerkort fra
EA SPORTS FC 27.
Ren statisk HTML — ingen backend, ingen API-nøgle, ingen build.

Åbn `fut/index.html` (virker også ved at dobbeltklikke filen lokalt).

## Hvor kommer data fra?

EA's offentlige ratings-endpoint:

```
https://drop-api.ea.com/rating/ea-sports-fc?limit=100&offset=0&locale=da
```

Hverken login eller nøgle kræves. Understøttede parametre: `limit` (maks. 100 —
større giver HTTP 400), `offset`, `locale`, `search` og `gender`.

### `drop-referrer` afgør årgangen

Det samme endpoint svarer med **to forskellige databaser** afhængigt af én header:

| Kald | Spillere | Årgang | #1 |
|---|---|---|---|
| uden header | 17.873 | FC 26 | Salah 91 |
| `drop-referrer: https://www.ea.com/games/ea-sports-fc/ratings` | 20.689 | **FC 27** | Mbappé 91 |

```bash
# FC 26 (standard)
curl -sS "https://drop-api.ea.com/rating/ea-sports-fc?limit=1&locale=en"

# FC 27
curl -sS -H "drop-referrer: https://www.ea.com/games/ea-sports-fc/ratings" \
  "https://drop-api.ea.com/rating/ea-sports-fc?limit=1&locale=en"
```

Værdien valideres: en vilkårlig streng i headeren giver FC 26-datasættet igen,
så den skal matche EA's ratings-side præcist. Der findes **ingen**
årgangsparameter — `game=`, `version=`, `year=` og `iteration=` ignoreres alle
(`/rating/ea-sports-fc/filters` viser `iterations: []`, så aksen er slået fra).

`fetch_ratings.py` sender headeren og kører en kontrol før hver hentning: den
henter én side med og én uden headeren og afbryder, hvis de er ens. Ellers ville
en ændring hos EA stille og roligt give et forældet datasæt.

Pr. spiller returnerer den navn, samlet rating, alle 40 delattributter, position
og alternativpositioner, klub, liga, nation, køn, tricks, svag fod, foretrukken
fod, fødselsdato samt URL'er til portræt og kortgrafik. Skemaet rummer også
PlayStyles, højde og vægt, men de er tomme i FC 27-droppet — se afsnittet
nedenfor.

Det er **basisspillerdatabasen — ikke live Ultimate Team-markedspriser.**
Priser ligger bag Cloudflare hos FUTBIN/FUT.GG, og EA's officielle FC Community
API er kun åben for tre godkendte partnersites (FUT.GG, FUTBIN, FUTWIZ).

### Sådan verificerer du årgangen

`campaignOverview.internalName` er **ikke** et pålideligt signal — det er et
marketing-banner og sagde "FC 27 Ratings | FUT" i månedsvis, mens `items`
stadig var FC 26. Tjek i stedet konkrete spillere, hvis rating ændrede sig:

| eaId | Spiller | FC 26 | FC 27 |
|---|---|---|---|
| 239085 | Erling Haaland | 90 | 91 |
| 277643 | Lamine Yamal | 89 | 90 |
| 203376 | Virgil van Dijk | 90 | 88 |
| 251854 | Pedri | 89 | 90 |

Uafhængigt facit pr. spiller og årgang:

```bash
curl -sS -H "user-agent: Mozilla/5.0" \
  "https://www.fut.gg/api/fut/player-item-definitions/27/239085/"
```

### Felter EA ikke har udfyldt i FC 27-droppet

- `playerAbilities` (PlayStyles) er **tom for alle 20.689** spillere. Det gælder
  også hos tredjeparter, så det er ikke et kildeproblem — EA har bare ikke
  udgivet dem endnu. `/rating/ea-sports-fc/filters` bekræfter det:
  `playerAbilities: []` og `playerStyles: []`. Siden skjuler PlayStyles-filteret
  og -panelet automatisk, når datasættet ikke har nogen, og viser dem igen af
  sig selv efter en refresh der har dem.
- `height` og `weight` er tomme strenge for alle. Modalen udelader dem.

### Billeder

Billed-URL'erne ligger under stien `/FC25/` — det er blot EA's CDN-mappe, som
de ikke har omdøbt; `FC24`, `FC26` og `FC27` giver alle 403. Stien serverer de
aktuelle portrætter. `avatarUrl` fra API'et matcher vores skabelon i 600 af 600
kontrollerede tilfælde, så URL'en udledes af spiller-id'et frem for at blive
gemt pr. spiller.

EA har kun renderet portrætter for en del af spillerne, og dækningen falder
kraftigt ned gennem rangeringen (12/12 i top 100, ca. 1/12 omkring rang 11.000).
Kort uden portræt falder tilbage til en silhuet.

## Hvorfor er data bundlet i stedet for hentet live?

EA sætter kun `access-control-allow-origin: https://www.ea.com`. Alle andre
origins får intet CORS-hoved, så browseren blokerer direkte kald:

```
$ curl -sS -D - -o /dev/null \
    "https://drop-api.ea.com/rating/ea-sports-fc?limit=1" \
    -H "Origin: https://example.com" | grep -i access-control
access-control-allow-credentials: true          # ingen allow-origin
```

Data hentes derfor server-side én gang og lægges i `data/players.js`, som sætter
`window.FUT_DATA`. Et almindeligt `<script>`-tag frem for `fetch()` betyder
også at siden virker direkte fra `file://`.

## Opdatér datasættet

```bash
./fut/tools/refresh.sh
```

Den henter alle sider fra EA (både `en` og `da`) og bygger `data/players.js`.
Kørslen tager under et minut. Rå API-sider caches i `tools/raw_en/` og
`tools/raw_da/` og er git-ignoreret — slet dem for at tvinge en frisk hentning.

Positioner og attributnavne tages fra `en` (GK, CB, ST … er det alle bruger),
mens nationer og PlayStyles (når de findes) tages fra `da`.

## Filstruktur

```
fut/
  index.html              hele appen — markup, CSS og JS i én fil
  data/players.js         genereret datasæt (~4,3 MB, ~1,47 MB gzippet)
  tools/fetch_ratings.py  henter rå sider fra drop-api
  tools/build_dataset.py  bygger det kompakte players.js
  tools/refresh.sh        kører begge dele
```

`players.js` er tupler frem for objekter for at holde filen lille.
Feltrækkefølgen er defineret i `build_dataset.py` og spejlet i konstanterne
øverst i scriptet i `index.html` — **ændrer du den ene, skal den anden følge med.**

## Funktioner

Fritekstsøgning (accent-ufølsom, så "mbappe" finder "Mbappé"), rating-interval,
position med eller uden alternativpositioner, spillerkategori, køn, liga, klub,
nation, foretrukken fod, tricks, svag fod, maksimal alder og minimumskrav på de
seks hovedattributter — plus PlayStyles, når datasættet indeholder dem (det gør
FC 27-droppet ikke, så filteret er skjult). Sortering på rating, hver hovedattribut,
tricks, svag fod, alder og navn. Filtre lægges i URL'ens hash, så en filtreret
visning kan deles. Målmandskort viser DIV/HAN/KIC/REF/SPE/POS i stedet for
PAC/SHO/PAS/DRI/DEF/PHY — EA lægger målmandsværdierne i de samme seks felter.

Kortene renderes i portioner på 60 via en IntersectionObserver, så alle 20.689
kan filtreres uden at lægge DOM'en ned.

## Forbehold

Uofficiel demo, ikke tilknyttet EA. Spillerbilleder og klublogoer hotlinkes fra
EA's eget CDN og tilhører EA Sports. `drop-referrer`-adfærden er udokumenteret
og kan forsvinde uden varsel — derfor kontrollen i `fetch_ratings.py`.
