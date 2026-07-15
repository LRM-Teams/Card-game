# @card-game/server

斗地主后端：Node.js + Socket.IO。服务端权威，规则判定一律调用共享包 `@card-game/rules`（不在服务端另写）。

## 架构

```
src/
  index.ts          入口：HTTP 健康检查 + Socket.IO（:3000）
  transport.ts      Socket.IO 传输层：ClientAction → GameRoom，ServerEvent 下发（只搬运，不判规则）
  registry.ts       房间注册表（内存）：roomId→GameRoom、(roomId,seat)→socketId
  game/
    GameRoom.ts     服务端权威对局状态机（纯逻辑，可单测；不依赖 socket.io）
    bot.ts          补位机器人 + 最小合法 AI（占位，规则&AI 是 @大伟 的职责，后续替换）
    types.ts        服务端私有状态类型
tests/
  game.test.ts      状态机 / 权威校验 / 全机器人局跑通 单测
```

### 状态机
`WAITING → DEALING → BIDDING → PLAYING → SETTLED`

- 发牌：`deal()` → 17/17/17 + 3 底牌。
- 叫地主：**叫分制**（叫 1/2/3 分，最高分者为地主；全员不叫则重发，封顶后座位 0 当地主）。⚠️ 叫地主玩法（抢地主 vs 叫分）与倍数细则待 @caozs2 在 #110 拍板，定了我再对齐。
- 地主拿底牌（共 20 张，底牌公开）。
- 出牌回合：领出可自由出合法牌型；跟牌须能压过上家；两人连过则本轮结束、领出者继续。
- 出牌校验：`canPlay(prev, cards)` / `identifyHand` —— 全部走 `@card-game/rules`。
- 任一玩家出完牌即判胜负（地主 vs 两农民）并结算。
- 真人不足时自动补机器人到 3 人；机器人用最小合法 AI 自动行棋，让一局能跑完。

### 协议
消息类型一处定义在共享包 `packages/game-rules/src/protocol.ts`（`ClientAction` / `ServerEvent` / `GameStateSnapshot` / `ErrorCode`）。客户端 socket 收发：

```ts
// 客户端 → 服务端
socket.emit('action', { type: 'join', name: '老胡' });
socket.emit('action', { type: 'start' });
socket.emit('action', { type: 'bid', points: 3 });
socket.emit('action', { type: 'play', cards: ['spade3', ...] });
socket.emit('action', { type: 'pass' });

// 服务端 → 客户端
socket.on('event', (e: ServerEvent) => { /* 'snapshot' 可直接渲染整张牌桌；'dealt' 是你的手牌 */ });
```

## 运行

```bash
pnpm install
pnpm --filter @card-game/server dev      # :3000，热重载
pnpm --filter @card-game/server test     # 单测
pnpm typecheck                            # 根目录全量类型检查
```

健康检查：`GET http://localhost:3000/health` → `{ "ok": true }`

## 范围（MVP）
已实现：房间/匹配、对局状态机、服务端权威校验、真人不足自动补机器人、Socket.IO 协议。
暂未做（Phase 2）：账号/昵称、断线重连、观战/回放、积分/排行榜、生产打包（当前 `build` 等价 typecheck，dev 用 tsx 直跑）。
