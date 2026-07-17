# 抢地主 + 加倍 消息协议（对标腾讯欢乐斗地主）

> 状态：**协议 + 服务端状态机 + 倍数规则均已实现并测过**（老胡）。UI（叫/抢按钮气泡、加倍面板）待小林。
> 单一事实来源：`packages/game-rules/src/protocol.ts`（协议类型）、`bidding.ts`/`multiplier.ts`（规则）。本文件做流程说明。
> 叫抢采用单轮线性 A 方案（阿策 #110 定）：每人各表态一次，最后 claim 者当地主；如需「反抢多轮」是另一条规则决策，找阿策拍板。

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

## 倍数口径（对标欢乐斗地主，由 game-rules 统一折算）

累积顺序：`createMultiplier` → `applyGrab`（抢地主）→ `applyDoubles`（加倍环节）→ 出牌时 `applyPlay`（炸弹/王炸）。

- 叫地主：基础倍数 1（`grabFactor`：首个 claim 不翻）。
- 每多一次「抢」：×2（`grabFactor` = 2^抢次数）。
- 加倍 `double` ×2、超级加倍 `super` ×4、不加倍 ×1；各家连乘（`applyDoubles`）。
- 炸弹/王炸/春天/明牌沿用现有 `multiplier` 规则。

## 实现与分工

- **game-rules（已实现）**：`grabFactor` / `roundAt`（bidding.ts）、`applyGrab` / `applyDoubles` / `doubleFactor`（multiplier.ts）；单测覆盖。→ 请大伟 review 规则口径。
- **server（已实现）**：BIDDING 输出 `round` 标签、地主敲定后 `applyGrab` → 进 `DOUBLING`（地主先、两农民后）→ `applyDoubles` → PLAYING；bot 自动叫/抢/加倍；snapshot 填 `bidRound`/`bids`/`doubles`。
- **client（待做，@小林）**：叫/抢按钮与气泡（读 `bids[].round`）、加倍面板（`double` action + `doubled` 事件 + `doubles` 快照）。
