# 身份徽章与行动高亮规格（LRM-167）

> Owner：小雅。接入：小林。对标 baseline 状态3「角色图标」行。
> 原则：身份常驻弱权重；轮到谁用金色脉冲；二者视觉通道分离，禁止徽章+文字双叠。

## 1. 定稿资产

| 资产 | 路径 | 尺寸 | 视觉强度 | 说明 |
|---|---|---|---|---|
| 地主角标 | `docs/assets/badges/landlord.svg` → `/badges/landlord.svg` | 96×96 SVG；座位角标 **28×28** | 弱：红金静态度，无脉冲 | 皇冠图标，**无「地主」文字** |
| 农民角标 | `docs/assets/badges/farmer.svg` → `/badges/farmer.svg` | 96×96 SVG；座位角标 **24×24**（略小于地主） | 更弱：青绿静态度 | 麦穗图标，**无「农民」文字** |
| 地主角色图 | `docs/assets/identity/landlord-character.svg` | 160×160；结算/揭示 72–96 | 揭示/结算用 | 去文字；牌桌座位**优先角标**，角色图留给揭示弹入 |
| 农民角色图 | `docs/assets/identity/farmer-character.svg` | 同上 | 同上 | 同上 |

版权：内部自绘，可商用。

## 2. 信息通道分离

| 通道 | 信号 | Token / 实现 | 禁止 |
|---|---|---|---|
| **身份（常驻）** | 头像角标 SVG + 头像静态色环 | `--ddz-identity-landlord-ring` / `--ddz-identity-farmer-ring`；无 animation | 金色脉冲、整座金色描边、身份文字牌、`（地主）` 文案叠名 |
| **行动（瞬时）** | 座位外框金色脉冲 | `--ddz-action-glow` + `ddz-turn-pulse`；class `is-turn` | 用身份色（红/绿）做轮到谁高亮；把身份环做成脉冲 |

同时存在时（地主且轮到他）：**角标/身份环保持静态**，仅外框金色脉冲 — 一眼能分「是地主」和「轮到他」。

## 3. 客户端落地要点（已接一版，可同 PR）

1. `SeatBadge`：头像用剪影；角标 `/badges/{role}.svg`；`aria-label` 含身份；**名字旁不写身份字**。
2. 我方 `RoleBadge`：只显示图标，文案仅 `aria-label`。
3. class：`role-landlord` / `role-farmer` = 身份；`is-turn` = 行动（勿与身份共用一套 glow）。
4. 颜色一律 `--ddz-*`，不硬编码。

## 4. 出牌态对照预览

见 `docs/assets/previews/lrm-167-play-identity-vs-turn.svg`（左：仅身份；右：身份+行动脉冲）。
