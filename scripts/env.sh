#!/usr/bin/env bash
# Shared configuration. Source this from other scripts.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PROJECT_DIR
export ARES="$PROJECT_DIR/node_modules/.bin/ares"
export NODE="${NODE:-node}"
export LG_DEVICE="${LG_DEVICE:-tv}"
export LG_TV_HOST="${LG_TV_HOST:-192.168.1.50}"
export LG_TV_PORT="${LG_TV_PORT:-9922}"
export LG_TV_USER="${LG_TV_USER:-prisoner}"
