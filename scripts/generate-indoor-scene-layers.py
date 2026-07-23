#!/usr/bin/env python3
"""LRM-518: Generate narrative-pixel indoor game scene layers (1920×1080)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/client/public"
DOCS = ROOT / "docs/assets/narrative-pixel"

PALETTE = {
    "ink": (22, 24, 28),
    "wall_dark": (36, 22, 18),
    "wood": (108, 88, 52),
    "wood_hi": (148, 118, 68),
    "wood_lo": (58, 72, 48),
    "purple": (58, 48, 72),
    "lamp": (232, 168, 72),
    "lamp_soft": (255, 204, 108),
}


def make_indoor_wall() -> Image.Image:
    w, h = 1920, 1080
    img = Image.new("RGBA", (w, h), (*PALETTE["wall_dark"], 255))
    draw = ImageDraw.Draw(img)
    # wood ceiling band
    for y in range(320):
        t = y / 320
        c = tuple(
            int(PALETTE["wood_lo"][i] * (1 - t) + PALETTE["wood"][i] * t) for i in range(3)
        )
        draw.line([(0, y), (w, y)], fill=(*c, 255))
    for x in range(0, w, 16):
        draw.line([(x, 0), (x, 320)], fill=(*PALETTE["wood_hi"], 40))
    # lower wall
    draw.rectangle([0, 320, w, h], fill=(*PALETTE["purple"], 255))
    # side shelves (wood)
    draw.rectangle([60, 700, 200, 1040], fill=(*PALETTE["wood"], 255))
    draw.rectangle([1720, 680, 1840, 1040], fill=(*PALETTE["wood"], 255))
    # window frames
    for x0, y0, ww, hh in [(120, 80, 200, 160), (1600, 60, 220, 180)]:
        draw.rectangle([x0, y0, x0 + ww, y0 + hh], fill=(*PALETTE["ink"], 200))
        draw.rectangle([x0 + 8, y0 + 8, x0 + ww - 8, y0 + hh - 8], fill=(*PALETTE["lamp_soft"], 60))
    return img


def make_indoor_lighting() -> Image.Image:
    w, h = 1920, 1080
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # lantern pool (top center)
    for r in range(140, 0, -12):
        a = max(6, 50 - r // 3)
        draw.ellipse([960 - r, 80 - r // 2, 960 + r, 80 + r], fill=(*PALETTE["lamp"], a))
    # window warm pools
    for cx, cy in [(220, 160), (1710, 150)]:
        for r in range(100, 0, -10):
            a = max(4, 30 - r // 4)
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*PALETTE["lamp_soft"], a))
    # vignette
    for i in range(80):
        a = int(i * 1.2)
        draw.rectangle([0, i, w, i + 1], fill=(*PALETTE["ink"], a))
        draw.rectangle([0, h - i - 1, w, h - i], fill=(*PALETTE["ink"], a))
        draw.rectangle([i, 0, i + 1, h], fill=(*PALETTE["ink"], a))
        draw.rectangle([w - i - 1, 0, w - i, h], fill=(*PALETTE["ink"], a))
    return img


def main() -> None:
    layers = {
        "scene/layer-indoor-wall-1920x1080.png": make_indoor_wall(),
        "lighting/layer-indoor-lighting-1920x1080.png": make_indoor_lighting(),
    }
    for rel, layer in layers.items():
        pub = PUBLIC / "narrative-pixel" / rel
        pub.parent.mkdir(parents=True, exist_ok=True)
        layer.save(pub)
        print(f"  {pub.relative_to(ROOT)}")
        doc = DOCS / rel
        doc.parent.mkdir(parents=True, exist_ok=True)
        layer.save(doc)
        print(f"  {doc.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
