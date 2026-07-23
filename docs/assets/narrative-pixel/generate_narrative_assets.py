#!/usr/bin/env python3
"""LRM-417: Generate narrative-pixel v3 sprites + scene layers."""
from __future__ import annotations

import json
import hashlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "apps/client/public"
DOCS = ROOT / "docs/assets/narrative-pixel"

PALETTE = {
    "sky": (98, 112, 128),
    "sky2": (140, 148, 138),
    "olive": (82, 98, 62),
    "ochre": (148, 118, 68),
    "ochre2": (188, 152, 88),
    "rust": (148, 72, 58),
    "slate": (72, 78, 86),
    "slate2": (48, 52, 58),
    "felt": (38, 78, 58),
    "lamp": (232, 168, 72),
    "lamp2": (255, 204, 108),
    "ink": (22, 24, 28),
    "cream": (251, 236, 196),
    "purple": (58, 48, 72),
    "green": (58, 74, 46),
}


def seed(name: str) -> int:
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)


def px(draw: ImageDraw.ImageDraw, x: int, y: int, c: tuple[int, int, int, int], s: int = 4) -> None:
    draw.rectangle([x * s, y * s, (x + 1) * s - 1, (y + 1) * s - 1], fill=c)


def make_sprite(name: str, category: str) -> Image.Image:
    s = seed(f"{category}/{name}")
    w, h = 48 + (s % 5) * 8, 48 + ((s >> 3) % 5) * 8
    if category == "buildings":
        w, h = 120 + (s % 4) * 40, 100 + ((s >> 2) % 4) * 30
    elif category == "characters":
        w, h = 32 + (s % 3) * 16, 48 + ((s >> 2) % 3) * 16
    elif category.startswith("ui"):
        w, h = 80 + (s % 3) * 20, 60 + ((s >> 2) % 3) * 20
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    base = {
        "props": PALETTE["ochre"],
        "buildings": PALETTE["rust"],
        "characters": PALETTE["slate2"],
        "tiles": PALETTE["slate"],
        "ui/states": PALETTE["ochre2"],
    }.get(category, PALETTE["olive"])
    accent = PALETTE["lamp"] if "lantern" in name or "lamp" in name or "tv" in name else PALETTE["green"]
    if "sign" in name:
        draw.rectangle([2, 8, w - 3, h - 10], fill=(*PALETTE["slate2"], 255))
        draw.rectangle([6, 12, w - 7, h - 14], fill=(*PALETTE["rust"], 255))
        draw.rectangle([10, 16, w - 11, 28], fill=(*PALETTE["lamp2"], 255))
    elif "lantern" in name:
        draw.rectangle([w // 2 - 8, 4, w // 2 + 8, h - 6], fill=(*PALETTE["rust"], 255))
        draw.ellipse([w // 2 - 14, 10, w // 2 + 14, 34], fill=(*accent, 255))
    elif "building" in name:
        draw.rectangle([0, h // 4, w - 1, h - 1], fill=(*base, 255))
        draw.polygon([(0, h // 4), (w // 2, 4), (w - 1, h // 4)], fill=(*PALETTE["rust"], 255))
        for i in range(3):
            wx = 12 + i * (w // 3)
            draw.rectangle([wx, h // 3, wx + 16, h // 3 + 20], fill=(*PALETTE["lamp"], 180))
    elif "npc" in name or "avatar" in name:
        draw.rectangle([w // 2 - 6, 10, w // 2 + 6, 22], fill=(*PALETTE["cream"], 255))
        draw.rectangle([w // 2 - 10, 22, w // 2 + 10, h - 8], fill=(*base, 255))
        draw.rectangle([w // 2 - 14, h - 6, w // 2 + 14, h - 2], fill=(*PALETTE["ink"], 200))
    elif "bush" in name or "tree" in name or "vine" in name:
        draw.ellipse([2, h // 3, w - 3, h - 3], fill=(*PALETTE["green"], 255))
        draw.ellipse([8, 4, w - 8, h // 2], fill=(*accent, 220))
    elif "tv" in name:
        draw.rectangle([4, 4, w - 5, h - 5], fill=(*PALETTE["slate2"], 255))
        inner = PALETTE["slate"] if "off" in name else PALETTE["felt"]
        draw.rectangle([10, 10, w - 11, h - 16], fill=(*inner, 255))
        if "loading" in name:
            for i in range(6):
                draw.rectangle([14 + i * 8, 20, 18 + i * 8, h - 22], fill=(*PALETTE["cream"], 120))
        if "default" in name or "hover" in name:
            draw.rectangle([w // 4, h // 2, w * 3 // 4, h // 2 + 12], fill=(*PALETTE["lamp2"], 255))
    elif "station" in name or "ledger" in name or "btn" in name:
        draw.rectangle([2, 2, w - 3, h - 3], fill=(*PALETTE["ochre"], 255))
        draw.rectangle([6, 6, w - 7, h - 7], fill=(*PALETTE["cream"], 230))
    elif "tile" in name or "ground" in name or "wall" in name:
        c1, c2 = PALETTE["slate"], PALETTE["slate2"]
        if "ground" in name:
            c1, c2 = PALETTE["ochre"], PALETTE["ochre2"]
        if "moss" in name or "weed" in name:
            c2 = PALETTE["green"]
        for y in range(0, h, 8):
            for x in range(0, w, 8):
                draw.rectangle([x, y, x + 7, y + 7], fill=(*(c1 if (x + y) % 16 else c2), 255))
    elif "card" in name:
        draw.rectangle([4, 4, w - 5, h - 5], fill=(*PALETTE["ochre"], 255))
        draw.rectangle([8, 8, w - 9, h - 9], fill=(*PALETTE["felt"], 255))
    else:
        draw.rectangle([4, 4, w - 5, h - 5], fill=(*base, 255))
        draw.rectangle([8, 8, w - 9, h - 9], fill=(*accent, 200))
    return img


def make_scene_layer(kind: str) -> Image.Image:
    w, h = 1920, 1080
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if kind == "far":
        for y in range(h // 2):
            t = y / (h // 2)
            c = tuple(int(PALETTE["sky"][i] * (1 - t) + PALETTE["sky2"][i] * t) for i in range(3))
            draw.line([(0, y), (w, y)], fill=(*c, 255))
        draw.polygon([(0, 420), (400, 300), (900, 360), (1400, 260), (1920, 320), (1920, 540), (0, 540)], fill=(*PALETTE["purple"], 200))
    elif kind == "mid":
        draw.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        draw.rectangle([80, 280, 480, 680], fill=(*PALETTE["rust"], 255))
        draw.rectangle([620, 200, 1300, 720], fill=(*PALETTE["slate2"], 255))
        draw.rectangle([1380, 300, 1860, 700], fill=(*PALETTE["slate"], 255))
        draw.rectangle([760, 160, 1160, 210], fill=(*PALETTE["ink"], 255))
        try:
            font = ImageFont.load_default()
            draw.text((790, 175), "TEAHOUSE", fill=(*PALETTE["lamp2"], 255), font=font)
        except Exception:
            pass
    elif kind == "fg":
        draw.rectangle([0, int(h * 0.62), int(w * 0.18), h], fill=(*PALETTE["green"], 220))
        draw.rectangle([int(w * 0.82), int(h * 0.58), w, h], fill=(*PALETTE["green"], 210))
    elif kind == "lighting":
        draw.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        for cx, cy in [(300, 400), (960, 350), (1500, 420)]:
            for r in range(120, 0, -15):
                a = max(8, 40 - r // 4)
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*PALETTE["lamp"], a))
    return img


CATALOG: dict[str, list[str]] = {
    "props": [
        "sign_teahouse_neon", "sign_mahjong_faded", "lantern_hanging", "crate_wood", "trash_bag",
        "traffic_cone", "card_table_outdoor", "card_stack", "chair_stool", "bottle_crate_stack",
        "bicycle_parked", "cat_sit", "poster_peeling", "graffiti_faded", "wire_tangle", "manhole",
        "coin_scatter", "newspaper", "hanging_laundry", "flower_box", "pot_plant", "grass_tuft",
        "moss_crack", "fence_wood",
    ],
    "buildings": ["building_teahouse_main", "building_left_apartment", "building_right_apartment", "power_pole"],
    "characters": [
        "npc_old_man_walk", "npc_card_players", "npc_player_idle", "npc_cat_walk", "bush_foreground",
        "bush_large", "tree_pine", "vine_wall", "npc_shadow", "npc_bicycle", "npc_scooter", "avatar_portrait",
    ],
    "tiles": [
        "wall_brick_tile_16", "wall_plaster_tile_16", "ground_tile_stone_16", "ground_tile_dirt_16",
        "ground_tile_moss_16", "window_lit_56x72", "window_dark_56x72", "door_teahouse", "balcony_rail_32",
        "pipe_horizontal", "pipe_vertical", "stone_step", "lantern_glow", "light_lamp_pool", "chimney_smoke",
        "dust_particle", "bird_silhouette", "distant_car", "rope_clothesline", "ac_unit", "fence_post",
        "puddle_reflection", "beer_bottle", "tea_cup", "wood_plank", "road_cone_alt", "brick_damage",
        "moss_wall", "crack_tile", "weed_corner", "leaf_particle", "sign_small",
    ],
    "ui/states": [
        "tv_screen_off", "tv_screen_default", "tv_screen_hover", "tv_screen_loading", "tv_screen_error",
        "station_board_empty", "ledger_book_open", "btn_wood_default", "btn_wood_hover", "btn_wood_press",
        "avatar_frame_default", "avatar_frame_selected", "tooltip_wood", "spinner_frame_1", "spinner_frame_2",
    ],
}


def main() -> None:
    catalog_out: dict[str, dict] = {}
    total = 0
    for category, names in CATALOG.items():
        catalog_out[category] = {}
        for name in names:
            sprite = make_sprite(name, category)
        rel = f"narrative-pixel/{category}/{name}.png"
        out_public = PUBLIC / rel
        out_public.parent.mkdir(parents=True, exist_ok=True)
        sprite.save(out_public)
        out_docs = DOCS / category / f"{name}.png"
        out_docs.parent.mkdir(parents=True, exist_ok=True)
        sprite.save(out_docs)
        catalog_out[category][name] = {
                "path": rel,
                "width": sprite.width,
                "height": sprite.height,
            }
            total += 1
            print(f"  {rel} {sprite.width}x{sprite.height}")

    for kind in ("far", "mid", "fg", "lighting"):
        layer = make_scene_layer(kind)
        sub = "scene" if kind != "lighting" else "lighting"
        fname = f"layer-{kind}-{'bg' if kind == 'far' else 'buildings' if kind == 'mid' else 'occluder' if kind == 'fg' else 'lighting'}-1920x1080.png"
        if kind == "lighting":
            fname = "layer-lighting-1920x1080.png"
        rel = f"narrative-pixel/{sub}/{fname}"
        out_public = PUBLIC / rel
        out_public.parent.mkdir(parents=True, exist_ok=True)
        layer.save(out_public)
        out_docs = DOCS / sub / fname
        out_docs.parent.mkdir(parents=True, exist_ok=True)
        layer.save(out_docs)

    full = Image.new("RGBA", (1920, 1080), (0, 0, 0, 255))
    for kind in ("far", "mid", "fg"):
        sub = "scene"
        fname = f"layer-{kind}-{'bg' if kind == 'far' else 'buildings' if kind == 'mid' else 'occluder'}-1920x1080.png"
        p = PUBLIC / f"narrative-pixel/{sub}/{fname}"
        full.alpha_composite(Image.open(p))
    for base in (PUBLIC, DOCS):
        target = base / ("narrative-pixel/scene/scene-full-1920x1080.png" if base == PUBLIC else "scene/scene-full-1920x1080.png")
        target.parent.mkdir(parents=True, exist_ok=True)
        full.save(target)

    cat_json = json.dumps(catalog_out, indent=2, ensure_ascii=False)
    for path in (
        PUBLIC / "narrative-pixel/elements-catalog.json",
        DOCS / "elements-catalog.json",
        ROOT / "apps/client/src/lib/narrative-pixel-elements-catalog.json",
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(cat_json, encoding="utf-8")

    manifest = {
        "version": "v3.1",
        "approved": "2026-07-23",
        "issue": "LRM-417",
        "totalElements": total,
        "categories": {k: len(v) for k, v in CATALOG.items()},
    }
    (DOCS / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Generated {total} sprites + 5 scene layers")


if __name__ == "__main__":
    main()
