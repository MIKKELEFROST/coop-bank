# EA FC Card Explorer

Demo-side hvor man kan bladre i og filtrere alle spillerkort fra EA SPORTS FC.
Ren statisk HTML — ingen backend, ingen API-nøgle, ingen build.

Åbn `fut/index.html` (virker også ved at dobbeltklikke filen lokalt).

## Hvor kommer data fra?

EA's offentlige ratings-endpoint:

```
https://drop-api.ea.com/rating/ea-sports-fc?limit=100&offset=0&locale=da
```

Hverken login eller nøgle kræves. Understøttede parametre: `limit` (maks. 100 —
større giver HTTP 400), `offset`, `locale`, `search` og `gender`.

Pr. spiller returnerer den navn, samlet rating, alle 40 delattributter,
PlayStyles og PlayStyle+ med ikoner og beskrivelser, position og
alternativpositioner, klub, liga, nation, tricks, svag fod, fod, højde, vægt,
fødselsdato samt URL'er til portræt og kortgrafik.

Det er **basisspillerdatabasen — ikke live Ultimate Team-markedspriser.**
Priser ligger bag Cloudflare hos FUTBIN/FUT.GG, og EA's officielle FC Community
API er kun åben for tre godkendte partnersites (FUT.GG, FUTBIN, FUTWIZ).

### Hvilken udgave?

Endpointet serverer det ratings-drop der er aktuelt lige nu — pt. **FC 27**
(`campaignOverview.internalName` = "FC 27 Ratings | FUT"). Man kan ikke bede om
en bestemt årgang: `game=`, `version=` og lignende parametre ignoreres.

Bemærk at billed-URL'erne stadig ligger under stien `/FC25/`. Det er blot EA's
CDN-mappe, som de ikke har omdøbt — `FC26` og `FC27` giver begge 403. Stien
serverer de aktuelle portrætter.

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
mens nationer og PlayStyles tages fra `da`.

## Filstruktur

```
fut/
  index.html              hele appen — markup, CSS og JS i én fil
  data/players.js         genereret datasæt (~3,8 MB, ~1,35 MB gzippet)
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
nation, foretrukken fod, tricks, svag fod, maksimal alder, minimumskrav på de
seks hovedattributter og PlayStyles. Sortering på rating, hver hovedattribut,
tricks, svag fod, alder og navn. Filtre lægges i URL'ens hash, så en filtreret
visning kan deles. Målmandskort viser DIV/HAN/KIC/REF/SPE/POS i stedet for
PAC/SHO/PAS/DRI/DEF/PHY — EA lægger målmandsværdierne i de samme seks felter.

Kortene renderes i portioner på 60 via en IntersectionObserver, så alle 17.873
kan filtreres uden at lægge DOM'en ned.

## Forbehold

Uofficiel demo, ikke tilknyttet EA. Spillerbilleder, klublogoer og
PlayStyle-ikoner hotlinkes fra EA's eget CDN og tilhører EA Sports.
