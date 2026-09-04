#!/usr/bin/env bash
# ==============================================================================
# mix-audio.sh — lay voiceover, music and sound design onto the rendered film.
#
# This does NOT re-render or re-encode the picture: it copies the existing video
# stream and only builds the audio. A pass takes a couple of seconds, so the mix
# can be iterated freely without touching the 2250 frames.
#
# Inputs (all optional, all under assets/audio/):
#   voiceover-da.wav | .mp3     the Danish narration
#   music.wav | .mp3            one continuous bed
#   sfx.wav | .mp3              a pre-assembled effects stem
#
# Signal chain:
#   voice  → high-pass 80 Hz → gentle levelling → the mix's anchor
#   music  → trimmed to length → ducked by the voice (sidechain) → -18 dB
#   sfx    → -9 dB, not ducked (transients should cut through)
#   bus    → loudness-normalised to -16 LUFS, true peak -1.5 dBTP
#
# The music is ducked by SIDECHAIN rather than by a fixed envelope, so it
# follows whatever the recording actually does — a take that runs a few tenths
# long still ducks correctly.
#
# Usage:
#   bash scripts/mix-audio.sh
#   VIDEO=dist/other.mp4 OUT=dist/other-mixed.mp4 bash scripts/mix-audio.sh
#   MUSIC_DB=-22 bash scripts/mix-audio.sh      # quieter bed
#   DUCK_RATIO=10 bash scripts/mix-audio.sh     # music gets further out of the way
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

VIDEO="${VIDEO:-dist/coop-bank-ai-agenter-preview.mp4}"
OUT="${OUT:-dist/coop-bank-ai-agenter.mp4}"
DURATION="${DURATION:-75}"

# Levels in dB relative to the voice. Music sits far enough under the narration
# that it never competes; effects sit between the two.
MUSIC_DB="${MUSIC_DB:--18}"
SFX_DB="${SFX_DB:--9}"
# Loudness target. -16 LUFS suits a laptop or meeting-room projector; use -14
# for a room with a proper PA.
LUFS="${LUFS:--16}"
# How hard the music gets out of the way under speech. The mechanism is proven;
# the depth should be set against the real recording, because synthetic test
# tones do not predict how real speech drives a compressor. Ratio 6 gave a 5 dB
# duck on the bench — raise DUCK_RATIO toward 10 for more separation.
DUCK_RATIO="${DUCK_RATIO:-6}"
DUCK_THRESHOLD="${DUCK_THRESHOLD:-0.02}"

FFMPEG="$(node -e "process.stdout.write(require('@ffmpeg-installer/ffmpeg').path)")"

if [ ! -f "$VIDEO" ]; then
  echo "error: $VIDEO not found — run 'npm run render' first" >&2
  exit 1
fi

pick() { for f in "$@"; do [ -f "$f" ] && { echo "$f"; return; }; done; echo ""; }
VO="$(pick assets/audio/voiceover-da.wav assets/audio/voiceover-da.mp3)"
MUSIC="$(pick assets/audio/music.wav assets/audio/music.mp3)"
SFX="$(pick assets/audio/sfx.wav assets/audio/sfx.mp3)"

if [ -z "$VO" ] && [ -z "$MUSIC" ] && [ -z "$SFX" ]; then
  cat >&2 <<'MSG'
error: no audio found in assets/audio/

Expected any of:
  assets/audio/voiceover-da.wav   (or .mp3)  — the Danish narration
  assets/audio/music.wav          (or .mp3)  — one continuous bed
  assets/audio/sfx.wav            (or .mp3)  — an effects stem

The recording script is in dist/voiceover-manus.txt and the cue times are in
dist/voiceover-timing.json.
MSG
  exit 1
fi

echo "[mix] video   $VIDEO (stream copied, not re-encoded)"
[ -n "$VO" ]    && echo "[mix] voice   $VO"
[ -n "$MUSIC" ] && echo "[mix] music   $MUSIC  (${MUSIC_DB} dB, ducked by the voice)"
[ -n "$SFX" ]   && echo "[mix] effects $SFX  (${SFX_DB} dB)"

INPUTS=(-i "$VIDEO")
FILTER=""
IDX=0
STEMS=""
N=0

# ---- voice -------------------------------------------------------------------
# The anchor of the mix. High-pass removes handling rumble; the compressor is
# gentle — enough to hold a steady level, not enough to sound processed.
if [ -n "$VO" ]; then
  IDX=$((IDX + 1)); INPUTS+=(-i "$VO")
  FILTER="${FILTER}[${IDX}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
  FILTER="${FILTER}highpass=f=80,acompressor=threshold=0.08:ratio=3:attack=15:release=250:makeup=1.6,"
  FILTER="${FILTER}apad,atrim=0:${DURATION},asetpts=N/SR/TB[vo];"
  # A second copy drives the sidechain that ducks the music.
  # The key branch is re-formatted explicitly: a mono recording would otherwise
  # reach sidechaincompress without a channel layout.
  FILTER="${FILTER}[vo]asplit=2[vo_out][vo_key_raw];"
  FILTER="${FILTER}[vo_key_raw]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[vo_key];"
  STEMS="${STEMS}[vo_out]"; N=$((N + 1))
fi

# ---- music -------------------------------------------------------------------
if [ -n "$MUSIC" ]; then
  IDX=$((IDX + 1)); INPUTS+=(-i "$MUSIC")
  FILTER="${FILTER}[${IDX}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
  FILTER="${FILTER}atrim=0:${DURATION},asetpts=N/SR/TB,"
  # In and out of the film, not into and out of the narration.
  FILTER="${FILTER}afade=t=in:st=0:d=1.2,afade=t=out:st=$(echo "$DURATION - 2.5" | bc):d=2.5,"
  FILTER="${FILTER}volume=${MUSIC_DB}dB[mu_raw];"
  if [ -n "$VO" ]; then
    # Duck under speech. release=400 ms lets the bed come back up in the gaps
    # between lines without pumping.
    FILTER="${FILTER}[mu_raw][vo_key]sidechaincompress=threshold=${DUCK_THRESHOLD}:ratio=${DUCK_RATIO}:attack=25:release=400:makeup=1[mu];"
  else
    FILTER="${FILTER}[mu_raw]anull[mu];"
  fi
  STEMS="${STEMS}[mu]"; N=$((N + 1))
fi

# ---- sound design ------------------------------------------------------------
# Not ducked: whooshes and clicks are short and should read through the voice.
if [ -n "$SFX" ]; then
  IDX=$((IDX + 1)); INPUTS+=(-i "$SFX")
  FILTER="${FILTER}[${IDX}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
  FILTER="${FILTER}atrim=0:${DURATION},asetpts=N/SR/TB,volume=${SFX_DB}dB[fx];"
  STEMS="${STEMS}[fx]"; N=$((N + 1))
fi

# ---- bus ---------------------------------------------------------------------
if [ "$N" -gt 1 ]; then
  # amix scales every input by 1/N, so the balance set above is preserved and
  # loudnorm brings the bus back up to target. (The `normalize` option is not
  # available in the bundled ffmpeg build, hence relying on that instead.)
  FILTER="${FILTER}${STEMS}amix=inputs=${N}:duration=first:dropout_transition=0[bus];"
else
  FILTER="${FILTER}${STEMS}anull[bus];"
fi
FILTER="${FILTER}[bus]loudnorm=I=${LUFS}:TP=-1.5:LRA=11,alimiter=limit=0.94[aout]"

mkdir -p "$(dirname "$OUT")"
"$FFMPEG" -y -hide_banner -loglevel warning -stats \
  "${INPUTS[@]}" \
  -filter_complex "$FILTER" \
  -map 0:v -map "[aout]" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart -t "$DURATION" \
  "$OUT"

echo ""
echo "[mix] wrote $OUT ($(du -h "$OUT" | cut -f1))"
"$FFMPEG" -hide_banner -i "$OUT" 2>&1 | grep -E "Duration|Stream" || true
