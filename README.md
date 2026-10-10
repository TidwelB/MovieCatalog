# My Movie Room — v1.7.0

A local-first movie catalog for tracking what you own and exactly where each physical copy is stored.

## v1.7.0 — launcher-based updates

The easiest macOS setup is now a standalone **MovieCatalog.app** launcher.

### Grandmother / macOS setup

1. Put `MovieCatalog.app` on the Desktop.
2. The first time, double-click it. If macOS blocks the unsigned local app, Control-click it, choose **Open**, then confirm **Open** once.
3. From then on, use that same **MovieCatalog** desktop app every time.

The launcher automatically:

- keeps the runnable web files in `~/Library/Application Support/MovieCatalog`;
- checks the public `TIDWELB/MovieCatalog` GitHub repository on startup;
- installs a newer `main` build when `version.js` increases;
- opens the installed `index.html` in the default browser;
- opens the last installed copy even when GitHub or the internet is temporarily unavailable.

Git, Python, and a GitHub account are not required on the family member's Mac.

The launcher contains a bundled v1.7.0 copy, so the first run can still start even if an update check is unavailable.

### Important storage note

When launched through `MovieCatalog.app`, the web app always opens from:

`~/Library/Application Support/MovieCatalog/index.html`

That stable path is intentional. Keep using the desktop launcher rather than moving/opening the internal runtime files manually.

The user's movie collection is still stored by the browser in IndexedDB. Updating the program files does not replace movies, cases, shelf positions, room layout, or the TMDB token.

If a Mac was already using an older MovieCatalog directly from another `index.html` path, that older browser storage is associated with the old local-file location. Export a JSON backup from the old copy and import it once into the launcher-based copy.

## Windows launcher

The full project also contains:

- `Launch MovieCatalog.bat`
- `launch-windows.ps1`

Double-click `Launch MovieCatalog.bat`. It checks the current GitHub version, installs a newer build when needed, and then opens the catalog. If GitHub cannot be reached, it opens the installed local copy.

The existing `Update MovieCatalog.bat` / `Update MovieCatalog.command` files remain as manual fallback updaters for folder-based installations.

## Settings update checker

**Settings → Application updates → Check for updates** still compares the installed `version.js` with GitHub.

When a newer build exists, the Mac instructions now tell the user to close the browser window and reopen **MovieCatalog.app**. The launcher performs the filesystem update before reopening the catalog.

## Publishing a new build

The launcher follows the public repository's `main` branch. You do not need to create a GitHub Release.

Before each family-facing build, increment `version.js`, for example:

```js
window.MOVIE_CATALOG_VERSION = '1.8.0';
```

Then commit and push:

```powershell
cd C:\Users\Owner\MovieCatalog

git add .
git update-index --chmod=+x "MovieCatalog.app/Contents/MacOS/MovieCatalog" "Launch MovieCatalog.command" "Update MovieCatalog.command" start-mac.command
git commit -m "Release MovieCatalog v1.7.0"
git push
```

The executable-bit command matters because you are committing macOS launch files from Windows/NTFS.

Once `main` contains the higher version, the next launch on your grandmother's Mac sees it and updates automatically.

## What you give your grandmother

For the simplest clean installation, give her only:

`MovieCatalog.app`

She can leave that app on her Desktop and use it as her normal MovieCatalog icon/launcher.

You do not need to give her Git, Python, the GitHub repository, or terminal instructions.

## Existing application features

- Search TMDB with live title suggestions.
- Manual movie entry without TMDB.
- Track format, edition, notes, bookcase, shelf, and physical position.
- Compact poster strips for shelves and Room Map cases.
- Large horizontal virtual shelf view in physical position order.
- Draggable room-map bookcases with movie-cover previews.
- IndexedDB local storage.
- JSON export/import for backups and computer/browser migration.
- TMDB API Read Access Token stored locally in the browser.

## Backups

The JSON export is not the live database. The active collection remains in browser IndexedDB.

Use **Settings → Export backup** periodically, especially before moving to a different browser/computer or before clearing browser data.

## TMDB attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
