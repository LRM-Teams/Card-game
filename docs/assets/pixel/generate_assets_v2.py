#!/usr/bin/env python3
"""LRM-408 v2 — production Modern Pixel assets (42 items)."""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
PREVIEWS = ROOT.parent / "previews" / "lrm-408"

# DDZ gold-green palette (--ddz-* tokens + card paper tones)
C = {
    "felt900": (11, 34, 24),
    "felt800": (20, 53, 42),
    "felt700": (27, 74, 55),
    "feltMid": (31, 85, 64),
    "felt600": (42, 99, 73),
    "gold500": (232, 188, 58),
    "gold600": (196, 146, 24),
    "gold700": (150, 96, 0),
    "btnFrom": (240, 208, 106),
    "btnMid": (224, 184, 58),
    "btnTo": (196, 138, 20),
    "red500": (214, 48, 49),
    "red600": (168, 32, 32),
    "red700": (122, 15, 16),
    "paperHi": (255, 252, 247),
    "paper": (251, 251, 246),
    "paperLo": (243, 238, 227),
    "paperFib": (201, 184, 154),
    "cardEdge": (232, 223, 208),
    "cardBorder": (138, 115, 85),
    "ink": (28, 28, 28),
    "wood900": (74, 46, 24),
    "wood700": (107, 68, 36),
    "wood500": (138, 92, 52),
    "woodHi": (180, 130, 80),
    "roomDark": (36, 22, 18),
    "roomMid": (67, 48, 31),
    "roomHi": (51, 34, 26),
    "lobby700": (90, 34, 24),
    "lobby500": (138, 52, 36),
    "cream": (255, 243, 196),
    "farmer": (46, 139, 87),
    "lose1": (52, 64, 82),
    "lose2": (35, 44, 56),
    "win1": (138, 42, 28),
    "win2": (90, 26, 18),
    "winTitle": (255, 224, 138),
    "loseTitle": (184, 196, 212),
    "backDark": (110, 26, 31),
    "backMid": (61, 16, 24),
    "backDeep": (28, 12, 20),
    "star": (243, 223, 154),
    "blue": (58, 90, 120),
    "blueHi": (100, 150, 200),
    "trans": (0, 0, 0, 0),
}

PALETTE_HEX = sorted({f"#{v[0]:02X}{v[1]:02X}{v[2]:02X}" for k, v in C.items() if k != "trans"})


def px(img: Image.Image, x: int, y: int, color: tuple[int, int, int]):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), (*color, 255))


def save(img: Image.Image, *parts: str) -> Path:
    path = ASSETS.joinpath(*parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    return path


def value_noise(w: int, h: int, scale: int, seed: int = 0) -> list[list[float]]:
    rng = random.Random(seed)
    gw = max(2, w // scale + 1)
    gh = max(2, h // scale + 1)
    nodes = [[rng.uniform(-1, 1) for _ in range(gw)] for _ in range(gh)]
    for row in nodes:
        row[gw - 1] = row[0]
    nodes[gh - 1] = list(nodes[0])
    out = [[0.0] * w for _ in range(h)]

    def lerp(a, b, t):
        return a + (b - a) * (1 - math.cos(t * math.pi)) / 2

    for y in range(h):
        for x in range(w):
            fx, fy = x / scale, y / scale
            ix, iy = int(fx) % (gw - 1), int(fy) % (gh - 1)
            tx, ty = fx - int(fx), fy - int(fy)
            n = lerp(lerp(nodes[iy][ix], nodes[iy][ix + 1], tx),
                      lerp(nodes[iy + 1][ix], nodes[iy + 1][ix + 1], tx), ty)
            out[y][x] = n
    return out


def gen_felt_texture() -> Image.Image:
    w = h = 64
    img = Image.new("RGBA", (w, h))
    n1 = value_noise(w, h, 10, 3)
    n2 = value_noise(w, h, 5, 11)
    for y in range(h):
        for x in range(w):
            v = n1[y][x] * 0.65 + n2[y][x] * 0.35
            if v < -0.4:
                c = C["felt900"]
            elif v < -0.05:
                c = C["felt800"]
            elif v < 0.25:
                c = C["felt700"]
            elif v < 0.55:
                c = C["feltMid"]
            else:
                c = C["felt600"]
            # weave cross-hatch
            if (x + y) % 7 == 0 and v > -0.2:
                c = C["felt800"] if c == C["felt700"] else C["felt700"]
            # sparse wear ≤1%
            if (x * 37 + y * 53) % 211 == 0:
                c = C["felt900"]
            px(img, x, y, c)
    # edge highlight top-left
    for x in range(w):
        px(img, x, 0, C["felt600"])
    for y in range(h):
        px(img, 0, y, C["felt600"])
    return img


def gen_rail_texture() -> Image.Image:
    w = h = 64
    img = Image.new("RGBA", (w, h))
    n = value_noise(w, h, 6, 5)
    for y in range(h):
        for x in range(w):
            grain = math.sin((x * 0.35 + y * 0.12)) * 0.3 + n[y][x] * 0.5
            if y < 3 or y >= h - 3:
                c = C["wood900"]
            elif grain < -0.15:
                c = C["wood900"]
            elif grain < 0.2:
                c = C["wood700"]
            elif grain < 0.45:
                c = C["wood500"]
            else:
                c = C["woodHi"]
            # knot
            if 20 < x < 28 and 24 < y < 32:
                c = C["wood900"] if (x + y) % 3 else C["wood700"]
            px(img, x, y, c)
    # top highlight strip
    for x in range(w):
        px(img, x, 1, C["woodHi"])
    return img


def draw_paper_base(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    # outer shell + bevel
    d.rounded_rectangle((2, 2, w - 3, h - 3), radius=max(4, w // 13), fill=C["cardEdge"])
    d.rounded_rectangle((3, 3, w - 4, h - 4), radius=max(3, w // 14), fill=C["paper"])
    # fiber noise
    rng = random.Random(206)
    for _ in range(w * h // 18):
        x, y = rng.randint(5, w - 6), rng.randint(5, h - 6)
        px(img, x, y, C["paperFib"])
    # inner rim
    d.rounded_rectangle((6, 6, w - 7, h - 7), radius=max(2, w // 18), outline=C["cardBorder"], width=1)
    # top sheen band
    for y in range(6, 6 + h // 8):
        for x in range(8, w - 8):
            if (x + y) % 3 != 0:
                px(img, x, y, C["paperHi"])
    return img


def draw_heart(img: Image.Image, cx: int, cy: int, scale: int, color):
    pts = []
    for dy in range(-6 * scale, 7 * scale):
        for dx in range(-7 * scale, 8 * scale):
            nx, ny = dx / (7 * scale), dy / (6 * scale)
            if (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny <= 0.05:
                px(img, cx + dx, cy + dy, color)


def draw_spade(img: Image.Image, cx: int, cy: int, scale: int, color):
    for dy in range(-7 * scale, 5 * scale):
        for dx in range(-6 * scale, 7 * scale):
            nx, ny = dx / (6 * scale), dy / (7 * scale)
            if nx * nx + (ny + 0.3) ** 2 < 0.85 and ny < 0.5:
                px(img, cx + dx, cy + dy, color)
    for dy in range(0, 4 * scale):
        for dx in range(-1 * scale, 2 * scale):
            px(img, cx + dx, cy + 3 * scale + dy, color)


def draw_rank_A(img: Image.Image, x: int, y: int, color, big: bool = False):
    h = 14 if big else 8
    for row, w in enumerate([1, 3, 5, 7, 5, 3, 1]):
        for dx in range(w):
            px(img, x - w // 2 + dx, y + row, color)


def gen_card_front() -> Image.Image:
    w, h = 104, 148
    img = draw_paper_base(w, h)
    draw_rank_A(img, 16, 14, C["red500"])
    draw_heart(img, 16, 30, 1, C["red500"])
    draw_heart(img, 52, 74, 3, C["red500"])
    draw_rank_A(img, w - 16, h - 14, C["red500"])
    draw_heart(img, w - 16, h - 30, 1, C["red500"])
    return img


def gen_card_back() -> Image.Image:
    w, h = 104, 148
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((2, 2, w - 3, h - 3), radius=8, fill=C["gold600"])
    d.rounded_rectangle((5, 5, w - 6, h - 6), radius=7, fill=C["backMid"])
    d.rounded_rectangle((8, 8, w - 9, h - 9), radius=6, fill=C["backDark"])
    # lattice
    for y in range(12, h - 12, 8):
        for x in range(12, w - 12, 8):
            px(img, x, y, C["gold500"])
            if x + 4 < w - 12:
                px(img, x + 4, y, C["gold600"])
    # medallion
    cx, cy = w // 2, h // 2
    d.ellipse((cx - 18, cy - 22, cx + 18, cy + 22), fill=C["backDeep"], outline=C["gold500"], width=2)
    for angle in range(0, 360, 72):
        rad = math.radians(angle - 90)
        sx = cx + int(math.cos(rad) * 10)
        sy = cy + int(math.sin(rad) * 10)
        px(img, sx, sy, C["star"])
    px(img, cx, cy, C["star"])
    return img


def gen_joker(is_big: bool) -> Image.Image:
    w, h = 104, 148
    img = draw_paper_base(w, h)
    d = ImageDraw.Draw(img)
    rail = C["red500"] if is_big else C["blue"]
    d.rounded_rectangle((10, 12, 16, h - 12), radius=2, fill=rail)
    # jester hat
    cx = w // 2
    for i, ox in enumerate([-14, 0, 14]):
        d.polygon([(cx + ox - 4, 36), (cx + ox, 22), (cx + ox + 4, 36)], fill=C["gold500"] if is_big else C["blueHi"])
        px(img, cx + ox, 20, C["red500"] if is_big else C["red500"])
    # face
    d.ellipse((cx - 14, 40, cx + 14, 68), fill=C["paperLo"], outline=C["ink"])
    px(img, cx - 5, 50, C["ink"])
    px(img, cx + 5, 50, C["ink"])
    for x in range(cx - 6, cx + 7):
        px(img, x, 58, C["ink"])
    # flame / star body
    if is_big:
        for y in range(72, 110):
            width = int(12 * (1 - abs(y - 90) / 20))
            for x in range(cx - width, cx + width + 1):
                c = C["red500"] if (x + y) % 3 else C["gold500"]
                px(img, x, y, c)
    else:
        for y in range(72, 100):
            width = 8 - abs(y - 86) // 3
            for x in range(cx - width, cx + width + 1):
                px(img, x, y, C["blue"])
    return img


def gen_landlord_character() -> Image.Image:
    s = 128
    img = Image.new("RGBA", (s, s), C["trans"])
    d = ImageDraw.Draw(img)
    # shadow
    d.ellipse((28, 108, 100, 120), fill=C["ink"])
    # robe body cel-shade
    d.polygon([(36, 72), (92, 72), (100, 108), (28, 108)], fill=C["red600"])
    d.polygon([(40, 76), (88, 76), (94, 104), (34, 104)], fill=C["red500"])
    d.rectangle((52, 88, 76, 104), fill=C["red700"])
    # gold trim
    d.line([(36, 72), (92, 72)], fill=C["gold500"], width=2)
    # head
    d.ellipse((46, 48, 82, 78), fill=C["paper"], outline=C["ink"])
    px(img, 56, 58, C["ink"])
    px(img, 72, 58, C["ink"])
    px(img, 62, 66, C["red500"])
    # hat
    d.polygon([(32, 52), (64, 24), (96, 52), (88, 58), (40, 58)], fill=C["gold500"], outline=C["gold700"])
    d.polygon([(40, 54), (64, 32), (88, 54)], fill=C["btnFrom"])
    for bx in (48, 64, 80):
        px(img, bx, 28, C["red500"])
    # beard suggestion
    d.arc((52, 64, 76, 76), 0, 180, fill=C["ink"])
    return img


def gen_farmer_character() -> Image.Image:
    s = 128
    img = Image.new("RGBA", (s, s), C["trans"])
    d = ImageDraw.Draw(img)
    d.ellipse((28, 108, 100, 120), fill=C["ink"])
    d.polygon([(38, 74), (90, 74), (98, 108), (30, 108)], fill=C["farmer"])
    d.polygon([(42, 78), (86, 78), (92, 104), (36, 104)], fill=C["felt600"])
    # straw hat
    d.rectangle((30, 44, 98, 54), fill=C["gold600"])
    d.rectangle((38, 36, 90, 48), fill=C["btnMid"])
    for x in range(34, 95, 6):
        d.line([(x, 36), (x + 3, 54)], fill=C["gold700"], width=1)
    # head
    d.ellipse((46, 50, 82, 80), fill=C["paper"], outline=C["ink"])
    px(img, 56, 62, C["ink"])
    px(img, 72, 62, C["ink"])
    px(img, 62, 70, C["gold600"])
    return img


def draw_bevel_btn(w: int, h: int, state: str, label_pixels: list[tuple[int, int]]) -> Image.Image:
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    if state == "disabled":
        base, mid, dark = C["lose2"], C["lose1"], C["ink"]
        hi = C["loseTitle"]
    elif state == "pressed":
        base, mid, dark = C["btnTo"], C["gold600"], C["gold700"]
        hi = C["gold600"]
    else:
        base, mid, dark = C["btnTo"], C["btnMid"], C["gold600"]
        hi = C["btnFrom"]
    d.rounded_rectangle((1, 1, w - 2, h - 2), radius=6, fill=base, outline=dark)
    if state != "pressed":
        d.rounded_rectangle((2, 2, w - 3, h // 2), radius=5, fill=hi)
        d.rounded_rectangle((2, h // 2, w - 3, h - 3), radius=4, fill=mid)
    else:
        d.rounded_rectangle((2, 3, w - 3, h - 2), radius=4, fill=mid)
    for x, y in label_pixels:
        px(img, x, y, C["ink"] if state != "disabled" else C["loseTitle"])
    return img


def play_icon_ox() -> list[tuple[int, int]]:
    pts = []
    for row, w in enumerate([1, 3, 5, 7, 9, 7, 5, 3, 1]):
        for dx in range(w):
            pts.append((24 + dx, 12 + row))
    return pts


def gen_btn_primary(state: str) -> Image.Image:
    return draw_bevel_btn(120, 40, state, play_icon_ox())


def gen_btn_secondary(state: str) -> Image.Image:
    pts = [(20 + i, 16) for i in range(40)]
    return draw_bevel_btn(96, 36, state, pts)


def gen_badge_circle(size: int, bg, rim, draw_fn):
    img = Image.new("RGBA", (size, size), C["trans"])
    d = ImageDraw.Draw(img)
    d.ellipse((1, 1, size - 2, size - 2), fill=bg, outline=rim, width=2)
    d.ellipse((3, 3, size - 4, size - 4), outline=rim, width=1)
    draw_fn(img, size)
    return img


def crown_pixels(img, s):
    cx = s // 2
    pts = [(cx - 8, 14), (cx - 4, 8), (cx, 12), (cx + 4, 8), (cx + 8, 14),
           (cx - 6, 16), (cx, 18), (cx + 6, 16)]
    for x, y in pts:
        px(img, x, y, C["gold500"])


def wheat_pixels(img, s):
    cx, cy = s // 2, s // 2 + 2
    for y in range(cy - 6, cy + 8):
        px(img, cx, y, C["cream"])
    for dx in (-4, -2, 2, 4):
        px(img, cx + dx, cy - 4, C["cream"])


def gen_bomb() -> Image.Image:
    s = 96
    img = Image.new("RGBA", (s, s), C["trans"])
    d = ImageDraw.Draw(img)
    # rays
    for angle in range(0, 360, 30):
        rad = math.radians(angle)
        for dist in range(30, 44):
            x = s // 2 + int(math.cos(rad) * dist)
            y = s // 2 + int(math.sin(rad) * dist)
            px(img, x, y, C["gold500"] if dist % 2 else C["red500"])
    # fuse
    for i in range(12):
        px(img, s // 2 - 2 + (i % 3), 18 + i, C["cream"])
    d.ellipse((30, 36, 66, 72), fill=C["ink"])
    d.ellipse((34, 40, 62, 68), fill=C["lose2"])
    d.ellipse((38, 44, 58, 64), fill=C["ink"])
    px(img, 42, 48, C["lose1"])
    d.text((42, 50), "!", fill=C["red500"])
    return img


def gen_spring() -> Image.Image:
    w, h = 96, 72
    img = Image.new("RGBA", (w, h), C["trans"])
    cx, cy = w // 2, h // 2
    for angle in range(0, 360, 30):
        rad = math.radians(angle)
        for dist in range(8, 28, 4):
            x = cx + int(math.cos(rad) * dist)
            y = cy + int(math.sin(rad) * dist)
            c = C["red500"] if angle % 60 == 0 else C["winTitle"]
            px(img, x, y, c)
            px(img, x + 1, y, c)
    d = ImageDraw.Draw(img)
    d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=C["cream"], outline=C["gold500"])
    for x, y in [(16, 52), (78, 48), (40, 60)]:
        px(img, x, y, C["farmer"])
        px(img, x + 1, y, C["felt600"])
    return img


def gen_room_bg() -> Image.Image:
    w, h = 320, 180
    img = Image.new("RGBA", (w, h))
    noise = value_noise(w, h, 24, 9)
    bands = [C["roomHi"], C["roomMid"], C["roomDark"]]
    bh = h // len(bands)
    for i, col in enumerate(bands):
        for y in range(i * bh, (i + 1) * bh if i < 2 else h):
            for x in range(w):
                n = noise[y][x]
                c = col
                if n > 0.3:
                    c = C["wood700"] if i == 1 else C["roomMid"]
                px(img, x, y, c)
    d = ImageDraw.Draw(img)
    # vignette corners
    for corner in [(0, 0), (w - 40, 0), (0, h - 30), (w - 40, h - 30)]:
        d.rectangle((corner[0], corner[1], corner[0] + 40, corner[1] + 30), fill=C["felt900"])
    # table silhouette
    d.ellipse((60, 100, 260, 170), fill=C["felt700"], outline=C["wood700"], width=3)
    return img


def gen_lobby_hero() -> Image.Image:
    w, h = 360, 160
    img = Image.new("RGBA", (w, h), C["trans"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((4, 4, w - 4, h - 4), radius=8, fill=C["lobby700"], outline=C["gold500"], width=2)
    # characters
    ll = gen_landlord_character().resize((64, 64), Image.NEAREST)
    ff = gen_farmer_character().resize((64, 64), Image.NEAREST)
    img.paste(ll, (24, 48), ll)
    img.paste(ff, (w - 88, 48), ff)
    # floating cards
    cf = gen_card_front().resize((36, 52), Image.NEAREST)
    for ox in (140, 168, 196):
        img.paste(cf, (ox, 54), cf)
    # banner
    d.rounded_rectangle((100, 16, 260, 44), fill=C["gold600"], outline=C["btnTo"])
    for x in range(120, 240, 14):
        d.rectangle((x, 24, x + 8, 36), fill=C["ink"])
    return img


def gen_seamless_proof() -> Image.Image:
    felt = gen_felt_texture()
    w, h = 128, 128
    out = Image.new("RGBA", (w, h))
    for y in range(0, h, 64):
        for x in range(0, w, 64):
            out.paste(felt, (x, y))
    return out


def gen_all():
    random.seed(408)
    manifest_assets = []

    def emit(cat, name, img, alias: str | None = None):
        p = save(img, cat, f"{name}.png")
        manifest_assets.append({"category": cat, "name": name, "file": str(p.relative_to(ASSETS)), "size": list(img.size)})
        if alias:
            ap = save(img, cat, f"{alias}.png")
            manifest_assets.append({"category": cat, "name": alias, "file": str(ap.relative_to(ASSETS)), "size": list(img.size)})

    # table env 6
    emit("tiles", "felt_texture", gen_felt_texture())
    emit("tiles", "rail_texture", gen_rail_texture())
    emit("backgrounds", "room_bg", gen_room_bg())
    emit("backgrounds", "lobby_hero", gen_lobby_hero())
    vig = Image.new("RGBA", (128, 72), C["trans"])
    d = ImageDraw.Draw(vig)
    for i in range(36):
        d.rectangle((i, i, 127 - i, 71 - i), outline=C["felt900"])
    emit("backgrounds", "table_vignette", vig)
    orn = Image.new("RGBA", (32, 32), C["trans"])
    d = ImageDraw.Draw(orn)
    d.rectangle((4, 4, 27, 27), fill=C["wood700"], outline=C["gold500"])
    emit("backgrounds", "room_corner_ornament", orn)

    # cards 6
    emit("ui", "card_front_template", gen_card_front())
    emit("ui", "card_back", gen_card_back())
    emit("ui", "joker_small", gen_joker(False))
    emit("ui", "joker_big", gen_joker(True))
    emit("ui", "card_small_front", gen_card_front().resize((40, 56), Image.NEAREST))
    emit("ui", "card_small_back", gen_card_back().resize((40, 56), Image.NEAREST))

    # seats 7
    emit("characters", "landlord_character", gen_landlord_character())
    emit("characters", "farmer_character", gen_farmer_character())
    emit("ui", "badge_landlord", gen_badge_circle(28, C["red600"], C["gold500"], crown_pixels))
    emit("ui", "badge_farmer", gen_badge_circle(24, C["felt700"], C["farmer"], wheat_pixels))
    for name, rim in [("avatar_frame_landlord", C["gold500"]), ("avatar_frame_farmer", C["farmer"]), ("avatar_frame_default", C["wood500"])]:
        fr = Image.new("RGBA", (64, 64), C["trans"])
        d = ImageDraw.Draw(fr)
        d.rectangle((2, 2, 61, 61), fill=C["roomDark"], outline=rim, width=3)
        d.rectangle((6, 6, 57, 57), fill=C["felt900"])
        emit("ui", name, fr)
    for name, col in [("seat_turn_ring", C["gold500"]), ("seat_idle_ring", C["wood500"])]:
        ring = Image.new("RGBA", (56, 56), C["trans"])
        d = ImageDraw.Draw(ring)
        d.ellipse((2, 2, 53, 53), outline=col, width=3)
        emit("ui", name, ring)

    # buttons 8
    for st in ("normal", "pressed", "disabled"):
        emit("ui", f"btn_primary_{st}", gen_btn_primary(st))
    save(gen_btn_primary("normal"), "ui", "btn_primary.png")
    for st in ("normal", "pressed", "disabled"):
        emit("ui", f"btn_secondary_{st}", gen_btn_secondary(st))
    for st in ("normal", "pressed"):
        emit("ui", f"btn_pass_{st}", draw_bevel_btn(72, 36, st, [(20, 16), (21, 17), (50, 17), (51, 16)]))

    # HUD 6
    emit("ui", "double_badge", gen_badge_circle(60, C["red600"], C["gold500"],
          lambda im, s: [px(im, s // 2 + dx, s // 2 + dy, C["cream"]) for dx in (-8, -4, 0, 4, 8) for dy in (-2, 0, 2)]))
    for name, col in [("timer_ring", C["cream"]), ("timer_ring_critical", C["red500"])]:
        tr = Image.new("RGBA", (48, 48), C["trans"])
        d = ImageDraw.Draw(tr)
        d.ellipse((4, 4, 43, 43), outline=col, width=4)
        d.ellipse((14, 14, 33, 33), fill=C["felt900"])
        emit("ui", name, tr)
    hud = Image.new("RGBA", (80, 24), C["trans"])
    d = ImageDraw.Draw(hud)
    d.rounded_rectangle((1, 1, 78, 22), radius=4, fill=C["felt900"], outline=C["cream"])
    emit("ui", "mult_hud_bg", hud)
    emit("ui", "phase_label_bg", hud.copy())

    # effects 5
    emit("effects", "bomb", gen_bomb())
    emit("effects", "spring", gen_spring())
    emit("effects", "rocket", gen_bomb().transpose(Image.FLIP_LEFT_RIGHT))
    flash = Image.new("RGBA", (64, 64), C["trans"])
    d = ImageDraw.Draw(flash)
    d.ellipse((8, 8, 55, 55), fill=C["gold500"])
    d.ellipse((16, 16, 47, 47), fill=C["red500"])
    emit("effects", "bomb_flash", flash)
    pulse = Image.new("RGBA", (64, 64), C["trans"])
    d = ImageDraw.Draw(pulse)
    d.ellipse((8, 8, 55, 55), outline=C["gold500"], width=2)
    emit("effects", "turn_pulse", pulse)

    # settle 4
    emit("ui", "victory_badge", gen_badge_circle(120, C["win1"], C["winTitle"],
          lambda im, s: [px(im, s // 2 + dx, 30 + dy, C["winTitle"]) for dx in range(-12, 13) for dy in range(8)]))
    emit("ui", "defeat_badge", gen_badge_circle(120, C["lose1"], C["loseTitle"],
          lambda im, s: [px(im, s // 2 + dx, 40 + dy, C["loseTitle"]) for dx in range(-8, 9) for dy in range(4)]))
    coin = Image.new("RGBA", (24, 24), C["trans"])
    d = ImageDraw.Draw(coin)
    d.ellipse((2, 2, 21, 21), fill=C["gold500"], outline=C["gold700"])
    emit("ui", "settle_coin", coin)
    panel = Image.new("RGBA", (200, 120), C["trans"])
    d = ImageDraw.Draw(panel)
    d.rounded_rectangle((2, 2, 197, 117), radius=6, fill=C["win1"], outline=C["winTitle"], width=2)
    emit("ui", "settle_panel_win", panel)

    # proof + preview sheet
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    gen_seamless_proof().save(PREVIEWS / "felt-seamless-2x2.png")

    manifest = {"version": 2, "style": "Modern Pixel", "asset_count": len(list(ASSETS.rglob("*.png"))), "assets": manifest_assets}
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    # preview sheet
    pngs = sorted(ASSETS.rglob("*.png"))
    cols, cell, pad = 7, 72, 4
    rows = (len(pngs) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), C["felt900"])
    for i, p in enumerate(pngs):
        im = Image.open(p).convert("RGBA")
        sc = min((cell - pad * 2) / im.width, (cell - pad * 2) / im.height)
        nw, nh = max(1, int(im.width * sc)), max(1, int(im.height * sc))
        im = im.resize((nw, nh), Image.NEAREST)
        col, row = i % cols, i // cols
        sheet.paste(im, (col * cell + (cell - nw) // 2, row * cell + (cell - nh) // 2), im)
    sheet.save(PREVIEWS / "pixel-preview-sheet-v2.png")
    print(f"[OK] generated {len(pngs)} PNGs, manifest + preview sheet")


if __name__ == "__main__":
    gen_all()
