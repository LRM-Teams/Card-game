#!/usr/bin/env python3
"""LRM-579: Derive true parallax layers from locked Narrative Pixel v3 bake.

Source of truth: caozs2-locked scene-full-1920x1080 (no new art direction).
Layers are depth-separated plates of the same bake so later parallax wiring
cannot drift from the approved full-scene visual bar.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SCENE = ROOT / "apps/client/public/narrative-pixel/scene"
PUBLIC_LIGHT = ROOT / "apps/client/public/narrative-pixel/lighting"
DOCS = ROOT / "docs/assets/narrative-pixel"
PREVIEWS = ROOT / "docs/assets/previews/lrm-579"

W, H = 1920, 1080
# Depth bands (y) tuned to v3 composition: sky/mountains / buildings / street+fg
FAR_END = 420
MID_END = 780
FG_START = 620


def load_bake() -> Image.Image:
    candidates = [
        PUBLIC_SCENE / "scene-full-1920x1080.png",
        PUBLIC_SCENE / "ddz-street-scene-v3-1920x1080.png",
    ]
    for path in candidates:
        if path.exists() and path.stat().st_size > 100_000:
            img = Image.open(path).convert("RGBA")
            if img.size != (W, H):
                img = img.resize((W, H), Image.Resampling.LANCZOS)
            return img
    raise FileNotFoundError("Locked v3 bake not found under narrative-pixel/scene/")


def sky_mask(rgb: np.ndarray) -> np.ndarray:
    """Warm sunset sky / distant mountain atmosphere in the upper band."""
    r, g, b = rgb[..., 0].astype(np.float32), rgb[..., 1].astype(np.float32), rgb[..., 2].astype(np.float32)
    y = np.arange(H)[:, None]
    upper = y < FAR_END
    warm = (r > g + 8) & (r > b + 20) & (r > 70)
    bright = (r + g + b) > 220
    purple_mtn = (b + 10 > r) & (r < 90) & (g < 80) & (y < 460)
    return upper & (warm | bright | purple_mtn)


def make_far(bake: Image.Image) -> Image.Image:
    """Sky + mountains plate; lower band filled with deep atmosphere so cover works."""
    rgb = np.array(bake.convert("RGB"))
    far = rgb.copy()
    # Soft horizon blur below mountains to avoid hard building silhouettes in far plate
    below = Image.fromarray(far).filter(ImageFilter.GaussianBlur(radius=18))
    below_arr = np.array(below)
    for y in range(FAR_END - 40, H):
        t = min(1.0, max(0.0, (y - (FAR_END - 40)) / 160.0))
        # Pull toward dark indigo ground fill matching night street mood
        fill = np.array([28, 22, 36], dtype=np.float32)
        row = far[y].astype(np.float32) * (1 - t) + below_arr[y].astype(np.float32) * t
        row = row * (1 - t * 0.85) + fill * (t * 0.85)
        far[y] = np.clip(row, 0, 255).astype(np.uint8)
    # Keep mountain ridge detail: restore original above FAR_END-20
    far[: FAR_END - 20] = rgb[: FAR_END - 20]
    return Image.fromarray(far, mode="RGB").convert("RGBA")


def make_mid(bake: Image.Image) -> Image.Image:
    """Buildings + street mid plate with transparent sky so it stacks over far."""
    rgba = np.array(bake.convert("RGBA"))
    rgb = rgba[..., :3]
    mask = sky_mask(rgb)
    # Feather sky edge
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    a_img = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(radius=3))
    alpha = np.array(a_img)
    # Soften very top always transparent
    for y in range(0, 80):
        alpha[y] = (alpha[y].astype(np.float32) * (y / 80.0)).astype(np.uint8)
    out = rgba.copy()
    out[..., 3] = alpha
    return Image.fromarray(out, mode="RGBA")


def make_fg(bake: Image.Image) -> Image.Image:
    """Foreground occluder: lower street dressing with soft top fade."""
    rgba = np.array(bake.convert("RGBA"))
    alpha = np.zeros((H, W), dtype=np.uint8)
    for y in range(H):
        if y < FG_START:
            a = 0
        elif y < FG_START + 80:
            a = int(255 * (y - FG_START) / 80.0)
        else:
            a = 255
        # Prefer edges / bottom for occluder feel (center stays more open for CTA)
        x = np.arange(W)
        edge = np.clip(np.minimum(x, W - 1 - x) / 220.0, 0, 1)
        bottom = max(0.35, (y - FG_START) / max(1, H - FG_START))
        row_a = (a * (0.25 + 0.75 * np.maximum(edge, bottom * 0.55))).astype(np.uint8)
        alpha[y] = row_a
    out = rgba.copy()
    out[..., 3] = alpha
    return Image.fromarray(out, mode="RGBA")


def make_lighting(bake: Image.Image) -> Image.Image:
    """Warm lamp/window glow plate for screen blend (derived, not geometric)."""
    rgb = np.array(bake.convert("RGB")).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    warm = np.clip((r - g) * 2.2 + (r - b) * 1.4 - 40, 0, 255)
    # Emphasize mid-building window band
    y = np.arange(H)[:, None].astype(np.float32)
    band = np.clip(1.0 - np.abs(y - 520) / 280.0, 0, 1)
    glow = (warm * band * 0.55).astype(np.uint8)
    glow_img = Image.fromarray(glow, mode="L").filter(ImageFilter.GaussianBlur(radius=12))
    g_arr = np.array(glow_img)
    out = np.zeros((H, W, 4), dtype=np.uint8)
    out[..., 0] = np.clip(g_arr.astype(np.int16) + 40, 0, 255).astype(np.uint8)
    out[..., 1] = np.clip(g_arr.astype(np.int16) * 0.7 + 20, 0, 255).astype(np.uint8)
    out[..., 2] = np.clip(g_arr.astype(np.int16) * 0.25, 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(g_arr.astype(np.int16) * 0.85, 0, 180).astype(np.uint8)
    return Image.fromarray(out, mode="RGBA")


def compose_preview(far: Image.Image, mid: Image.Image, fg: Image.Image, lighting: Image.Image) -> Image.Image:
    base = far.convert("RGBA")
    base = Image.alpha_composite(base, mid)
    base = Image.alpha_composite(base, lighting)
    base = Image.alpha_composite(base, fg)
    return base.convert("RGB")


def main() -> None:
    bake = load_bake()
    far = make_far(bake)
    mid = make_mid(bake)
    fg = make_fg(bake)
    lighting = make_lighting(bake)
    preview = compose_preview(far, mid, fg, lighting)

    PUBLIC_SCENE.mkdir(parents=True, exist_ok=True)
    PUBLIC_LIGHT.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)

    outs = {
        PUBLIC_SCENE / "layer-far-bg-1920x1080.png": far,
        PUBLIC_SCENE / "layer-mid-buildings-1920x1080.png": mid,
        PUBLIC_SCENE / "layer-fg-occluder-1920x1080.png": fg,
        PUBLIC_LIGHT / "layer-lighting-1920x1080.png": lighting,
        PREVIEWS / "layered-preview-1920x1080.png": preview,
        PREVIEWS / "bake-reference-1920x1080.png": bake.convert("RGB"),
    }
    manifest_layers = {}
    for path, img in outs.items():
        img.save(path, optimize=True)
        rel = str(path.relative_to(ROOT))
        manifest_layers[path.name] = {
            "path": rel,
            "size": list(img.size),
            "mode": img.mode,
            "bytes": path.stat().st_size,
        }
        print(f"wrote {rel} ({path.stat().st_size} bytes, {img.mode})")

    # Never rewrite locked full bake / companions here — preserve attachment bytes/sha.

    meta = {
        "version": "v3-locked-layers",
        "issue": "LRM-579",
        "source": "caozs2-locked scene-full-1920x1080 (019f92b9)",
        "constraint": "no visual drift from locked bake; layers derived from bake pixels",
        "canvas": [W, H],
        "depth_bands": {"far_end": FAR_END, "mid_end": MID_END, "fg_start": FG_START},
        "layers": manifest_layers,
        "runtime_primary": "apps/client/public/narrative-pixel/scene/scene-full-1920x1080.png",
        "note": "Lobby keeps full bake as visible bar; far/mid/fg/lighting are true parallax plates for wiring",
    }
    (DOCS / "lobby-v3-layers-manifest.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("manifest ok")


if __name__ == "__main__":
    main()
