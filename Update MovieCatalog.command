#!/bin/bash
set -u

REPO_OWNER="TIDWELB"
REPO_NAME="MovieCatalog"
BRANCH="main"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ARCHIVE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.zip"
TEMP_ROOT="$(mktemp -d -t MovieCatalogUpdate.XXXXXX)"
ZIP_PATH="$TEMP_ROOT/MovieCatalog.zip"
EXTRACT_DIR="$TEMP_ROOT/extract"
BACKUP_ROOT="$SCRIPT_DIR/.moviecatalog-update-backups"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"

cleanup() {
  rm -rf "$TEMP_ROOT" >/dev/null 2>&1 || true
}
trap cleanup EXIT

read_version() {
  local file="$1"
  if [ ! -f "$file" ]; then
    printf 'unknown'
    return
  fi
  sed -nE "s/.*MOVIE_CATALOG_VERSION[[:space:]]*=[[:space:]]*['\"]([^'\"]+)['\"].*/\1/p" "$file" | head -n 1
}

copy_app_source() {
  local source="$1"
  local destination="$2"
  local item base
  mkdir -p "$destination" || return 1

  for item in "$source"/*; do
    [ -e "$item" ] || continue
    base="$(basename "$item")"
    case "$base" in
      .git|.github|.moviecatalog-update-backups|movie-room-backup-*.json|*.zip)
        continue
        ;;
    esac
    /usr/bin/ditto "$item" "$destination/$base" || return 1
  done
}

fail() {
  echo
  echo "Update failed: $1"
  echo
  echo "Press Return to close this window."
  read -r _
  exit 1
}

echo
echo "MovieCatalog Updater"
echo "--------------------"
echo "Checking GitHub for the newest build..."

mkdir -p "$EXTRACT_DIR" || fail "Could not create the temporary update folder."
if ! curl -fL --retry 2 --connect-timeout 15 "$ARCHIVE_URL" -o "$ZIP_PATH"; then
  fail "Could not download MovieCatalog from GitHub. Check the internet connection and try again."
fi
if ! unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"; then
  fail "The downloaded update could not be unpacked."
fi

SOURCE_DIR="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[ -n "$SOURCE_DIR" ] || fail "The GitHub archive did not contain the application folder."

CURRENT_VERSION="$(read_version "$SCRIPT_DIR/version.js")"
LATEST_VERSION="$(read_version "$SOURCE_DIR/version.js")"

echo "Installed version: $CURRENT_VERSION"
echo "GitHub version:    $LATEST_VERSION"

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ] && [ "$CURRENT_VERSION" != "unknown" ]; then
  echo
  echo "MovieCatalog is already up to date."
  echo "Opening MovieCatalog..."
  open "$SCRIPT_DIR/index.html"
  sleep 2
  exit 0
fi

echo
echo "Creating a safety copy of the current program files..."
mkdir -p "$BACKUP_DIR" || fail "Could not create the safety-copy folder."
if ! copy_app_source "$SCRIPT_DIR" "$BACKUP_DIR"; then
  fail "Could not create a safety copy of the current program files."
fi

echo "Installing the new build..."
if ! copy_app_source "$SOURCE_DIR" "$SCRIPT_DIR"; then
  echo "Install failed. Restoring the previous program files..."
  copy_app_source "$BACKUP_DIR" "$SCRIPT_DIR" >/dev/null 2>&1 || true
  fail "The update could not be installed, so the prior application files were restored."
fi

INSTALLED_VERSION="$(read_version "$SCRIPT_DIR/version.js")"
echo
echo "Update complete. MovieCatalog $INSTALLED_VERSION is installed."
echo "Your movie catalog data was not replaced; it remains in browser IndexedDB."
echo "Opening MovieCatalog..."
open "$SCRIPT_DIR/index.html"
sleep 3
exit 0
