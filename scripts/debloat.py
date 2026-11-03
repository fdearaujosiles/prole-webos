#!/usr/bin/env python3
"""Build and apply the reversible, non-root debloat plan.

Every key below exists in the TV's own settings store (baseline captured from
/var/luna/preferences).  Writes go through SSAP, then the store is re-read from
disk and compared key by key.  Nothing is uninstalled and no app is disabled.

Default is a dry run; pass --apply to write.
"""
import argparse
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import tv_prefs  # noqa: E402  (path set above so the script also runs from the repo root)

SSAP = os.path.join(ROOT, "scripts", "ssap.js")
NODE = tv_prefs.NODE

# Rules are exact (category, key) pairs observed in the baseline.  "on"/"off"
# strings and booleans are kept in the type the store already uses.
RULES = [
    # -- advertising / tracking -------------------------------------------
    {"category": "option", "key": "livePlus", "after": "off",
     "label": "Live Plus (automatic content recognition)",
     "note": "Stops the TV from collecting what you watch and selling it as viewing data."},
    {"category": "option", "key": "livePromotion", "after": "off",
     "label": "Live promotion content",
     "note": "Ad/promo rails on the LG home and Live TV screens."},
    {"category": "option", "key": "webOSPromotionVideo", "after": "off",
     "label": "webOS promotion video",
     "note": "Full-screen LG promo videos on the launcher."},
    {"category": "option", "key": "channelplus", "after": "off",
     "label": "LG Channels (ad-supported streaming)",
     "note": "Hides the ad-supported LG Channels row; the app stays installed."},
    {"category": "option", "key": "thirdPartyCookie", "after": "off",
     "label": "Third-party cookies",
     "note": "Blocks cookies set by ad/analytics partners in the TV browser."},
    {"category": "option", "key": "dbgLogUpload", "after": False,
     "label": "Debug log upload",
     "note": "Stops the TV shipping diagnostic logs to LG."},
    {"category": "general", "key": "lmt", "after": "on",
     "label": "Limit ad tracking",
     "note": "Equivalent of the iOS/Android ad-tracking switch."},
    {"category": "general", "key": "adCookie", "after": "off",
     "label": "Advertising cookie",
     "note": "Disables the identifier used to target ads on the home screen."},
    {"category": "general", "key": "doNotSellMyPersonalInformation", "after": "on",
     "label": "Do not sell my personal information",
     "note": "CCPA-style opt-out flag honoured by LG's ad stack."},
    {"category": "general", "key": "homeAutoLaunch", "after": "off",
     "label": "Auto-launch promoted content on Home",
     "note": "Stops Home from jumping into a promoted app on its own."},

    # -- speed -------------------------------------------------------------
    {"category": "option", "key": "quickStartMode", "after": "on",
     "label": "Quick Start+ (instant-on standby)",
     "note": "Keeps the SoC warm between sessions so power-on and Home load faster; "
             "uses a few watts in standby."},
]

# Keys that are already at the privacy-safe value.  Recorded and re-checked so a
# firmware update that flips one back is caught, but never written.
ASSERTIONS = [
    ("option", "promotionStreamer", "off", "Promotion streamer"),
    ("option", "channelplusPopup", "off", "LG Channels popup"),
    ("general", "homePromotion", "off", "Home promotion banner"),
    ("general", "customizedAd", "off", "Customised ads"),
    ("general", "screenSaverAd", "off", "Screen-saver ads"),
    ("general", "absenceRecognition", "off", "Absence recognition"),
    ("general", "aiNudge", "off", "AI nudge"),
    ("general", "aiSettingsNudge", "off", "AI settings nudge"),
    ("general", "aiChannel", "off", "AI channel"),
    ("general", "avmsd", "off", "Automatic volume-matched ad detection"),
    ("other", "contentRecommendation", "off", "Content recommendations"),
]

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


def baseline_settings(backup_dir):
    """Parsed pristine settings from the backup; works from files or settings.json."""
    prefs_dir = os.path.join(backup_dir, "raw", "prefs")
    if not os.path.isdir(prefs_dir):
        sys.exit(f"no pristine settings in {prefs_dir}; run scripts/tv_prefs.py first")
    return tv_prefs.parse(tv_prefs.load(prefs_dir))


def screenshot(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    proc = subprocess.run([NODE, SSAP, "screenshot", path], capture_output=True, text=True)
    return proc.returncode == 0 and os.path.exists(path), (proc.stdout or proc.stderr).strip()


def group_by_category(items):
    groups = {}
    for item in items:
        groups.setdefault(item["category"], {})[item["key"]] = item["after"]
    return groups


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backup", help="backup directory (default: newest under backup/)")
    ap.add_argument("--device", default=os.environ.get("LG_DEVICE", "tv"))
    ap.add_argument("--apply", action="store_true", help="actually write the changes")
    ap.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = ap.parse_args()

    backup_dir = find_backup(args.backup)
    if not backup_dir or not os.path.isdir(backup_dir):
        sys.exit("no backup found; run scripts/tv_prefs.py --out backup/<date>/raw/prefs")
    pristine = baseline_settings(backup_dir)
    live = tv_prefs.parse(tv_prefs.fetch_prefs(args.device))

    # A key missing from the pristine baseline was never there; refusing to
    # invent it keeps this compatible with a different firmware profile.
    proposals, already, missing = [], [], []
    for rule in RULES:
        cat, key = rule["category"], rule["key"]
        before = pristine.get(cat, {}).get(key, "<not in backup>")
        if before == "<not in backup>":
            missing.append(rule)
            continue
        current = live.get(cat, {}).get(key)
        item = {**rule, "before": before, "current": current}
        if tv_prefs.same(current, rule["after"]):
            already.append(item)
        else:
            proposals.append(item)

    assertion_rows = []
    for cat, key, want, label in ASSERTIONS:
        current = live.get(cat, {}).get(key)
        assertion_rows.append({
            "category": cat, "key": key, "label": label,
            "expected": want, "current": current,
            "ok": tv_prefs.same(current, want),
        })

    print(f"backup: {backup_dir}")
    print(f"\n{'category':<9} {'key':<32} {'current':<10} {'after':<10} label")
    for p in proposals:
        print(f"{p['category']:<9} {p['key']:<32} {str(p['current']):<10} "
              f"{str(p['after']):<10} {p['label']}")
    if already:
        names = ", ".join(f"{i['category']}.{i['key']}" for i in already)
        print(f"\nalready at target: {names}")
    if missing:
        names = ", ".join(f"{i['category']}.{i['key']}" for i in missing)
        print(f"\nWARNING: not in the pristine backup, skipped: {names}")
    bad = [a for a in assertion_rows if not a["ok"]]
    if bad:
        print("\nassertions that drifted (reported, not changed):")
        for a in bad:
            print(f"  {a['category']}.{a['key']} = {a['current']!r}, expected {a['expected']!r}")

    report = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "backup": backup_dir,
        "device": args.device,
        "proposals": proposals,
        "already": already,
        "assertions": assertion_rows,
        "missing": missing,
    }
    with open(os.path.join(backup_dir, "debloat-proposal.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nproposed changes: {len(proposals)}   already correct: {len(already)}   "
          f"assertions ok: {sum(a['ok'] for a in assertion_rows)}/{len(assertion_rows)}")
    print(f"proposal: {os.path.join(backup_dir, 'debloat-proposal.json')}")

    if not args.apply:
        print("\ndry run. re-run with --apply to write.")
        return
    if not proposals:
        print("nothing to write.")
        return
    if not args.yes:
        answer = input("\nApply these settings to the TV? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            sys.exit("cancelled")

    screens = os.path.join(backup_dir, "screens")
    ok, detail = screenshot(os.path.join(screens, "10-before-debloat.jpg"))
    print(("before screenshot: " + detail) if ok else ("before screenshot FAILED: " + detail))

    applied, failures = [], []
    for category, settings in group_by_category(proposals).items():
        print(f"\nwriting {category}: {json.dumps(settings)}")
        wrote, detail = tv_prefs.apply_settings(category, settings, args.device)
        print(f"  ssap exit ok={wrote}")
        if not wrote:
            for item in proposals:
                if item["category"] == category:
                    failures.append({**item, "response": detail})
                    print(f"  FAILED   {item['category']}.{item['key']}: {detail}")
            continue
        for item in proposals:
            if item["category"] == category:
                applied.append(item)

    # The store is the authority: one read after all writes.
    stored = tv_prefs.parse(tv_prefs.fetch_prefs(args.device))
    verified = 0
    for item in applied:
        got = stored.get(item["category"], {}).get(item["key"])
        item["stored"] = got
        item["verified"] = tv_prefs.same(got, item["after"])
        verified += item["verified"]
        flag = "ok " if item["verified"] else "BAD"
        print(f"  {flag} {item['category']}.{item['key']} = {got!r} "
              f"(wanted {item['after']!r})")

    ok, detail = screenshot(os.path.join(screens, "11-after-debloat.jpg"))
    print(("after screenshot: " + detail) if ok else ("after screenshot FAILED: " + detail))

    # Merge with earlier runs so restore always has the earliest "before".
    changes_path = os.path.join(backup_dir, "changes.json")
    previous = {}
    if os.path.exists(changes_path):
        try:
            with open(changes_path, encoding="utf-8") as f:
                previous = {(c["category"], c["key"]): c
                            for c in json.load(f).get("changes", [])}
        except (OSError, json.JSONDecodeError):
            previous = {}
    merged = dict(previous)
    for item in applied:
        key = (item["category"], item["key"])
        before = merged[key]["before"] if key in merged else item["before"]
        merged[key] = {
            "category": item["category"],
            "key": item["key"],
            "label": item["label"],
            "before": before,
            "after": item["after"],
            "stored": item.get("stored"),
            "verified": item.get("verified", False),
        }

    record = {
        "generated": datetime.datetime.now().isoformat(timespec="seconds"),
        "backup": backup_dir,
        "device": args.device,
        "changes": list(merged.values()),
        "failures": failures,
        "verified": f"{verified}/{len(applied)}",
    }
    with open(changes_path, "w", encoding="utf-8") as f:
        json.dump(record, f, indent=2)

    print(f"\napplied {len(applied)}, failed {len(failures)}, verified {verified}/{len(applied)}")
    print(f"changes: {changes_path}")
    print("restore with: scripts/restore.sh")
    if failures or verified != len(applied):
        sys.exit(1)


if __name__ == "__main__":
    main()
