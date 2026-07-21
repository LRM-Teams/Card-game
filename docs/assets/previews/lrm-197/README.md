# LRM-197 结算「再来一局」单一 CTA

## 根因

`GameTable` 结算主按钮同时渲染了：

1. `<img src="/badges/restart.svg">`（整颗金色「↻再来一局」按钮图）
2. 文案「再来一局」

`restart.svg` 本身已是完整 CTA 胶囊，缩成 `.btn-icon` 后嵌进金色大按钮，形成 Frank 反馈的套娃。

## 修复

去掉内嵌 `restart.svg`，结算主按钮只保留文案「再来一局」（与大厅/出牌主 CTA 一致）。

## 截图

| 文件 | 说明 |
|------|------|
| `before-frank-feedback.png` | Frank 反馈：金色 CTA 内嵌微型「↻再来一局」 |
| `after-single-cta.png` | 修复后：按钮本体单一文案 |
| `after-settle-card.png` | 修复后结算卡全貌 |

本地复现：

```bash
pnpm --filter @card-game/client build
pnpm --filter @card-game/client preview --port 5173
cd apps/client && FX_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test e2e/lrm197-settle-cta.spec.ts
```
