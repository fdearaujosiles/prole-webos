# Generates prole-webos app icon, large icon and splash screen with Pillow.
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "app", "assets")
os.makedirs(ASSETS, exist_ok=True)

TEAL = (46, 242, 192)
CYAN = (53, 208, 255)
PURPLE = (123, 107, 255)


def load_font(candidates, size):
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def vertical_gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        draw.line([(0, y), (w, y)], fill=c)
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def ribbons(size, scale, seed=7):
    """Returns an RGBA layer with aurora ribbons + stars, sized `size`."""
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    rnd = random.Random(seed)

    for i, (color, width, y0, amp, freq, phase) in enumerate(
        [
            (TEAL, int(30 * scale), int(h * 0.30), int(36 * scale), 1.6, 0.3),
            (CYAN, int(20 * scale), int(h * 0.42), int(30 * scale), 1.9, 2.1),
            (PURPLE, int(26 * scale), int(h * 0.24), int(28 * scale), 1.3, 4.0),
        ]
    ):
        glow = Image.new("RGBA", size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        pts = []
        for x in range(-int(80 * scale), w + int(80 * scale), max(2, int(4 * scale))):
            t = x / w
            y = y0 + amp * math.sin(t * math.pi * 2 * freq + phase) + int(70 * scale) * t
            pts.append((x, y))
        gd.line(pts, fill=color + (150,), width=width * 3, joint="curve")
        glow = glow.filter(ImageFilter.GaussianBlur(int(14 * scale)))
        layer = Image.alpha_composite(layer, glow)
        crisp = Image.new("RGBA", size, (0, 0, 0, 0))
        ImageDraw.Draw(crisp).line(pts, fill=color + (190,), width=max(2, width // 3), joint="curve")
        layer = Image.alpha_composite(layer, crisp)

    stars = Image.new("RGBA", size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(stars)
    for _ in range(int(90 * scale * scale)):
        x = rnd.uniform(0, w)
        y = rnd.uniform(0, h * 0.62)
        r = rnd.uniform(0.6, 2.0) * max(0.6, scale)
        a = rnd.randint(40, 190)
        sd.ellipse([x - r, y - r, x + r, y + r], fill=(223, 234, 255, a))
    return Image.alpha_composite(layer, stars)


def mountain_layer(size, base_ratio, amp_ratio, color, seed):
    w, h = size
    rnd = random.Random(seed)
    pts = [(0, h)]
    phases = [rnd.uniform(0, 6.28) for _ in range(3)]
    for i in range(41):
        t = i / 40
        y = h * base_ratio - h * amp_ratio * (
            0.5
            + 0.28 * math.sin(t * 6.2 + phases[0])
            + 0.12 * math.sin(t * 15.0 + phases[1])
            + 0.07 * math.sin(t * 31.0 + phases[2])
        )
        pts.append((t * w, y))
    pts.append((w, h))
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).polygon(pts, fill=color)
    return layer


def build_icon_master():
    size = (512, 512)
    bg = vertical_gradient(size, (8, 22, 42), (2, 4, 9)).convert("RGBA")
    aurora = ribbons(size, 1.0, seed=13).crop((0, 0, 512, 512))
    img = Image.alpha_composite(bg, aurora)
    img = Image.alpha_composite(img, mountain_layer(size, 0.80, 0.16, (3, 10, 16, 255), 3))
    img = Image.alpha_composite(img, mountain_layer(size, 0.92, 0.12, (1, 5, 9, 255), 9))
    # soft vignette
    vignette = Image.new("L", size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse([-int(size[0] * 0.25), -int(size[1] * 0.25), int(size[0] * 1.25), int(size[1] * 1.25)], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(70))
    dark = Image.new("RGBA", size, (0, 0, 0, 255))
    img = Image.composite(img, dark, vignette)
    img.putalpha(rounded_mask(size, 112))
    return img


def build_splash():
    size = (1920, 1080)
    bg = vertical_gradient(size, (3, 10, 24), (1, 3, 8)).convert("RGBA")
    aurora = ribbons(size, 1.5, seed=21)
    bg = Image.alpha_composite(bg, aurora)
    bg = Image.alpha_composite(bg, mountain_layer(size, 0.76, 0.18, (5, 15, 24, 255), 3))
    bg = Image.alpha_composite(bg, mountain_layer(size, 0.90, 0.14, (3, 9, 15, 255), 9))
    bg = Image.alpha_composite(bg, mountain_layer(size, 1.02, 0.10, (1, 4, 7, 255), 17))

    draw = ImageDraw.Draw(bg)
    font = load_font(
        [
            r"C:\Windows\Fonts\segoeuil.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf",
        ],
        132,
    )
    sub = load_font(
        [
            r"C:\Windows\Fonts\segoeuisl.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf",
        ],
        34,
    )
    draw.text((150, 520), "prole-webos", font=font, fill=(255, 255, 255, 235))
    draw.text((156, 690), "Y O U R   T V ,   S I M P L I F I E D", font=sub, fill=(210, 230, 240, 120))
    # subtle bottom fade for dock legibility
    fade = Image.new("RGBA", size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    for y in range(840, 1080):
        t = (y - 840) / 240
        fd.line([(0, y), (1920, y)], fill=(0, 0, 0, int(120 * t)))
    bg = Image.alpha_composite(bg, fade)
    return bg.convert("RGB")


master = build_icon_master()
master.save(os.path.join(ASSETS, "icon-512.png"))
master.resize((130, 130), Image.LANCZOS).save(os.path.join(ASSETS, "icon-large.png"))
master.resize((80, 80), Image.LANCZOS).save(os.path.join(ASSETS, "icon.png"))
build_splash().save(os.path.join(ASSETS, "splash.png"))
print("assets written:", ", ".join(sorted(os.listdir(ASSETS))))
