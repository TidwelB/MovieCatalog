# My Movie Room — v1.6.1

A local-first web movie catalog for tracking what you own and exactly where each physical copy is stored.

## Features

- Search TMDB for movies and poster metadata, with debounced suggestions while you type.
- Add movies manually even without TMDB or internet access.
- Track physical format, edition, personal notes, bookcase, shelf, and shelf position.
- Create any number of physical bookcases with configurable shelf counts.
- Browse compact ordered poster strips in **Cases & Shelves** and in the Room Map inspector.
- Open a large virtual shelf showing every movie left-to-right in physical position order.
- See miniature movie-cover previews directly inside the draggable bookcases on the Room Map.
- Drag bookcases around a simple room map; hover for movie counts and click to inspect shelf contents.
- Local-first storage using IndexedDB. No application server or cloud database is required.
- Export/import a JSON backup to transfer your catalog between Windows, macOS, browsers, or computers.
- Check GitHub for application updates from inside **Settings**.
- Install updates using a one-click-ish local updater on Windows or macOS; Git and Python are not required on the family member's computer.


## v1.6.1 hotfix — update checker freshness

The Settings update checker now reads `version.js` through the GitHub Contents API instead of relying on the `raw.githubusercontent.com` branch URL. This avoids a short-lived CDN/cache condition where GitHub's web UI already showed the new version but the checker still received the previous `version.js`.

The checker still reads only the public `TIDWELB/MovieCatalog` repository and does not require a GitHub account or token.

## v1.5 changes — updater system

MovieCatalog now tracks its application version in `version.js` and can compare that version to the copy in the public GitHub repository:

`https://github.com/TIDWELB/MovieCatalog`

Open **Settings → Application updates → Check for updates**.

If a newer build is available, MovieCatalog tells the user which local updater to run:

- Windows: `Update MovieCatalog.bat`
- macOS: `Update MovieCatalog.command`

The updater downloads the newest `main` branch ZIP directly from GitHub, makes a safety copy of the current program files, replaces the application files, and reopens `index.html`.

The updater does **not** replace the user's live catalog. Movies, bookcases, room layout, and the TMDB token remain in that browser's IndexedDB storage.

### Important limitation

The browser cannot securely launch an arbitrary local `.bat` or `.command` file by itself. The simplest safe flow is therefore:

1. Open **Settings**.
2. Click **Check for updates**.
3. If an update is available, close MovieCatalog.
4. Double-click the updater in the MovieCatalog folder.
5. MovieCatalog reopens after the update finishes.

No terminal commands are required during normal updating.

## Publishing a new build

This updater follows the `main` branch directly, so a release does not need to be created in GitHub Releases.

Before pushing a build, change this line in `version.js`:

```js
window.MOVIE_CATALOG_VERSION = '1.6.0';
```

Use a higher version number each time you want family members to see an update.

Then commit and push normally:

```powershell
git add .
git update-index --chmod=+x "Update MovieCatalog.command" start-mac.command
git commit -m "Release MovieCatalog v1.6.0"
git push
```

The `git update-index` line records the executable bit for the two macOS `.command` scripts. This is especially important when committing from Windows/NTFS.

Once `main` contains the new `version.js`, the Settings checker and both updater scripts will see the new build.

## First-time setup for a family member

Copy or download the entire MovieCatalog folder onto the computer.

### Windows

Open `index.html` normally. For future updates, double-click `Update MovieCatalog.bat` when Settings reports a new version.

The Windows updater uses built-in PowerShell. It does not require Git or Python.

### macOS

Open `index.html` normally. For future updates, double-click `Update MovieCatalog.command` when Settings reports a new version.

On the first launch, macOS may require **Control-click → Open** because the updater is an unsigned local script. After the one-time approval, future launches are normally straightforward.

If macOS reports that the updater is not executable, make sure the executable bit was committed to Git with:

```powershell
git update-index --chmod=+x "Update MovieCatalog.command" start-mac.command
```

and then commit/push that change.

## Safety copies during updates

The updater creates program-file safety copies under:

`.moviecatalog-update-backups/`

That folder is ignored by Git via `.gitignore`.

These backups are separate from the user's movie database. They exist only to restore application files if an update copy fails.

## Starting the app — Python is optional

### Simplest method

Open `index.html` in a current Chrome, Edge, Firefox, or Safari browser.

If direct launch is working for TMDB search and local saves on the machine, Python is not needed.

### Windows

- Double-click `index.html`, or
- Double-click `start-windows.bat`.

### macOS

- Double-click `index.html`, or
- Run `start-mac.command`.

The launcher scripts use Python only as an optional local web server. If Python is unavailable, they open `index.html` directly.

## Where the data actually lives

The JSON backup is not the active database.

The live catalog is stored by the browser in an IndexedDB database named:

`myMovieRoomDB`

That database contains:

- `movies` — movie metadata, format, edition, notes, case/shelf/position, etc.
- `cases` — bookcase definitions and Room Map coordinates/sizes.
- `settings` — including the saved TMDB API Read Access Token.

The browser writes this data into its own profile/storage area. It is not stored next to `index.html`.

### What this means

- Updating `index.html`, `app.js`, `styles.css`, and the other program files does not replace the catalog.
- Closing the browser does not erase the collection.
- Restarting Windows/macOS does not erase the collection.
- The JSON export is only a backup/transfer file.
- Clearing browser site data may delete the collection.
- Different browsers have separate IndexedDB storage.
- Copying the application folder to another computer does not copy IndexedDB; use Export/Import for that.

## Moving a collection to another computer

1. Open **Settings → Export backup** on the old computer.
2. Copy the MovieCatalog folder and the downloaded backup JSON to the new computer.
3. Open `index.html` on the new computer using the preferred browser.
4. Open **Settings → Import backup** and select the JSON file.
5. Continue using that browser for the catalog.

## TMDB setup

1. Create/log in to a TMDB account.
2. Request API access in TMDB account settings.
3. Copy the **API Read Access Token**.
4. Open **Settings** in MovieCatalog and paste it.
5. Click **Test connection**.

The token is stored only in that browser's local IndexedDB database unless the user explicitly exports a MovieCatalog backup.

## Data model

- **Movie:** TMDB/manual metadata + ownership details + `caseId`, `shelf`, and `position`.
- **Bookcase:** name, shelf count, Room Map X/Y coordinates, and display width/height.
- The Room Map and movie assignments are independent, so furniture can move without changing shelf assignments.

## TMDB attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
