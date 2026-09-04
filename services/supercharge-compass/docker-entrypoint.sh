#!/bin/sh
set -eu

DATA_FILE="${DATA_FILE:-data/superchargers.json}"

mkdir -p "$(dirname "$DATA_FILE")"

if [ ! -s "$DATA_FILE" ]; then
  echo "[startup] No Supercharger dataset found. Fetching initial data..."
  node scripts/grab.js
fi

echo "[startup] Starting SuperchargeCompass..."
exec node src/server.js
