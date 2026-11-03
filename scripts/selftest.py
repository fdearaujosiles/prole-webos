#!/usr/bin/env python3
"""Offline self-test: exercise debloat/restore against a fake settings store.

Does not touch the TV. Creates a fixture backup under backup/selftest, then
verifies proposal, apply, on-store verification and restore.
"""
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import debloat  # noqa: E402
import restore  # noqa: E402
import tv_prefs  # noqa: E402

FIXTURE = os.path.join(ROOT, "backup", "selftest")

# Pristine values as they appear on the real TV's store (see
# backup/2026-11-03/raw/prefs/settings.json); every RULE/ASSERTION key is set
# to the opposite of its target.
PRISTINE = {
    "option": {
        "livePlus": "on",
        "livePromotion": "on",
        "webOSPromotionVideo": "on",
        "channelplus": "on",
        "channelplusPopup": "off",
        "thirdPartyCookie": "on",
        "dbgLogUpload": True,
        "quickStartMode": "off",
        "promotionStreamer": "off",
    },
    "general": {
        "lmt": "off",
        "adCookie": "on",
        "doNotSellMyPersonalInformation": "off",
        "homeAutoLaunch": "on",
        "homePromotion": "off",
        "customizedAd": "off",
        "screenSaverAd": "off",
        "absenceRecognition": "off",
        "aiNudge": "off",
        "aiSettingsNudge": "off",
        "aiChannel": "off",
        "avmsd": "off",
    },
    "other": {"contentRecommendation": "off"},
}

STATE = json.loads(json.dumps(PRISTINE))


def fake_fetch_prefs(device="tv", timeout=120):
    return {name: json.dumps(values).encode() for name, values in STATE.items()}


def fake_apply_settings(category, settings, device="tv", timeout=60):
    STATE.setdefault(category, {}).update(settings)
    return True, "ok"


def patch():
    tv_prefs.fetch_prefs = fake_fetch_prefs
    tv_prefs.apply_settings = fake_apply_settings
    debloat.screenshot = lambda path: (os.makedirs(os.path.dirname(path), exist_ok=True)
                                      or True, "ok")
    restore.screenshot = debloat.screenshot


def run(module, argv):
    old = sys.argv
    sys.argv = argv
    try:
        module.main()
    finally:
        sys.argv = old


def main():
    if os.path.isdir(FIXTURE):
        shutil.rmtree(FIXTURE)
    prefs_dir = os.path.join(FIXTURE, "raw", "prefs")
    os.makedirs(prefs_dir)
    for category, values in PRISTINE.items():
        with open(os.path.join(prefs_dir, category), "w", encoding="utf-8") as f:
            json.dump(values, f)

    patch()

    run(debloat, ["debloat.py", "--backup", FIXTURE])
    proposal = json.load(open(os.path.join(FIXTURE, "debloat-proposal.json")))
    changed = {(p["category"], p["key"]): p for p in proposal["proposals"]}

    expected = {
        ("option", "livePlus"): "off",
        ("option", "livePromotion"): "off",
        ("option", "webOSPromotionVideo"): "off",
        ("option", "channelplus"): "off",
        ("option", "thirdPartyCookie"): "off",
        ("option", "dbgLogUpload"): False,
        ("option", "quickStartMode"): "on",
        ("general", "lmt"): "on",
        ("general", "adCookie"): "off",
        ("general", "doNotSellMyPersonalInformation"): "on",
        ("general", "homeAutoLaunch"): "off",
    }
    assert set(changed) == set(expected), (set(changed) ^ set(expected))
    for key, after in expected.items():
        assert changed[key]["after"] == after, (key, changed[key])
    assert not proposal["missing"], proposal["missing"]
    assert all(a["ok"] for a in proposal["assertions"]), proposal["assertions"]

    run(debloat, ["debloat.py", "--backup", FIXTURE, "--apply", "--yes"])
    record = json.load(open(os.path.join(FIXTURE, "changes.json")))
    assert record["changes"], "no changes applied"
    assert not record["failures"], record["failures"]
    assert record["verified"] == f"{len(expected)}/{len(expected)}", record["verified"]
    for p in record["changes"]:
        assert p["verified"], p
        assert tv_prefs.same(STATE[p["category"]][p["key"]], p["after"]), p

    run(restore, ["restore.py", "--backup", FIXTURE, "--device", "fake"])
    log = json.load(open(os.path.join(FIXTURE, "restore-log.json")))
    assert not log["failures"], log["failures"]
    assert log["verified"] == f"{len(expected)}/{len(expected)}", log["verified"]
    assert STATE == PRISTINE, "store did not return to pristine"

    print("selftest: PASS")
    print(f"  fixture: {FIXTURE}")


if __name__ == "__main__":
    main()
