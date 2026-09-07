#!/usr/bin/env bash
# Opdaterer datasættet bag EA FC Card Explorer.
#
#   ./fut/tools/refresh.sh
#
# 1) henter alle sider fra EA's drop-api (en + da)
# 2) bygger det kompakte fut/data/players.js
#
# De rå API-sider lander i fut/tools/raw_en og raw_da og er git-ignoreret.
# Slet dem hvis du vil tvinge en helt frisk hentning.
set -euo pipefail

cd "$(dirname "$0")"

python3 fetch_ratings.py en da
python3 build_dataset.py ../data/players.js

echo
echo "Færdig. Tjek diffen i fut/data/players.js før du committer."
