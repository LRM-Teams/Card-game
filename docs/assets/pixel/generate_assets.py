#!/usr/bin/env python3
"""Generate LRM-408 Modern Pixel assets from spec_lock.md (DDZ gold-green)."""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"

# palette from spec_lock
C = {
    "felt900": (11, 34, 24),
    "felt800": (20, 53, 42),
    "felt700": (27, 74, 55),
    "felt600": (42, 99, 73),
    "gold500": (232, 188, 58),
    "gold600": (196, 146, 24),
    "red500": (214, 48, 49),
    "red600": (168, 32, 32),
    "paper": (251, 251, 246),
    "ink": (28, 28, 28),
    "wood700": (107, 68, 36),
    "wood500": (138, 92, 52),
    "wood900": (74, 46, 24),
    "roomMid": (67, 48, 31),
    "roomDark": (36, 22, 18),
    "cream": (255, 243, 196),
    "blue": (74, 144, 217),
    "trans": (0, 0, 0, 0),
}


def save(img: Image.Image, *parts: str) -> None:
    path = ASSETS.joinpath(*parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def rect(draw: ImageDraw.ImageDraw, xy, fill, outline=None):
    draw.rectangle(xy, fill=fill, outline=outline)


def noise_tile(w: int, h: int, base, dark, light, accent=None, seed=0) -> Image.Image:
    rng = random.Random(seed)
    img = Image.new("RGBA", (w, h), base)
    px = img.load()
    for y in range(h):
        for x in range(w):
            n = rng.random()
            if n < 0.12:
                px[x, y] = dark
            elif n < 0.18:
                px[x, y] = light
            elif accent and n > 0.985:
                px[x, y] = accent
    return img


def card_front() -> Image.Image:
    w, h = 52, 74
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    rect(d, (1, 1, w - 2, h - 2), C["paper"], C["wood700"])
    rect(d, (3, 3, w - 4, h - 4), C["paper"])
    d.text((6, 4), "A", fill=C["red500"])
    # heart pixel
    for dx, dy in [(24, 28), (25, 27), (26, 27), (27, 28), (25, 30), (26, 30)]:
        if 0 <= dx < w and 0 <= dy < h:
            img.putpixel((dx, dy), C["red500"])
    d.text((w - 14, h - 14), "A", fill=C["red500"])
    return img


def card_back() -> Image.Image:
    w, h = 52, 74
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    rect(d, (1, 1, w - 2, h - 2), C["red600"], C["gold500"])
    rect(d, (5, 5, w - 6, h - 6), C["red600"], C["gold600"])
    d.ellipse((18, 24, 34, 50), outline=C["gold500"], width=2)
    d.polygon([(26, 30), (29, 36), (35, 36), (30, 40), (32, 46), (26, 42), (20, 46), (22, 40), (17, 36), (23, 36)], fill=C["cream"])
    return img


def joker_small() -> Image.Image:
    w, h = 52, 74
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    rect(d, (1, 1, w - 2, h - 2), C["paper"], C["wood700"])
    rect(d, (4, 4, 8, h - 5), C["blue"])
    d.text((12, 8), "X", fill=C["ink"])
    d.polygon([(26, 22), (34, 40), (18, 40)], fill=C["blue"])
    d.rectangle((20, 48, 32, 58), fill=C["gold500"], outline=C["ink"])
    return img


def joker_big() -> Image.Image:
    w, h = 52, 74
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    rect(d, (1, 1, w - 2, h - 2), C["paper"], C["wood700"])
    rect(d, (4, 4, 8, h - 5), C["red500"])
    d.text((12, 8), "D", fill=C["red600"])
    d.polygon([(26, 20), (32, 34), (28, 50), (24, 50), (20, 34)], fill=C["red500"])
    d.ellipse((22, 30, 30, 38), fill=C["gold500"])
    return img


def badge(size: int, fg, bg, symbol: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), C["trans"])
    d = ImageDraw.Draw(img)
    d.ellipse((1, 1, size - 2, size - 2), fill=bg, outline=fg, width=2)
    d.text((size // 2 - 4, size // 2 - 6), symbol, fill=fg)
    return img


def character_landlord() -> Image.Image:
    s = 96
    img = Image.new("RGBA", (s, s), C["trans"])
    d = ImageDraw.Draw(img)
    d.rectangle((36, 50, 60, 78), fill=C["red600"])
    d.rectangle((30, 30, 66, 52), fill=C["gold500"], outline=C["ink"])
    d.polygon([(24, 18), (48, 8), (72, 18), (66, 28), (30, 28)], fill=C["gold600"], outline=C["ink"])
    d.rectangle((40, 78, 48, 90), fill=C["ink"])
    d.rectangle((52, 78, 60, 90), fill=C["ink"])
    return img


def character_farmer() -> Image.Image:
    s = 72
    img = Image.new("RGBA", (s, s), C["trans"])
    d = ImageDraw.Draw(img)
    d.rectangle((26, 38, 46, 60), fill=C["felt600"])
    d.rectangle((24, 22, 48, 38), fill=C["cream"], outline=C["ink"])
    d.rectangle((18, 22, 54, 28), fill=C["felt700"])
    d.rectangle((30, 60, 36, 68), fill=C["ink"])
    d.rectangle((40, 60, 46, 68), fill=C["ink"])
    return img


def btn_primary() -> Image.Image:
    w, h = 120, 40
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((1, 1, w - 2, h - 2), radius=8, fill=C["gold500"], outline=C["gold600"], width=2)
    d.rounded_rectangle((3, 3, w - 4, h // 2), radius=6, fill=C["cream"])
    d.text((42, 12), "PLAY", fill=C["ink"])
    return img


def effect_bomb() -> Image.Image:
    img = Image.new("RGBA", (80, 60), C["trans"])
    d = ImageDraw.Draw(img)
    d.polygon([(40, 4), (56, 24), (72, 28), (58, 40), (62, 58), (40, 48), (18, 58), (22, 40), (8, 28), (24, 24)], fill=C["red500"], outline=C["gold500"])
    d.text((32, 22), "B", fill=C["cream"])
    return img


def effect_spring() -> Image.Image:
    img = Image.new("RGBA", (80, 60), C["trans"])
    d = ImageDraw.Draw(img)
    for i in range(5):
        d.ellipse((10 + i * 12, 20, 22 + i * 12, 44), fill=C["felt600"], outline=C["gold500"])
    d.text((18, 8), "SPR", fill=C["gold500"])
    return img


def badge_wide(w: int, h: int, title: str, bg, fg) -> Image.Image:
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((2, 2, w - 3, h - 3), radius=6, fill=bg, outline=fg, width=2)
    d.text((12, h // 2 - 8), title, fill=fg)
    return img


def room_bg() -> Image.Image:
    w, h = 320, 180
    img = Image.new("RGBA", (w, h), C["roomDark"])
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        col = tuple(int(C["roomDark"][i] * (1 - t) + C["roomMid"][i] * t) for i in range(3)) + (255,)
        d.line([(0, y), (w, y)], fill=col)
    d.ellipse((120, -20, 200, 40), fill=(*C["gold500"], 40))
    return img


def lobby_hero() -> Image.Image:
    w, h = 360, 160
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((4, 4, w - 4, h - 4), radius=10, fill=C["roomMid"], outline=C["gold500"], width=2)
    d.ellipse((40, 40, 120, 120), fill=C["felt700"], outline=C["gold500"])
    for i in range(5):
        d.rectangle((150 + i * 18, 50, 162 + i * 18, 110), fill=C["paper"], outline=C["wood700"])
    d.text((140, 16), "DDZ", fill=C["gold500"])
    return img


def main():
    random.seed(408)
    save(noise_tile(64, 64, C["felt700"], C["felt800"], C["felt600"], seed=1), "tiles", "felt_texture.png")
    save(noise_tile(64, 64, C["wood700"], C["wood900"], C["wood500"], C["cream"], seed=2), "tiles", "rail_texture.png")
    save(card_front(), "ui", "card_front_template.png")
    save(card_back(), "ui", "card_back.png")
    save(joker_small(), "ui", "joker_small.png")
    save(joker_big(), "ui", "joker_big.png")
    save(badge(28, C["gold500"], C["red600"], "D"), "ui", "badge_landlord.png")
    save(badge(24, C["gold500"], C["felt700"], "F"), "ui", "badge_farmer.png")
    save(badge(60, C["cream"], C["red600"], "x2"), "ui", "double_badge.png")
    save(badge_wide(90, 70, "WIN", C["gold600"], C["cream"]), "ui", "victory_badge.png")
    save(badge_wide(90, 70, "LOSE", C["blue"], C["cream"]), "ui", "defeat_badge.png")
    save(btn_primary(), "ui", "btn_primary.png")
    save(character_landlord(), "characters", "landlord_character.png")
    save(character_farmer(), "characters", "farmer_character.png")
    save(effect_bomb(), "effects", "bomb.png")
    save(effect_spring(), "effects", "spring.png")
    save(room_bg(), "backgrounds", "room_bg.png")
    save(lobby_hero(), "backgrounds", "lobby_hero.png")
    print("[OK] generated 18 assets")


if __name__ == "__main__":
    main()
