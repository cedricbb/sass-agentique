#!/bin/bash
# AC tests for docs/PIVOT.md
set -euo pipefail
FILE="docs/PIVOT.md"
PASS=0; FAIL=0

assert() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS: $name"; PASS=$((PASS+1))
  else
    echo "FAIL: $name"; FAIL=$((FAIL+1))
  fi
}

cd "$(git rev-parse --show-toplevel)"

assert "AC1-file-exists" test -f "$FILE"

assert "AC1-5-sections" bash -c '[ "$(grep -c "^## " "$0")" -eq 5 ]' "$FILE"

assert "AC2-D1-D5" bash -c '[ "$(grep -c "^| D[1-5]" "$0")" -ge 5 ]' "$FILE"

assert "AC2-OptionA" grep -q "Option A" "$FILE"

assert "AC3-R1-R7" bash -c '[ "$(grep -c "^| R[1-7]" "$0")" -eq 7 ]' "$FILE"

assert "AC4-pivot-document" grep -q "pivot-document.md" "$FILE"

assert "AC4-pre-pivot-v1" grep -q "pre-pivot-v1" "$FILE"

assert "AC5-line-count-min" bash -c '[ "$(wc -l < "$0")" -ge 50 ]' "$FILE"

assert "AC5-line-count-max" bash -c '[ "$(wc -l < "$0")" -le 100 ]' "$FILE"

echo "---"
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
