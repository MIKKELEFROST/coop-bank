#!/usr/bin/env python3
"""Henter hele EA SPORTS FC ratings-databasen fra EA's åbne drop-api.

Endpointet kræver hverken API-nøgle eller login, men EA sætter kun
`access-control-allow-origin: https://www.ea.com`, så en browser kan ikke kalde
det direkte. Derfor hentes data her (server-side) og bundles med siden.

VIGTIGT — `drop-referrer`-headeren afgør hvilken årgang man får:

    uden headeren            -> 17.873 spillere, FC 26-ratings (Salah 91 som #1)
    med headeren             -> 20.689 spillere, FC 27-ratings (Mbappé 91 som #1)

Det er samme URL i begge tilfælde; kun headeren skiller. EA's egen ratings-side
(www.ea.com/games/ea-sports-fc/ratings) sætter den, og backenden serverer den
aktuelle årgang til de kald der oplyser den. En forkert værdi i headeren giver
det gamle FC 26-datasæt igen, så den skal matche præcist.

    python3 fetch_ratings.py            # henter både en og da
    python3 fetch_ratings.py en         # kun én locale

Skriver rå API-sider til raw_<locale>/<offset>.json ved siden af scriptet.
Allerede hentede sider genbruges, så kørslen kan afbrydes og genoptages —
slet raw_*-mapperne når du skifter årgang, ellers blandes gamle og nye sider.
"""
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://drop-api.ea.com/rating/ea-sports-fc"
LIMIT = 100  # API'et afviser limit > 100 med HTTP 400
WORKERS = 6
HERE = os.path.dirname(os.path.abspath(__file__))

# Uden denne header falder API'et tilbage til forrige års database. Se modulets
# docstring. Værdien skal være EA's ratings-side, ikke en vilkårlig URL.
RATINGS_REFERRER = "https://www.ea.com/games/ea-sports-fc/ratings"

HEADERS = {
    "accept": "application/json",
    "user-agent": "Mozilla/5.0 (fut-card-explorer dataset builder)",
    "drop-referrer": RATINGS_REFERRER,
}


def get(url, tries=5):
    """GET med eksponentiel backoff — EA's edge svarer af og til 5xx."""
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def assert_current_edition():
    """Fejl højlydt hvis drop-referrer holder op med at virke.

    Uden headeren serverer API'et forrige års database. De to svar skal derfor
    være forskellige — er de ens, har EA ændret adfærden, og alt hvad vi henter
    ville stille og roligt være forældet.
    """
    with_hdr = get(f"{BASE}?limit=1&locale=en&_cb=guard1")

    plain = urllib.request.Request(f"{BASE}?limit=1&locale=en&_cb=guard2", headers={
        "accept": "application/json",
        "user-agent": HEADERS["user-agent"],
    })
    with urllib.request.urlopen(plain, timeout=45) as resp:
        without_hdr = json.loads(resp.read().decode("utf-8"))

    a, b = with_hdr["totalItems"], without_hdr["totalItems"]
    if a == b:
        raise SystemExit(
            f"AFBRUDT: drop-referrer gør ingen forskel længere (begge svar har "
            f"{a} spillere).\nEA har sandsynligvis ændret API'et. Undersøg hvad "
            f"https://www.ea.com/games/ea-sports-fc/ratings kalder nu, før du "
            f"henter videre — ellers bygger du på forældede ratings."
        )
    print(f"kontrol: med header {a} spillere, uden {b} — headeren virker")
    return a


def fetch_locale(locale):
    out = os.path.join(HERE, f"raw_{locale}")
    os.makedirs(out, exist_ok=True)

    first = get(f"{BASE}?limit={LIMIT}&offset=0&locale={locale}")
    total = first["totalItems"]
    print(f"[{locale}] totalItems = {total}")
    with open(os.path.join(out, "0.json"), "w") as f:
        json.dump(first, f)

    def page(offset):
        path = os.path.join(out, f"{offset}.json")
        if os.path.exists(path) and os.path.getsize(path) > 100:
            return offset, "cached"
        data = get(f"{BASE}?limit={LIMIT}&offset={offset}&locale={locale}")
        with open(path, "w") as f:
            json.dump(data, f)
        return offset, len(data.get("items", []))

    offsets = list(range(LIMIT, total + LIMIT, LIMIT))
    done = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for offset, n in pool.map(page, offsets):
            done += 1
            if done % 40 == 0 or done == len(offsets):
                print(f"[{locale}]   {done}/{len(offsets)} sider", flush=True)
    return total


if __name__ == "__main__":
    assert_current_edition()
    locales = sys.argv[1:] or ["en", "da"]
    for loc in locales:
        fetch_locale(loc)
    print("færdig")
