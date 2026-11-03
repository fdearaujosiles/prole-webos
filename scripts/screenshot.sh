#!/usr/bin/env bash
# Capture the TV screen to a local image over SSAP (works as `prisoner`).
# usage: scripts/screenshot.sh [output.jpg]
set -uo pipefail
. "$(dirname "$0")/env.sh"

OUT="${1:-$PROJECT_DIR/backup/shots/$(date +%Y%m%d-%H%M%S).jpg}"
mkdir -p "$(dirname "$OUT")"
exec "$NODE" "$PROJECT_DIR/scripts/ssap.js" screenshot "$OUT"
