# DouZero 推理适配器接口（LRM-310）

面向：服务端（老胡）↔ 规则/推理（大伟）↔ 训模 Agent。  
边界：**训模冻结期只探活 + fallback**；不接新 ckpt、不上线人机对战。

## 调用链

```
GameRoom.drainBots
  → choosePlayWithDouZero(ctx, adapter?)
       ├─ adapter.choosePlay(state)  // HTTP /infer 或 CLI
       └─ 失败/超时/非法 → botChoosePlay（规则机器人普通档，LRM-260）
```

TS 入口：`apps/server/src/game/douzeroAdapter.ts`  
配置/探活：`apps/server/src/game/douzeroConfig.ts`  
常驻推理：`apps/server/scripts/douzero-server.py`

## HTTP 契约（常驻）

| 方法 | 路径 | 请求 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/health` | — | `{status:"ok", models, modelId, ckptDir?}` | 非 200 / 连不上 |
| POST | `/infer` | `DouZeroPlayState` JSON（可选 `topN`） | `{action:[…]}` 或带 `top` | 5xx → TS 当 `null` |

`DouZeroPlayState` 字段：`position` / `modelKey` / `hand` / `lastMove` / `bottom` / `handCounts` / `playedCards` / `playHistory` / `legalActions`（DouZero 点数编码）。

## 环境变量（切换 ckpt 无需改代码）

| 变量 | 谁读 | 说明 |
| --- | --- | --- |
| `DOUZERO_INFER_URL` | 游戏服 | 例 `http://172.17.0.1:8765`；未设则整条 DouZero 关闭 |
| `DOUZERO_INFER_TIMEOUT_MS` | 游戏服 | HTTP 超时，默认 1500 |
| `DOUZERO_MODEL_ID` / `DOUZERO_CKPT` | 双方 | 逻辑模型 id，写入 `/health` |
| `DOUZERO_CKPT_DIR` | 推理进程 | ckpt 根目录 stub |
| `DOUZERO_LANDLORD_CKPT` 等 | 推理进程 | 三角色真实路径 |
| `DOUZERO_INFER_COMMAND` | 游戏服 | 可选 CLI 兜底（process-per-move） |

训模 Agent 换模型：改上述 env → 重启 `douzero-server.py` → `curl …/8765/health` 看 `modelId`；**不必改 TS**。

## Fallback（不卡局）

任一情况游戏服继续出牌：

- `/infer` 超时、网络错误、非 2xx
- action 非法 / 不在 `legalActions` / 回选手牌失败
- adapter `throw`

→ `botChoosePlay`（普通档启发式）。单测见 `apps/server/tests/douzeroAdapter.test.ts`、`douzeroConfig.test.ts`。

## 探活

游戏服启动调用 `logInferProbeOnBoot()`，stdout JSON：

- `douzero.probe.ok` / `douzero.probe.fail` / `douzero.probe.skip`

运维 curl 见 `docs/ops-89.md`「DouZero 推理脚手架探活」。
