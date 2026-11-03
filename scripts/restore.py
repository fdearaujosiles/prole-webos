#!/usr/bin/env python3
"""Undo the debloat: write every recorded "before" value back through SSAP.

Nothing was uninstalled, so there is nothing to reinstall.  --full additionally
replays the entire pristine settings snapshot, which resets unrelated keys you
may have changed later (volume, picture mode, ...), so it is opt-in.

Usage:
  restore.py [--backup DIR] [--dry-run] [--full] [--remove-app]
"""
import argparse
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import tv_prefs  # noqa: E402

NODE = tv_prefs.NODE
ARES = os.path.join(ROOT, "node_modules", "@webos-tools", "cli", "bin")
SSAP = os.path.join(ROOT, "scripts", "ssap.js")
APP_ID = "com.fdear.prolewebos"
VOLATILE = {"updatetime", "lastupdate", "timestamp", "deviceid", "currentversion"}


def find_backup(explicit=None):
    if explicit:
        return os.path.abspath(explicit)
    latest = os.path.join(ROOT, "backup", "latest.txt")
    if os.path.exists(latest):
        with open(latest, encoding="utf-8") as f:
            return os.path.abspath(f.read().strip())
    base = os.path.join(ROOT, "backup")
    if not os.path.isdir(base):
        return None
    dirs = [os.path.join(base, d) for d in os.listdir(base)
            if os.path.isdir(os.path.join(base, d))]
    return max(dirs, key=os.path.getmtime) if dirs else None


def screenshot(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    proc = subprocess.run([NODE, SSAP, "screenshot", path], capture_output=True, text=True)
    return proc.returncode == 0 and os.path.exists(path), (proc.stdout or proc.stderr).strip()


def plan_from_changes(backup_dir):
    path = os.path.join(backup_dir, "changes.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        record = json.load(f)
    return [{**c, "value": c["before"]} for c in record.get("changes", [])]


def plan_from_proposal(backup_dir):
    path = os.path.join(backup_dir, "debloat-proposal.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        proposal = json.load(f)
    out = []
    for c in proposal.get("proposals", []) + proposal.get("already", []):
        if "before" in c:
            out.append({**c, "value": c["before"]})
    return out


def plan_full(backup_dir):
    prefs_dir = os.path.join(backup_dir, "raw", "prefs")
    if not os.path.isdir(prefs_dir):
        sys.exit(f"no pristine snapshot in {prefs_dir}")
    pristine = tv_prefs.parse(tv_prefs.load(prefs_dir))
    out = []
    for category, values in pristine.items():
        for key, value in values.items():
            if str(key).lower() in VOLATILE:
                continue
            out.append({"category": category, "key": key, "value": value,
                        "label": "full snapshot"})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backup")
    ap.add_argument("--device", default=os.environ.get("LG_DEVICE", "tv"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--full", action="store_true",
                    help="replay the entire pristine settings snapshot")
    ap.add_argument("--remove-app", action="store_true",
                    help="also close and uninstall prole-webos")
    args = ap.parse_args()

    backup_dir = find_backup(args.backup)
    if not backup_dir or not os.path.isdir(backup_dir):
        sys.exit("backup not found; pass --backup DIR")

    plan = plan_changes = plan_from_changes(backup_dir)
    if args.full:
        plan = plan_full(backup_dir)
    elif not plan:
        plan = plan_from_proposal(backup_dir)
    if not plan:
        sys.exit("nothing to restore: no changes.json, proposal or snapshot replay")

    dedup = {}
    for item in plan:
        dedup[(item["category"], item["key"])] = item
    plan = list(dedup.values())

    print(f"backup: {backup_dir}")
    print(f"{len(plan)} setting(s) to restore")
    for item in plan:
        print(f"  {item['category']}.{item['key']} -> {json.dumps(item['value'])}")
    if args.dry_run:
        print("\ndry run: nothing written")
        return

    screens = os.path.join(backup_dir, "screens")
    ok, detail = screenshot(os.path.join(screens, "20-before-restore.jpg"))
    print(("before screenshot: " + detail) if ok else ("before screenshot FAILED: " + detail))

    groups = {}
    for item in plan:
        groups.setdefault(item["category"], {})[item["key"]] = item["value"]

    failures = []
    for category, settings in groups.items():
        wrote, detail = tv_prefs.apply_settings(category, settings, args.device)
        print(f"writing {category}: {len(settings)} keys, ssap exit ok={wrote}")
        if not wrote:
            for item in plan:
                if item["category"] == category:
                    failures.append({**item, "response": detail})

    stored = tv_prefs.parse(tv_prefs.fetch_prefs(args.device))
    verified = 0
    for item in plan:
        got = stored.get(item["category"], {}).get(item["key"])
        good = tv_prefs.same(got, item["value"])
        verified += good
        if not good:
            print(f"  BAD {item['category']}.{item['key']} = {got!r} (wanted {item['value']!r})")

    ok, detail = screenshot(os.path.join(screens, "21-after-restore.jpg"))
    print(("after screenshot: " + detail) if ok else ("after screenshot FAILED: " + detail))

    record = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "backup": backup_dir,
        "device": args.device,
        "full": bool(args.full),
        "planned": len(plan),
        "verified": f"{verified}/{len(plan)}",
        "failures": failures,
    }
    with open(os.path.join(backup_dir, "restore-log.json"), "w", encoding="utf-8") as f:
        json.dump(record, f, indent=2)

    if args.remove_app:
        print("\nremoving prole-webos...")
        subprocess.run([NODE, os.path.join(ARES, "ares-launch.js"), "-d", args.device,
                        "-c", APP_ID], capture_output=True, text=True)
        proc = subprocess.run([NODE, os.path.join(ARES, "ares-install.js"), "-d",
                               args.device, "-r", APP_ID], capture_output=True, text=True)
        print("  " + (proc.stdout or proc.stderr).strip())

    print(f"\nrestored {len(plan) - len(failures)}/{len(plan)}, verified {verified}/{len(plan)}, "
          f"failures {len(failures)}")
    print(f"log: {os.path.join(backup_dir, 'restore-log.json')}")
    if failures or verified != len(plan):
        sys.exit(1)


if __name__ == "__main__":
    main()
