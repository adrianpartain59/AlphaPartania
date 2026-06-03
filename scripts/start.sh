#!/usr/bin/env bash
#
# One-shot local dev launcher.
#
# Always lands you on a clean server, no matter what was running before:
#   1. Kills any lingering Vite dev servers.
#   2. Frees the target port.
#   3. Installs dependencies if they're missing or out of date.
#   4. Starts a fresh dev server on a fixed port.
#
# Usage:
#   npm start            # http://localhost:5173
#   PORT=3000 npm start  # custom port

set -euo pipefail

# Resolve the project root regardless of where the script is called from.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-5173}"

echo "▸ Cleaning up any running dev servers…"
# Kill stray Vite processes (ignore if none are running).
pkill -f "node.*vite" 2>/dev/null || true
# Free the target port specifically, in case something else grabbed it.
if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:"$PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
fi
# Give the OS a moment to release the sockets.
sleep 1

echo "▸ Checking dependencies…"
# Install if node_modules is missing or the lockfile is newer than it.
if [ ! -d node_modules ] || { [ -f package-lock.json ] && [ package-lock.json -nt node_modules ]; }; then
  echo "  Installing…"
  npm install
else
  echo "  Up to date."
fi

echo "▸ Starting dev server on http://localhost:${PORT} (opening browser) …"
exec npx vite --port "$PORT" --strictPort --open
