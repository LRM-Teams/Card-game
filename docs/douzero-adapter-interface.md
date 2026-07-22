# DouZero Adapter 接口（1 页，LRM-310）

面向：**大伟**（推理服务 / 规则协同）↔ **老胡**（游戏服务端调用层）。  
边界：本页只约定契约；**不接真 ckpt、不上线人机对战**，训模 Agent 进场后再切模型。

## 谁调用谁

```text
GameRoom / choosePlayWithDouZero
        │
        ▼
  DouZeroBotAdapter（TS，apps/server）
        │  POST ${DOUZERO_INFER_URL}/infer
        ▼
  douzero-server.py（常驻，默认 :8765）
        │  加载 landlord / landlord_up / landlord_down
        ▼
  超时 / 5xx / 非法 action → 规则机器人普通档（LRM-260）
```

## HTTP 契约

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 探活。期望 `{"status":"ok","models":["landlord","landlord_up","landlord_down"]}` |
| `POST` | `/infer` | 推理。Body = `DouZeroPlayState`（+ 可选 `topN`、`modelId`） |

**成功**：`200` + `{"action": number[]}`；若请求带 `topN`，另附  
`{"top":[{"action":number[],"value":number}, ...]}`（出牌提示用）。

**失败**：非 2xx / 超时 / 非法 JSON → TS 侧 `choosePlay` 返回 `null`，**不卡局**，fallback 普通档规则 bot。

## `DouZeroPlayState`（输入要点）

| 字段 | 含义 |
| --- | --- |
| `position` / `modelKey` | `landlord` \| `landlord_up` \| `landlord_down` |
| `hand` / `lastMove` / `bottom` | DouZero 点数编码（3–14, 17=2, 20/30 大小王） |
| `handCounts` / `playedCards` / `playHistory` | 公开信息 |
| `legalActions` | 规则引擎已过滤的合法动作（含跟牌时可 `[]`=过） |
| `topN` | 可选，提示按钮要 top-N |
| `modelId` | 可选 stub，训模侧按 id 选权重目录 |

点数编码与完整字段见 `docs/douzero-inference.md`。

## 环境变量（切换 ckpt **无需改代码**）

| 变量 | 作用 |
| --- | --- |
| `DOUZERO_INFER_URL` | 游戏服 → 推理服，如 `http://172.17.0.1:8765` |
| `DOUZERO_INFER_TIMEOUT_MS` | 单次 `/infer` 超时（默认 1500） |
| `DOUZERO_HEALTH_TIMEOUT_MS` | 探活超时（默认 800） |
| `DOUZERO_MODEL_ID` | 模型目录名（stub / 训模切换） |
| `DOUZERO_CKPT_DIR` | ckpt 根目录；实际路径 = `$CKPT_DIR[/$MODEL_ID]/{position}.ckpt` |
| `DOUZERO_LANDLORD_CKPT` 等 | 显式三身份路径（优先于目录约定） |

89 探活：`apps/server/scripts/douzero-health-check.sh` 或见 `docs/ops-89.md`。

## 验收对齐（脚手架）

1. 启动 / 对局前打 `[douzero] infer.health` 日志；不可用只告警。  
2. infer 超时/5xx → 普通档规则 bot，单测覆盖。  
3. 改 `DOUZERO_MODEL_ID` / `DOUZERO_CKPT_DIR` 即可换权重，TS 无硬编码路径。
