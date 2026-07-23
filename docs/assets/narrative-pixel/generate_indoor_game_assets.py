#!/usr/bin/env python3
"""LRM-520: Indoor game scene layers + seat markers for Narrative Pixel line B."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "apps/client/public/narrative-pixel/indoor"
DOCS = ROOT / "docs/assets/narrative-pixel/indoor"
PREVIEW = ROOT / "docs/assets/previews/lrm-520"

C = {
    "wall": (58, 48, 72),
    "wall2": (72, 62, 86),
    "wood": (107, 68, 36),
    "felt": (27, 74, 55),
    "felt2": (42, 99, 73),
    "lamp": (232, 168, 72),
    "ink": (22, 24, 28),
    "cream": (255, 243, 196),
}


def layer_wall() -> Image.Image:
    w, h = 1920, 1080
    img = Image.new("RGBA", (w, h), (*C["ink"], 255))
    draw = ImageDraw.Draw(img)
    for y in range(0, 420, 16):
        shade = C["wall"] if (y // 16) % 2 else C["wall2"]
        draw.rectangle([0, y, w, y + 15], fill=(*shade, 255))
    for x in range(0, w, 64):
        draw.rectangle([x, 420, x + 60, h], fill=(*C["wood"], 255))
    return img


def layer_lamp_glow() -> Image.Image:
    img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for r in range(180, 0, -12):
        a = max(6, 50 - r // 5)
        draw.ellipse([860 - r, 40 - r // 2, 1060 + r, 200 + r], fill=(*C["lamp"], a))
    return img


def layer_vignette() -> Image.Image:
    img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 240, 1080], fill=(0, 0, 0, 90))
    draw.rectangle([1680, 0, 1920, 1080], fill=(0, 0, 0, 90))
    draw.rectangle([0, 900, 1920, 1080], fill=(0, 0, 0, 110))
    return img


def sprite(name: str, w: int, h: int, draw_fn) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(img), w, h)
    return img


def main() -> None:
    manifest: dict = {"version": "v1", "issue": "LRM-520", "layers": {}, "sprites": {}, "pixel_v2_refs": {}}
    layers = {
        "layer-wall-1920x1080.png": layer_wall(),
        "layer-lamp-glow-1920x1080.png": layer_lamp_glow(),
        "layer-vignette-indoor-1920x1080.png": layer_vignette(),
    }
    for fname, im in layers.items():
        for base in (PUBLIC, DOCS):
            p = base / fname
            p.parent.mkdir(parents=True, exist_ok=True)
            im.save(p)
        manifest["layers"][fname] = {"path": f"narrative-pixel/indoor/{fname}", "size": [1920, 1080]}

    def seat_marker(color, label):
        def _d(d, w, h):
            d.ellipse([4, 4, w - 5, h - 5], fill=(*color, 255), outline=(*C["cream"], 255), width=2)
            d.text((w // 2 - 8, h // 2 - 6), label, fill=(*C["ink"], 255))
        return _d

    sprites = {
        "seat_landlord_marker.png": (48, 48, seat_marker((214, 48, 49), "D")),
        "seat_farmer_marker.png": (48, 48, seat_marker((46, 139, 87), "F")),
        "tea_steam_16.png": (16, 32, lambda d, w, h: [d.rectangle([6, 20 - i * 4, 10, 24 - i * 4], fill=(*C["cream"], 80 - i * 15)) for i in range(4)]),
        "shelf_props_128.png": (128, 64, lambda d, w, h: (
            d.rectangle([8, 20, 120, 28], fill=(*C["wood"], 255)),
            d.rectangle([16, 8, 40, 20], fill=(*C["wall2"], 255)),
            d.rectangle([56, 10, 72, 18], fill=(*C["lamp"], 255)),
        )),
    }
    for fname, (w, h, fn) in sprites.items():
        im = sprite(fname, w, h, fn)
        for base in (PUBLIC, DOCS):
            im.save(base / fname)
        manifest["sprites"][fname] = {"path": f"narrative-pixel/indoor/{fname}", "size": [w, h]}

    # LRM-408 v2 cross-ref (already in /pixel/)
    pixel_refs = {
        "felt_texture": "/pixel/tiles/felt_texture.png",
        "rail_texture": "/pixel/tiles/rail_texture.png",
        "card_front_template": "/pixel/ui/card_front_template.png",
        "card_back": "/pixel/ui/card_back.png",
        "badge_landlord": "/pixel/ui/badge_landlord.png",
        "badge_farmer": "/pixel/ui/badge_farmer.png",
        "btn_primary_normal": "/pixel/ui/btn_primary.png",
        "btn_primary_pressed": "/pixel/ui/btn_primary.png",
        "btn_primary_disabled": "/pixel/ui/btn_primary.png",
        "landlord_character": "/pixel/characters/landlord_character.png",
        "farmer_character": "/pixel/characters/farmer_character.png",
        "bomb": "/pixel/effects/bomb.png",
        "victory_badge": "/pixel/ui/victory_badge.png",
        "defeat_badge": "/pixel/ui/defeat_badge.png",
    }
    manifest["pixel_v2_refs"] = pixel_refs

    out = ROOT / "docs/assets/narrative-pixel/indoor-game-manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    # preview 1920 composite
    PREVIEW.mkdir(parents=True, exist_ok=True)
    comp = Image.new("RGBA", (1920, 1080), (*C["ink"], 255))
    comp.alpha_composite(layers["layer-wall-1920x1080.png"])
    # table ellipse
    d = ImageDraw.Draw(comp)
    d.ellipse([360, 280, 1560, 820], fill=(*C["felt"], 255), outline=(*C["wood"], 255), width=16)
    d.ellipse([380, 300, 1540, 800], fill=(*C["felt2"], 255))
    comp.alpha_composite(layers["layer-lamp-glow-1920x1080.png"])
    comp.alpha_composite(layers["layer-vignette-indoor-1920x1080.png"])
    comp.convert("RGB").save(PREVIEW / "game-indoor-preview-1920.png")
    print(f"[OK] indoor assets + preview -> {PREVIEW}")


if __name__ == "__main__":
    main()
