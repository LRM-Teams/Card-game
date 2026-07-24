#!/usr/bin/env python3
"""LRM-579 Narrative Pixel v3 lobby asset validator.

Checks locked bake + derived layers + element pack against manifests.
Exit 0 on PASS, 1 on FAIL.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("[ERROR] Pillow required")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "apps/client/public/narrative-pixel"
DOCS = ROOT / "docs/assets/narrative-pixel"

MIN_LAYER_BYTES = 80_000
MIN_ELEMENT_BYTES = 8_000
MIN_BAKE_BYTES = 200_000
CANVAS = (1920, 1080)


def fail(msg: str, errors: list[str]) -> None:
    errors.append(msg)
    print(f"[ERROR] {msg}")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    layers_manifest_path = DOCS / "lobby-v3-layers-manifest.json"
    elements_manifest_path = DOCS / "lobby-v3-elements-manifest.json"
    if not layers_manifest_path.exists():
        fail(f"missing {layers_manifest_path}", errors)
    if not elements_manifest_path.exists():
        fail(f"missing {elements_manifest_path}", errors)
    if errors:
        return 1

    layers_meta = json.loads(layers_manifest_path.read_text(encoding="utf-8"))
    elements_meta = json.loads(elements_manifest_path.read_text(encoding="utf-8"))

    # Bake
    bake = PUBLIC / "scene/scene-full-1920x1080.png"
    if not bake.exists():
        fail("scene-full-1920x1080.png missing", errors)
    else:
        size = bake.stat().st_size
        im = Image.open(bake)
        print(f"[CHECK] bake {im.size} {size} bytes")
        if size < MIN_BAKE_BYTES:
            fail(f"bake too small ({size} < {MIN_BAKE_BYTES}) — placeholder?", errors)
        if im.size != CANVAS:
            fail(f"bake size {im.size} != {CANVAS}", errors)

    # Required layers
    required_layers = [
        PUBLIC / "scene/layer-far-bg-1920x1080.png",
        PUBLIC / "scene/layer-mid-buildings-1920x1080.png",
        PUBLIC / "scene/layer-fg-occluder-1920x1080.png",
        PUBLIC / "lighting/layer-lighting-1920x1080.png",
    ]
    for path in required_layers:
        if not path.exists():
            fail(f"missing layer {path.relative_to(ROOT)}", errors)
            continue
        size = path.stat().st_size
        im = Image.open(path)
        print(f"[CHECK] layer {path.name} {im.size} {im.mode} {size} bytes")
        if size < MIN_LAYER_BYTES:
            fail(f"{path.name} too small ({size}) — geometric placeholder?", errors)
        if im.size != CANVAS:
            fail(f"{path.name} size {im.size} != {CANVAS}", errors)

    # Elements from elements manifest
    elements = elements_meta.get("elements", {})
    if len(elements) < 12:
        fail(f"element pack too thin ({len(elements)} < 12)", errors)
    for key, meta in elements.items():
        rel = meta["path"]
        # path stored as narrative-pixel/...
        path = ROOT / "apps/client/public" / rel
        if not path.exists():
            fail(f"missing element {key}: {rel}", errors)
            continue
        size = path.stat().st_size
        im = Image.open(path)
        print(f"[CHECK] element {key} {im.size} {im.mode} {size} bytes")
        if size < MIN_ELEMENT_BYTES:
            fail(f"{key} too small ({size}) — placeholder?", errors)
        if im.mode not in ("RGBA", "RGB", "LA", "P"):
            warnings.append(f"{key} unexpected mode {im.mode}")
        if "RGBA" in im.getbands():
            # require some transparency for sprites (except full RGB bake crops)
            alpha = im.getchannel("A") if "A" in im.getbands() else None
            if alpha is not None:
                extrema = alpha.getextrema()
                if extrema == (255, 255):
                    warnings.append(f"{key} has no transparency")

    # Catalog sync sample
    catalog = PUBLIC / "elements-catalog.json"
    if catalog.exists():
        cat = json.loads(catalog.read_text(encoding="utf-8"))
        for key in ("building_teahouse_main", "lantern_hanging", "npc_cat_walk"):
            found = False
            for group in cat.values():
                if isinstance(group, dict) and key in group:
                    found = True
                    break
            if not found:
                fail(f"catalog missing {key}", errors)

    print("=" * 60)
    print(f"[SCAN] layers_manifest={layers_meta.get('version')} elements={len(elements)}")
    for w in warnings:
        print(f"  [WARN] {w}")
    if errors:
        print(f"  [FAIL] {len(errors)} error(s)")
        return 1
    print("  [PASS] asset_validator OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
