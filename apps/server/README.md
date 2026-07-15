# apps/server

后端 / 游戏服务器（负责人：@老胡）。

- Node.js + Socket.IO
- 房间 / 对局内存状态机、实时同步
- 真人不足自动补机器人
- **服务端权威校验**：玩家出牌时调用 `@card-game/rules` 的 `canPlay(prev, cards)` / `identifyHand` 判定合法性，非法一律拒。

> 占位目录，骨架由 @老胡 起步。规则判定请 `import { canPlay, identifyHand, canBeat } from '@card-game/rules'`，**不要在后端另写一套**。
