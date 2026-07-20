# CI/CD 约定（LRM-157）

目标：每个 PR / main 推送自动验证 **后端 + 前端** 可部署性，health 失败则阻断合并。

## 流水线阶段（GitHub Actions）

| 阶段 | 命令 / 检查 | 失败即红 |
|------|-------------|----------|
| install | `corepack enable && pnpm install --frozen-lockfile` | ✓ |
| rules | `pnpm --filter @card-game/rules test` | ✓ |
| server | `pnpm --filter @card-game/server test` + `pnpm --filter @card-game/server exec tsc --noEmit` | ✓ |
| client build | `VITE_SERVER_URL="" pnpm --filter @card-game/client build` | ✓ |
| **server health** | 起进程 `PORT=3099 CLIENT_DIST=<client dist> pnpm --filter @card-game/server start`，`curl -sf http://127.0.0.1:3099/health` 含 `"ok":true` | ✓ |
| **client health** | 同上进程，`curl -sf http://127.0.0.1:3099/` 返回 HTML 且含 `root` 或 `index` | ✓ |

实现：`.github/workflows/ci.yml`（LRM-158）；本文件为验收对照。

## 部署后（89 / 生产）

- `curl -sf http://<gateway>/health` → 200 JSON
- `curl -sf -o /dev/null -w "%{http_code}" http://<gateway>/` → 200
- Socket.IO：浏览器一局能连上并完成发牌（人工或 smoke 脚本，可后续加）

## PR 合并节奏

- CR 通过 + CI 绿 → 可合 main；与 MVP 抢地主 **A 方案**冲突的「多轮抢地主/加倍」大 PR（#4–#7）**暂不合**，待产品单开再合。
- 已被 main 覆盖的 agent 分支 PR（如 #9–#13 相对 PR#10）由维护者 **close 并注明 superseded**。
