# 斗地主前端全量图形资产规格（LRM-140）

> Owner：小雅。接入：小林。目标：所有关键前端视觉先有明确图形资产或矢量规范，再进入客户端落地；不再只用 CSS 色块/文字占位。
>
> 对标边界：学习腾讯「欢乐斗地主」的信息层级、反馈强度和精致度；所有图形为内部自绘 SVG，可商用，不复制竞品原图。

## 1. 资产总览

| 模块 | 资产 | 路径 | 规格 | 用途 | 版权 |
| --- | --- | --- | --- | --- | --- |
| 扑克牌 | 普通牌模板 | `docs/assets/cards/card-front-template.svg` / `apps/client/public/cards/card-front-template.svg` | 104x148 SVG；客户端逻辑尺寸建议 52x74 | 3-A-2 普通牌通用卡面，点数/花色由组件替换 | 内部自绘，可商用 |
| 扑克牌 | 牌背 | `docs/assets/cards/card-back.svg` / `apps/client/public/cards/card-back.svg` | 104x148 SVG；对手缩略 40x56 | 对手手牌、牌堆、未翻底牌 | 内部自绘，可商用 |
| 扑克牌 | 小王 | `docs/assets/cards/joker-small.svg` / `apps/client/public/cards/joker-small.svg` | 104x148 SVG；逻辑 52x74 | 小王专用牌面 | 内部自绘，可商用 |
| 扑克牌 | 大王 | `docs/assets/cards/joker-big.svg` / `apps/client/public/cards/joker-big.svg` | 104x148 SVG；逻辑 52x74 | 大王专用牌面 | 内部自绘，可商用 |
| 身份 | 地主角标 | `docs/assets/badges/landlord.svg` / `apps/client/public/badges/landlord.svg` | 96x96 SVG；座位角标 28x28 | 座位身份常驻（弱权重，无文字） | 内部自绘，可商用 |
| 身份 | 农民角标 | `docs/assets/badges/farmer.svg` / `apps/client/public/badges/farmer.svg` | 96x96 SVG；座位角标 24x24 | 座位身份常驻（弱于地主，无文字） | 内部自绘，可商用 |
| 身份 | 地主角色图 | `docs/assets/identity/landlord-character.svg` / `apps/client/public/identity/landlord-character.svg` | 160x160 SVG；揭示/结算 72–96 | 地主揭示弹入、结算胜方（去文字） | 内部自绘，可商用 |
| 身份 | 农民角色图 | `docs/assets/identity/farmer-character.svg` / `apps/client/public/identity/farmer-character.svg` | 160x160 SVG；揭示/结算 72–96 | 农民揭示/结算（去文字） | 内部自绘，可商用 |
| 状态 | 炸弹 | `docs/assets/states/bomb.svg` / `apps/client/public/states/bomb.svg` | 160x120 SVG | 炸弹牌型爆点反馈 | 内部自绘，可商用 |
| 状态 | 春天 | `docs/assets/states/spring.svg` / `apps/client/public/states/spring.svg` | 160x120 SVG | 春天/反春结算提示 | 内部自绘，可商用 |
| 状态 | 加倍徽章 | `docs/assets/states/double-badge.svg` / `apps/client/public/states/double-badge.svg` | 120x120 SVG | 加倍/超级加倍反馈，可由组件替换数字 | 内部自绘，可商用 |
| 状态 | 胜利徽章 | `docs/assets/states/victory-badge.svg` / `apps/client/public/states/victory-badge.svg` | 180x140 SVG | 结算胜利标题 | 内部自绘，可商用 |
| 状态 | 惜败徽章 | `docs/assets/states/defeat-badge.svg` / `apps/client/public/states/defeat-badge.svg` | 180x140 SVG | 结算失败标题 | 内部自绘，可商用 |
| 大厅 | 主视觉插画 | `docs/assets/lobby/hero-illustration.svg` / `apps/client/public/lobby/hero-illustration.svg` | 720x320 SVG | 大厅品牌主视觉（暖红金 + 角色剪影 + 浮牌） | 内部自绘，可商用；见 `docs/assets/lobby/LICENSE.md` |

## 2. 扑克牌设计规范（LRM-206 精修）

> 对标欢乐斗地主「纸质感」体验层级；资产为内部自绘 SVG，见 `docs/assets/cards/LICENSE.md`。预览：`docs/assets/previews/lrm-206/card-face-preview.png`。

### 2.1 资产与尺寸

- 普通牌不导出 52 张位图，采用「通用纸张模板 + 组件点数/花色」方案。
- 资产画布：**104×148** SVG（@2x）；客户端逻辑尺寸：主手牌/出牌 **52×74**；对手背牌 **40×56**；底牌展示 **46×64**。
- 大小王必须引用专用 SVG（`/cards/joker-small.svg`、`/cards/joker-big.svg`），禁止纯文字占位。
- 牌背引用 `/cards/card-back.svg`。花色矢量可选：`/cards/suit-{spade,heart,club,diamond}.svg`。

### 2.2 可测规格 · 色值

| Token / 用途 | 值 | 验收 |
| --- | --- | --- |
| `--ddz-suit-red` | `#c62828` | 红桃/方片/大王标签，打印红（比旧 `#c72d2d` 更稳） |
| `--ddz-suit-ink` | `#1a1f2e` | 黑桃/梅花/小王标签 |
| `--ddz-card-stroke` | `#c9a056` | 外描边金 |
| `--ddz-card-paper-0` | `#fffef9` | 纸面渐变起点 |
| `--ddz-card-paper-1` | `#fbf6ea` | 纸面中段 |
| `--ddz-card-paper-2` | `#e6d3a8` | 纸面终点（米金） |
| `--ddz-joker-small` | `#1a2f4a` | 小王主色（冷蓝） |
| `--ddz-joker-big` | `#b71c1c` | 大王主色（暖红） |
| 选中描边 | `#e8bc3a`（`--ddz-gold-500`） | 外描边 2–3px |

### 2.3 可测规格 · 字号层级（逻辑 52×74 显示）

| 层级 | 用途 | 显示字号 | 资产 @104 参考 |
| --- | --- | --- | --- |
| L1 | 角标点数（A/K/…） | 11px / weight 700 | 22 |
| L2 | 角标花色 | 7–8px | ~14 |
| L3 | 中心花色（主锚） | 24–28px | ~48–56 |
| L4 | 大小王「JOKER」 | 7–8px | 11 |
| L5 | 大小王「小王/大王」 | 9–10px | 14 |

字体：点数用衬线（Georgia / Times）；中文标签用 `--ddz-font-body`。

### 2.4 可测规格 · 圆角 / 描边 / 阴影

| 项 | 值 |
| --- | --- |
| 显示圆角 | `--ddz-radius-card: 8px`（资产 rx≈10 @104） |
| 内发丝线 | inset 4px，rx≈5–7，描边 `#fff8e8` / 弱金 `#d4b06a` @35% |
| 外描边 | 1–2px `#c9a056` |
| 常态阴影 | `--ddz-shadow-card: 0 6px 12px rgba(0,0,0,.22)` |
| 选中阴影 | `--ddz-glow-gold` + `0 12px 18px rgba(0,0,0,.35)` |

### 2.5 可测规格 · 状态

| 状态 | 视觉（可测） |
| --- | --- |
| 常态 | 纸面渐变 + 金描边 + 常态阴影 |
| 选中 / 抬起 | `translateY(-10px~-34px)`（手牌区用 `--card-lift`）+ 外描边 `#e8bc3a` 2–3px + 选中阴影 |
| 不可出 | `.is-unplayable`：`filter: saturate(0.55)` + `opacity: 0.55`（饱和约 -45%） |
| 已出 | 正常亮度，进入中央出牌区；无选中金边 |
| 禁用（无点击） | `cursor: default`；若同时不可出则叠加不可出滤镜 |

### 2.6 大小王辨识红线

- 小王：冷蓝小丑帽 + 冰蓝铃铛；标签色 `#1a2f4a`。
- 大王：暖红金火焰纹章；标签色 `#b71c1c`。
- 缩略到 40×56 时仍须一眼分出冷/暖色相，不得仅靠文字。

## 3. 身份与角色设计规范

- 地主：红金皇冠角标 `badges/landlord.svg`（座位常驻）；角色图 `landlord-character.svg` 仅揭示/结算。**禁止**角标/角色图内嵌「地主」文字，也禁止名字旁叠 `（地主）`。
- 农民：青绿麦穗角标 `badges/farmer.svg`（略小于地主）；角色图同理去文字。
- 身份高亮：头像静态色环（`--ddz-identity-*-ring`），无动画。
- 行动高亮：座位外框金色脉冲（`--ddz-action-glow` + `ddz-turn-pulse`），与身份通道分离。详见 `docs/identity-badge-spec.md`。
- 身份揭示：地主图 96x96 居中弹入，农民图 72x72 分发到两侧座位。
- 结算：胜方身份图加金色外光，负方身份图降饱和；不要同时显示「图标 + 大文字 + 角标」三重重复信息。

## 4. 关键状态设计规范

- 叫/抢地主：主按钮仍走 token，但座位反馈要配身份/气泡图形；叫地主成功后触发地主角色图短弹入。
- 加倍/超级加倍：使用 `double-badge.svg` 作为基底，普通加倍显示 x2，超级加倍可替换为 x4 并加 1 次金色 pulse。
- 炸弹/王炸：炸弹使用 `bomb.svg`，王炸使用大小王两张牌交叉 + 炸弹徽章；动画不超过 700ms，避免遮挡出牌区太久。
- 春天/反春：使用 `spring.svg`，只在结算层出现一次，不在桌面常驻刷屏。
- 结算：胜利/惜败使用独立徽章图，不再只用 emoji 或纯文字。

## 5. 交给小林的接入清单

1. `CardView.tsx`（LRM-206）：普通牌继续组件化，纸面/花色/点数走 §2 token；可选接入 `/cards/suit-*.svg` 替换 Unicode 花色；大小王直接引用 `/cards/joker-small.svg`、`/cards/joker-big.svg`；背面引用 `/cards/card-back.svg`；补 `.is-unplayable` 状态类。
2. `GameTable.tsx`：座位身份用 `/badges/landlord.svg`、`/badges/farmer.svg` 角标；揭示/结算再用 `/identity/*-character.svg`。行动用 `is-turn`，勿与身份 glow 混用。
3. 叫抢/加倍状态：加倍反馈引用 `/states/double-badge.svg`，超级加倍复用基底替换数字或叠加文案。
4. 炸弹/春天/结算：炸弹引用 `/states/bomb.svg`；春天引用 `/states/spring.svg`；结算胜负引用 `/states/victory-badge.svg`、`/states/defeat-badge.svg`。
5. 所有颜色/阴影/圆角接 `--ddz-*` token；SVG 本身作为 v1 可落地资产，后续如果 token 化 SVG 颜色再升级。

## 6. 预览覆盖

本批交付覆盖：扑克牌普通/大小王/背面、地主/农民、加倍、炸弹、春天、胜利/失败结算。四状态合成预览见 `docs/assets/previews/lrm-140-visual-preview.svg`；大厅和整桌场景仍可参考 `docs/assets/doudizhu-p0-table.svg`。
身份 vs 行动高亮对照（LRM-167）：`docs/assets/previews/lrm-167-play-identity-vs-turn.svg`。
**LRM-206 牌面精修预览**：`docs/assets/previews/lrm-206/card-face-preview.png`（及同目录单牌 PNG）；规格源本文 §2；版权 `docs/assets/cards/LICENSE.md`。
