#!/usr/bin/env bash
# Build, install, launch and screenshot ProleWebOS.
set -euo pipefail
. "$(dirname "$0")/env.sh"

cd "$PROJECT_DIR"
mkdir -p packages

echo "== packaging =="
"${ARES}-package" app -o packages

IPK="$(ls -t packages/com.fdear.prolewebos_*.ipk | head -n 1)"
echo "== installing $IPK =="
if ! "${ARES}-install" -d "$LG_DEVICE" "$IPK"; then
  echo "direct install failed; retrying after removing the old version"
  "${ARES}-install" -d "$LG_DEVICE" -r com.fdear.prolewebos || true
  "${ARES}-install" -d "$LG_DEVICE" "$IPK"
fi

echo "== launching =="
"${ARES}-launch" -d "$LG_DEVICE" -c com.fdear.prolewebos >/dev/null 2>&1 || true
"${ARES}-launch" -d "$LG_DEVICE" com.fdear.prolewebos

sleep 4
mkdir -p "$PROJECT_DIR/backup/shots"
SHOT="$PROJECT_DIR/backup/shots/prolewebos-$(date +%Y%m%d-%H%M%S).jpg"
if "$PROJECT_DIR/scripts/screenshot.sh" "$SHOT"; then
  echo "screenshot: $SHOT"
else
  echo "warning: screenshot unavailable" >&2
fi
