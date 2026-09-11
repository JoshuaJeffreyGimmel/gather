#!/bin/sh
# Boots the API on a throwaway database, runs the smoke test against it and
# shuts it down again. Usage: sh scripts/smoke-run.sh   (from backend/)
set -e
DIR=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
PORT=${PORT:-4123}
trap 'kill $PID 2>/dev/null; rm -rf "$TMP"' EXIT

DB_PATH="$TMP/smoke.db" PORT="$PORT" node "$DIR/src/index.js" > "$TMP/api.log" 2>&1 &
PID=$!

i=0
while [ $i -lt 60 ]; do
  if curl -sf "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then break; fi
  i=$((i + 1))
  # portable 100ms wait without relying on `sleep 0.1`
  curl -s --max-time 0.2 "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1 || true
done

if ! curl -sf "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then
  echo "API did not come up:"; cat "$TMP/api.log"; exit 1
fi

node "$DIR/scripts/smoke.mjs" "http://127.0.0.1:$PORT"
