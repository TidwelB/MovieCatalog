#!/bin/bash
cd "$(dirname "$0")"
PORT=8765
if command -v python3 >/dev/null 2>&1; then
  open "http://localhost:$PORT"
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  open "http://localhost:$PORT"
  python -m http.server "$PORT"
else
  echo "Python was not found. Opening index.html directly instead."
  open "index.html"
fi
