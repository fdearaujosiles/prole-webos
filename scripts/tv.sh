#!/usr/bin/env bash
# Run one shell command on the TV over the Dev Mode SSH session.
# usage: scripts/tv.sh 'luna-send -n 1 -f luna://com.webos.applicationManager/listApps '"'"'{}'"'"''
set -euo pipefail
. "$(dirname "$0")/env.sh"

if [ "$#" -eq 0 ]; then
  echo "usage: tv.sh '<remote command>'" >&2
  exit 2
fi

"${ARES}-novacom" -d "$LG_DEVICE" --run "$*"
