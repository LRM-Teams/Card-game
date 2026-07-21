# LRM-168 关键动效演示素材

- `lrm168-deal.webm` / `turn` / `bomb` / `settle`：Playwright 录屏举证
- `stills/*.png`：同场景静帧对照
- 本地重录：`pnpm --filter @card-game/client dev` 后执行 `pnpm --filter @card-game/client fx:record`（需 `FX_BASE_URL` 指向实际 Vite 端口）
- 演示页：`/fx-demo?scene=deal|turn|bomb|rocket|settle`
- 时长常量：`apps/client/src/lib/motionSpec.ts`
