# LRM-316 牌桌背景资产接入

- 规格：`docs/assets/table/integration-spec.md` + `docs/doudizhu-design-tokens.md` §13
- 实现：`apps/client/src/styles.css`（`body.app--game-page` + `.app--game .table`）
- 资产：`apps/client/public/table/{felt-texture,rail-strip,room-bg}.svg`

## 验收截图（Playwright）

| 视口 | 文件 |
|---|---|
| 1920×1080 | `01-play-state-1920x1080.png` |
| 390×844 | `02-play-state-390x844.png` |

```bash
cd apps/client && pnpm exec vite --host 127.0.0.1 --port 5173 &
FX_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test e2e/lrm316-table-bg.spec.ts
```

验收口径：出牌态一屏无纵滚（LRM-246），手牌贴底（LRM-250），`--ddz-vp-*` 未改动。
