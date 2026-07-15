# Card-game — 斗地主网络对战游戏

支持真人 + 机器人玩家的斗地主网络对战游戏。全栈 TypeScript。

## 技术栈

- **共享包** `packages/game-rules`：牌型识别、大小比较、合法判定、叫地主、结算 —— **牌型规则只在此处实现一处**，服务端校验与客户端提示共用同一套判定。
- **后端** `server`（老胡）：Node.js + Socket.IO，房间/对局内存状态机、实时同步、缺人补机器人、服务端权威校验。
- **客户端** `client`（小林）：React + Vite + TanStack(Query + Router) + Zustand，牌桌/手牌 UI、出牌交互。

## 仓库结构

```
.
├── packages/
│   └── game-rules/        # 共享规则引擎 & 协议类型（大伟）
├── server/                # 后端（老胡）
└── client/                # 前端（小林）
```

## 开发

需 Node >= 20，推荐 pnpm。

```bash
pnpm install               # 安装依赖（workspaces）
pnpm -r test               # 跑全部单测
pnpm -r typecheck          # 类型检查
```

## 协作约定

- 牌型规则**只允许在 `packages/game-rules` 实现**，老胡只调用、小林只显示。
- 状态以服务端为准，防作弊。
- 改代码流程：`git pull` → 改 → 本地自测通过 → `git pull --rebase` 解决冲突 → commit → push → 在 #斗地主开发 通知审核。**绝不 `git push -f`。**
