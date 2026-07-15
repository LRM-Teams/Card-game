# apps/client

客户端（负责人：@小林）。

- React + Vite + TanStack (Query + Router)，牌局状态用 Zustand 镜像。
- 牌桌 / 手牌 UI、选牌出牌交互、实时状态展示。
- 出牌提示：复用 `@card-game/rules` 的 `identifyHand` / `canBeat` 给玩家"能否成牌 / 压过"的提示，**只做展示、不做权威判定**（权威在服务端）。

## 当前状态：静态原型

- `deal()` 在本地造数据，交互也是本地的，**尚未联网**。
- 路由：`/`（大厅）→ `/room`（房间）→ `/game`（牌桌）。
- 牌桌支持选牌 + 出牌 / 不出 / 重开；机器人暂不真实出牌。
- 等老胡定稿 Socket.IO 协议后，`store/gameStore.ts` 改为镜像服务端事件。

## 开发

```bash
# 在仓库根目录
pnpm install
pnpm --filter @card-game/client dev      # Vite dev :5173
pnpm --filter @card-game/client build    # typecheck + vite build
pnpm --filter @card-game/client typecheck
```

## 目录

```
src/
  main.tsx            入口
  router.tsx          路由（大厅 / 房间 / 牌桌）
  store/gameStore.ts  Zustand 状态（现 mock，联网后镜像服务端）
  mock/deal.ts        本地发牌（复用 @card-game/rules 的 deal()）
  lib/cards.ts        花色 / 颜色 / 牌型名（展示用）
  components/         Lobby / Room / GameTable / HandView / CardView
  styles.css
```
