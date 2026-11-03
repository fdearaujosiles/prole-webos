#!/usr/bin/env python3
"""Read and write the TV's settings store without root.

settingsservice persists every category as a small file in
/var/luna/preferences on the TV.  The Developer Mode shell runs as `prisoner`,
which cannot write there but *can* read the files (they are 0644).  Writes go
through SSAP (scripts/ssap.js): an alert's onclose/onClick target is an
internal luna:// URI, so closing the alert makes settingsservice apply the
change.  That is the same non-root channel the LG remote app uses.

Reading the store back is the authoritative check, including for keys the SSAP
settings adapter does not expose.
"""
import base64
import binascii
import io
import json
import os
import re
import shutil
import subprocess
import tarfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = shutil.which("node") or "node"
ARES_NOVACOM = os.path.join(ROOT, "node_modules", "@webos-tools", "cli", "bin", "ares-novacom.js")
SSAP = os.path.join(ROOT, "scripts", "ssap.js")

# Settings categories plus the couple of auxiliary files worth keeping.
FILES = [
    "general", "option", "other", "picture", "sound", "caption", "channel",
    "environmentCondition", "hotelMode", "lgchannels", "localeInfo", "network",
    "soundbar", "time", "timezone", "twinTv", "systemprefs.db",
]
JSON_FILES = [f for f in FILES if f != "systemprefs.db" and f != "timezone"]
B64 = re.compile(r"^[A-Za-z0-9+/=]+$")


class PrefsError(RuntimeError):
    pass


def _run(device, command, timeout=120):
    return subprocess.run(
        [NODE, ARES_NOVACOM, "-d", device, "--run", command],
        capture_output=True,
        timeout=timeout,
        env={**os.environ, "LG_DEVICE": device},
    )


def fetch_prefs(device="tv"):
    """Return {filename: bytes} for every settings file on the TV."""
    cmd = "tar -czf - -C /var/luna/preferences " + " ".join(FILES) + " | base64"
    proc = _run(device, cmd)
    if proc.returncode != 0:
        raise PrefsError((proc.stderr or proc.stdout).decode("utf-8", "replace").strip())
    # ares may print informational lines; keep only base64 payload lines.
    payload = "".join(
        line.strip() for line in proc.stdout.decode("ascii", "replace").splitlines()
        if line.strip() and B64.match(line.strip())
    )
    if not payload:
        raise PrefsError("TV returned no settings data")
    try:
        raw = base64.b64decode(payload)
    except binascii.Error as exc:
        raise PrefsError(f"bad base64 from TV: {exc}") from exc
    out = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            name = member.name.lstrip("./").split("/")[-1]
            handle = tar.extractfile(member)
            if handle is not None:
                out[name] = handle.read()
    missing = [f for f in FILES if f not in out]
    if missing:
        raise PrefsError(f"settings files missing from TV: {', '.join(missing)}")
    return out


def parse(files):
    """Parse the JSON settings files; ignore the sqlite db and timezone link."""
    out = {}
    for name, data in files.items():
        if name not in JSON_FILES:
            continue
        try:
            out[name] = json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PrefsError(f"{name}: not valid JSON ({exc})") from exc
    return out


def save(directory, files, parsed=None):
    os.makedirs(directory, exist_ok=True)
    for name, data in files.items():
        with open(os.path.join(directory, name), "wb") as handle:
            handle.write(data)
    if parsed is not None:
        with open(os.path.join(directory, "settings.json"), "w", encoding="utf-8") as handle:
            json.dump(parsed, handle, indent=2, sort_keys=True)
            handle.write("\n")
    return directory


def load(directory):
    """Load a previously saved raw prefs directory."""
    files = {}
    for name in FILES:
        path = os.path.join(directory, name)
        if os.path.isfile(path):
            with open(path, "rb") as handle:
                files[name] = handle.read()
    if not files:
        raise PrefsError(f"no saved settings in {directory}")
    return files


def apply_settings(category, settings, device="tv", timeout=60):
    """Write one category through SSAP. Returns (ok, detail)."""
    env_device = {"LG_DEVICE": device}
    payload = json.dumps(settings, separators=(",", ":"))
    proc = subprocess.run(
        [NODE, SSAP, "settings-set", category, payload],
        capture_output=True,
        text=True,
        timeout=timeout,
        env={**os.environ, **env_device},
    )
    detail = (proc.stdout or proc.stderr or "").strip()
    # ssap.js exits non-zero only when the whole request failed.
    return proc.returncode == 0, detail


def set_live(category, settings, device="tv"):
    """Write and then re-read the store, returning the values actually stored."""
    ok, detail = apply_settings(category, settings, device)
    stored = parse(fetch_prefs(device)).get(category, {})
    return ok, detail, {key: stored.get(key) for key in settings}


def same(a, b):
    """Compare JSON-ish values, treating true/True and on/ON loosely for strings."""
    if isinstance(a, str) and isinstance(b, str):
        return a.lower() == b.lower()
    return a == b


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Dump the TV settings store.")
    ap.add_argument("--device", default=os.environ.get("LG_DEVICE", "tv"))
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    prefs = fetch_prefs(args.device)
    parsed = parse(prefs)
    save(args.out, prefs, parsed)
    print(f"wrote {len(prefs)} files / {len(parsed)} categories to {args.out}")
