# LG QNED75SRA — debloat + prole-webos runbook

Everything here is **reversible and non-root**. Nothing is uninstalled, no
firmware is modified, and every setting change is recorded in
`backup/<timestamp>/changes.json` so `scripts/restore.sh` can put it back.

**What this cannot do:** replace LG's system launcher. On a non-rooted webOS
TV, pressing **Home** always returns to LG's home screen. prole-webos is an
installed app with its own dock and wallpapers; launching it gives you the
Apple-TV-style screen, but it is not the power-on screen. Root on webOS 10
(2025 QNED) is not available, so that limitation is accepted by design.

> **Agent rule — always ask before pushing.** When work is finished and
> verified, ask the user whether to push the changes and whether the target is
> `main` or a new branch. Never push, force-push or open a pull request
> without an explicit answer. Full detail: `PROLEWEBOS.md` G30.

---

## 0. What is in this repo

| Path | Purpose |
|---|---|
| `scripts/scan.js` | Find the TV's IP by TCP-scanning the LAN |
| `scripts/connect.sh` | Register the TV once Developer Mode is on |
| `scripts/backup.sh` | Dump settings/apps/device info + screenshots |
| `scripts/debloat.py` | Build a proposal (dry run) and apply it with `--apply` |
| `scripts/restore.py` | Put every changed setting back |
| `scripts/package-install.sh` | Build, install, launch prole-webos, screenshot |
| `scripts/set-wallpapers.py` | Replace prole-webos wallpapers with every image in a folder (crop 1920×1080 JPEG, archive the old set, deploy) |
| `scripts/gen-wallpapers.js` | Regenerate the original eight SVG wallpaper scenes |
| `scripts/screenshot.sh` | Capture the TV screen to a local JPG |
| `scripts/tv.sh` | Run a shell command on the TV |
| `app/` | prole-webos (web app, `com.fdear.prolewebos`) |
| `packages/` | Built prole-webos IPKs plus the saved RetroArch 1.22.2 ARM IPK |
| `blocklist/` | DNS ad/telemetry domains for your router or Pi-hole |
| `backup/` | Every backup, proposal, change log and screenshot |
| `PROLEWEBOS.md` | Resume-here reference: app architecture, features, build/deploy/verify loop, guardrails, rooting risks |

All scripts read `scripts/env.sh`. Override the TV address without editing
files:

```bash
export LG_TV_HOST=192.168.1.50
export LG_TV_PORT=9922
export LG_TV_USER=prisoner
export LG_DEVICE=tv
```

On Windows, run these from **Git Bash**.

Offline checks (no TV needed):

```bash
npm test                        # fake Luna bus: proposal -> apply -> restore
node node_modules/@webos-tools/cli/bin/ares-package.js -c app   # manifest check
```

`preview/` holds local PNGs of the eight wallpapers, the splash and the icon,
rasterized with sharp for a quick look before installing.

---

## 1. Find the TV

```bash
node scripts/scan.js          # e.g. 3000/3001/9080/8009/8008 => 192.168.1.50
```

Already confirmed: **192.168.1.50** (LG TV, 2025, Linux 5.4, UUID
`LGTV20233=31002481304`).

If the IP changes, set `LG_TV_HOST` and re-run.

---

## 2. Enable Developer Mode (on the TV, once)

Developer Mode expires after **1000 hours** (about 41 days). It can be
renewed from the same app before it expires.

1. On the TV: **LG Content Store → Apps → search “Developer Mode” → Install**.
2. Open **Developer Mode**. Sign in with (or create) an **LG developer
   account** — this is a separate LG account type; a normal LG TV account
   will not work.
3. Toggle **Dev Mode Status → ON**, accept the notice, and let the TV reboot
   if it asks.
4. Re-open **Developer Mode → Start Key Server**. Leave this panel open;
   it shows the SSH details and a **6-character passphrase**.
5. Make sure the TV and this computer are on the **same Wi-Fi/LAN**.

---

## 3. Connect

```bash
bash scripts/connect.sh <passphrase>
```

- Checks ports **9922** (SSH) and **9991** (key server) first.
- Registers the device `tv` in `~/.webos/tv` (ares device profile).
- Downloads the TV's SSH key into `~/.ssh/`.
- Verifies with `ares-device -i`, `uname -a`, and the foreground app query.

If it fails, see **Troubleshooting**.

---

## 4. Back up (do this first, every time)

```bash
bash scripts/backup.sh
```

Writes `backup/<YYYYmmdd-HHMMSS>/`:

- `raw/prefs/` — every settings file from `/var/luna/preferences`
  (`general option other picture sound caption channel environmentCondition
  hotelMode lgchannels localeInfo network soundbar time timezone twinTv
  systemprefs.db`), plus `settings.json` with all JSON categories parsed
- `raw/apps-ssap.json`, `raw/launchpoints.json` — every installed app and
  every launcher entry, as the TV reports them
- `raw/systeminfo.json` — model / firmware / board (SSAP does not expose
  `tv.systemproperty/getSystemInfo` on this firmware, so it is derived from
  `ares-device`)
- `raw/foreground.json` — the foreground app at snapshot time
- `device-info.txt`, `apps-full.txt` — CLI snapshots (`apps-full` lists only
  user-installed apps; the full system list is in `apps-ssap.json`)
- `screens/00-home.jpg` — baseline screenshot
- `backup/latest.txt` — pointer used by the other scripts

The backup is plain text/JSON; it is safe to keep and diff. The settings
store is read over the Dev Mode shell as `prisoner` (the files are
world-readable), so this works without root.

---

## 5. Debloat

### 5.1 Review the proposal (writes nothing)

```bash
python scripts/debloat.py
```

Read the table it prints and **`backup/<timestamp>/debloat-proposal.json`**.
It records:

1. `proposals` — exact `(category, key)` pairs that would change, with
   `current`, `after`, `before` and a plain-English label.
2. `already` — keys already at the target value (no write).
3. `missing` — rules whose key is absent from this firmware's baseline;
   skipped rather than invented, so a different firmware profile cannot be
   bricked.
4. `assertions` — privacy keys that should already be off; checked and
   reported if a firmware update flips one back, never written.

Rules are exact key names observed in the pristine baseline, not fuzzy
matching. Nothing is uninstalled and no app is disabled.

### 5.2 Apply

```bash
python scripts/debloat.py --apply
```

- Takes `screens/10-before-debloat.jpg` and `11-after-debloat.jpg`.
- Writes each category through **SSAP** (`scripts/ssap.js settings-set`).
  The write path is an alert whose `onclose` target is LG's internal
  `setSystemSettings` Luna call — the same non-root channel the official LG
  remote app uses. It does not need root or `luna-send`.
- After all writes, **re-reads `/var/luna/preferences` from disk** and
  compares every changed key. The store is the authority; SSAP's own read
  adapter exposes only a handful of keys.
- Writes `changes.json` (earliest `before`, `after`, `stored`, `verified`)
  and merges with earlier runs so restore always has the original value.
- The summary prints `applied / failed / verified`.

### 5.3 What the rules target

Applied on this TV (all verified from the on-disk store):

- `option.livePlus` → off — ACR / viewing-data collection
- `option.livePromotion`, `option.webOSPromotionVideo` → off — promo rails
- `option.channelplus` → off — LG Channels ad row
- `option.thirdPartyCookie` → off — ad/analytics cookies
- `option.dbgLogUpload` → false — diagnostic upload
- `general.lmt` → on, `general.adCookie` → off,
  `general.doNotSellMyPersonalInformation` → on — ad tracking
- `general.homeAutoLaunch` → off — promoted app self-launch
- `option.quickStartMode` → on — see the trade-off below

Assertions (checked, already privacy-safe, never written): promotion
streamer/popup, home promotion, customised ads, screen-saver ads, absence
recognition and the AI nudges/channel, AVMSD ad detection, content
recommendations.

Voice control and Cast/AirPlay are left enabled, per your choices.

**Quick Start+ trade-off:** it keeps the SoC warm in standby so power-on and
the launcher are noticeably faster, at the cost of a few watts when the TV is
"off". To turn it off after the fact, set `option.quickStartMode` to `off`
(or run the restore) — everything else stays as is.

### 5.4 If something breaks

```bash
bash scripts/restore.sh                # latest backup
bash scripts/restore.sh backup/2026…   # a specific backup
```

It restores only the `before` values recorded in `changes.json`, verifies
booleans, and writes `restore-log.json`. It never installs anything.

Extra flags:

```bash
bash scripts/restore.sh --dry-run      # print the plan, write nothing
bash scripts/restore.sh --full         # re-apply every saved key (not just changed ones)
bash scripts/restore.sh --remove-app   # also close + uninstall prole-webos
```

---

## 6. Install prole-webos

```bash
bash scripts/package-install.sh
```

- `ares-package app -o packages`
- Installs the newest `packages/*.ipk`; if that fails, removes the previous
  version and retries once.
- Closes any running copy, launches `com.fdear.prolewebos`, waits 4 s.
- Saves a screenshot to `backup/shots/prolewebos-<timestamp>.jpg`.

Controls:

| Key | Action |
|---|---|
| Left / Right | Move the dock focus |
| Enter / OK | Launch the focused app |
| Up / Down | Next / previous wallpaper |
| Back / Exit | Leave prole-webos |

The dock adapts: an app not installed on the TV is dimmed but still tries
common package IDs. Rotating nature wallpapers crossfade every 30 s.

To launch later: **Home → Apps → prole-webos**, or
`node node_modules/@webos-tools/cli/bin/ares-launch.js -d tv com.fdear.prolewebos`.

### 6.1 Configure the dock

The dock is editable from inside the app: **All apps → Manage dock**
(or deep link `{"params":{"view":"manage"}}`).

| Key | Action |
|---|---|
| Left / Right on a dock tile | Reorder the pinned app |
| OK on a dock tile | Unpin that app |
| Up / Down | Move between the dock and the Actions row |
| Left / Right / Up / Down in the picker | Move focus across the app grid |
| OK on a picker tile | Pin / unpin (a `✓` badge shows pinned apps) |
| Actions | **Add apps**, **Reset dock**, **Done** |
| Back | Picker → Manage dock → All apps → exit |

Up to **10** apps can be pinned; a full dock shows "Dock is full — unpin an
app first (10 max)." **Reset dock** requires two Oks (3.2 s window) and
restores the eight defaults (the seven streaming apps plus RetroArch). The configuration is stored in
`localStorage['prolewebos.dock']`, so it survives relaunch; clearing app data
or reinstalling returns to the defaults in `app/js/apps.js`.

Pinned tiles keep their icons across relaunches: the TV serves launch-point
icons from `http://127.0.0.1:3000/resources/<hash>/…`, and that hash changes
when the TV restarts, so the app re-reads the icon URL for every pinned app
each time the catalog loads. If a pinned tile still shows a letter, the TV no
longer offers an icon for it at all.

### 6.2 Use the Inputs screen

**All apps → Inputs** (or deep link `{"params":{"view":"inputs"}}`) asks the
TV for its external inputs (`tv/getExternalInputList`) every time the screen
opens, then groups them:

| Group | Meaning |
|---|---|
| Active | Connected or reporting a signal — what is on right now |
| Connected | Plugged in but no signal (e.g. a console in standby) |
| Not connected | Nothing plugged into that port |

Tiles use the name the TV reports for the device (a Switch on HDMI 1 shows as
"Nintendo Switch", with the port as a small sub-label), not just the port
name. **Live TV** is always listed first under Active. Empty groups are
hidden; Up/Down moves between groups, Left/Right within a group, OK launches
the source and Back closes the screen.

The first time, the TV shows a permission prompt for the input list; accept
it. If detection fails or the prompt is dismissed, the screen falls back to
the static HDMI/AV/Component list instead of going blank — reopen it after
accepting the prompt.

### 6.3 Use your own wallpapers

```bash
pip install pillow                                  # once
python scripts/set-wallpapers.py "C:/path/to/images"
python scripts/set-wallpapers.py "C:/path/to/images" --no-deploy   # write only
python scripts/set-wallpapers.py "C:/path/to/images" --quality 85  # JPEG quality
```

Every JPG/PNG/WebP/BMP/TIFF in the folder is center-cropped to 1920×1080,
saved as a JPEG, and replaces the bundled scenes. The previous assets and
manifest are archived to `backup/wallpapers/<timestamp>/`. By default the
script then runs `package-install.sh` (build, install, launch).

Restore the originals: move any added JPEGs out of `app/wallpapers/`, run
`node scripts/gen-wallpapers.js`, then `bash scripts/package-install.sh`.
`gen-wallpapers.js` re-adds the SVGs but does not delete added JPEGs.

### 6.4 RetroArch and USB game content

RetroArch is installed as its own TV app (`com.retroarch.webos`), separate from
prole-webos. This TV is **not rooted**, and none of the old root-only steps are
needed: RetroArch 1.22.2 reads external USB storage directly.

Installed build: **webosbrew RetroArch 1.22.2 GLES3 ARM (armv7)**. Keep the IPK
at `packages/com.retroarch.webos.gles3_1.22.2_arm.ipk`. The 64-bit userspace is
not present on this TV, so use the ARMv7 build, not aarch64.

```bash
# reinstall from the saved IPK
node node_modules/@webos-tools/cli/bin/ares-install.js -d tv packages/com.retroarch.webos.gles3_1.22.2_arm.ipk
# launch
node node_modules/@webos-tools/cli/bin/ares-launch.js -d tv com.retroarch.webos
```

In prole-webos, RetroArch appears in **All apps** automatically because it is a
launch point. It is also one of the eight default dock tiles for a fresh or
reset dock; an existing saved dock keeps its own layout, so pin it from
**All apps → Manage dock → Add apps** if it is not there yet.

#### First-run setup (on the TV)

1. **Settings → Online Updater → Update Assets** — menu fonts and icons. Do this
   first; without assets the menu can look blank.
2. **Update Core Info Files** and **Update Controller Profiles**.
3. **Load Core → Download a Core** for the systems you want.

ARMv7 cores available for the requested systems:

| System | Core | Notes |
|---|---|---|
| NES | Mesen or FCEUmm | Either is fine; Mesen is more accurate |
| SNES | Snes9x | `snes9x2010` is lighter if frames drop |
| Genesis / Mega Drive | Genesis Plus GX | Also covers Master System / Game Gear |
| GBA / GBC | mGBA | Gambatte is a lighter Game Boy alternative |
| NDS | melonDS or DeSmuME | Expect slow performance on the TV SoC |
| N64 | Mupen64Plus-Next (GLES3) | Use the GLES3 build; compatibility varies per game |
| PS1 | PCSX-ReARMed | Fastest; Beetle PSX is more accurate but heavier |
| Dreamcast | Flycast | Playable on simpler titles |
| PSP | PPSSPP | Performance varies widely |

**GameCube and PS2 are not available in the ARMv7 core set.** The aarch64
collection has Dolphin, PCSX2 and Cemu, but using it requires the experimental
`webos-bridge-64to32` IPK and a separate aarch64 RetroArch. That path is not
installed here: the TV's 32-bit userspace, the extra bridge, and the TV SoC
make GameCube/PS2 performance unlikely to be usable. Treat it as an experiment,
not part of this setup.

#### Xbox controller

Pair it with the TV first: **Settings → Connection → Bluetooth Device List**
(or the TV's Gamepad/Bluetooth accessory screen), put the Xbox controller in
pairing mode (hold the pair button until the Xbox logo flashes), and select it.
Then in RetroArch open **Settings → Input → Input User 1 Binds** and use
**Set All** if the buttons are not mapped automatically. Restart RetroArch
after the TV reports the controller connected.

#### USB stick

- Format **FAT32** (MBR, not exFAT/NTFS — those do not mount for apps).
- Create one folder per system, e.g. `nes/`, `snes/`, `genesis/`, `psx/`.
- Plug it into the TV, then power-cycle the TV so the mount is created before
  RetroArch starts. The TV mounts it at `/tmp/usb/sda/sda1/`.
- In RetroArch: **Load Content**, then open **`/tmp/usb`** (1.22.2 lists it
  automatically) and browse to the ROM/ISO.

Saves, states and config stay in the app's internal `.config/retroarch`; a USB
stick is only needed for content. Internal storage free space is small
(~120 MB), so keep ISOs and large ROM sets on the stick.

Uninstall only if you no longer want the emulator (this does not touch
prole-webos):

```bash
node node_modules/@webos-tools/cli/bin/ares-install.js -d tv --remove com.retroarch.webos
```

---

## 7. DNS ad blocking (system-level ads/ACR)

TV settings alone do not stop every ad endpoint. **This TV's DNS cannot be
changed by this tool:** `connectionmanager/setdns` is not reachable from the
Dev Mode shell, an SSAP alert, or `luna-send-pub` (all return 401/404/500),
so there is no non-root way to write the TV's resolver setting. Set it on
the TV only through the on-screen menu if your firmware exposes it:
**Settings → Network → Wi-Fi Connection → Advanced Wi-Fi Settings → Edit
DNS** (AdGuard: `94.140.14.14` / `94.140.15.15`). The reliable route is
network-level filtering — add `blocklist/lg-ads-telemetry.txt` to one of:

- **Router** that supports a custom block list / DNS filter
- **Pi-hole** → *Group Management → Adlists* → add the file (serve it on
  your LAN or paste the domains)
- **AdGuard Home** → *Filters → DNS blocklists → Add blocklist → Custom*
- **NextDNS** → *Privacy → Blocklists → Add* (paste the domains)

The list deliberately keeps `lgappstv.com`, `lge.com` and the streaming
domains working. Apply it **after** finishing app installs if you want to
avoid any chance of a store update being blocked.

Test from a LAN device: `nslookup us.lgtvsdp.com <router-ip>` should return
`0.0.0.0` (or NXDOMAIN).

---

## 8. Verify (screenshots each step)

```bash
bash scripts/screenshot.sh backup/shots/check-home.jpg
```

Expected screenshots in `backup/<timestamp>/`:

| File | When |
|---|---|
| `screens/00-home.jpg` | after backup |
| `screens/10-before-debloat.jpg` | debloat start |
| `screens/11-after-debloat.jpg` | debloat end |
| `screens/20-before-restore.jpg`, `21-after-restore.jpg` | restore |
| `screens/30-prolewebos-launch.jpg` | prole-webos install/launch |
| `screens/31..33-*` | wallpaper rotation proof |

Screenshots are 960×540 JPEGs from `ssap://tv/executeOneShot`. If the TV is
in screen saver they come back black; wake the panel first with
`node scripts/ssap.js request ssap://com.webos.service.tvpower/power/turnOnScreen '{}'`.

A missing screenshot is a failed step, not a warning — re-run it and fix
the cause (usually Dev Mode off or the TV asleep).

---

## 9. Dev Mode expiry and teardown

- Dev Mode lasts **1000 hours**. When it expires, SSH stops; the TV keeps
  working normally and all debloat settings remain.
- To renew: open **Developer Mode** on the TV and extend the session.
- To remove everything:
  1. `bash scripts/restore.sh --remove-app`
  2. Turn **Dev Mode Status → OFF** and uninstall the Developer Mode app.
  3. Remove the blocklist from your router/Pi-hole.
  4. Optional: delete `~/.webos/tv`, `~/.ssh/tv_webos` and `backup/`.

The TV's own settings are back to the pre-debloat state after step 1; the
TV never had anything uninstalled by this project except prole-webos itself.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `port 9922 closed` | Developer Mode off, key server not started, or different LAN. Re-open Developer Mode and press **Start Key Server**; check `LG_TV_HOST`. |
| `port 9991 closed` | Key server not running. Same fix. |
| `getkey` returns 401/403 | Wrong/expired passphrase. Re-read the 6 characters on the TV; regenerate if needed. |
| `ares-device` times out | TV asleep or on another VLAN/guest network. Wake it with the remote; disable AP/client isolation. |
| Screenshot fails | Capture service refused; wake the TV, open any app, re-run. If it still fails, Dev Mode may have expired. |
| `settings-set` exits non-zero / a key does not verify | The key is read-only or not settable in that category, or SSAP rejected the alert. It is logged in `changes.json` failures — leave it; the rest still applies. |
| SSAP returns `404 no such service or method` | That service is not in the Dev Mode client's ACL (e.g. `tv.systemproperty/getSystemInfo`). Use `ares-device -i` / `ssap apps` instead. |
| App installs but won't launch | Check `appinfo.json` id and `ares-launch -d tv -c com.fdear.prolewebos`; re-run `package-install.sh`. |
| A dock app won't open | Its package ID in `app/js/apps.js` does not match the TV. prole-webos repairs ids by exact then substring title match against the launch-point catalog (`listLaunchPoints`, with a `getAppLoadStatus` probe fallback); for an app with no title match, read `raw/apps-ssap.json` and fix the id. |
| Dock won't accept another app ("Dock is full — unpin an app first (10 max).") | Ten pinned | Unpin one in Manage dock, then pin the new app. |
| Dock change disappears after relaunch | `localStorage` write failed (storage unavailable) | Check the inspector console; the app falls back to `app/js/apps.js` defaults. |
| Pin badges vanish seconds after pinning | A lazy icon failed and rewrote the tile contents | This was fixed in 1.3.0 (`letterIcon` inserts instead of replacing children); reinstall the current package. |
| Pinned dock apps show only a letter after relaunch | The saved icon URL used a resource hash the TV rotated | Fixed in 1.3.1: `refreshFavoriteIcon()` re-reads each favorite's icon from the live launch points on every catalog load. Reinstall the current package; if it persists, confirm the app still appears in `listLaunchPoints`. |
| Inputs shows "Showing known inputs" or misses a source | `tv/getExternalInputList` failed, or the pairing key does not cover it | Accept the TV permission prompt, then reopen Inputs. After upgrading from 1.3.0 the TV may ask once more because 1.3.1 requests `READ_INPUT_DEVICE_LIST`; the static HDMI/AV/Component list is the fallback. |
| Inputs puts a device in the wrong group | The TV's `connected` / `hdmiPlugIn` / `hdmiSignalExist` flags changed while the overlay was open | Close and reopen Inputs — detection runs on open. Active = signal/connected, Connected = plugged in without a signal, Not connected = neither. |
| `set-wallpapers.py` fails: "Pillow is required" | Pillow missing | `pip install pillow` |
| `set-wallpapers.py` fails: "no JPG/PNG/WebP/BMP/TIFF images" | Folder empty or unsupported files only | Point it at a folder with supported extensions. |
| Wallpapers unchanged after running the script | Stopped at `--no-deploy` or deploy failed | `bash scripts/package-install.sh`; check the script output. |
| Want the original wallpapers back | Added JPEGs replaced the SVG scenes | Move the added JPEGs out of `app/wallpapers/`, run `node scripts/gen-wallpapers.js`, then `bash scripts/package-install.sh`. |
| TV feels slower after changes | `bash scripts/restore.sh`; then apply fewer rules (edit `RULES` in `scripts/debloat.py`). |
| IP changed | `export LG_TV_HOST=<new-ip>`, then `bash scripts/connect.sh <pass>` once (key is per device entry). |

---

## 11. Snappiness notes

- prole-webos uses no framework, no `backdrop-filter`, and no web fonts; the
  eight bundled SVG wallpapers are 3–25 KB each. If you replace them with
  your own images, use `set-wallpapers.py` — it writes 1920×1080 progressive
  JPEGs (typically 100–500 KB each) rather than shipping originals.
- The dock asks the bundled `com.fdear.prolewebos.service` for launch points once
  at boot (with a `getAppLoadStatus` probe as fallback); launches go through
  `com.webos.applicationManager/launch` directly.
- Inputs adds no boot cost: `tv/getExternalInputList` is requested only when
  the Inputs screen opens, then grouped locally and cached in memory.
- Dock configuration is a tiny `localStorage` entry read at boot; adding,
  removing and reordering apps costs no reload and no extra service call.
- Quick Start+ is **on**; that is the TV's own fast-boot setting (see the
  power trade-off in §5.3).
- The biggest real-world win is removing ad/ACR calls. The settings above
  stop the TV's own collection; the DNS blocklist stops the remaining
  endpoints, but it is a router/network change you apply separately (§7).
- prole-webos only paints faster while it is in front. LG's launcher still draws
  Home and power-on, because it cannot be replaced non-rooted.
