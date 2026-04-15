#!/usr/bin/env bash
# Inventar — local build helper for Linux and macOS.
#
# Produces frontend/dist/ so the Dockerfile's `COPY frontend/dist/` step
# has something to copy. Run this BEFORE `docker build .` and before
# installing the add-on onto HAOS.
#
# Usage:
#   ./scripts/build.sh            # build frontend only
#   ./scripts/build.sh --clean    # wipe frontend/node_modules first
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/frontend"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "error: frontend/ directory not found at ${FRONTEND_DIR}" >&2
  exit 1
fi

if [[ "${1:-}" == "--clean" ]]; then
  echo "==> cleaning frontend/node_modules"
  rm -rf "${FRONTEND_DIR}/node_modules"
fi

echo "==> installing frontend dependencies"
cd "${FRONTEND_DIR}"
npm install --no-audit --no-fund

echo "==> building frontend"
npm run build

if [[ ! -f "${FRONTEND_DIR}/dist/index.html" ]]; then
  echo "error: frontend/dist/index.html was not produced — check vite build output" >&2
  exit 2
fi

echo "==> build complete: ${FRONTEND_DIR}/dist"
echo "    You can now run: docker build -t inventar-addon ."
