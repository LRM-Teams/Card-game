# LRM-522 结算/特效接线清单（小雅 → 小林）

> 配合 LRM-521 全流程演示 · Narrative Pixel 室内茶馆调性

## 结算面板（`narrative-pixel/settle/`）

| 资产 | 路径 | 用途 |
|---|---|---|
| 木框底板 | `settle/panel_backdrop_480x360.png` | `.result-card` 背景 |
| 胜/负插画 | `settle/victory_illustration_128.png` / `defeat_illustration_128.png` | 替换 `PIXEL.ui.victoryBadge` / `defeatBadge` |
| 再来一局 | `settle/btn_rematch_{default,hover,press}.png` | 三态 CTA |

## 特效徽章（`narrative-pixel/fx/`）

| 资产 | 路径 | 三态 | 用途 |
|---|---|---|---|
| 加倍 | `fx/badge_double_{default,active,dim}.png` | ✓ | 座位角标 / `double-badge-corner` |
| 春天 | `fx/stamp_spring_96x48.png` | — | 倍数 breakdown 角标 |
| 炸弹 | `fx/stamp_bomb_96x48.png` | — | 倍数 breakdown 角标 |
| 爆点 | `fx/overlay_bomb_flash_128.png` | — | 炸弹出牌特效 overlay |

## TS 接线建议

```ts
// apps/client/src/lib/narrativeSettleAssets.ts（新建）
export const NP_SETTLE = {
  panel: '/narrative-pixel/settle/panel_backdrop_480x360.png',
  victory: '/narrative-pixel/settle/victory_illustration_128.png',
  defeat: '/narrative-pixel/settle/defeat_illustration_128.png',
  rematch: { default, hover, press },
};
export const NP_FX = { double: {...}, spring, bomb, bombFlash };
```

`GameTable` settled 分支与 `FxDemo?scene=settle|bomb|double` 优先读 narrative 路径，fallback `/pixel/`。

## 验收

- 1920 + 390 结算态预览：`docs/assets/previews/lrm-522/`
- `settle-fx-manifest.json` 与 `asset_validator` PASS
