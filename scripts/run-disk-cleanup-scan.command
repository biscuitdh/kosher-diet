#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"

cd "$PROJECT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 was not found."
  echo "Install Apple's Command Line Tools, then run this again:"
  echo "  xcode-select --install"
  echo
  echo "Press Return to close this window."
  read
  exit 1
fi

echo "Running a read-only disk cleanup scan."
echo "Default folders: Downloads, Desktop, Documents, Movies, Music, Pictures"
echo "Old-file rule: not accessed in 30+ days and at least 100 MB"
echo

python3 "$SCRIPT_DIR/mac_disk_cleanup_scan.py" \
  --days 30 \
  --min-size 100M \
  --top 200 \
  --old-limit 500 \
  --dir-limit 200 \
  --open

echo
echo "Done. Nothing was deleted."
echo "Review the HTML report before moving anything to Trash."
echo "Press Return to close this window."
read
