# LRM-199 出牌不整手刷新 — 89 烟测

- tip: `dbb561d`（含 PR#56 `dbf273e`）
- live bundle: `assets/index-bjxd0aFy.js`
- 入口: http://82.157.184.89:8088/

| 文件 | 说明 |
|------|------|
| 01-89-hand-before-play.png | 出牌前手牌 |
| 02-89-hand-after-play.png | 出牌后手牌（仅少打出的牌） |
| 03-89-table-after-play.png | 桌面出牌区已更新 |

断言：出牌前后 `.hand.is-dealing` 均为 0（见 `apps/client/e2e/lrm199-no-refresh-89.spec.ts`）。
