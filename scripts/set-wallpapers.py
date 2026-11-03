#!/usr/bin/env python3
"""Replace prole-webos wallpapers with images from a folder.

Usage:
    python scripts/set-wallpapers.py path/to/images
    python scripts/set-wallpapers.py path/to/images --no-deploy

Every image in the folder (JPG, PNG, WebP, BMP, TIFF) is center-cropped to
1920x1080, saved as a JPEG, and written to app/wallpapers/. The previous
wallpaper assets and manifest are moved to backup/wallpapers/<timestamp>/ so
nothing is lost.

By default the script then runs scripts/package-install.sh, which builds,
installs and launches prole-webos on the TV. Pass --no-deploy to stop after
writing the files.

Run scripts/gen-wallpapers.js to regenerate the original eight SVG scenes at
any time.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - environment dependent
    sys.exit("Pillow is required: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "app" / "wallpapers"
MANIFEST = ROOT / "app" / "js" / "wallpapers.js"

WIDTH, HEIGHT = 1920, 1080
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def natural_key(path: Path):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.name)]


def display_name(path: Path) -> str:
    stem = path.stem
    for ch in ("_", "-", "."):
        stem = stem.replace(ch, " ")
    name = " ".join(stem.split()).strip()
    return name[:60] or "Wallpaper"


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "wallpaper"


def load_rgb(path: Path) -> Image.Image:
    with Image.open(path) as src:
        img = ImageOps.exif_transpose(src)
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.convert("RGBA")
            background = Image.new("RGBA", img.size, (0, 0, 0, 255))
            img = Image.alpha_composite(background, img).convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")
        return img.copy()


def crop(path: Path, out: Path, quality: int) -> tuple[int, int]:
    img = load_rgb(path)
    size = img.size
    fitted = ImageOps.fit(img, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    fitted.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
    return size


def archive_current() -> Path | None:
    stamp = time.strftime("%Y%m%d-%H%M%S")
    archive = ROOT / "backup" / "wallpapers" / stamp
    moved = 0

    if ASSETS.is_dir():
        files = [p for p in ASSETS.iterdir() if p.is_file()]
        if files:
            (archive / "assets").mkdir(parents=True, exist_ok=True)
            for path in files:
                shutil.move(str(path), str(archive / "assets" / path.name))
                moved += 1

    if MANIFEST.is_file():
        archive.mkdir(parents=True, exist_ok=True)
        shutil.copy2(MANIFEST, archive / "wallpapers.js")

    return archive if moved or (archive / "wallpapers.js").is_file() else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Replace prole-webos wallpapers with images from a folder.")
    parser.add_argument("folder", type=Path, help="folder containing the new wallpaper images")
    parser.add_argument("--quality", type=int, default=90, help="JPEG quality, 1-100 (default 90)")
    parser.add_argument("--no-deploy", action="store_true", help="write files only; do not build/install/launch")
    args = parser.parse_args()

    quality = max(1, min(100, args.quality))
    folder = args.folder.expanduser().resolve()

    if not folder.is_dir():
        print(f"error: not a folder: {folder}", file=sys.stderr)
        return 1

    sources = sorted(
        (p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in EXTENSIONS),
        key=natural_key,
    )
    if not sources:
        print(f"error: no JPG/PNG/WebP/BMP/TIFF images in {folder}", file=sys.stderr)
        return 1

    print(f"Processing {len(sources)} image(s) from {folder}")

    temp_dir = Path(tempfile.mkdtemp(prefix="prolewebos-wallpapers-"))
    outputs: list[tuple[Path, Path]] = []
    used_slugs: dict[str, int] = {}
    width = max(2, len(str(len(sources))))

    try:
        for index, source in enumerate(sources, start=1):
            name = display_name(source)
            slug = slugify(name)
            if slug in used_slugs:
                used_slugs[slug] += 1
                slug = f"{slug}-{used_slugs[slug]}"
            else:
                used_slugs[slug] = 1

            out = temp_dir / f"{index:0{width}d}-{slug}.jpg"
            try:
                original = crop(source, out, quality)
            except Exception as exc:  # noqa: BLE001 - report the offending file and stop
                print(f"error: could not convert {source.name}: {exc}", file=sys.stderr)
                return 1
            outputs.append((out, source))
            print(f"  {source.name}  {original[0]}x{original[1]} -> {out.name}  {out.stat().st_size // 1024} KB")

        archive = archive_current()
        ASSETS.mkdir(parents=True, exist_ok=True)
        for out, _ in outputs:
            shutil.move(str(out), str(ASSETS / out.name))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    manifest = [{"file": f"wallpapers/{out.name}", "name": display_name(source)} for out, source in outputs]
    MANIFEST.write_text(
        "// Generated by scripts/set-wallpapers.py\n"
        "window.AURORA_WALLPAPERS = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )

    total_kb = sum((ASSETS / out.name).stat().st_size for out, _ in outputs) // 1024
    print(f"\n{len(manifest)} wallpaper(s) written to app/wallpapers/ ({total_kb} KB total)")
    if archive:
        print(f"previous assets archived to {archive.relative_to(ROOT)}")
    print("original scenes can be regenerated with: node scripts/gen-wallpapers.js")

    if args.no_deploy:
        print("--no-deploy: skipping build/install/launch")
        return 0

    bash = shutil.which("bash")
    if not bash:
        print("\nwarning: bash not found; run this yourself:", file=sys.stderr)
        print("  bash scripts/package-install.sh", file=sys.stderr)
        return 0

    print("\nBuilding, installing and launching prole-webos...")
    result = subprocess.run([bash, "scripts/package-install.sh"], cwd=str(ROOT))
    if result.returncode != 0:
        print("error: package-install.sh failed", file=sys.stderr)
        return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
