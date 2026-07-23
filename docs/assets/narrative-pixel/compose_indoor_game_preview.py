#!/usr/bin/env python3
"""LRM-520: Compose 1920×1080 in-game preview from real indoor + pixel v2 PNGs."""
from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
INDOOR = ROOT / "apps/client/public/narrative-pixel/indoor"
PIXEL_PUBLIC = ROOT / "apps/client/public/pixel"
PIXEL_DOCS = ROOT / "docs/assets/pixel/assets"
PREVIEW = ROOT / "docs/assets/previews/lrm-520"
GIT_REF = "origin/agent/xiao-ya/lrm-408-pixel-assets"

W, H = 1920, 1080
TABLE_OUTER = (360, 280, 1560, 820)
TABLE_INNER = (380, 300, 1540, 800)


def load_asset(rel: str) -> Image.Image:
    """Resolve pixel or indoor PNG from public/, docs/, or git ref."""
    pixel_rel = rel if rel.startswith("pixel/") else f"pixel/{rel}"
    candidates = [
        PIXEL_PUBLIC / rel,
        PIXEL_DOCS / rel,
        INDOOR / Path(rel).name if "indoor" in rel or rel.endswith(".png") and "/" not in rel else None,
        INDOOR / rel,
    ]
    for p in candidates:
        if p and p.is_file():
            return Image.open(p).convert("RGBA")
    git_path = f"apps/client/public/{pixel_rel}"
    raw = subprocess.check_output(["git", "-C", str(ROOT), "show", f"{GIT_REF}:{git_path}"])
    from io import BytesIO

    return Image.open(BytesIO(raw)).convert("RGBA")


def load_indoor(name: str) -> Image.Image:
    p = INDOOR / name
    if not p.is_file():
        p = ROOT / "docs/assets/narrative-pixel/indoor" / name
    return Image.open(p).convert("RGBA")


def tile_texture(tex: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    x0, y0, x1, y1 = box
    tw, th = tex.size
    layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    for y in range(0, y1 - y0, th):
        for x in range(0, x1 - x0, tw):
            layer.paste(tex, (x, y), tex)
    return layer


def ellipse_mask(size: tuple[int, int], box: tuple[int, int, int, int]) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    return mask


def screen_blend(base: Image.Image, overlay: Image.Image, opacity: float = 0.55) -> Image.Image:
  out = base.copy()
  ov = overlay.copy()
  if opacity < 1:
    alpha = ov.split()[3].point(lambda a: int(a * opacity))
    ov.putalpha(alpha)
  screen = ImageChops.screen(base.convert("RGB"), ov.convert("RGB"))
  screen = screen.convert("RGBA")
  screen.putalpha(ov.split()[3])
  return Image.alpha_composite(out, screen)


def paste_pct(canvas: Image.Image, im: Image.Image, left: float, top: float, width_pct: float) -> None:
    tw = int(W * width_pct / 100)
    th = int(im.height * tw / im.width)
    scaled = im.resize((tw, th), Image.Resampling.NEAREST)
    x = int(W * left / 100)
    y = int(H * top / 100)
    canvas.alpha_composite(scaled, (x, y))


def draw_card_hand(canvas: Image.Image, card: Image.Image, cx: int, cy: int, count: int, spread: int = 28) -> None:
    cw, ch = 52, 74
    scaled = card.resize((cw, ch), Image.Resampling.NEAREST)
    start = cx - (count - 1) * spread // 2
    for i in range(count):
        canvas.alpha_composite(scaled, (start + i * spread, cy))


def main() -> Path:
    PREVIEW.mkdir(parents=True, exist_ok=True)

    comp = Image.new("RGBA", (W, H), (22, 24, 28, 255))

    # z1 wall (real PNG)
    comp.alpha_composite(load_indoor("layer-wall-1920x1080.png"))

    # z2-z3 table: felt tile + rail ring (real pixel v2 textures)
    felt = load_asset("tiles/felt_texture.png")
    rail = load_asset("tiles/rail_texture.png")
    table_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    inner = tile_texture(felt, TABLE_INNER)
    mask = ellipse_mask((W, H), TABLE_INNER)
    table_layer.paste(inner, (TABLE_INNER[0], TABLE_INNER[1]), inner)
    table_layer.putalpha(ImageChops.multiply(table_layer.split()[3], mask))

    rail_ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rail_ring)
    for offset in range(0, 20, 4):
        rd.ellipse(
            [TABLE_OUTER[0] - offset, TABLE_OUTER[1] - offset, TABLE_OUTER[2] + offset, TABLE_OUTER[3] + offset],
            outline=(*rail.getpixel((8, 8))[:3], 255),
            width=4,
        )
    comp = Image.alpha_composite(comp, table_layer)
    comp = Image.alpha_composite(comp, rail_ring)

    # z4 decor sprites (real indoor PNGs)
    paste_pct(comp, load_indoor("shelf_props_128.png"), 3, 16, 7)
    paste_pct(comp, load_indoor("tea_steam_16.png"), 86, 58, 1.2)

    # HUD: characters + badges at seat hotspots (wire-list %)
    landlord = load_asset("characters/landlord_character.png").resize((96, 96), Image.Resampling.NEAREST)
    farmer = load_asset("characters/farmer_character.png").resize((96, 96), Image.Resampling.NEAREST)
    badge_l = load_asset("ui/badge_landlord.png")
    badge_f = load_asset("ui/badge_farmer.png")

    comp.alpha_composite(landlord, (int(W * 0.42) - 48, int(H * 0.08)))
    comp.alpha_composite(badge_l, (int(W * 0.42) + 56, int(H * 0.08) + 4))
    comp.alpha_composite(farmer, (int(W * 0.08), int(H * 0.38)))
    comp.alpha_composite(badge_f, (int(W * 0.08) + 104, int(H * 0.38) + 4))
    comp.alpha_composite(farmer.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (int(W * 0.76) - 96, int(H * 0.38)))
    comp.alpha_composite(badge_f, (int(W * 0.76) - 32, int(H * 0.38) + 4))

    # play zone: 3 cards face-up
    card = load_asset("ui/card_front_template.png").resize((52, 74), Image.Resampling.NEAREST)
    for i, ox in enumerate([800, 848, 896]):
        comp.alpha_composite(card, (ox, 520))

    # hand dock (17 cards, bottom seat)
    hand_card = load_asset("ui/card_front_template.png")
    draw_card_hand(comp, hand_card, 960, 780, 17, spread=26)

    # CTA button
    btn = load_asset("ui/btn_primary_normal.png")
    btn = btn.resize((280, int(280 * btn.height / btn.width)), Image.Resampling.NEAREST)
    comp.alpha_composite(btn, (820, 900))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    ImageDraw.Draw(comp).text((920, 918), "出牌", fill=(22, 24, 28, 255), font=font)

    # seat markers (debug/optional layer from indoor PNGs)
    paste_pct(comp, load_indoor("seat_landlord_marker.png"), 41, 7.5, 2.5)

    # z5 lamp screen blend (real PNG, opacity .55 per wire-list)
    lamp = load_indoor("layer-lamp-glow-1920x1080.png")
    comp = screen_blend(comp, lamp, 0.55)

    # z6 vignette (real PNG)
    comp.alpha_composite(load_indoor("layer-vignette-indoor-1920x1080.png"))

    out = PREVIEW / "game-indoor-preview-1920.png"
    comp.convert("RGB").save(out, optimize=True)
    print(f"[OK] composed preview from real PNGs -> {out} ({out.stat().st_size} bytes)")
    return out


if __name__ == "__main__":
    main()
