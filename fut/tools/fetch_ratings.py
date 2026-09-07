#!/usr/bin/env python3
"""Henter hele EA SPORTS FC ratings-databasen fra EA's åbne drop-api.

Endpointet kræver hverken API-nøgle eller login, men EA sætter kun
`access-control-allow-origin: https://www.ea.com`, så en browser kan ikke kalde
det direkte. Derfor hentes data her (server-side) og bundles med siden.

    python3 fetch_ratings.py            # henter både en og da
    python3 fetch_ratings.py en         # kun én locale

Skriver rå API-sider til raw_<locale>/<offset>.json ved siden af scriptet.
Allerede hentede sider genbruges, så kørslen kan afbrydes og genoptages.
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


def get(url, tries=5):
    """GET med eksponentiel backoff — EA's edge svarer af og til 5xx."""
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "accept": "application/json",
                "user-agent": "Mozilla/5.0 (fut-card-explorer dataset builder)",
            })
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


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
    locales = sys.argv[1:] or ["en", "da"]
    for loc in locales:
        fetch_locale(loc)
    print("færdig")
