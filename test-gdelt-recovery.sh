#!/bin/bash
# Test GDELT rate-limit recovery: how long until requests work again after a 429/block
# Usage: bash test-gdelt-recovery.sh [query] [timespan]

set -e

QUERY="${1:-gold AND mining}"
TIMESPAN="${2:-7d}"
MAX_RECORDS=10
BASE="https://api.gdeltproject.org/api/v2/doc/doc"

ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$QUERY'''))")
URL="${BASE}?query=${ENCODED_QUERY}&mode=ArtList&maxrecords=${MAX_RECORDS}&timespan=${TIMESPAN}&format=json"

echo "=== GDELT Rate-Limit Recovery Test ==="
echo "Query:    $QUERY"
echo "Timespan: $TIMESPAN"
echo ""

run_request() {
  local label="$1"
  local start=$(date +%s%N)
  local tmpfile=$(mktemp)
  local http_code

  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" --connect-timeout 10 --max-time 30 "$URL" 2>/dev/null) || http_code="ERR"
  local end=$(date +%s%N)
  local elapsed_ms=$(( (end - start) / 1000000 ))

  local article_count="-"
  if [[ "$http_code" == "200" ]]; then
    article_count=$(python3 -c "
import json
try:
    d = json.load(open('$tmpfile'))
    print(len(d.get('articles', [])))
except:
    print(0)
" 2>/dev/null)
  fi

  printf "  %-18s  HTTP %-3s  %6d ms  %s articles\n" "$label" "$http_code" "$elapsed_ms" "$article_count"
  rm -f "$tmpfile"
  echo "$http_code"
}

echo "--- Phase 1: Burn through rate limit ---"
for i in 1 2 3; do
  result=$(run_request "Burn #$i" 2>/dev/null)
  # print the formatted line (it went to stderr via subshell, re-run inline)
  start=$(date +%s%N)
  tmpfile=$(mktemp)
  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" --connect-timeout 10 --max-time 30 "$URL" 2>/dev/null) || http_code="ERR"
  end=$(date +%s%N)
  elapsed_ms=$(( (end - start) / 1000000 ))
  article_count="-"
  if [[ "$http_code" == "200" ]]; then
    article_count=$(python3 -c "import json; d=json.load(open('$tmpfile')); print(len(d.get('articles',[])))" 2>/dev/null)
  fi
  printf "  Burn #%-2d  HTTP %-3s  %6d ms  %s articles\n" "$i" "$http_code" "$elapsed_ms" "$article_count"
  rm -f "$tmpfile"
done

echo ""
echo "--- Phase 2: Recovery probes every 30s (up to 5 min) ---"
echo "    Probing at 30s intervals until we get HTTP 200..."
echo ""

for wait in 30 60 90 120 150 180 210 240 270 300; do
  printf "  (waiting ${wait}s total from last burn...)\r"
  sleep 30

  start=$(date +%s%N)
  tmpfile=$(mktemp)
  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" --connect-timeout 10 --max-time 30 "$URL" 2>/dev/null) || http_code="ERR"
  end=$(date +%s%N)
  elapsed_ms=$(( (end - start) / 1000000 ))
  article_count="-"
  if [[ "$http_code" == "200" ]]; then
    article_count=$(python3 -c "import json; d=json.load(open('$tmpfile')); print(len(d.get('articles',[])))" 2>/dev/null)
  fi
  printf "  t+%-4ss  HTTP %-3s  %6d ms  %s articles\n" "$wait" "$http_code" "$elapsed_ms" "$article_count"
  rm -f "$tmpfile"

  if [[ "$http_code" == "200" ]]; then
    echo ""
    echo "  >>> RECOVERED at t+${wait}s"
    break
  fi
done

echo ""
echo "=== Done ==="
