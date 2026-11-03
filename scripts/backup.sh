#!/usr/bin/env bash
# Full reversible baseline: settings store, installed apps, device info, screenshots.
# Reads run as `prisoner` over the Dev Mode shell; live queries use SSAP.
# usage: scripts/backup.sh
set -uo pipefail
. "$(dirname "$0")/env.sh"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$PROJECT_DIR/backup/$TS"
mkdir -p "$OUT/raw" "$OUT/screens"
printf '%s\n' "$OUT" > "$PROJECT_DIR/backup/latest.txt"

ssap() { node "$PROJECT_DIR/scripts/ssap.js" "$@"; }

echo "== settings store (/var/luna/preferences) =="
if python "$PROJECT_DIR/scripts/tv_prefs.py" --device "$LG_DEVICE" --out "$OUT/raw/prefs"; then
  echo "  ok    raw/prefs (+ settings.json)"
else
  echo "  FAIL  could not read the settings store" >&2
fi

echo "== SSAP snapshots =="
ssap apps --json > "$OUT/raw/apps-ssap.json" 2>"$OUT/raw/apps-ssap.err" \
  && echo "  ok    apps-ssap.json" || echo "  miss  apps-ssap.json"
ssap foreground > "$OUT/raw/foreground.json" 2>/dev/null \
  && echo "  ok    foreground.json" || echo "  miss  foreground.json"
ssap request ssap://com.webos.applicationManager/listLaunchPoints '{}' \
  > "$OUT/raw/launchpoints.json" 2>/dev/null \
  && echo "  ok    launchpoints.json" || echo "  miss  launchpoints.json"

echo "== CLI snapshots =="
"${ARES}-device" -d "$LG_DEVICE" -i > "$OUT/device-info.txt" 2>&1 || true
# SSAP does not expose ssap://com.webos.service.tv.systemproperty on this
# firmware (404), so model/firmware are recorded from ares-device instead.
python - "$OUT/device-info.txt" "$OUT/raw/systeminfo.json" <<'PY'
import json, re, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
fields = dict(re.findall(r"^(\w+)\s*:\s*(.+)$", text, re.M))
json.dump({"source": "ares-device -i", **fields},
          open(sys.argv[2], "w", encoding="utf-8"), indent=2)
PY
"${ARES}-install" -d "$LG_DEVICE" -l -F > "$OUT/apps-full.txt" 2>&1 || true

echo "== baseline screenshot =="
ssap launch com.webos.app.home >/dev/null 2>&1 || true
sleep 3
if ssap screenshot "$OUT/screens/00-home.jpg" >/dev/null 2>&1; then
  echo "  ok    screens/00-home.jpg"
else
  echo "  miss  screenshot unavailable"
fi

{
  echo "LG webOS TV backup"
  echo "created: $(date -Iseconds)"
  echo "device:  $LG_DEVICE"
  echo
  echo "raw/prefs/        settings store files read from /var/luna/preferences"
  echo "raw/prefs/settings.json  parsed copy of every category"
  echo "raw/apps-ssap.json       every installed app + launch point as the TV reports them"
  echo "raw/systeminfo.json      model / firmware / board (from ares-device)"
  echo "device-info.txt          raw ares-device output"
  echo "apps-full.txt            apps installed by the user over Developer Mode"
  echo "screens/00-home.jpg      what the TV looked like before any change"
  echo
  echo "Restore: scripts/restore.sh $OUT"
} > "$OUT/README.txt"

echo
echo "Backup written to: $OUT"
find "$OUT" -maxdepth 2 -type f -printf '  %P\n' 2>/dev/null | sort
