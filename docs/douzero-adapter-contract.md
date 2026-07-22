# DouZero Adapter 接口契约（LRM-310 · 训模预备）

> 给训模 Agent / 老胡接线用。**本页为单一接口说明**；部署细节见 `douzero-inference.md`，89 巡检见 `ops-89.md`。  
> 边界：**不训模、不部署新 ckpt、不上线人机对战**；真上线等训模 Agent + PO 点名。

## 1. 调用链

```text
GameRoom（机器人回合）
  → choosePlayWithDouZero(ctx, adapter?)
      → adapter.choosePlay(DouZeroPlayState)   // HTTP / CLI，可选
      → 校验 legalActions + canPlay
      → 任一步失败 / 超时 / 无 adapter
          → botChoosePlay（@card-game/rules 普通档，LRM-260）
```

规则引擎仍是唯一合法性来源；模型输出不可信。

## 2. Adapter 接口（TypeScript）

定义位置：`apps/server/src/game/douzeroAdapter.ts`

```ts
interface DouZeroBotAdapter {
  choosePlay(state: DouZeroPlayState): Promise<DouZeroAction | null>;
  rankActions?(state: DouZeroPlayState, topN: number): Promise<RankEntry[] | null>;
}
```

| 返回值 | 含义 |
| --- | --- |
| `DouZeroAction`（数字数组） | 候选出牌（DouZero 编码） |
| `[]` | 过牌（仅当 `prev` 非空时有效） |
| `null` | 失败 → **必须** fallback 规则机器人，不得抛错卡局 |

## 3. `DouZeroPlayState`（stdin / POST `/infer` body）

| 字段 | 说明 |
| --- | --- |
| `position` / `modelKey` | `landlord` \| `landlord_up` \| `landlord_down` |
| `hand` | 当前手牌（DouZero 点数） |
| `lastMove` | 上一手有效牌；空数组 = 自由出 |
| `bottom` | 地主底牌 3 张 |
| `handCounts` | 各座位剩余张数 |
| `playedCards` | 已打出牌集合 |
| `playHistory` | 有序出/过历史 |
| `legalActions` | **工程侧已过滤的合法动作**；模型输出必须命中其一 |

编码：`3..10=3..10, J=11, Q=12, K=13, A=14, 2=17, 小王=20, 大王=30`（无花色）。

## 4. 配置（ckpt 切换无需改代码）

| 变量 | 用途 |
| --- | --- |
| `DOUZERO_INFER_URL` | 常驻服务根 URL（优先，如 `http://172.17.0.1:8765`） |
| `DOUZERO_INFER_COMMAND` | 进程式 CLI（备选） |
| `DOUZERO_INFER_TIMEOUT_MS` | 超时 ms，默认 `1500` |
| `DOUZERO_LANDLORD_CKPT` | 地主权重路径 |
| `DOUZERO_LANDLORD_UP_CKPT` | 地主上家（农） |
| `DOUZERO_LANDLORD_DOWN_CKPT` | 地主下家（农） |

切换权重：改环境变量并重启 **8765 infer 进程**（或 CLI 所在 host）；**游戏 server 不用改代码**。未配置 URL/COMMAND 时全程走 LRM-260。

## 5. 探活与 fallback（脚手架验收）

```bash
# 8765 探活（在 89 或能访问 docker bridge 的机器上）
curl -sS -m 2 http://172.17.0.1:8765/health | jq .
# 期望：{"status":"ok","models":["landlord","landlord_up","landlord_down"]}
# 失败（超时/非 200）：对局仍继续，机器人用 LRM-260 普通档
```

Fail-closed 规则：超时 / 5xx / 非法 action / 不在 `legalActions` / `canPlay` 失败 → `botChoosePlay`（普通档）。单测：`apps/server/tests/douzeroAdapter.test.ts`。

## 6. 训模 Agent 接入检查清单

1. 三身份 ckpt 路径写入上表 env（勿提交 git）。
2. 起 `douzero-server.py`（或兼容 `/health` + `/infer`）。
3. 游戏 server 设 `DOUZERO_INFER_URL`。
4. 先 curl health，再开「AI 补位」局；非法输出不得崩局。

**协作**：接口/单测/规则 fallback — 大伟；89 接线/探活日志/滚版 — 老胡。
