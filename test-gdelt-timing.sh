#!/bin/bash
# Test GDELT API response timing: first request + rapid follow-ups
# Usage: bash test-gdelt-timing.sh [query] [timespan]

set -e

QUERY="${1:-gold AND (mining OR mine OR production OR exploration OR mineral OR ore)}"
TIMESPAN="${2:-7d}"
MAX_RECORDS=75
BASE="https://api.gdeltproject.org/api/v2/doc/doc"

ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$QUERY'''))")
URL="${BASE}?query=${ENCODED_QUERY}&mode=ArtList&maxrecords=${MAX_RECORDS}&timespan=${TIMESPAN}&format=json"

echo "=== GDELT API Timing Test ==="
echo "Query:    $QUERY"
echo "Timespan: $TIMESPAN"
echo "URL:      ${URL:0:120}..."
echo ""

run_request() {
  local label="$1"
  local start=$(date +%s%N)
  local http_code
  local body
  local tmpfile=$(mktemp)

  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" --max-time 30 "$URL" 2>/dev/null) || true
  local end=$(date +%s%N)
  local elapsed_ms=$(( (end - start) / 1000000 ))

  local article_count=0
  if [[ "$http_code" == "200" ]]; then
    article_count=$(python3 -c "
import json, sys
try:
    d = json.load(open('$tmpfile'))
    print(len(d.get('articles', [])))
except:
    print(0)
" 2>/dev/null)
  fi

  printf "%-12s  HTTP %-3s  %5d ms  %3s articles\n" "$label" "$http_code" "$elapsed_ms" "$article_count"
  rm -f "$tmpfile"
}

echo "--- Initial request ---"
run_request "Request #1"

echo ""
echo "--- Follow-up requests at intervals ---"

for delay in 0 1 2 3 5 8 10 15 20 30; do
  if [[ $delay -gt 0 ]]; then
    printf "  (waiting ${delay}s...)\n"
    sleep "$delay"
  fi
  run_request "+${delay}s"
done

echo ""
echo "=== Done ==="
