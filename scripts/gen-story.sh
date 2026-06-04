#!/usr/bin/env bash
# Generate the landing brand-film shots (16:9) via Higgsfield Seedance, download to
# public/hero/story/. Resumable: skips any shot whose .mp4 already exists & is non-empty.
# See design_refs/LANDING-VIDEO-SCRIPT.md. Costs credits — run intentionally.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=public/hero/story
mkdir -p "$OUT"

# name|duration|prompt
SHOTS=(
"cryptic_charge|8|Cinematic 16:9, extreme close-up of a smartphone banking app at night, one transaction line subtly highlighted, cool blue screen glow on a person's face half in shadow, moody, shallow depth of field, warm-to-cool filmic grade, subtle grain. No readable text, no logos, no watermark."
"the_lunch|8|Cinematic 16:9, a warm sunlit business lunch at a modern restaurant, two professionals talking and laughing, one taps a credit card on a small tabletop card reader, plates and coffee, gentle bokeh, handheld, shallow depth of field, warm filmic grade, natural skin tones. No text, no logos, no watermark."
"april_scramble|8|Cinematic 16:9, a cluttered home-office desk, a pile of crumpled paper receipts spilled from a shoebox, a person's hands sorting through them looking frustrated and tired, flat overcast daylight, muted desaturated grade, shallow depth of field. No text, no logos, no watermark."
"the_turn|8|Cinematic 16:9, close on a person's hands holding a smartphone and typing a short casual text message, warm cafe light glowing in the blurred background, shallow depth of field, warm filmic grade, calm relieved mood. No readable text, no logos, no watermark."
"montage_coffee|4|Cinematic 16:9, a barista hands a takeaway coffee cup across a wooden counter to a customer, warm tones, soft steam rising, shallow depth of field, filmic grade. No text, no logos, no watermark."
"montage_gas|4|Cinematic 16:9, a hand returning a fuel nozzle to a gas pump at golden hour, a work pickup truck softly blurred behind, gentle lens flare, warm filmic grade. No text, no logos, no watermark."
"montage_lunch|4|Cinematic 16:9, two professionals finishing a warm sunlit lunch, one glances at their phone with a small satisfied smile, gentle bokeh, shallow depth of field, filmic grade. No text, no logos, no watermark."
"payoff|8|Cinematic 16:9, a person calmly closing a laptop at a tidy desk, exhaling with relief, then standing and walking toward a bright window with warm natural light, shallow depth of field, filmic grade, hopeful mood. No text, no logos, no watermark."
)

for entry in "${SHOTS[@]}"; do
  IFS='|' read -r name dur prompt <<< "$entry"
  dest="$OUT/$name.mp4"
  if [ -s "$dest" ]; then echo "SKIP $name (exists)"; continue; fi
  echo "GEN  $name (${dur}s) ..."
  json=$(higgsfield generate create seedance1_5 --prompt "$prompt" \
    --aspect_ratio 16:9 --duration "$dur" --resolution 720p \
    --wait --wait-timeout 20m --wait-interval 10s --json 2>&1)
  url=$(printf '%s' "$json" | jq -r '.[0].result_url // empty' 2>/dev/null)
  if [ -z "$url" ]; then echo "FAIL $name — no result_url"; printf '%s\n' "$json" | tail -3; continue; fi
  curl -sS -o "$dest" "$url" && echo "OK   $name -> $dest ($(du -h "$dest" | cut -f1))"
done
echo "STORY GENERATION DONE"
