# prole-webos

A quiet, fast home screen for LG webOS TVs, plus a reversible debloat toolkit
for the same TV. Sideloaded over Developer Mode — nothing is rooted and no
system partition is written.

Built and verified on an **LG 55QNED75SRA** (webOS 10.3.2 / "webOS 25",
firmware 33.31.75).

## What it does

- **prole-webos app** (`com.fdear.prolewebos`) — a minimal launcher surface:
  clock/date, rotating wallpapers, and a configurable dock of your streaming
  and game apps.
  - Dock holds up to 10 pins, with defaults for Netflix, YouTube, Prime Video,
    Disney+, Stremio, Apple TV, HBO Max and RetroArch.
  - **All apps** view built from the TV's own launch points (hidden apps and
    input tiles filtered out), with **Manage dock** to add, remove, reorder or
    reset.
  - **Inputs** view grouped into Active / Connected / Not connected using the
    TV-reported device names.
  - 8 bundled SVG wallpapers; replace them with your own images.
- **Debloat toolkit** — backs up every setting before touching it, applies 11
  reversible prefs changes (telemetry/ads surfaces, Quick Start+), and can
  restore the backup. Every write is verified on disk.
- **DNS blocklist** — `blocklist/lg-ads-telemetry.txt` for a router or Pi-hole
  (applied outside this repo).

## Requirements

- Windows/macOS/Linux with **Node.js** (project uses `@webos-tools/cli`) and
  **Python 3** for the debloat/restore helpers.
- An LG webOS TV with **Developer Mode** enabled and the PC registered.
- `bash` (Git Bash on Windows is fine).

```bash
npm install
```

## Quick start

```bash
# 1. Register the TV as the ares device "tv" (one time)
bash scripts/connect.sh

# 2. Back up settings and app list before changing anything
bash scripts/backup.sh

# 3. Optional: reversible debloat
python scripts/debloat.py

# 4. Build, install, launch and screenshot prole-webos
bash scripts/package-install.sh
```

Restore the debloat at any time with `bash scripts/restore.sh`. These commands
are also exposed as npm scripts (`npm run connect`, `backup`, `debloat`,
`install-app`, `restore`).

### Wallpapers

```bash
python scripts/set-wallpapers.py path/to/images   # crop to 1920x1080, archive old set, deploy
python scripts/set-wallpapers.py path/to/images --no-deploy
node scripts/gen-wallpapers.js                    # regenerate the original 8 SVG scenes
```

## Tests

```bash
npm test    # python scripts/selftest.py
```

The self-test exercises the backup/debloat/restore pipeline against a local
fixture; it does not touch the TV.

## Documentation

- [`PROLEWEBOS.md`](PROLEWEBOS.md) — architecture, feature inventory, verified
  TV state, build/deploy, troubleshooting and the change log.
- [`RUNBOOK.md`](RUNBOOK.md) — step-by-step non-root debloat, backup, install,
  DNS blocking and teardown.

## Agent rule — always ask before pushing

When work is finished and verified, agents **must ask the user** whether to
push and whether the target is `main` or a new branch, then wait for the
answer. Never push, force-push or open a pull request unprompted. Full detail:
**G30** in `PROLEWEBOS.md`.

## License

The project is declared ISC in `package.json`. The bundled `app/webOSTVjs/`
carries its own Apache-2.0 license (`LICENSE-2.0.txt`).
