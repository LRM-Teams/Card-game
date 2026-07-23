# LRM-518 室内对局页接线清单（小雅 → 小林）

> 设计交付 LRM-520 · 基准 1920×1080 · 遵守 LRM-246/250 一屏无纵滚

## 场景层（`narrative-pixel/indoor/`）

| z | 资产 | 路径 | 说明 |
|---|---|---|---|
| 1 | 木墙+地板 | `indoor/layer-wall-1920x1080.png` | `object-fit: cover` 全屏 |
| 2 | 灯笼光晕 | `indoor/layer-lamp-glow-1920x1080.png` | `mix-blend-mode: screen; opacity: .55` |
| 3 | 牌桌台呢 | `/pixel/tiles/felt_texture.png` | 椭圆区平铺，保留 v2 质感 |
| 4 | 木轨 | `/pixel/tiles/rail_texture.png` | 椭圆 border + box-shadow 叠层 |
| 5 | 暗角 | `indoor/layer-vignette-indoor-1920x1080.png` | 前景压暗 |
| 10+ | HUD/手牌/出牌 | 现有 GameTable 结构 | 不改 `--ddz-vp-*` |

## 座位区热点（% of viewport）

| 座位 | left | top | width | height | 角标 |
|---|---|---|---|---|---|
| 自己（底） | 42 | 72 | 16 | 12 | — |
| 上家 | 42 | 8 | 16 | 10 | `badge_landlord` / `badge_farmer` |
| 下家 | 8 / 76 | 38 | 12 | 10 | 同上 |

装饰标记（可选）：`indoor/seat_landlord_marker.png` / `seat_farmer_marker.png`

## LRM-408 v2 复用（`/pixel/`）

| 用途 | 路径 | 三态 |
|---|---|---|
| 牌面/牌背 | `ui/card_front_template.png` / `card_back.png` | — |
| 主 CTA | `ui/btn_primary.png` | normal（v2 另有 pressed/disabled 在 PR #101） |
| 身份角标 | `ui/badge_landlord.png` / `badge_farmer.png` | — |
| 角色立绘 | `characters/landlord_character.png` / `farmer_character.png` | — |
| 结算 | `ui/victory_badge.png` / `defeat_badge.png` | — |
| 特效 | `effects/bomb.png` | — |

## TS 接线建议

```ts
// apps/client/src/lib/narrativeGameSceneLayout.ts（新建或扩展现有）
export const indoorGameLayers = { wall, lamp, vignette };
export const indoorSeatHotspots = { self, top, left, right };
```

`NarrativeSceneElements` 可复用摆放逻辑；对局页 z-index 低于手牌 dock。

## 验收截图

- 1920×1080 出牌态 docH ≤ 1080
- 390×844 一屏无纵滚
- tip/bundle/health 贴 LRM-518 issue
