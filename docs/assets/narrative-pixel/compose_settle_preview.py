#!/usr/bin/env python3
"""LRM-522: Compose settlement state previews (1920 + 390) from narrative PNGs."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
NP = ROOT / "apps/client/public/narrative-pixel"
INDOOR = NP / "indoor"
PREVIEW = ROOT / "docs/assets/previews/lrm-522"


def load(rel: str) -> Image.Image:
    return Image.open(NP / rel).convert("RGBA")


def compose(w: int, h: int) -> Image.Image:
    scale = w / 1920
    comp = Image.new("RGBA", (w, h), (22, 24, 28, 255))
    wall = INDOOR / "layer-wall-1920x1080.png"
    if wall.is_file():
        bg = Image.open(wall).resize((w, h), Image.Resampling.NEAREST)
        comp.alpha_composite(bg)
    else:
        ImageDraw.Draw(comp).rectangle([0, 0, w, h], fill=(58, 48, 72, 255))

    panel = load("settle/panel_backdrop_480x360.png")
    pw, ph = int(480 * scale), int(360 * scale)
    panel = panel.resize((pw, ph), Image.Resampling.NEAREST)
    comp.alpha_composite(panel, ((w - pw) // 2, int(h * 0.22)))

    vic = load("settle/victory_illustration_128.png").resize((int(96 * scale), int(96 * scale)), Image.Resampling.NEAREST)
    comp.alpha_composite(vic, ((w - int(96 * scale)) // 2, int(h * 0.26)))

    spring = load("fx/stamp_spring_96x48.png").resize((int(80 * scale), int(40 * scale)), Image.Resampling.NEAREST)
    bomb = load("fx/stamp_bomb_96x48.png").resize((int(80 * scale), int(40 * scale)), Image.Resampling.NEAREST)
    dbl = load("fx/badge_double_active.png").resize((int(48 * scale), int(48 * scale)), Image.Resampling.NEAREST)
    comp.alpha_composite(spring, (int(w * 0.12), int(h * 0.12)))
    comp.alpha_composite(bomb, (int(w * 0.78), int(h * 0.15)))
    comp.alpha_composite(dbl, (int(w * 0.08), int(h * 0.55)))

    btn = load("settle/btn_rematch_default.png").resize((int(200 * scale), int(48 * scale)), Image.Resampling.NEAREST)
    comp.alpha_composite(btn, ((w - int(200 * scale)) // 2, int(h * 0.62)))

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(14, int(28 * scale)))
    except OSError:
        font = ImageFont.load_default()
    d = ImageDraw.Draw(comp)
    d.text((w // 2 - int(60 * scale), int(h * 0.34)), "你赢了", fill=(255, 243, 196, 255), font=font)
    d.text((w // 2 - int(80 * scale), int(h * 0.42)), "地主胜 · 单注 10 · x4", fill=(232, 188, 58, 255), font=font)

    vignette = INDOOR / "layer-vignette-indoor-1920x1080.png"
    if vignette.is_file():
        v = Image.open(vignette).resize((w, h), Image.Resampling.NEAREST)
        comp.alpha_composite(v)
    return comp


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    for name, size in [("settle-preview-1920.png", (1920, 1080)), ("settle-preview-390x844.png", (390, 844))]:
        compose(*size).convert("RGB").save(PREVIEW / name, optimize=True)
        print(f"[OK] {PREVIEW / name}")


if __name__ == "__main__":
    main()
