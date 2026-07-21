# LRM-196 选中/提示抬起

验收截图（`/fx-demo?scene=select` + Playwright）：

| 文件 | 说明 |
|------|------|
| `select-lifted.png` | 提示/选中态：命中牌明显上移 |
| `select-cleared.png` | 清空后全部回落贴底 |
| `select-after-deal-hint.png` | 重播发牌后再提示：仍可抬起 |

本地复现：

```bash
pnpm --filter @card-game/client build
pnpm --filter @card-game/client preview --port 5173
cd apps/client && FX_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test e2e/lrm196-select-lift.spec.ts
```

## 89 现网烟测（2026-07-21 · tip `20458cd` / `index-Clt9f3H8.js`）

| 文件 | 说明 |
|---|---|
| `89-hint-lift-hand.png` | 提示命中牌明显抬起（手牌特写） |
| `89-hint-lift.png` | 全桌：提示 1/4 |
| `89-hint-cleared-hand.png` | 清空后回落 |
| `89-metrics.json` | `ty=-34` / `liftPx=34` / `--card-lift:-34px` |
