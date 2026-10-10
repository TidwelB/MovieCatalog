# My Movie Room — v1.4

A local-first web movie catalog for tracking what you own and exactly where each physical copy is stored.

## Features

- Search TMDB for movies and poster metadata, with debounced suggestions while you type.
- Add movies manually even without TMDB or internet access.
- Track physical format, edition, personal notes, bookcase, shelf, and shelf position.
- Create any number of physical bookcases with configurable shelf counts.
- Browse compact ordered poster strips in **Cases & Shelves** and in the Room Map inspector.
- Open a **large virtual shelf** that shows every movie left-to-right in physical position order.
- See miniature movie-cover previews directly inside the draggable bookcases on the Room Map.
- Drag bookcases around a simple room map; hover for movie counts and click to inspect shelf contents.
- Local-first storage using IndexedDB. No application server or cloud database is required.
- Export/import a single JSON backup to transfer your catalog between Windows, macOS, browsers, or computers.
- No JavaScript frameworks and no package installation.

## v1.4 changes

- Reworked the large virtual-shelf cards so the movie spine is visually separated from its text label.
- Movie titles now sit underneath each spine in a wider fixed label area instead of competing with the image for horizontal space.
- Titles can use up to three wrapped lines and retain the full title as a hover tooltip.
- Position labels are now compact badges beneath each spine.
- The shelf keeps its left-to-right physical-position ordering and horizontal-scroll behavior.

## v1.3 changes

- Added **View shelf** buttons to Cases & Shelves and the Room Map inspector.
- The new large virtual shelf displays all titles in physical shelf order with larger covers, position labels, titles, and horizontal scrolling.
- Selecting a cover from the virtual shelf opens that movie's editor/location details.
- Draggable Room Map bookcases now display small per-shelf poster previews directly on the case itself.
- Room-map poster previews do not intercept pointer input, so cases remain easy to drag and select.
- Windows/macOS launcher scripts now fall back to opening `index.html` directly when Python is not installed.

## Starting the app — Python is optional

### Simplest method

Open `index.html` in a current Chrome, Edge, Firefox, or Safari browser.

If direct launch is working for TMDB search and local saves on your machine, **you do not need Python**.

The included launcher scripts use Python only as an optional tiny local web server. If Python is unavailable, the updated launchers simply open `index.html` directly.

### Windows

- Double-click `index.html`, **or**
- Double-click `start-windows.bat`.

### macOS

- Double-click `index.html`, **or**
- Run `start-mac.command` (macOS may require Control-click → Open the first time because it is an unsigned local script).

If `index.html` works directly, there is no reason to install Python just for this catalog.

## Where the data actually lives

The JSON backup is **not** the active database.

The live catalog is stored by the browser in an IndexedDB database named:

`myMovieRoomDB`

That database currently contains three object stores:

- `movies` — movie metadata, format, edition, notes, case/shelf/position, etc.
- `cases` — bookcase definitions and Room Map coordinates/sizes.
- `settings` — currently including the saved TMDB API Read Access Token.

The browser writes this data into its own private profile/storage area on the computer. The files are managed by the browser; they are not saved next to `index.html` and you normally should not edit them manually.

### What this means

- Closing the browser does **not** erase the collection.
- Restarting Windows/macOS does **not** erase the collection.
- The JSON export is only a backup/transfer file; it does not need to remain present for the app to work.
- Deleting the JSON backup does **not** delete the live catalog.
- Deleting/clearing the browser's site data may delete the catalog.
- Chrome, Edge, Firefox, and Safari each have separate browser storage.
- A Windows browser's IndexedDB does not automatically move to a Mac just because you copy the app folder.

For that reason, use **Settings → Export backup** before changing computers, browser profiles, or launch methods.

## Important note about opening `index.html` directly

Directly opening the app uses a `file://` URL. Browser handling of storage/origins for local files is implementation-dependent, so behavior can differ between browsers. For consistency, keep using the same browser and the same copy/path of the app when possible.

If direct launch works reliably for you, it is perfectly reasonable to keep using it. A `localhost` server is mainly a fallback if a browser later blocks an API/network feature or handles local-file storage differently.

## Moving from Windows to Mac

1. On Windows, open **Settings → Export backup**.
2. Copy both the app folder and the downloaded JSON backup to the Mac.
3. Open `index.html` on the Mac in your preferred browser.
4. Open **Settings → Import backup** and choose the JSON file.
5. Continue using that same browser/launch method on the Mac.

The backup contains your catalog, bookcases, room-map positions, and TMDB token.

## TMDB setup

1. Create/log in to a TMDB account.
2. Request API access in your TMDB account settings.
3. Copy the **API Read Access Token**.
4. Open **Settings** in the app and paste the token.
5. Click **Test connection**.

The token is stored in the same local IndexedDB database as the rest of the catalog.

## Data model

- **Movie:** TMDB/manual metadata + ownership details + `caseId`, `shelf`, and `position`.
- **Bookcase:** name, shelf count, Room Map X/Y coordinates, and display width/height.
- The Room Map and movie assignments are independent, so furniture can move without changing shelf assignments.

## TMDB attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
