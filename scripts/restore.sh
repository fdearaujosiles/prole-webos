#!/usr/bin/env bash
# Restore the TV to its pre-debloat state.
# usage: scripts/restore.sh [backup-dir] [--dry-run] [--remove-app] [--full]
set -euo pipefail
. "$(dirname "$0")/env.sh"

BACKUP=""
if [ "${1:-}" ] && [[ "${1:-}" != --* ]]; then
  BACKUP="$1"
  shift
fi

if [ -z "$BACKUP" ]; then
  if [ ! -f "$PROJECT_DIR/backup/latest.txt" ]; then
    echo "No backup/latest.txt. Pass a backup directory." >&2
    exit 1
  fi
  BACKUP="$(cat "$PROJECT_DIR/backup/latest.txt")"
fi

python "$PROJECT_DIR/scripts/restore.py" \
  --backup "$BACKUP" \
  --device "$LG_DEVICE" \
  "$@"
