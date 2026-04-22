#!/bin/bash
# RonCare Daily — cron runner
# Called by launchd/cron each morning at 7am.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/roncare-daily.log"

cd "$SCRIPT_DIR"

# Load .env variables
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.env"
  set +a
fi

echo "──────────────────────────────────" >> "$LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') Starting generation..." >> "$LOG_FILE"

node generate.js >> "$LOG_FILE" 2>&1

echo "$(date '+%Y-%m-%d %H:%M:%S') Done." >> "$LOG_FILE"
