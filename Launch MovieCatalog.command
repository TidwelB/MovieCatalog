#!/bin/bash
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Prefer the friendly macOS app launcher when it is present.
if [ -d "$SCRIPT_DIR/MovieCatalog.app" ]; then
  open "$SCRIPT_DIR/MovieCatalog.app"
  exit 0
fi

# Fallback for copies that do not include the .app bundle.
if [ -x "$SCRIPT_DIR/Update MovieCatalog.command" ]; then
  exec "$SCRIPT_DIR/Update MovieCatalog.command"
fi

open "$SCRIPT_DIR/index.html"
