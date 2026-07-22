# LRM-314 接入规格（给小林 · LRM-316）

> design-first 交付；客户端接线见本节 + `design-tokens.md` §13。

## 资产路径

| 资产 | 文档源 | 客户端引用 | 逻辑尺寸 |
|---|---|---|---|
| 台呢纹理 | `docs/assets/table/felt-texture.svg` | `/table/felt-texture.svg` | 512×512 平铺 |
| 木轨纹理 | `docs/assets/table/rail-strip.svg` | `/table/rail-strip.svg` | 64×64 平铺（box-shadow 增强） |
| 房间背景 | `docs/assets/table/room-bg.svg` | `/table/room-bg.svg` | 1920×1080 cover |

## 推荐接线（保留 token + LRM-246）

```css
/* 1. 房间背景 — 替换 body 纯渐变，保留暗角 token 叠层 */
body.app--game-page {
  background:
    url('/table/room-bg.svg') center / cover no-repeat,
    linear-gradient(135deg, var(--ddz-room-from), var(--ddz-room-mid) 48%, var(--ddz-room-to));
}

/* 2. 台呢 — felt 平铺 + 现有径向 token 叠层 */
.app--game .table {
  background:
    radial-gradient(ellipse at 50% 28%, var(--ddz-felt-soft), transparent 56%),
    radial-gradient(ellipse at 50% 42%, var(--ddz-felt-600) 0%, var(--ddz-felt-mid) 42%, var(--ddz-felt-700) 68%, var(--ddz-felt-900) 100%),
    url('/table/felt-texture.svg') center / 512px 512px repeat;
  /* rail box-shadow 保持不变 — 可用 rail-strip 作 ::before 外圈增强（可选） */
}

/* 3. 木轨增强（可选）— 在现有 box-shadow 外再叠一圈纹理 */
.app--game .table::before {
  /* 保留现有 inset 发丝线；外圈可加 */
  box-shadow: 0 0 0 var(--ddz-rail-thickness) transparent;
  background: url('/table/rail-strip.svg') center / 64px 64px repeat;
  -webkit-mask: radial-gradient(ellipse at 50% var(--ddz-vp-ellipse-y), #000 68%, transparent 70%);
  mask: radial-gradient(ellipse at 50% var(--ddz-vp-ellipse-y), #000 68%, transparent 70%);
  opacity: 0.35;
  mix-blend-mode: overlay;
}
```

## 硬约束

- **不得**改动 `--ddz-vp-*` 预算与 `.app--game` 一屏锁高（LRM-246）。
- **不得**回归手牌贴底（LRM-250 `margin-top: auto`）。
- **不得**重新引入金色桌沿泛光（LRM-166）。
- 移动端 ≤680px：`--ddz-rail-thickness-mobile` 仍生效；felt 平铺可缩至 `384px`。
