#!/usr/bin/env bash
# One-time Dev Mode registration.
# usage: scripts/connect.sh [passphrase]
# The passphrase is the 6-character code displayed by the Developer Mode app.
set -euo pipefail
. "$(dirname "$0")/env.sh"

PASS="${1:-${LG_PASSPHRASE:-}}"
if [ -z "$PASS" ]; then
  read -r -s -p "Dev Mode passphrase shown on the TV: " PASS
  echo
fi

echo "== TV reachability =="
ok_dev=0
ok_key=0
for p in 9922 9991; do
  if (echo > /dev/tcp/"$LG_TV_HOST"/"$p") >/dev/null 2>&1; then
    echo "  ok    port $p open"
    [ "$p" = "9922" ] && ok_dev=1
    [ "$p" = "9991" ] && ok_key=1
  else
    echo "  MISS  port $p closed"
  fi
done

if [ "$ok_dev" -ne 1 ] || [ "$ok_key" -ne 1 ]; then
  cat >&2 <<'EOF'

Developer Mode is not fully up.
  1. On the TV open the "Developer Mode" app.
  2. Sign in with your LG developer account.
  3. Turn "Dev Mode Status" ON and reboot if prompted.
  4. Re-open Developer Mode and press "Start Key Server" (keep this app open).
  5. Re-run: scripts/connect.sh <passphrase>
EOF
  exit 1
fi

mkdir -p "$HOME/.ssh"

echo "== registering device '$LG_DEVICE' =="
if "${ARES}-setup-device" -l 2>/dev/null | grep -qw "$LG_DEVICE"; then
  "${ARES}-setup-device" -m "$LG_DEVICE" -i \
    "{'host':'$LG_TV_HOST','port':'$LG_TV_PORT','username':'$LG_TV_USER','description':'LG QNED75SRA'}"
else
  "${ARES}-setup-device" -a "$LG_DEVICE" -i \
    "{'host':'$LG_TV_HOST','port':'$LG_TV_PORT','username':'$LG_TV_USER','description':'LG QNED75SRA','default':true}"
fi

echo "== fetching SSH key from the TV (port 9991) =="
if [ -n "$PASS" ]; then
  "${ARES}-novacom" -d "$LG_DEVICE" --getkey --passphrase "$PASS"
else
  "${ARES}-novacom" -d "$LG_DEVICE" --getkey
fi

echo "== verifying =="
"${ARES}-device" -d "$LG_DEVICE" -i
echo
"${ARES}-novacom" -d "$LG_DEVICE" --run "uname -a; echo; luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}'"

echo
echo "Connected. Next: scripts/backup.sh"
