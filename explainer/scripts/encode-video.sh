#!/usr/bin/env bash
# ==============================================================================
# encode-video.sh — assemble dist/frames/*.png into the final MP4.
#
#   1920x1080 · 16:9 · exactly 30 fps · H.264 · yuv420p · no letterboxing
#
# If a Danish voiceover exists in assets/audio/ it is muxed in; optional music
# and sound-design beds are mixed underneath it. With no audio at all the
# output is a silent visual preview, which is the documented fallback.
#
# Usage:
#   bash scripts/encode-video.sh
#   FRAMES_DIR=dist/preview-frames OUT=dist/preview.mp4 bash scripts/encode-video.sh
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

FRAMES_DIR="${FRAMES_DIR:-dist/frames}"
OUT="${OUT:-dist/coop-bank-ai-agenter-preview.mp4}"
FPS="${FPS:-30}"
CRF="${CRF:-16}"
PRESET="${PRESET:-slow}"

# ffmpeg comes from the npm package so the project has no system dependency.
FFMPEG="$(node -e "process.stdout.write(require('@ffmpeg-installer/ffmpeg').path)")"

COUNT=$(ls -1 "$FRAMES_DIR"/frame-*.png 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -eq 0 ]; then
  echo "error: no frames in $FRAMES_DIR — run 'npm run frames' first" >&2
  exit 1
fi
echo "[encode] $COUNT frames from $FRAMES_DIR at ${FPS} fps"

mkdir -p "$(dirname "$OUT")"

# ---- locate optional audio -------------------------------------------------
VO=""
for f in assets/audio/voiceover-da.wav assets/audio/voiceover-da.mp3; do
  [ -f "$f" ] && VO="$f" && break
done
MUSIC=""
for f in assets/audio/music.wav assets/audio/music.mp3; do
  [ -f "$f" ] && MUSIC="$f" && break
done
SFX=""
for f in assets/audio/sfx.wav assets/audio/sfx.mp3; do
  [ -f "$f" ] && SFX="$f" && break
done

VIDEO_ARGS=(
  -framerate "$FPS"
  -start_number 0
  -i "$FRAMES_DIR/frame-%05d.png"
)

VIDEO_FILTER="format=yuv420p"
COMMON_V=(
  -c:v libx264
  -preset "$PRESET"
  -crf "$CRF"
  -profile:v high
  -level 4.2
  -pix_fmt yuv420p
  -x264-params "keyint=60:min-keyint=30:scenecut=0:ref=4"
  -color_primaries bt709 -color_trc bt709 -colorspace bt709
  -movflags +faststart
  -r "$FPS"
  -vf "$VIDEO_FILTER"
)

if [ -n "$VO" ]; then
  echo "[encode] voiceover: $VO"
  AUDIO_INPUTS=(-i "$VO")
  IDX=1
  # Voiceover always sits on top; music and effects are ducked well beneath it.
  FILTER="[${IDX}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=1.0[vo]"
  MIX_IN="[vo]"
  N=1
  if [ -n "$MUSIC" ]; then
    IDX=$((IDX + 1)); AUDIO_INPUTS+=(-i "$MUSIC")
    FILTER="$FILTER;[${IDX}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.16[mu]"
    MIX_IN="$MIX_IN[mu]"; N=$((N + 1))
    echo "[encode] music: $MUSIC"
  fi
  if [ -n "$SFX" ]; then
    IDX=$((IDX + 1)); AUDIO_INPUTS+=(-i "$SFX")
    FILTER="$FILTER;[${IDX}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.34[fx]"
    MIX_IN="$MIX_IN[fx]"; N=$((N + 1))
    echo "[encode] sfx: $SFX"
  fi
  FILTER="$FILTER;${MIX_IN}amix=inputs=${N}:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]"

  "$FFMPEG" -y -hide_banner -loglevel warning -stats \
    "${VIDEO_ARGS[@]}" "${AUDIO_INPUTS[@]}" \
    -filter_complex "$FILTER" -map 0:v -map "[aout]" \
    "${COMMON_V[@]}" -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest \
    "$OUT"
else
  echo "[encode] no voiceover found — rendering a silent visual preview"
  "$FFMPEG" -y -hide_banner -loglevel warning -stats \
    "${VIDEO_ARGS[@]}" "${COMMON_V[@]}" -an "$OUT"
fi

echo ""
echo "[encode] wrote $OUT ($(du -h "$OUT" | cut -f1))"
echo ""
echo "[verify] ffprobe:"
"$FFMPEG" -hide_banner -i "$OUT" 2>&1 | grep -E "Duration|Stream" || true
