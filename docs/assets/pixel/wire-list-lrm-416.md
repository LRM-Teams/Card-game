# LRM-416 像素风接线清单（对齐 LRM-417）

> 设计源：`docs/doudizhu-pixel-ui-spec.md` · 资产根：`/pixel/`

## 全局

| 任务 | 选择器 / 文件 | 资产 / Token |
|---|---|---|
| 像素渲染 | `img.pixel`, `.pixel-bg` | `image-rendering: pixelated` · `--ddz-px-render` |
| 页面底图 | `body`, `.app--game` | `/pixel/backgrounds/room_bg.png` cover |
| 圆角收敛 | `.panel`, `.btn` | `--ddz-px-radius-sm/md` 替换大圆角 |

## 大厅 `Lobby.tsx`

| 任务 | 选择器 | 资产 |
|---|---|---|
| Hero | `.lobby-hero__art` | `/pixel/backgrounds/lobby_hero.png` |
| 主 CTA | `.btn.primary.cta` | `/pixel/ui/btn_primary.png` border-image 九宫格 |
| 面板框 | `.panel.lobby` | room_bg + `--ddz-px-panel-border` |

## 对局 `GameTable.tsx` / `styles.css`

| 任务 | 选择器 | 资产 |
|---|---|---|
| 台呢 | `.app--game .table` | `/pixel/tiles/felt_texture.png` 64 repeat + radial token |
| 木轨 | `.table` box-shadow + `::before` optional | `/pixel/tiles/rail_texture.png` overlay 0.35 |
| 地主角标 | `.seat-badge.landlord` | `/pixel/ui/badge_landlord.png` |
| 农民角标 | `.seat-badge.farmer` | `/pixel/ui/badge_farmer.png` |
| 牌面 | `CardView` | `/pixel/ui/card_*.png` **单图层** |
| 出牌按钮 | `.controls .btn.primary` | `/pixel/ui/btn_primary.png` |
| 加倍 HUD | bidding overlay | `/pixel/ui/double_badge.png` |
| 炸弹特效 | play fx hook | `/pixel/effects/bomb.png` |

## 硬约束（勿破）

- `--ddz-vp-*` 一屏预算（LRM-246）
- `.hand { margin-top: auto }`（LRM-250）
- 全屏唯一金色主 CTA
- 牌面禁止 paper SVG + HTML 角标双层（LRM-406）

## 烟测

- [ ] 1920×1080 `/` 大厅像素 hero + CTA
- [ ] 1920×1080 `/game` 台呢纹理 + 手牌 + 出牌按钮
- [ ] 390×844 两页无纵滚
- [ ] Frank 加倍场景牌面无重影
