#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .e2e

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose -f infra/docker-compose.yml up -d --build
  docker compose -f infra/docker-compose.yml --profile e2e run --rm e2e
  docker compose -f infra/docker-compose.yml logs --no-color > .e2e/compose.log
  sh scripts/log-scan.sh .e2e/compose.log .e2e/word
  echo "[x] log scan: no pseudonyms, xprv, seed words, nsec, or PSBT base64 in any container log"
else
  echo "NOTE: docker compose is not installed. The checklist runs against host bitcoind. Compose was not started."
  exec pnpm exec tsx scripts/e2e-host.ts
fi
