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
