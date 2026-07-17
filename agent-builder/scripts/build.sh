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

# Guard: the App serves assets from the root. If index.html references a
# subpath (e.g. a stray `npm run build` baked in the GitHub Pages base), the
# App would fetch assets that 404 -> SPA fallback returns HTML -> white page.
if grep -qE 'src="/[^"/][^"]*/assets/' "$CLIENT_DIR/dist/index.html"; then
  echo "ERROR: dist/index.html assets are under a subpath, not /assets — wrong base." >&2
  echo "       Always build via this script (VITE_BASE=/), not bare 'npm run build'." >&2
  grep -oE 'src="[^"]+\.js"' "$CLIENT_DIR/dist/index.html" >&2
  exit 1
fi

echo "==> Done. Built to: $CLIENT_DIR/dist"
