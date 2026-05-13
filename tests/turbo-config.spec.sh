#!/usr/bin/env bash
set -euo pipefail

TURBO_JSON="$(dirname "$0")/../turbo.json"

echo "TAP version 13"
echo "1..3"

# AC-1: turbo.json is valid JSON
if python3 -m json.tool "$TURBO_JSON" > /dev/null 2>&1; then
  echo "ok 1 - turbo.json is valid JSON"
else
  echo "not ok 1 - turbo.json is valid JSON"
fi

# AC-2: test pipeline has no outputs key
if python3 -c "import json; d=json.load(open('$TURBO_JSON')); assert 'outputs' not in d['tasks']['test']" 2>/dev/null; then
  echo "ok 2 - test pipeline has no outputs key"
else
  echo "not ok 2 - test pipeline has no outputs key"
fi

# AC-2b: build pipeline still has outputs
if python3 -c "import json; d=json.load(open('$TURBO_JSON')); assert 'outputs' in d['tasks']['build']" 2>/dev/null; then
  echo "ok 3 - build pipeline still has outputs"
else
  echo "not ok 3 - build pipeline still has outputs"
fi
