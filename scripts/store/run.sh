#!/usr/bin/env bash
# Regenerates every store screenshot, the Play feature graphic and icon from the real app.
# Run after content or design changes, and after clinical review so badges read "Reviewed by".
set -euo pipefail
cd "$(dirname "$0")/../.."
npx vitest run --config scripts/store/vitest.config.mjs
VITE_PREVIEW_PASS=true npx vite build --outDir store/.work/dist
npx vite preview --outDir store/.work/dist --port 4600 --strictPort >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 2
ONDESSA_URL=http://localhost:4600 node scripts/store/capture.cjs
node scripts/store/compose.cjs
echo "Store assets written to store/ios and store/android"
