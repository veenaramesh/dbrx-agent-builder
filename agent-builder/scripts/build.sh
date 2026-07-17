#!/usr/bin/env bash
# Build the React client for the Databricks App deployment.
#
# The Databricks Apps runtime is Python-only — it cannot run npm — so the
# client must be built ahead of `databricks apps deploy`. This produces
# agent-builder/client/dist, which server/app.py mounts at /.
#
# VITE_BASE=/ makes assets resolve from the App root (GitHub Pages uses a
# subpath instead; see client/vite.config.ts).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$SCRIPT_DIR/../client"

echo "==> Building client (base=/) for the Databricks App"
cd "$CLIENT_DIR"

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

VITE_BASE=/ npm run build

echo "==> Done. Built to: $CLIENT_DIR/dist"
