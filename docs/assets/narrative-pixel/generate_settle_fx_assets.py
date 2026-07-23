#!/usr/bin/env python3
"""LRM-522: Narrative Pixel settlement panel + double/spring/bomb FX assets."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "apps/client/public/narrative-pixel"
DOCS = ROOT / "docs/assets/narrative-pixel"

C = {
    "ink": (22, 24, 28),
    "wall": (58, 48, 72),
    "wood": (107, 68, 36),
    "wood2": (138, 92, 52),
    "felt": (27, 74, 55),
    "gold": (232, 188, 58),
    "lamp": (232, 168, 72),
    "cream": (255, 243, 196),
    "red": (214, 48, 49),
    "green": (46, 139, 87),
    "dim": (120, 110, 100),
}


def save_both(rel: str, img: Image.Image) -> None:
    for base in (PUBLIC, DOCS):
        p = base / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p, "PNG")


def wood_panel(w: int, h: int) -> Image.Image:
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=12, fill=(*C["wood"], 255), outline=(*C["gold"], 255), width=4)
    d.rounded_rectangle([8, 8, w - 9, h - 9], radius=8, fill=(*C["wall"], 240), outline=(*C["wood2"], 255), width=2)
    for y in range(16, h - 16, 24):
        d.line([(20, y), (w - 20, y)], fill=(*C["ink"], 40), width=1)
    return img


def btn_rematch(state: str) -> Image.Image:
    fills = {"default": C["gold"], "hover": C["lamp"], "press": C["wood2"]}
    img = Image.new("RGBA", (200, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y_off = 2 if state == "press" else 0
    d.rounded_rectangle([4, 4 + y_off, 196, 44 + y_off], radius=6, fill=(*fills[state], 255), outline=(*C["wood"], 255), width=3)
    d.text((72, 14 + y_off), "再来一局", fill=(*C["ink"], 255))
    return img


def badge_double(state: str) -> Image.Image:
    fills = {"default": C["gold"], "active": C["red"], "dim": C["dim"]}
    img = Image.new("RGBA", (60, 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([4, 4, 55, 55], fill=(*fills[state], 255), outline=(*C["cream"], 255), width=2)
    d.text((14, 18), "x2", fill=(*C["ink"], 255))
    return img


def stamp_fx(label: str, color: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (96, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([2, 6, 93, 42], radius=4, fill=(*color, 230), outline=(*C["cream"], 255), width=2)
    d.text((12, 14), label, fill=(*C["cream"], 255))
    return img


def result_illustration(win: bool) -> Image.Image:
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    col = C["gold"] if win else C["dim"]
    d.ellipse([8, 8, 119, 119], fill=(*col, 255), outline=(*C["cream"], 255), width=3)
    d.polygon([(64, 28), (88, 72), (40, 72)] if win else [(40, 40), (88, 40), (64, 88)], fill=(*C["cream"], 255))
    return img


def bomb_flash() -> Image.Image:
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, a in enumerate([220, 160, 100, 50]):
        r = 60 - i * 12
        d.ellipse([64 - r, 64 - r, 64 + r, 64 + r], fill=(*C["red"], a))
    d.text((46, 52), "炸", fill=(*C["cream"], 255))
    return img


def main() -> None:
    manifest: dict = {"version": "v1", "issue": "LRM-522", "settle": {}, "fx": {}, "states": {}}

    assets = {
        "settle/panel_backdrop_480x360.png": wood_panel(480, 360),
        "settle/victory_illustration_128.png": result_illustration(True),
        "settle/defeat_illustration_128.png": result_illustration(False),
        "settle/btn_rematch_default.png": btn_rematch("default"),
        "settle/btn_rematch_hover.png": btn_rematch("hover"),
        "settle/btn_rematch_press.png": btn_rematch("press"),
        "fx/badge_double_default.png": badge_double("default"),
        "fx/badge_double_active.png": badge_double("active"),
        "fx/badge_double_dim.png": badge_double("dim"),
        "fx/stamp_spring_96x48.png": stamp_fx("春天", C["green"]),
        "fx/stamp_bomb_96x48.png": stamp_fx("炸弹", C["red"]),
        "fx/overlay_bomb_flash_128.png": bomb_flash(),
    }

    for rel, im in assets.items():
        save_both(rel, im)
        key = Path(rel).stem
        bucket = "settle" if rel.startswith("settle/") else "fx"
        entry = {"path": f"narrative-pixel/{rel}", "size": list(im.size)}
        if "btn_rematch" in rel or "badge_double" in rel:
            manifest["states"].setdefault(key.rsplit("_", 1)[0], entry)
        manifest[bucket][key] = entry

    out = DOCS / "settle-fx-manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] {len(assets)} assets -> {PUBLIC} + {out}")


if __name__ == "__main__":
    main()
