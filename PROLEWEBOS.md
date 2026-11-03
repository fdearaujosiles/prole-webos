# prole-webos — resume here

> Working reference for the prole-webos app and the non-root TV build loop.
> Last verified on the physical TV: **2026-11-03**.
>
> Companion document: `RUNBOOK.md` covers backup, debloat, restore and the
> account/Developer Mode setup step by step. This file covers the app itself,
> the deploy/verify loop, guardrails for future edits, and the rooting
> research and risks.

---

## 0. How to use this document

- Picking this up cold? Read **§1 Current state**, **§2 Identity**, and
  **§8 Guardrails** before touching code.
- Building or reinstalling? Go straight to **§6 Build and deploy**.
- Debugging on the TV? **§7 Verify on the TV** and **§10 Troubleshooting**.
- Asked about root, a default launcher, or starting prole-webos at power-on?
  **§11 Rooting** has the full research, risks and rollback.
- Looking for a term? **§14 Search index** maps keywords to sections.

> **Agent rule — pushing is never automatic.** After finishing a piece of work
> and verifying it, always ask the user whether to push the changes, and
> whether the push should go to `main` or to a new branch. Do not commit and
> push, force-push, or open a pull request without an explicit answer. See
> guardrail **G30** and §13 for the git commands.

Search anchors in this file: `prole-webos`, `com.fdear.prolewebos`,
`com.fdear.prolewebos.service`, `listLaunchPoints`, `getExternalInputList`,
`getAppLoadStatus`, `clientKey`, `PROMPT`, `READ_INSTALLED_APPS`,
`READ_INPUT_DEVICE_LIST`, `127.0.0.1`, `hidden`,
`launchPointId`, `Overlay`, `CDP`, `ssap.js`, `ocr2.ps1`, `SlopBro`,
`HomeBack`, `Input Hook`, `init.d`, `sam`, `kiosk`, `DRM`,
`prolewebos.dock`, `Manage dock`, `pin-badge`, `set-wallpapers.py`,
`push`, `branch`, `ask before pushing`.

---

## 1. Current state (TL;DR)

| Item | Value |
|---|---|
| App | **prole-webos**, app id `com.fdear.prolewebos` (renamed from `com.fdear.aurora` in 1.4.0; keep the new id stable) |
| Version | **1.4.0** in `app/appinfo.json` and `app/services/com.fdear.prolewebos.service/package.json` |
| TV | LG **55QNED75SRA**, webOS **10.3.2** ("webOS 25"), firmware **33.31.75** |
| TV address | `192.168.1.50` (PC `192.168.1.15`) |
| Access | Developer Mode, SSH `prisoner@192.168.1.50:9922`, key server `9991`, ares device `tv` |
| Root | **None.** Nothing was rooted, no system partition was written |
| Home key / power-on | Still LG's launcher. prole-webos is an installed app, not the default |
| Dock | Configurable: add/remove, reorder and reset from **Manage dock**; 8 defaults (7 streaming apps + RetroArch), up to **10** pins; separator; All apps / Inputs / Settings |
| All apps | Last verified **23 tiles**, including the native store app named **Apps** and the installed **RetroArch**, plus **Manage dock** |
| Wallpapers | 8 bundled SVG scenes; replace them with your own images via `scripts/set-wallpapers.py` |
| Inputs | Detected live with `tv/getExternalInputList`, grouped **Active / Connected / Not connected**, with the TV-reported device name (e.g. **Nintendo Switch** on HDMI 1); Live TV is listed under Active |
| Debloat | 11 settings changes applied, all verified on disk; Quick Start+ on |
| Pairing | SSAP key persisted in app `localStorage` (`prolewebos.ssapKey`); one TV prompt on first use, and one more if a stored key predates a newly requested permission |

Exact All-apps catalog at the last verification (boot-time snapshot):

```
Amazon Alexa, Apple TV, Apps, Câmera, Copilot, Developer Mode, Disney+,
FILMICCA, GeForce NOW, Globoplay, HBO Max, Hub Inicial, Mercado Play,
Navegador Web, Netflix, Prime Video, Reprodutor de Mídia, RetroArch,
Settings, Spotify - Músicas e podcasts, Star+, Stremio, YouTube
```

The TV's live launch-point list is larger and changes as apps are installed.
At the last live check, after installing RetroArch, the TV reported **32
launch points, 26 visible, 6 hidden**. The 6 hidden ones were LG Gaming Portal,
Esportes, LG Channels, LG Gallery+, LG Sports Playbook and 8 Ball Pool. prole-webos filters
`hidden === true`, itself and input launch points; the native store shows up
as **Apps**. The earlier saved backup from the same day reports 32 launch
points with none hidden, so treat these figures as dated snapshots. Never
hard-code the count; assert it dynamically (§7.1).

**Important:** the catalog is loaded once when the app boots. An app installed
or unhidden on the TV afterwards will not appear until prole-webos is
relaunched or the TV is restarted. This explains why the live launch-point
list can contain an entry missing from a still-open All-apps grid.

---

## 2. Identity, TV and accounts

| Thing | Detail |
|---|---|
| App id | `com.fdear.prolewebos` — new identity from 1.4.0; keep it stable (installed identity, app storage, package name) |
| Display title | `prole-webos` (app title, DOM title, brand and splash) |
| Project/vendor | `fdear`, app type `web`, main `index.html`, resolution `1920x1080` |
| Service id | `com.fdear.prolewebos.service`, v1.4.0, `service.js` |
| TV model | 55QNED75SRA (2025 QNED, webOS 25) |
| TV firmware | 33.31.75 (Linux 5.4 class; exact SoC details in `backup/2026-11-03/raw/systeminfo.json`) |
| Dev Mode | Installed on the TV; 1000-hour session limit (~41 days), renewable in the Developer Mode app |
| Dev Mode shell | `prisoner` user over SSH port 9922; key server 9991 |
| ares device | `tv`, registered by `scripts/connect.sh` |
| ares binaries | `node_modules/.bin/` and `node_modules/@webos-tools/cli/bin/` |
| SSAP | `wss://192.168.1.50:3001`, signed `com.lge.test` manifest with unsigned fallback |
| PC shell | Git Bash on Windows 11; use Unix syntax |

Legacy naming that remains on purpose:

- The app id was `com.fdear.aurora` through 1.3.2. Version 1.4.0 renames it to
  `com.fdear.prolewebos`, so 1.4.0 installs as a **new app**: the old storage
  (dock pins, wallpapers, SSAP pairing) does not carry over. The old
  `com.fdear.aurora` install can be removed once the renamed app is verified.
- The wallpapers global still says **aurora**
  (`window.AURORA_WALLPAPERS`). `app/js/wallpapers.js` is generated by
  `scripts/gen-wallpapers.js`; renaming the global means touching the
  generator and the app together.
- The config global is `window.PROLE_CONFIG`, with
  `window.AURORA_CONFIG` accepted as a fallback in `app/js/app.js:6`.
- The temporary research app in `probe/` still has the title
  "Aurora Probe" (`com.fdear.probe`). It is not part of prole-webos.

---

## 3. Repo map

| Path | Purpose |
|---|---|
| `app/` | prole-webos web app and its bundled Luna service |
| `app/index.html` | DOM shell: wallpaper layers, clock/date, brand, toast, dock, overlay, hint |
| `app/js/app.js` | All page logic (dock, dock management, catalog, overlay, keys, wallpapers, clock) |
| `app/js/apps.js` | Default dock configuration (`window.PROLE_CONFIG`, favorites + candidate ids); user changes live in `localStorage['prolewebos.dock']` |
| `app/js/wallpapers.js` | Wallpaper manifest; generated by `scripts/gen-wallpapers.js` or `scripts/set-wallpapers.py`, do not hand-edit casually |
| `app/wallpapers/*` | Wallpaper images: 8 bundled SVGs (roughly 3–25 KB each) or JPEGs added by the wallpaper script |
| `app/css/style.css` | Layout, focus states, overlay grids, reduced-motion handling |
| `app/assets/` | Icon, large icon, splash |
| `app/services/com.fdear.prolewebos.service/` | ES5 Luna JS service that talks to the TV's remote-control API |
| `scripts/` | Scan, connect, backup, debloat, restore, package/install, SSAP, CDP, screenshots, wallpapers |
| `scripts/set-wallpapers.py` | Replace wallpapers with every image in a folder (crop to 1920×1080 JPEG, archive the old set, optionally deploy) |
| `scripts/gen-wallpapers.js` | Regenerate the 8 original SVG scenes and manifest |
| `scripts/ssap.js` | Minimal SSAP client: pair, request, apps, foreground, launch, close, screenshot, settings, key, luna |
| `scripts/cdp-eval.js` | Evaluate JS in the running app through the `ares-inspect` proxy |
| `scripts/package-install.sh` | Build, install, launch, screenshot |
| `scripts/screenshot.sh` | Capture the TV screen via SSAP |
| `scripts/env.sh` | Shared environment: `LG_TV_HOST`, `LG_DEVICE`, `ARES` |
| `blocklist/` | DNS ad/telemetry domains for router/Pi-hole (applied outside this repo) |
| `backup/` | Backups, proposals, change logs, screenshots, inspector logs |
| `backup/<date>/` | Raw prefs/apps/launchpoints/systeminfo + debloat evidence |
| `backup/shots/` | Verification screenshots (`home-clean.jpg`, `allapps-clean.jpg`, …) |
| `packages/` | Built `.ipk` files |
| `preview/` | Local PNG previews of wallpapers/splash/icon |
| `probe/` | Temporary capability-probe app (`com.fdear.probe`), research only |
| `tools/reportd.py` | Loopback receiver used by the probe; not needed to build prole-webos |
| `RUNBOOK.md` | Non-root debloat, backup, restore, DNS, teardown |
| `PROLEWEBOS.md` | This document |

Secrets / generated files that must not be committed: `.ssap-client-key.json`
(SSAP pairing key, mode 0600), `node_modules/`, `packages/`, `backup/`,
`preview/`, `__pycache__/`.

---

## 4. Architecture

```
LG remote ──keydown──> app.js ──launch──> luna://com.webos.applicationManager/launch
                          │
                          ├── catalog ──> luna://com.fdear.prolewebos.service/ssap
                          │                   └─ raw WebSocket 127.0.0.1:3000
                          │                      (Origin: file://)
                          │                      ├─ com.webos.applicationManager/listLaunchPoints
                          │                      └─ tv/getExternalInputList
                          │
                          └── fallback ──> applicationManager/getAppLoadStatus
                                            (28 known app ids + 7 input ids)
```

### 4.1 Runtime files and boot sequence

`app/index.html` loads, in order: `webOSTVjs/webOSTV.js`,
`js/wallpapers.js`, `js/apps.js`, `js/app.js`.

At the end of `app/js/app.js` (`:1522`):

1. `rebuildDock()` builds the configured favorites (defaults from
   `apps.js`, or the user's saved set) + separator + utilities.
2. `setDockFocus(0)` focuses the first favorite.
3. `tick()` paints the clock/date and aligns the next tick to the minute.
4. `setHint('dock')` shows the remote hint.
5. `loadCatalog()` starts **two things in parallel**: `probeKnown()` and
   `serviceCatalog()`.
6. Deep-link handling reads `PalmSystem.launchParams` and opens
   All apps/Inputs/Manage dock after 500 ms if requested.

### 4.2 Why a bundled Luna service exists

A normal app page is not allowed to call
`com.webos.applicationManager/listLaunchPoints` directly. The page origin is
also unusual (`file://com.fdear.prolewebos-webos` on this firmware), and the TV's
remote-control API closes connections whose handshake does not say
`Origin: file://`.

`app/services/com.fdear.prolewebos.service/service.js` solves both problems:

- It is a Luna JS service, so its Luna calls are privileged enough for the app
  list.
- It opens a raw WebSocket to `127.0.0.1:3000` and sends the HTTP upgrade with
  `Origin: file://` (see `service.js:67`).
- It registers with the TV using `pairingType: 'PROMPT'` and the permissions
  `READ_INSTALLED_APPS` + `READ_INPUT_DEVICE_LIST` (`service.js:29`, `:78`).
  The TV shows a prompt; accepting it returns a **client key** that the
  service returns to the page.
- It proxies exactly two URIs (`service.js:25`):
  `com.webos.applicationManager/listLaunchPoints` and
  `tv/getExternalInputList`. Any other URI is refused with
  `{returnValue:false, errorText:'Unsupported request'}`
  (`service.js:115`).
- It waits up to **90 seconds** for the person to answer the prompt
  (`service.js:38`).

The page stores the returned key in `localStorage` under
`prolewebos.ssapKey` (`app.js:85`, `:619`, `:626`). On later calls the key is sent to
the service so the TV does not prompt again. If storage is cleared or the app
is reinstalled, expect one new prompt. A key saved before
`READ_INPUT_DEVICE_LIST` was requested cannot authorize the Inputs call: the
service reports `{staleKey:true}` and the handler retries once with **no**
key, which triggers a fresh, wider prompt (`service.js:57`, `:122`).

If the person declines, the service answers
`{returnValue:false, errorText:'Pairing was refused on the TV'}`; if the TV
never answers, `{returnValue:false, errorText:'No answer from the remote
control API'}`. Either way the page falls back to the probe results.

The service is ES5 on purpose: older webOS ships an old Node. It uses only
`net` and a `Buffer.from` fallback (`service.js:12`).

### 4.3 Catalog resolution (primary and fallback)

`serviceCatalog()` (`app.js:617`):

1. Reads the stored client key (inside `try/catch`; storage can be disabled).
2. Calls the bundled service with
   `uri: 'com.webos.applicationManager/listLaunchPoints'`.
3. On success: stores the new `clientKey` if present; takes
   `payload.launchPoints`; filters entries with an id and `hidden !== true`;
   builds an `installed` map; forces `installed['com.palm.app.settings']`;
   sets `hasAppList = true`; repairs favorites; rebuilds the catalog.

`probeKnown()` (`app.js:648`) runs at the same time, regardless of whether the
service works:

- It calls `getAppLoadStatus` for 28 known app ids (`KNOWN_APPS`, `:90`) plus
  the 7 input ids (`INPUT_IDS`, `:121`).
- Any `exist === true` result is recorded. Input ids also set
  `inputFound[id]`, which filters the static Inputs fallback when live
  detection is unavailable (§4.8).
- If the service never delivers a real list, the probe's results become
  `fallbackApps` and the visible catalog.
- When the probe finishes and the Inputs overlay is open on the static
  fallback path, it re-renders it so availability updates.

`rebuildCatalog()` (`app.js:562`) is the single place that turns launch points
into grid items:

1. Skip `hidden === true`, self (`com.fdear.prolewebos`) and input ids.
2. Dedupe on `launchPointId || id`. Bookmarks can reuse a host app's id but
   have their own launch point id; the dedupe key keeps both.
3. Preserve `params` (`lp.params`) so bookmarks launch correctly.
4. If there are no launch points at all, use the fallback probe results.
5. Append a Settings entry if one is not already present.
6. Sort by title (`localeCompare`, base sensitivity, numeric).
7. Re-render if the All-apps overlay is open.

`inputItems()` (`app.js:692`) is the static fallback: it shows a source when
the probe found it, the service's `installed` map contains it, or the catalog
has not loaded yet. It is used only until `loadInputs()` (see §4.8) returns a
live device list.

`repairFavorites()` (`app.js:531`) runs on every catalog update. For each
favorite it re-resolves the icon from the current launch points through
`refreshFavoriteIcon()` (`app.js:496`): the same app id wins, an exact params
match is preferred over a bare id match, and the first icon found
(`icon` or `largeIcon`) replaces the stored one. If anything changed it calls
`rebuildDock()` and re-saves the dock config. This is what keeps pinned dock
tiles from falling back to letter avatars after a relaunch, because launch
point resource URLs carry a per-install hash that changes.

### 4.4 Launch resolution

`launchIds(ids, name, params)` (`app.js:434`):

1. Copies the candidate ids; toasts if none.
2. If the installed map is available, sorts installed ids first.
3. Closes any overlay.
4. Tries ids in order through
   `luna://com.webos.applicationManager` `launch`.
5. Each attempt has a **2.5 s** guard; `returnValue === false` or a Luna
   failure moves to the next id.
6. After all candidates fail, shows "Could not open <name>. Check that it is
   installed."
7. Passes `params` when present (bookmarks such as Xbox Cloud Gaming).

Default dock favorites carry multiple ids in `app/js/apps.js`; the first
installed one wins. Pinned apps copied from the catalog keep the catalog
entry's ids and params. `repairFavorites()` (`app.js:531`) also matches
installed titles (exact first, then substring) and inserts the discovered id;
a favorite with no match is dimmed, never removed.

### 4.5 Icon resolution

Launch point icons are served from a per-install resource path, typically
`http://127.0.0.1:3000/resources/<hash>/icon.png`; older firmware used
`https://192.168.1.50:3001/...`. `makeIcon()` (`app.js:815`):

1. Inputs get a uniform inline SVG glyph.
2. The Settings/Manage entry uses the inline glyph from `UTILITY_LOGOS`.
3. Otherwise it tries `iconCandidates()` (`app.js:790`): original URL, then
   the same URL with host `127.0.0.1`, then the same URL over `http:`.
4. Each `error` advances to the next candidate.
5. If all fail, it removes the image and paints a deterministic letter avatar
   (`initial()` + `colorFor()`).

`letterIcon()` (`app.js:805`) **inserts** the letter instead of replacing the
icon box's contents. The picker's pin badge is a child of the same box, and
icon URLs can fail seconds after rendering; wiping the box would silently
remove the badge.

The `<hash>` segment changes when an app is updated or the TV re-indexes its
resources, so a saved dock icon goes stale. The saved value is refreshed from
the live launch points on every catalog load (§4.3), which is why pinned dock
tiles keep their artwork across relaunches. A tile still falls back to a
letter when the app is genuinely absent from the launch point list or every
candidate URL fails — that is expected, not a symptom of a broken catalog.

### 4.6 Overlay and focus model

- The overlay is one element (`#overlay`) with modes: `apps`, `inputs` and
  `manage`. The manage mode has two views: `dock` and `picker`.
- All apps: 8-column grid, title "All apps", subtitle "<n> installed", plus a
  trailing **Manage dock** tile.
- Inputs: 4-column grid, `max-width: 52vw`, title "Inputs", subtitle
  "Detected sources" once the live list arrives. Group headers ("Active",
  "Connected", "Not connected") span the full grid width. Before/without a
  live list the subtitle is "Detecting sources…" or "Showing known inputs"
  and the static fallback tiles render (§4.8).
- Manage dock: dock row + Actions row (Add apps / Reset dock / Done).
- Add apps (picker): the full catalog, 8-column grid, pin badges on pinned
  apps.
- Focus starts at index 0 when opened.
- Horizontal movement wraps; vertical movement moves by the number of rendered
  grid columns and clamps at the ends.
- The focused tile is scrolled into view with `scrollIntoView({block:
  'nearest', inline: 'nearest'})`.
- Clicking a tile focuses and launches; hovering focuses.
- Clicking the overlay backdrop closes it.
- The remote hint switches text per mode and dims to opacity 0.16 after 12 s.

### 4.7 Settings tile and the layered popup

`UTILITIES` (`app.js:72`) always includes:

- All apps (opens the `apps` overlay).
- Inputs (opens the `inputs` overlay).
- Settings, with candidate ids `com.palm.app.settings` and
  `com.webos.app.settings`.

On this TV, Settings opens as a **layered popup owned by the system**, and the
foreground app can keep reporting `com.fdear.prolewebos`. Do not infer that
Settings did not open from a foreground query alone (see §7.5 and §10).

### 4.8 Inputs

Opening the Inputs overlay calls `loadInputs()` (`app.js:718`), which asks the
service for `tv/getExternalInputList` (using the stored client key). The
overlay paints "Detecting sources…" immediately and re-renders when the answer
arrives; `inputsLoading` prevents overlapping requests. The returned
`payload.devices` are kept in `externalInputs` (entries without an `appId` are
dropped).

Each device is labelled by `inputName()` (`app.js:748`), which prefers the
TV-reported device name from `subList[0]` (`brandName`, then `labelName`, e.g.
**Nintendo Switch**), then a non-generic `label`, then `HDMI <port>`.

`inputGroups()` (`app.js:757`) splits the devices by signal state:

- **Active** — `connected === true` or `hdmiSignalExist === true` (something
  is actually on that source).
- **Connected** — `hdmiPlugIn === true` but not active (a console plugged in
  with its power off).
- **Not connected** — everything else.

The last two groups are ordered by port. **Live TV** is always appended to
Active with sub "Antenna / Cable". Empty groups are omitted, and each tile's
sub-label is the port ("HDMI 1") unless the title is already the plain port
name.

If the call fails or was refused, `inputsFailed` is set and the overlay falls
back to `inputItems()` (`app.js:692`): the static seven definitions — HDMI
1–4, Live TV, AV (`externalinput.av1`) and Component
(`externalinput.component`) — filtered by what the probe found. Launching
either kind of tile goes through the same `applicationManager/launch` path
with the input app id.

### 4.9 Deep links

`window.PalmSystem.launchParams` is parsed at boot; `{"view":"apps"}`,
`{"view":"inputs"}` or `{"view":"manage"}` opens the matching overlay after
500 ms. This exists for testing, not as a public feature.

Example:

```bash
node scripts/ssap.js launch com.fdear.prolewebos '{"params":{"view":"apps"}}'
node scripts/ssap.js launch com.fdear.prolewebos '{"params":{"view":"manage"}}'
```

### 4.10 Dock configuration and management

The dock is now user-editable. Two layers:

1. **Defaults** — `app/js/apps.js` (`window.PROLE_CONFIG.apps`) plus the three
   fixed utilities. The defaults are the seven streaming apps plus
   `com.retroarch.webos`; RetroArch has no bundled icon, so its tile picks up
   the live launch-point icon through the normal icon refresh.
2. **User configuration** — `localStorage['prolewebos.dock']`, written by the
   app whenever the set changes. On boot, `loadDockConfig()` (`app.js:210`)
   reads it; if absent or invalid, the defaults are used. `saveDockConfig()`
   and `clearDockConfig()` (`app.js:225`, `:229`) guard storage in
   `try/catch`.

Saved entries are `{key, name, ids, icon, params}`. `MAX_DOCK = 10`
(`app.js:4`). Utilities are never saved and cannot be unpinned or reordered.

Identification helpers (`app.js:195`–`:257`):

- `normParams()` treats `{}` as `null`, so a catalog entry and its default
  equivalent compare equal.
- `favoriteKey()` reuses the default favorite's `key` when ids overlap, which
  preserves brand logos; otherwise `app:<id>`.
- `pinnedIndex()` matches an item to the saved set by ids **and** normalized
  params.

Saved tile icons live in storage, so they are refreshed from the live launch
points whenever the catalog arrives (§4.3); otherwise a stale resource hash
would leave a pinned tile iconless on the next launch.

Management UI (`app.js:1057`–`:1360`) lives in the overlay's `manage` mode:

| View | Controls |
|---|---|
| Manage dock | Left/Right **reorders** the focused dock tile (swap); Up/Down jumps to/from Actions; OK **unpins** a dock tile; OK on an action runs it; Back returns to All apps |
| Add apps (picker) | Arrows move; OK **pins/unpins** the focused app; Back returns to Manage dock |
| Actions | Add apps, Reset dock, Done. Done returns to All apps |

- Pinning beyond 10 shows "Dock is full — unpin an app first (10 max)." and
  leaves storage untouched.
- Reset dock is two-step: the first OK arms it for 3.2 s (red-ringed tile and
  "Press OK again to reset the dock."); the second OK restores the defaults.
- Every mutation saves storage and calls `rebuildDock()` immediately, so the
  visible dock updates while the overlay is open.
- The picker marks pinned apps with a `.pin-badge` ✓ on the icon.
- `renderManage()` (`app.js:1171`), `manageKey()` (`app.js:1339`).

### 4.11 Wallpaper replacement script

`scripts/set-wallpapers.py <folder>` turns a folder of images into the app's
wallpaper set:

1. Accepts `.jpg .jpeg .png .webp .bmp .tif .tiff`, sorted naturally by
   filename.
2. Applies EXIF orientation, composites transparency over black, and
   center-crops with `ImageOps.fit` to **1920×1080**.
3. Saves optimized progressive JPEGs (quality 90; `--quality` overrides) into
   `app/wallpapers/` as `NN-name.jpg`.
4. Archives the previous assets and manifest to
   `backup/wallpapers/<YYYYmmdd-HHMMSS>/`.
5. Rewrites `app/js/wallpapers.js` (`window.AURORA_WALLPAPERS`).
6. Deploys by default: runs `bash scripts/package-install.sh` (build, install,
   launch, screenshot). `--no-deploy` stops after writing files.

The original eight SVG scenes can be regenerated any time with
`node scripts/gen-wallpapers.js`; note that it rewrites the manifest but does
not delete JPEGs added by the script, so archive/move those yourself.

---

## 5. Feature inventory

Every feature implemented so far. "Where" points at the source of truth.

| ID | Feature | Behavior | Where |
|---|---|---|---|
| F1 | Wallpaper stage | Two stacked layers, 1.35 s crossfade, bundled SVG or user JPEG wallpapers, all preloaded | `index.html`, `style.css`, `app.js:379` |
| F2 | Wallpaper rotation | Automatic every `rotateSeconds` (30 s, minimum 8 s); Up/Down also changes it with a 1.5 s guard | `app.js:379`, `:410`, `:1496` |
| F3 | Clock | 24 h HH:MM via `Intl.DateTimeFormat`; fallback manual formatting; ticks aligned to the minute | `app.js:352` |
| F4 | Date | Long weekday/day/month in the TV locale | `app.js:352` |
| F5 | Brand mark | `PROLEWEBOS` top right with a teal/violet gradient dot | `index.html:21`, `style.css:64` |
| F6 | Dock | 7 default favorites, user-configurable up to 10, separator, 3 utilities; Apple-TV-style glass bar | `app.js:259`, `style.css:87` |
| F7 | Dock focus | Scale + rise + white ring; clicked/hovered tile becomes focused; wraps left/right | `app.js:323` |
| F8 | Missing-app state | Tile dimmed with a red dot when no candidate id is installed; still tries common ids on OK | `app.js:512`, `:531`, `style.css:160` |
| F9 | All apps overlay | Windows-Start-style grid of every visible launch point, native store included, plus Settings and Manage dock | `app.js:899` |
| F10 | Catalog service | Bundled Luna service proxies `listLaunchPoints` and `getExternalInputList` through the TV's remote-control API, persists the client key, and re-pairs when a saved key is too narrow | service `service.js`, `app.js:617` |
| F11 | Fallback probe | 28 known app ids + 7 inputs checked with `getAppLoadStatus` when the service is refused/unavailable | `app.js:648` |
| F12 | Title repair + icon refresh | Matches installed apps to favorites by exact then substring title; inserts discovered ids; re-resolves each favorite's icon from live launch points so pinned tiles keep their artwork | `app.js:480`, `:496`, `:531` |
| F13 | Settings tile | Gear glyph; tries `com.palm.app.settings` then `com.webos.app.settings`; dims if both absent | `app.js:72`, `:512` |
| F14 | Inputs overlay | Detected live with `tv/getExternalInputList`; grouped Active / Connected / Not connected; TV-reported device name (e.g. Nintendo Switch); Live TV under Active; static HDMI 1–4/AV/Component fallback | `app.js:692`–`:788`, `:899` |
| F15 | Launch fallback chain | Installed-first ordering; tries each candidate with a 2.5 s guard; toast after all fail | `app.js:434` |
| F16 | Robust icons | Original URL → `127.0.0.1` host → `http:` → deterministic letter avatar; preserves pin badges | `app.js:790`, `:805`, `:815` |
| F17 | Pairing persistence | `localStorage['prolewebos.ssapKey']`, guarded reads/writes; stale keys re-pair once without asking the page | `app.js:85`, `:617`, `:708` |
| F18 | Remote control | Arrows, Enter/OK, Back/Exit in dock, overlay, manage and picker modes | `app.js:1467` |
| F19 | Toast | Status message with 3.4 s default, `role=status`, `aria-live=polite` | `app.js:1417`, `index.html:23` |
| F20 | Hint footer | Mode-specific key legend; auto-dims after 12 s | `app.js:1427` |
| F21 | Deep links | `{"view":"apps"}` / `"inputs"` / `"manage"` open the matching overlay after 500 ms | `app.js:1528` |
| F22 | Exit | Back/Exit calls `window.close()`, then `PalmSystem.close()` after 120 ms | `app.js:1455` |
| F23 | Motion/accessibility | `prefers-reduced-motion` drops transitions; cursor hidden; ARIA labels and hidden state | `style.css:584`, `app.js` |
| F24 | Performance footprint | No framework, no web fonts, no `backdrop-filter`; inline SVG logos; small local wallpapers | `app/` |
| F25 | Dock management | Manage dock in All apps: add/remove, reorder, two-step reset; max 10; persisted in `localStorage['prolewebos.dock']` | `app.js:1057`–`:1360`, `style.css:504`–`:582` |
| F26 | Wallpaper replacement | `python scripts/set-wallpapers.py <folder>` crops every image to 1920×1080 JPEG, archives the old set, optionally builds/installs/launches | `scripts/set-wallpapers.py` |

Remote key map:

| Key | Dock mode | Overlay mode | Manage dock | Add apps (picker) |
|---|---|---|---|---|
| Left / Right (37/39) | Move dock focus (wraps) | Move focus, wrapping horizontally | Reorder focused dock tile (Left at first / Right at last moves into Actions) | Move focus, wrapping |
| Up / Down (38/40) | Next / previous wallpaper | Move focus by grid columns (clamped) | Jump between dock row and Actions | Move focus by grid columns |
| Enter / OK (13/415) | Activate focused tile | Launch focused item | Unpin tile / run action | Pin or unpin focused app |
| Back / Exit (461/27) | Exit the app | Close the overlay | Return to All apps | Return to Manage dock |

These are **browser keyCodes**. Device-level codes used by root/remapper
research are different (§11.6).

---

## 6. Build and deploy on the TV

### 6.1 One-time prerequisites

1. Developer Mode is on and its key server is running (see `RUNBOOK.md` §2).
2. The device is registered once:

   ```bash
   bash scripts/connect.sh <6-character-passphrase>
   ```

3. The TV is reachable at `LG_TV_HOST` (default `192.168.1.50`). Override with
   an environment variable, do not edit the scripts.
4. Node dependencies are installed (`@webos-tools/cli`, `sharp`).

### 6.2 Normal build/deploy loop

```bash
cd /c/Users/fdear/lg-tv-debloat
bash scripts/package-install.sh
```

What it does (`scripts/package-install.sh`):

1. Sources `scripts/env.sh`.
2. Runs `ares-package app -o packages`.
3. Picks the newest `packages/com.fdear.prolewebos_*.ipk`.
4. Installs it with `ares-install -d tv`.
5. If the direct install fails, removes the old version
   (`ares-install -r com.fdear.prolewebos`) and retries once.
6. Closes any running copy, launches `com.fdear.prolewebos`.
7. Waits 4 s and captures `backup/shots/prolewebos-YYYYmmdd-HHMMSS.jpg`.

A failed screenshot prints a warning; it is not proof the install failed.
Check the foreground app (§7.4) and take another screenshot.

### 6.3 Manual equivalent

```bash
cd /c/Users/fdear/lg-tv-debloat
. scripts/env.sh

node node_modules/@webos-tools/cli/bin/ares-package.js app -o packages
IPK="$(ls -t packages/com.fdear.prolewebos_*.ipk | head -n 1)"
node node_modules/@webos-tools/cli/bin/ares-install.js -d tv "$IPK"
node node_modules/@webos-tools/cli/bin/ares-launch.js -d tv com.fdear.prolewebos
```

Offline manifest check (no TV):

```bash
node node_modules/@webos-tools/cli/bin/ares-package.js -c app
```

`npm test` is the **debloat** self-test (`scripts/selftest.py`), not an app
test suite. It exercises proposal → apply → restore against a fake Luna bus.

### 6.4 Version rules

When changing the app, bump **both**:

- `app/appinfo.json` → `version`
- `app/services/com.fdear.prolewebos.service/package.json` → `version`

`services.json` has no version field. Keeping the two in sync avoids a package
whose service metadata disagrees with the app. Current: **1.4.0**.

### 6.5 Reinstall/uninstall effects

- Reinstalling keeps the app id; `scripts/package-install.sh` handles the
  replace path.
- Uninstalling and reinstalling **clears app storage**, including
  `prolewebos.ssapKey` and the saved dock (`prolewebos.dock`). Expect the TV
  to show the pairing prompt again on the next catalog request; accept it on
  the TV, or let the fallback probe build the list (it is less complete and
  contains no bookmark params). The dock returns to the defaults in
  `app/js/apps.js` until the user edits it again.
- `scripts/restore.sh --remove-app` closes and uninstalls the app as part of
  teardown. It does not uninstall anything else.

### 6.6 Launch and deep-link checks

```bash
# Normal launch
node node_modules/@webos-tools/cli/bin/ares-launch.js -d tv com.fdear.prolewebos

# Open All apps directly (deep link)
node scripts/ssap.js launch com.fdear.prolewebos '{"params":{"view":"apps"}}'

# Open Inputs directly
node scripts/ssap.js launch com.fdear.prolewebos '{"params":{"view":"inputs"}}'

# Open Manage dock directly
node scripts/ssap.js launch com.fdear.prolewebos '{"params":{"view":"manage"}}'
```

### 6.7 Replace wallpapers with your own images

```bash
# crop, archive the previous set, then build + install + launch
python scripts/set-wallpapers.py "C:/path/to/images"

# write files only, no TV deploy
python scripts/set-wallpapers.py "C:/path/to/images" --no-deploy

# raise/lower JPEG quality (default 90)
python scripts/set-wallpapers.py "C:/path/to/images" --quality 95
```

Requirements: Python 3 and Pillow (`pip install pillow`). Every image in the
folder is used, in natural filename order. The manifest is rewritten, so the
next launch shows the new set. Previous files are archived under
`backup/wallpapers/<timestamp>/`.

To go back to the bundled scenes:

```bash
node scripts/gen-wallpapers.js
bash scripts/package-install.sh
```

`gen-wallpapers.js` rewrites the manifest and the 8 SVGs but leaves any
JPEGs produced by `set-wallpapers.py` in `app/wallpapers/`; move them to
`backup/` first if you want a clean folder.

---

## 7. Verify on the TV

A change is not done until it has been observed on the physical TV. The
harness is intentionally layered: DOM truth first, pixels second.

### 7.1 Inspector + CDP

Start the inspector and keep it running:

```bash
node node_modules/@webos-tools/cli/bin/ares-inspect.js -d tv -a com.fdear.prolewebos
```

It prints a proxy port (for example `55706`). The proxy log is
`backup/inspect.log`. If neither `--port` nor `CDP_PORT` is given,
`cdp-eval.js` reads `backup/.inspector-port`; that file is not created by
default, so pass the port explicitly.

Evaluate in the page:

```bash
node scripts/cdp-eval.js --port 55706 'JSON.stringify({
  open: !!document.querySelector("#overlay.open"),
  sub: document.getElementById("overlay-sub").textContent,
  tiles: document.querySelectorAll("#overlay-grid .app-tile").length,
  labels: [...document.querySelectorAll("#overlay-grid .app-label")].map(e => e.textContent),
  focus: [...document.querySelectorAll("#dock .tile")].findIndex(e => e.classList.contains("focused"))
})'
```

`cdp-eval.js` uses `Runtime.evaluate` with `returnByValue`, `awaitPromise` and
`userGesture`, and times out after 10 s. If it prints **"no page target"**, the
app is not running/foreground, or the proxy is stale; relaunch the app and
restart the inspector.

To open All apps during a test without keyboard wiring:

```bash
node scripts/cdp-eval.js --port 55706 'document.querySelector("#dock .tile[data-app=allapps]").click()'
```

### 7.2 Synthetic remote keys

The page listens for `keydown` in the capture phase. Dispatch a real browser
event including `keyCode` and `which`:

```bash
node scripts/cdp-eval.js --port 55706 'window.dispatchEvent(new KeyboardEvent("keydown", {keyCode: 39, which: 39, bubbles: true}))'
```

Use `13`/`415` for Enter/OK, `461`/`27` for Back, `37`–`40` for arrows.
Alternatively send a real key over SSAP:

```bash
node scripts/ssap.js key RIGHT
node scripts/ssap.js key ENTER
node scripts/ssap.js key BACK
```

Caveat: pressing Enter while Settings is focused opens the system popup. Skip
that tile during navigation tests, or use it deliberately and recover (§7.5).

### 7.3 Screenshots, OCR and wake

```bash
bash scripts/screenshot.sh backup/shots/check-home.jpg
```

Screenshots are 960×540 JPEGs from `ssap://tv/executeOneShot`. If the TV is in
the screen saver they come back black. Wake the panel first:

```bash
node scripts/ssap.js request ssap://com.webos.service.tvpower/power/turnOnScreen '{}'
```

OCR helper (Windows):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\fdear\AppData\Local\Temp\ocr2.ps1" -Path "C:\path\shot.jpg"
```

It upscales 3× and raises contrast. OCR is noisy on this TV (brand text can
read as "PROLCWCOOS", small labels garble). Use it for a visual sanity check,
not for exact-string assertions. Use CDP/DOM for exact text.

### 7.4 Foreground and app state

```bash
node scripts/ssap.js foreground
```

Expected during normal use: `com.fdear.prolewebos`. A different app means the app
was exited, backgrounded, or a tile launched something. Settings is the
exception: it can open as a system popup while foreground still reports
prole-webos.

### 7.5 Test pitfalls seen on this TV

- **Settings popup trap.** Enter on the Settings tile opens a layered popup.
  `ares-launch -c com.palm.app.settings` is rejected with "Only Dev app should
  be closed using /dev category_API", and an SSAP Back did not dismiss it.
  Recovery used:
  `ares-launch -d tv youtube.leanback.v4`, then
  `ares-launch -d tv com.fdear.prolewebos`.
- **Black screenshot.** Screen saver/asleep. Wake with `turnOnScreen`, then
  re-capture.
- **Catalog is stale by design.** It is filled at boot. Relaunch before
  asserting a newly installed app or a changed count.
- **Hidden apps are intentional.** Six LG promo/regional entries are hidden by
  the TV and therefore absent. Do not "fix" this without a product decision.
- **Inspector orphan processes.** Stale `ares-inspect`/node processes keep
  ports open. List them with PowerShell
  `Get-CimInstance Win32_Process` and inspect command lines; kill only the
  PIDs you started. Keep the one on the active port.
- **PowerShell quoting.** A PowerShell command wrapped in bash double quotes
  expands `$_`; use single quotes or a script file.
- **Unicode console output.** Python printing arrows to cp1252 fails; set
  `PYTHONIOENCODING=utf-8`.

### 7.6 Definition of done

Before declaring an app change complete:

1. `ares-package -c app` passes.
2. `scripts/package-install.sh` installs and launches; foreground is
   `com.fdear.prolewebos`.
3. CDP assertions confirm the changed DOM (tile count, labels, focus, overlay
   state).
4. Synthetic keys exercise every changed path (dock, overlay, Back, OK).
5. A fresh screenshot is visually checked (and OCR'd if useful).
6. No new console errors or repeated pairing prompts.
7. Inspector/proxy processes started for the test are cleaned up.

---

## 8. Development guardrails

Read these before editing. Each one exists because of a concrete constraint
observed on this TV or a deliberate product decision.

| ID | Rule | Why / how to apply |
|---|---|---|
| G1 | Keep the service ES5 and dependency-free (`net`, `Buffer` fallback only) | Older webOS ships an old Node; ES6 syntax and modern APIs can fail to parse. |
| G2 | Do not widen the service allowlist beyond `listLaunchPoints` and `getExternalInputList` | The service holds a TV client key; it must expose the minimum. Those two calls cover every screen in the app. |
| G3 | Keep `Origin: file://` in the WebSocket handshake | The remote-control API closes connections with any other origin. |
| G4 | Keep `pairingType: 'PROMPT'` and only the permissions the app uses (`READ_INSTALLED_APPS`, `READ_INPUT_DEVICE_LIST`) | Requesting more increases risk and review burden. Adding a permission invalidates existing client keys, so the service must keep the one-shot re-pair path. |
| G5 | Keep the icon host rewrite (`192.168.1.50` → `127.0.0.1`, https → http fallback) | App pages cannot fetch the TV's HTTPS port 3001; letter avatars are the last resort. |
| G6 | Keep filtering `hidden === true` | Hiding LG promo/regional apps is part of the quiet-home intent. Verify with a product decision before changing. |
| G7 | Dedupe on `launchPointId || id` and keep `params` | Bookmarks reuse host app ids but need their own entry and launch params. |
| G8 | Treat the catalog as a boot-time snapshot | Do not promise live refresh. Relaunch the app to see new apps; assert counts dynamically. |
| G9 | Append Settings only if absent; keep both Settings ids | Settings has no visible launch point on this TV, and its id differs across webOS builds. |
| G10 | Repair by exact title, then substring; dim rather than remove | Ids drift across TV models; users should still see their favorite and be able to try it. |
| G11 | Keep installed-first launch ordering and the 2.5 s guard | Some candidate ids resolve slowly or not at all; the chain must move on without hanging. |
| G12 | Bump `appinfo.json` and the service `package.json` together | Mismatch produces confusing package metadata and versioning. |
| G13 | Keep the app id `com.fdear.prolewebos` | 1.4.0 renamed it from `com.fdear.aurora`; that was a deliberate one-time break (new install, storage/pairing not carried over). Changing it again repeats the break. |
| G14 | Never uninstall TV apps or change system settings from prole-webos | This project is reversible and non-root by design. Debloat lives in `scripts/debloat.py`. |
| G15 | Protect the performance budget | No framework, no web fonts, no `backdrop-filter`; inline SVG logos; small local wallpapers. A launcher must paint immediately. |
| G16 | Remote-first interaction | Every actionable element needs a focused style and a key path. Test with synthetic keys, not just clicks. |
| G17 | Respect safe areas and `vw/vh` sizing | Layout is tuned for 1920×1080; the dock sits at 5.6vh from the bottom and the overlay pads 7.5vh/6vw/12vh. Re-check 4K scaling on the TV. |
| G18 | Escape or use `textContent` for every dynamic title | App titles come from the TV; never inject them as raw HTML (see `escapeHtml`/`textContent`). |
| G19 | Be careful with legacy AURORA globals | `AURORA_WALLPAPERS` is generated by `scripts/gen-wallpapers.js` **and** `scripts/set-wallpapers.py`; `AURORA_CONFIG` is a compatibility fallback. Rename both generators and consumers together. |
| G20 | Keep the timers intentional | 1.5 s wallpaper throttle, 2.5 s launch guard, 500 ms deep link, 90 s pairing wait, 12 s hint dim. Changing one affects perceived responsiveness. |
| G21 | Do not auto-navigate in tests | Settings opens a layered popup that can strand the app. Leave that tile alone unless testing it deliberately. |
| G22 | Wrap `localStorage` access in `try/catch` | Storage may be unavailable; the app must still boot and rely on the fallback probe. |
| G23 | Keep `disableBackHistoryAPI` and `handlesRelaunch: false` | The app owns Back/Exit explicitly; browser history/relaunch behavior would fight the key handler. |
| G24 | Verify on the TV, not only in a desktop browser | `webOS.service`, `PalmSystem`, TV icon hosts and key delivery only exist on the TV. |
| G25 | Keep `MAX_DOCK` and the dock store schema in lockstep | `MAX_DOCK` (`app.js:4`) caps both the pinned list and the picker; the store key is `localStorage['prolewebos.dock']`. Entries carry `{key,name,ids,icon,params}` where `params` is always normalized by `normParams()` (`:192`) so `{}` and `null` never create duplicate pins. Change the cap or entry shape in one place only. |
| G26 | Never replace an icon box's children | The pin badge (`✓`) is a child of the same tile element as the icon. `letterIcon()` inserts a text node before `firstChild`; using `textContent` wipes badges when a lazy `<img>` candidate fails after render. |
| G27 | Remember what regenerates wallpapers | `scripts/set-wallpapers.py` archives the old assets to `backup/wallpapers/<timestamp>/` and rewrites `app/js/wallpapers.js`; `scripts/gen-wallpapers.js` re-adds the eight SVG scenes but does **not** delete JPEGs you added, so move those out first when restoring. |
| G28 | Never treat a stored favorite icon as permanent | Launch-point resource hashes rotate; `refreshFavoriteIcon()` must keep re-reading `icon`/`largeIcon` from the current launch points on every catalog pass, or pinned tiles fall back to letter avatars after a relaunch. |
| G29 | Group inputs from the TV's flags, not from names | Active = `connected` or `hdmiSignalExist`; Connected = `hdmiPlugIn` without a signal; Not connected = the rest. Names are display-only (`subList[0].brandName`/`labelName`); deciding state from a name breaks on renamed or newer devices. |
| G30 | **Always ask before pushing** | Once work is finished and verified, ask the user whether to push and whether the target is `main` or a new branch. Wait for the answer; never push, force-push or open a PR unprompted. This applies to agents and humans alike. |

---

## 9. Known limitations and non-goals

1. **LG still owns Home and power-on.** No non-root way to make prole-webos the
   default launcher; pressing Home returns to LG's screen. Rooting does not
   automatically fix this either (§11).
2. **No boot autostart.** The app must be launched from LG's Home, the app
   list, or `ares-launch`.
3. **No live catalog refresh.** The list is captured at boot; relaunch to
   refresh.
4. **Settings is a system popup.** It can overlap the app; foreground may
   still report prole-webos. Do not rely on Back to dismiss it.
5. **No DNS/network settings from the app or Dev Mode.** Network-level
   ad/telemetry blocking is a router/Pi-hole change (`RUNBOOK.md` §7).
6. **Icon coverage is best-effort.** Some TV icon URLs are unreachable from
   the app page, so letter avatars appear. Pinned tiles re-read their icon
   from the live launch points on every catalog load, so a letter avatar now
   means the app is genuinely absent or all candidate URLs failed.
7. **Hidden TV entries stay hidden.** Six LG promo/regional apps are excluded
   by design.
8. **No search or categories in All apps.** The grid is sorted by title and
   scrolls. The dock itself is editable: Manage dock (`all apps → Manage
   dock`, or the `{"view":"manage"}` launch param) adds/removes, reorders
   and resets pinned apps (§4.10).
9. **Wallpaper choice is not persisted.** Every launch starts at wallpaper 0.
10. **Pairing is per install/storage and per permission set.** Clearing app
    data or reinstalling triggers one TV prompt; a key saved before 1.3.1 does
    not cover `READ_INPUT_DEVICE_LIST`, so the first Inputs open after the
    upgrade triggers one extra prompt. Refusing it falls back to the id probe
    (apps) or the static input list (Inputs).
11. **English UI strings.** Date/time follow the TV locale via `Intl`; all
    other labels are hard-coded English.
12. **No background key handling.** Keys work only while prole-webos is the
    foreground page.

---

## 10. Troubleshooting matrix

| Symptom | Likely cause | Fix |
|---|---|---|
| All apps says "Loading installed apps…" forever | Pairing prompt refused/unanswered, service not running, or the probe is still in flight | Accept the prompt on the TV; wait for the probe; check `ares-inspect` console; relaunch |
| All apps says "No apps found" | Service refused and all `getAppLoadStatus` calls failed | Verify the app is installed/launching; check the service log; reinstall |
| All apps shows fewer apps than expected | Boot-time snapshot, hidden entries, or dedupe | Relaunch the app; confirm `hidden` flags; check `launchPointId` duplicates |
| A newly installed app is missing | Catalog captured before install | Relaunch prole-webos |
| Dock tile dim with red dot | No candidate id installed and no title match | Inspect `raw/apps-ssap.json`; edit `app/js/apps.js`; title repair may fix it |
| Letter avatar instead of icon | TV icon URL unreachable from the page | Expected fallback; verify the `127.0.0.1` candidate; accept letter tile if still failing |
| Pinned dock apps lose their icons after relaunch | Saved icon URL used a rotated resource hash | 1.3.1 refreshes it on every catalog load; confirm `refreshFavoriteIcon()` runs from `repairFavorites()` and the launch points include the app (G28) |
| Inputs stuck on "Showing known inputs" | `tv/getExternalInputList` failed or pairing was refused | Accept the TV prompt (it may ask for `READ_INPUT_DEVICE_LIST` once after upgrading from 1.3.0); check the service log; the static list is the fallback |
| Inputs shows a device in the wrong group | TV flags changed while the overlay was open | Close and reopen Inputs (detection runs on open); verify `connected` / `hdmiPlugIn` / `hdmiSignalExist` in the raw response (G29) |
| OK does nothing / wrong app opens | Candidate id mismatch or focus on a popup | Check foreground; verify ids; open the app directly with `ssap.js launch` |
| Back does not exit | Overlay is open (first Back closes it) or key not delivered | Press Back again; confirm the app is foreground; test keyCode 461/27 |
| Settings popup stuck | System popup owns the layer | Launch another app (`youtube.leanback.v4`), then relaunch prole-webos |
| Screenshot is black | Screen saver / panel asleep | `ssap.js request ssap://com.webos.service.tvpower/power/turnOnScreen '{}'` |
| `cdp-eval.js` says "no page target" | App not foreground/running, or stale inspector proxy | Relaunch app; restart `ares-inspect`; use the new port |
| Inspector port already in use | Orphaned `ares-inspect` processes | Inspect command lines, kill only stale PIDs, keep the active one |
| Install fails with a version/close error | Old copy still installed or running | Script removes and retries; manual `ares-install -d tv -r com.fdear.prolewebos` |
| `ares-launch -c <system app>` rejected | Dev app category restriction | Do not close system apps with `-c`; launch another app instead |
| Package build fails | Manifest error or missing asset | `ares-package -c app`; check `appinfo.json` and paths |
| Pairing prompt never appears | Service not started, wrong origin, or TV API refused | Check the service is packaged/running; confirm `Origin: file://`; reinstall |
| TV IP changed | DHCP lease | `export LG_TV_HOST=<new-ip>`; rerun `connect.sh <pass>` |
| Debloat key does not verify | Read-only/unsupported key on this firmware | Leave it; see `changes.json` failures; do not invent keys |
| Pin badges disappear after a few seconds | A lazy icon candidate failed and something rewrote the tile's contents | Keep the `letterIcon` insert-before-`firstChild` pattern (G26); confirm `.pin-badge` is still appended in `renderManage()` |
| "Dock is full — unpin an app first (10 max)." | Ten apps already pinned | Unpin one in Manage dock, then pin the new app |
| Dock changes vanish after relaunch | `localStorage` write failed (unavailable storage) | Check for storage errors in the inspector console; the app falls back to `apps.js` defaults |
| Reset dock did nothing | Reset is two-step: first OK arms 3.2 s | Press OK again within 3.2 s; the toast confirms arming |
| `set-wallpapers.py` exits "Pillow is required" | Pillow not installed in the active Python | `pip install pillow` |
| `set-wallpapers.py` says "no JPG/PNG/WebP/BMP/TIFF images" | Folder empty or only unsupported files | Pass a folder with supported extensions |
| Wallpapers unchanged on the TV after the script ran | Script stopped before deploy (`--no-deploy` or build failure) | Run `bash scripts/package-install.sh`; check the script output |
| Want the original wallpapers back | JPEGs replaced the SVG scenes | Move added JPEGs out of `app/wallpapers/`, run `node scripts/gen-wallpapers.js`, then `bash scripts/package-install.sh` |

---

## 11. Rooting: risks, options, and rollback

> **Status of this project: not rooted.** Everything in this section is
> research from public community sources, collected earlier at your request.
> It was **not** executed against this TV. Treat it as a risk brief, not as a
> tested recipe. Firmware findings go stale; re-verify before acting.

### 11.1 Bottom line

- Non-root webOS exposes **no supported API** to set a default launcher or to
  auto-start a user app at boot. Home and power-on belong to LG's system apps.
- Rooting is only worth it if the goal is **Home-key behavior** or a **full
  Home app takeover**. It is not needed for anything prole-webos currently
  does.
- The safest path remains: install prole-webos as an app, launch it from LG's
  Home or the app list, and accept that Home returns to LG.
- If root is ever taken: prefer the smallest change (Home-key remap) over a
  full Home takeover, and keep a tested way back.

### 11.2 What root would and would not fix

| Goal | Non-root | Rooted |
|---|---|---|
| Launch prole-webos from LG Home/app list | Yes | Yes |
| Make prole-webos the power-on screen | No | Only with a full Home takeover |
| Make the Home key open prole-webos | No | Yes, with a remapper or takeover |
| Keep stock LG Home reachable | Yes | Yes, if remap/hold is configured |
| Avoid warranty/security trade-offs | Yes | No |
| Guaranteed survival across firmware updates | N/A | No |

### 11.3 Exploit and firmware landscape (research findings)

- **SlopBro** was reported to likely work on firmware **33.31.75**, but the
  exact **55QNED75SRA** model was not proven in the sources reviewed.
- **webOS 26** firmware (for example **43.21.84**, published after
  **2026-10-10**) was reported to patch the SlopBro path. Once the TV is on
  that version, this route may be gone.
- There is **no supported downgrade** path. Updating before rooting can
  permanently close the non-hardware route; updating after rooting can remove
  the root/hooks or fail the update.
- Community tooling covers homebrew apps, key remapping and home-app
  replacement, but support is model- and firmware-specific.

### 11.4 Risk register

| ID | Risk | Why it happens | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Permanent brick** | Writing signed/verified system partitions (for example replacing the home app in place) can fail signature checks or leave a partial boot image; there is no consumer recovery | TV unusable; board-level recovery only | Never overwrite `/usr` files; only bind-mount overlays at runtime; verify a USB recovery image first |
| R2 | **Boot-loop failsafe opens telnet root** | A failed boot can start a recovery/failsafe service with unauthenticated root telnet | Anyone on the LAN can get root; further damage | Isolate the TV on a trusted VLAN/guest network; do not leave it in a boot loop; reflash |
| R3 | **OTA update removes root or breaks boot** | Firmware updates overwrite root hooks/home overlays and may fail on a modified system | Lose the launcher/root; possible boot loop | Disable auto-update, block update domains, do not accept webOS 26 while relying on root, keep undo steps |
| R4 | **Telnet/SSH exposure** | Telnet root commonly has no password; SSH commonly ships a default `alpine` account/password; services listen on the LAN | Remote root compromise | No port forwarding; firewall/VLAN; change or disable accounts; remove telnet |
| R5 | **System instability** | `sam` restarts, CRIU checkpoint/restore, voice recognition, CEC and Quick Start depend on stock services; modified services can loop or be disabled | Crashes, broken voice/CEC, wake problems | Change one thing at a time; test cold boot and standby wake; keep logs; revert |
| R6 | **Developer Mode conflict** | The Developer Mode app conflicts with rooted homebrew/Home takeover; it must be uninstalled before root and not reinstalled while rooted | Lose the ares/SSH workflow; conflicts or boot issues | Finish app installs first, back up, uninstall Dev Mode as part of the root plan, use the root shell |
| R7 | **Warranty/support** | Rooting and system modification are unsupported | Warranty void; LG may refuse repair | Accept the trade-off; keep the stock path documented |
| R8 | **DRM failures** | Netflix/Widevine and similar may refuse rooted or modified systems; unproven on this model | Streaming apps fail | Test a DRM app immediately after root; keep stock libraries; be ready to revert |
| R9 | **No downgrade / version lock** | webOS 26 patches the exploit; firmware cannot be rolled back by the user | Root route permanently closed after update | Confirm the exact firmware first; disable updates; do not update "just in case" |
| R10 | **Hardware root damage** | eMMC/UART/SWD access requires opening the TV and writing low-level storage | Destroyed board | Avoid; professional-only if ever attempted |
| R11 | **Launcher takeover bugs** | Boot can land on the last input, standby wake may not run `init.d`, home-app updates can overwrite the overlay | Home/power-on not as intended; recovery needed | Test cold boot, standby and wake; keep a way back to stock Home; retain root shell access |
| R12 | **Security posture** | Root, an unauthenticated service and a frozen firmware increase attack surface; blocking updates also blocks security fixes | Compromise/data exposure over time | Network isolation, minimal services, monitoring; acknowledge the update trade-off |
| R13 | **This repo cannot undo root** | `scripts/restore.sh` restores TV settings only; it knows nothing about mounts, `init.d` or remapped keys | False confidence after a failed experiment | Keep a separate, tested root undo procedure (§11.8) |

### 11.5 Takeover options

| Option | What it does | Root? | Risk level | Recovery |
|---|---|---|---|---|
| **T0. Stay non-root (current)** | prole-webos is an app; LG Home owns Home/power-on | No | None | Nothing to undo |
| **T1. Home-key remap** | A root remapper changes what Home does: tap opens prole-webos, hold opens stock Home (HomeBack-style), or Input Hook intercepts home-related key codes | Yes | Medium | Remove the remapper app/service and reboot |
| **T2. Full Home app takeover** | Bind-mount a replacement over `/usr/palm/applications/com.webos.app.home`, re-establish at boot via `init.d`; possibly combined with `sam`/after-sam hooks and Home Style Basic | Yes | High | Unmount/remove the boot hook and reboot; reflash if boot fails |
| **T3. Kiosk mode** | Use kiosk/enterprise-style launcher behavior where the firmware exposes it | Usually no | Low–medium | Disable kiosk settings |
| **T4. App-owned input polling** | A privileged/LunaService app reads `/dev/input/event*` for Home presses and reacts | Root/privilege | Medium–high | Remove the app/service |

Reported details from the research (verify on this firmware before relying):

- **HomeBack**: tap/hold behavior for the Home key, commonly used to keep
  stock Home on a long press while a custom launcher opens on tap.
- **Input Hook**: intercepts device-level key codes; the research mentioned
  codes **773/774/125** for home-related events. These are device-level, not
  the browser `461`/`27` seen by `app.js`.
- **`init.d`**: boot-time scripts. Reported caveat: standby **wake** may not
  run them, so a takeover can be correct on cold boot and wrong after resume.
- **`sam` / after-sam**: the system app manager and its post-start hook. They
  can relaunch a replacement after `sam` restarts, but a bad hook can cause
  restart loops; CRIU checkpoint/restore can also interact badly.
- **Bind mount**: overlays the read-only home app without writing the
  partition, but must be re-established every boot and can be lost on update.
- **Boot-to-input bug**: some takeovers boot to the last input instead of the
  Home app; a startup script may be needed to switch back.
- **Home Style Basic**: a home-app presentation option referenced in the
  research as part of a takeover; confirm availability per firmware.

### 11.6 Mechanisms referenced

- **No default-launcher API**: webOS does not expose a setting that says
  "launch this user app on Home/power-on". prole-webos cannot become Home by
  configuration alone.
- **Home key ownership**: the system handles Home before app key events. A
  root remapper or input hook is required to change that.
- **Demo/kiosk modes** exist on some builds but are limited and not equivalent
  to a general-purpose replacement launcher.
- **Persistence**: boot hooks (`init.d`, bind mounts, remappers) are the only
  way to survive reboot; each has firmware-update and standby-wake caveats.

### 11.7 Pre-root checklist

Do not start until every item is true:

1. The exact **model and firmware** are confirmed supported by a current
   community report (not just "same firmware family").
2. The goal is explicit: Home-key remap (T1) or full takeover (T2/T4). Prefer
   the smallest change.
3. A current TV backup exists (`bash scripts/backup.sh`) and
   `backup/<date>/changes.json` is understood; `scripts/restore.sh` still
   works.
4. A **USB firmware recovery image** for this exact model is downloaded and
   the recovery procedure is written down. Verify it exists before starting,
   not after a failure.
5. The TV is on an isolated/trusted network, with no port forwarding and no
   guest-device access to telnet/SSH.
6. Auto-update is disabled or update domains are blocked; the plan for webOS
   26 is explicit ("do not update").
7. Developer Mode app is uninstalled **before** rooting (conflict), and the
   root shell method is confirmed working.
8. DRM apps (Netflix, etc.) have been tested and a revert is planned if they
   fail.
9. Every undo step in §11.8 has been read and is possible with the access you
   will have after root.
10. The warranty/support trade-off is accepted.

### 11.8 Rollback / removal

1. **Remapper (T1):** remove the remapper app/service, reboot, confirm Home
   returns to stock.
2. **Home takeover (T2):** via the root shell, remove the `init.d` boot hook,
   unmount the bind mount, restore/verify the stock home app, reboot. Keep the
   stock path reachable before rebooting.
3. **Input polling (T4):** remove the service/app and reboot.
4. **Boot failure:** use the isolated network only; try the failsafe/root
   shell to undo the last change; otherwise use the prepared USB recovery
   image. Do not expose telnet to an untrusted LAN.
5. **Return to normal:** confirm stock Home/power-on, remove root tooling,
   then reinstall Developer Mode if the ares workflow is wanted again.
6. **Remember:** `scripts/restore.sh` does **not** undo root, mounts or key
   remaps. It only restores the TV settings recorded in `changes.json`.

### 11.9 Re-verify before acting

The findings above came from public community documentation and project
pages. Do not trust a stale summary for a one-way operation. Re-check the
current state of these topics before touching the TV:

- `SlopBro` webOS exploit support by model/firmware
- webOS 26 / firmware 43.21.84 and later patch status
- `HomeBack` and `Input Hook` current releases and supported models
- webOS home-app bind mount + `init.d` takeover reports
- `sam` / after-sam hook behavior and CRIU issues
- LG firmware downgrade/recovery options for the 55QNED75SRA

### 11.10 Decision log

- **2026-11-03:** stay non-root. prole-webos remains an installed app; LG owns
  Home and power-on. No root changes were made. Revisit only if the Home-key
  requirement becomes explicit, and then start from §11.7.

---

## 12. Change log

| Version | Change |
|---|---|
| 1.0.0 | Initial "Aurora" web app: dock, wallpapers, clock, remote navigation |
| 1.2.0 | Renamed the app to **ProleWebOS** (now `prole-webos`); added Settings and Inputs utilities; added the All-apps overlay including the native store; bundled Luna service catalog; fallback id probe; title-based id repair; icon host rewrite and letter avatars; deep links; hint/toast polish; service version aligned |
| 1.3.0 | Dock is configurable in-app: Manage dock (`{"view":"manage"}` launch param) adds/removes apps, reorders with Left/Right, resets to defaults (two-step); pin badges in the Add-apps picker; cap raised to 10 with a full-dock toast; fixed badges being wiped by letter-avatar fallback. New `scripts/set-wallpapers.py` replaces TV wallpapers from a folder (center-crop 1920×1080 JPEG, archives old assets, builds/installs/launches) |
| 1.3.1 | Pinned dock icons re-resolve from the live launch points on every catalog load, so they survive relaunches (stale resource hashes no longer strand tiles on letter avatars). Inputs are detected automatically on open with `tv/getExternalInputList` (service allowlist + `READ_INPUT_DEVICE_LIST`, one-shot re-pair for older keys), grouped Active / Connected / Not connected, and labelled with the TV-reported device name (e.g. Nintendo Switch on HDMI 1); the static HDMI/AV/Component list remains the fallback |
| 1.3.2 | RetroArch (`com.retroarch.webos`) added as the eighth default dock tile; existing saved docks keep their layout and can pin it from Manage dock. No app-code changes beyond `app/js/apps.js` |
| 1.4.0 | Renamed the project and app to **prole-webos**: app id `com.fdear.aurora` → `com.fdear.prolewebos`, service id/dir → `com.fdear.prolewebos.service`, npm package `lg-tv-debloat` → `prole-webos`, display title/DOM title/brand → `prole-webos`, splash text redrawn from "Aurora" to "prole-webos", build/restore/CDP scripts and docs updated. Installs as a new app; old storage and pairing do not carry over |

The repo does not contain a separate 1.1.0 changelog entry; do not invent one.
Current package and service versions are both **1.4.0**.

---

## 13. Command cheatsheet

```bash
# --- environment ---
export LG_TV_HOST=192.168.1.50
export LG_TV_PORT=9922
export LG_TV_USER=prisoner
export LG_DEVICE=tv

# --- one-time / recovery ---
bash scripts/connect.sh <passphrase>
node scripts/scan.js
bash scripts/backup.sh

# --- build / deploy ---
node node_modules/@webos-tools/cli/bin/ares-package.js -c app
bash scripts/package-install.sh
node node_modules/@webos-tools/cli/bin/ares-launch.js -d tv com.fdear.prolewebos

# --- TV control ---
node scripts/ssap.js foreground
node scripts/ssap.js key BACK
node scripts/ssap.js screenshot backup/shots/x.jpg
bash scripts/screenshot.sh backup/shots/x.jpg
node scripts/ssap.js request ssap://com.webos.service.tvpower/power/turnOnScreen '{}'
node scripts/ssap.js launch com.fdear.prolewebos '{"params":{"view":"apps"}}'
node scripts/ssap.js launch com.fdear.prolewebos '{"params":{"view":"manage"}}'

# --- wallpapers ---
python scripts/set-wallpapers.py path/to/images
python scripts/set-wallpapers.py path/to/images --no-deploy
python scripts/set-wallpapers.py path/to/images --quality 85
node scripts/gen-wallpapers.js          # regenerate the eight original SVG scenes

# --- live debugging ---
node node_modules/@webos-tools/cli/bin/ares-inspect.js -d tv -a com.fdear.prolewebos
node scripts/cdp-eval.js --port <port> 'JSON.stringify({...})'

# --- git: only run after the user answers the push question (G30) ---
git status
git add -A
git commit -m "…"
git push origin main            # only if the user chose main
git switch -c <branch>          # only if the user chose a new branch
git push -u origin <branch>

# --- debloat (separate concern) ---
python scripts/debloat.py
python scripts/debloat.py --apply
bash scripts/restore.sh --dry-run
bash scripts/restore.sh
npm test
```

---

## 14. Search index

| Term / question | Section |
|---|---|
| What is installed, current version, tile count | §1 |
| App id, TV model, firmware, IPs, Dev Mode user | §2 |
| Where does each file live | §3 |
| Why is there a Luna service; how does the catalog work | §4.2–§4.3 |
| `listLaunchPoints`, `getExternalInputList`, `clientKey`, `PROMPT`, `READ_INSTALLED_APPS`, `READ_INPUT_DEVICE_LIST`, `Origin: file://`, stale-key re-pair | §4.2–§4.3 |
| `getAppLoadStatus` fallback, known ids, input ids | §4.3 |
| Hidden apps, dedupe, bookmarks, launch params | §4.3, G6–G7 |
| Why letter icons; `127.0.0.1` icon rewrite | §4.5, G5 |
| Overlay grids, focus, wrap/clamp, scroll | §4.6 |
| Settings tile; layered popup; recovery | §4.7, §7.5, §10 |
| Inputs detection, grouping (Active / Connected / Not connected), dynamic device names, fallback list | §4.8, G29 |
| Pinned dock icons lose their artwork after relaunch | §4.3, §4.5, G28 |
| Deep link `view:apps` / `view:inputs` / `view:manage` | §4.9 |
| Dock configuration, `MAX_DOCK`, `prolewebos.dock`, `normParams`, `favoriteKey` | §4.10, G25 |
| Manage dock views/controls, pin badges, full-dock toast, reset | §4.10, §10 |
| Pin badges missing after icon fallback | G26, §10 |
| Replace TV wallpapers from a folder; crop/quality; archive; restore SVGs | §4.11, §6.7, §10, G27 |
| Every feature implemented | §5 |
| Remote key codes 13/27/37–40/415/461 | §5 |
| How to build/install/launch | §6 |
| Version bump locations | §6.4 |
| Uninstall clears pairing key | §6.5 |
| Inspector, CDP, `cdp-eval.js`, proxy port | §7.1 |
| Synthetic keys, `KeyboardEvent` | §7.2 |
| Screenshots, OCR `ocr2.ps1`, black screen, `turnOnScreen` | §7.3 |
| Foreground query | §7.4 |
| Test hazards (Settings popup, stale catalog, orphan inspectors) | §7.5 |
| Definition of done | §7.6 |
| Rules before editing (performance, ES5, app id, hidden apps, timers) | §8 |
| What the app cannot do | §9 |
| Symptom → fix | §10 |
| Root risks, brick, telnet, DRM, updates, warranty | §11.4 |
| SlopBro, firmware 33.31.75, webOS 26 43.21.84 | §11.3 |
| HomeBack, Input Hook, 773/774/125, bind mount, `init.d`, `sam`, kiosk | §11.5–§11.6 |
| Pre-root checklist and rollback | §11.7–§11.8 |
| Version history | §12 |
| Copy-paste commands, git push flow | §13 |
| Should I push? Main or a new branch? | §0 callout, G30 |
