# 抢地主 + 加倍 消息协议（对标腾讯欢乐斗地主）

> 状态：协议层已定义（老胡），MVP 服务端仍为单轮叫地主；多轮结算 + 倍数由 game-rules 补齐（大伟），UI 由小林落地。
> 单一事实来源：`packages/game-rules/src/protocol.ts`。本文件只做流程说明。

## 阶段（GamePhase）

```
WAITING → DEALING → BIDDING → DOUBLING → PLAYING → SETTLED
                       │(叫/抢)   │(加倍)
```

- `BIDDING`：含两个轮次，用 `BidRound` 区分：
  - `call`（叫地主轮）：从首叫位起，依次 `claim`(叫) / `pass`(不叫)。首个 `claim` 者成临时地主，进入 grab 轮。
  - `grab`（抢地主轮）：其余玩家依次 `claim`(抢) / `pass`(不抢)；抢过后可被反抢，直到一圈无人再抢。最后一个 `claim` 者当地主。
  - `call` 轮全 `pass` → 流局重发。
- `DOUBLING`（新增）：地主敲定、底牌公开后，出牌前。每名玩家一次 `DoubleChoice`：`double`(加倍) / `super`(超级加倍) / `pass`(不加倍)。

## 客户端 → 服务端（ClientAction）

| action | 语义 |
| --- | --- |
| `{ type: 'bid', choice: 'claim' \| 'pass' }` | 叫/抢：服务端按当前 `BidRound` 判定是「叫」还是「抢」，客户端不需要区分 |
| `{ type: 'double', choice: 'double' \| 'super' \| 'pass' }` | 加倍环节决策（**新增**） |

## 服务端 → 客户端（ServerEvent）

| event | 语义 |
| --- | --- |
| `{ type: 'bid', seat, choice, round? }` | 某玩家叫/抢；`round` 供客户端选气泡文案（叫地主/抢地主），缺省视为 `call` |
| `{ type: 'doubled', seat, choice }` | 某玩家加倍决策（公开，**新增**） |

## 快照（GameStateSnapshot 新增字段）

| 字段 | 说明 |
| --- | --- |
| `bidRound: BidRound \| null` | 当前叫抢轮次，仅 BIDDING 有意义 |
| `bids: { seat, choice, round }[]` | 叫/抢公开历史，供气泡/回顾 |
| `doubles: { seat, choice }[]` | 加倍环节各家选择（公开） |

## 倍数口径（对标欢乐斗地主，由 game-rules `multiplier` 统一折算 —— 大伟）

- 叫地主：基础倍数 1。
- 每一次「抢/反抢」：×2。
- 加倍 `double` ×2、超级加倍 `super` ×4、不加倍 ×1。
- 炸弹/王炸/春天/明牌沿用现有 `multiplier` 规则。

## 待办依赖

- **@大伟（game-rules）**：`resolveBidding` 现为单轮线性（最后 claim 者胜）；需多轮 `call → grab → 反抢` resolver + 基于叫/抢/加倍的倍数累积函数。
- **@小林（client）**：叫/抢按钮与气泡、加倍面板，渲染新增快照字段。
- **老胡（server）**：BIDDING 增加 grab 轮状态机 + DOUBLING 阶段驱动，接上上面的 resolver。当前 MVP 仍走单轮，`bidRound` 恒为 `call`、`doubles` 恒为空。
