#!/usr/bin/env python3
"""Slice narrative-pixel atlas images into individual transparent sprites."""
from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/client/public/narrative-pixel"
DOCS = ROOT / "docs/assets/narrative-pixel"
ASSETS_SRC = Path(
    "/home/jianghp3/.cursor/projects/"
    "home-jianghp3-multica-workspaces-7beafc96-3c51-4fcc-9fe7-8c36ceb482ff-c9f78201-workdir/assets"
)

MAGENTA = (255, 0, 255)
MAGENTA_TOL = 42


def chroma_key(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - 255) + abs(g) + abs(b - 255) < MAGENTA_TOL * 3:
                px[x, y] = (0, 0, 0, 0)
    return img


def trim_alpha(img: Image.Image, pad: int = 2) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(img.width, x1 + pad)
    y1 = min(img.height, y1 + pad)
    return img.crop((x0, y0, x1, y1))


def slice_grid(
    src: Path,
    out_dir: Path,
    names: list[str],
    cols: int,
    rows: int,
    *,
    catalog_base: Path | None = None,
) -> dict[str, dict]:
    img = chroma_key(Image.open(src))
    cw, ch = img.width // cols, img.height // rows
    manifest: dict[str, dict] = {}
    for idx, name in enumerate(names):
        if idx >= cols * rows:
            break
        row, col = divmod(idx, cols)
        cell = img.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
        cell = trim_alpha(cell)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{name}.png"
        cell.save(out_path)
        if catalog_base is not None:
            manifest[name] = {
                "path": str(out_path.relative_to(catalog_base)),
                "width": cell.width,
                "height": cell.height,
            }
    return manifest


ATLASES = [
    {
        "src": "props-atlas-p0.png",
        "out": "props",
        "cols": 6,
        "rows": 4,
        "names": [
            "sign_teahouse_neon",
            "sign_mahjong_faded",
            "lantern_hanging",
            "crate_wood",
            "trash_bag",
            "traffic_cone",
            "card_table_outdoor",
            "card_stack",
            "chair_stool",
            "bottle_crate_stack",
            "bicycle_parked",
            "cat_sit",
            "poster_peeling",
            "graffiti_faded",
            "wire_tangle",
            "manhole",
            "coin_scatter",
            "newspaper",
            "hanging_laundry",
            "flower_box",
            "pot_plant",
            "grass_tuft",
            "moss_crack",
            "fence_wood",
        ],
    },
    {
        "src": "buildings-atlas-p0.png",
        "out": "buildings",
        "cols": 2,
        "rows": 2,
        "names": [
            "building_teahouse_main",
            "building_left_apartment",
            "building_right_apartment",
            "power_pole",
        ],
    },
    {
        "src": "characters-plants-atlas-p0.png",
        "out": "characters",
        "cols": 4,
        "rows": 3,
        "names": [
            "npc_old_man_walk",
            "npc_card_players",
            "npc_player_idle",
            "npc_cat_walk",
            "bush_foreground",
            "bush_large",
            "tree_pine",
            "vine_wall",
            "npc_shadow",
            "npc_bicycle",
            "npc_scooter",
            "avatar_portrait",
        ],
    },
    {
        "src": "tiles-atlas-p0.png",
        "out": "tiles",
        "cols": 8,
        "rows": 4,
        "names": [
            "wall_brick_tile_16",
            "wall_plaster_tile_16",
            "ground_tile_stone_16",
            "ground_tile_dirt_16",
            "ground_tile_moss_16",
            "window_lit_56x72",
            "window_dark_56x72",
            "door_teahouse",
            "balcony_rail_32",
            "pipe_horizontal",
            "pipe_vertical",
            "stone_step",
            "lantern_glow",
            "light_lamp_pool",
            "chimney_smoke",
            "dust_particle",
            "bird_silhouette",
            "distant_car",
            "rope_clothesline",
            "ac_unit",
            "fence_post",
            "puddle_reflection",
            "beer_bottle",
            "tea_cup",
            "wood_plank",
            "road_cone_alt",
            "brick_damage",
            "moss_wall",
            "crack_tile",
            "weed_corner",
            "leaf_particle",
            "sign_small",
        ],
    },
    {
        "src": "ui-atlas-p0.png",
        "out": "ui/states",
        "cols": 5,
        "rows": 3,
        "names": [
            "tv_screen_off",
            "tv_screen_default",
            "tv_screen_hover",
            "tv_screen_loading",
            "tv_screen_error",
            "station_board_empty",
            "ledger_book_open",
            "btn_wood_default",
            "btn_wood_hover",
            "btn_wood_press",
            "avatar_frame_default",
            "avatar_frame_selected",
            "tooltip_wood",
            "spinner_frame_1",
            "spinner_frame_2",
        ],
    },
]


def main() -> None:
    catalog: dict[str, dict] = {}
    for spec in ATLASES:
        src = ASSETS_SRC / spec["src"]
        if not src.exists():
            print(f"SKIP missing {src}")
            continue
        out_public = PUBLIC / spec["out"]
        out_docs = DOCS / spec["out"].replace("ui/states", "ui")
        m = slice_grid(
            src, out_public, spec["names"], spec["cols"], spec["rows"],
            catalog_base=ROOT / "apps/client/public",
        )
        slice_grid(src, out_docs, spec["names"], spec["cols"], spec["rows"])
        catalog[spec["out"]] = m
        print(f"OK {spec['src']} -> {len(m)} sprites")

    catalog_path = PUBLIC / "elements-catalog.json"
    catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False))
    (DOCS / "elements-catalog.json").write_text(
        catalog_path.read_text(encoding="utf-8"), encoding="utf-8"
    )
    print(f"Wrote {catalog_path}")


if __name__ == "__main__":
    main()
