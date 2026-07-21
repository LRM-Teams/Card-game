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
| 身份 | 地主角色图 | `docs/assets/identity/landlord-character.svg` / `apps/client/public/identity/landlord-character.svg` | 160x160 SVG；座位 48x48，结算 96x96 | 地主揭示、座位身份、结算胜方 | 内部自绘，可商用 |
| 身份 | 农民角色图 | `docs/assets/identity/farmer-character.svg` / `apps/client/public/identity/farmer-character.svg` | 160x160 SVG；座位 48x48，结算 96x96 | 农民身份、队友关系、结算 | 内部自绘，可商用 |
| 状态 | 炸弹 | `docs/assets/states/bomb.svg` / `apps/client/public/states/bomb.svg` | 160x120 SVG | 炸弹牌型爆点反馈 | 内部自绘，可商用 |
| 状态 | 春天 | `docs/assets/states/spring.svg` / `apps/client/public/states/spring.svg` | 160x120 SVG | 春天/反春结算提示 | 内部自绘，可商用 |
| 状态 | 加倍徽章 | `docs/assets/states/double-badge.svg` / `apps/client/public/states/double-badge.svg` | 120x120 SVG | 加倍/超级加倍反馈，可由组件替换数字 | 内部自绘，可商用 |
| 状态 | 胜利徽章 | `docs/assets/states/victory-badge.svg` / `apps/client/public/states/victory-badge.svg` | 180x140 SVG | 结算胜利标题 | 内部自绘，可商用 |
| 状态 | 惜败徽章 | `docs/assets/states/defeat-badge.svg` / `apps/client/public/states/defeat-badge.svg` | 180x140 SVG | 结算失败标题 | 内部自绘，可商用 |
| 大厅 | 主视觉插画 | `docs/assets/lobby/hero-illustration.svg` / `apps/client/public/lobby/hero-illustration.svg` | 720x320 SVG | 大厅品牌主视觉（暖红金 + 角色剪影 + 浮牌） | 内部自绘，可商用；见 `docs/assets/lobby/LICENSE.md` |

## 2. 扑克牌设计规范

- 普通牌不导出 52 张位图，采用「通用纸张模板 + 组件点数/花色」方案，避免重复资产并便于响应式缩放。
- 红色花色使用 `#c72d2d`，黑色花色使用 `#263247`，牌面纸白到米金渐变，保留轻微阴影和内描边。
- 主手牌逻辑尺寸：52x74；桌面出牌区：52x74；对手背牌：40x56；底牌展示：46x64。
- 大小王必须使用专用 SVG，不用纯文字替代：小王为深蓝金小丑帽，大王为红金火焰小丑，保持一眼可分。
- 选中态：卡牌上移 10px，外描边 `#f6c65b` 2px，阴影增强；不可出态：整体饱和度 -45%，透明度 0.55；已出态：正常亮度，进入中央出牌区。

## 3. 身份与角色设计规范

- 地主：红金皇冠/地主服方向，使用 `landlord-character.svg`；座位上只放图标或徽章，不再叠加大段文字。
- 农民：草帽/麦穗/绿色布衣方向，使用 `farmer-character.svg`；农民身份弱于地主但需可识别。
- 身份揭示：地主图 96x96 居中弹入，农民图 72x72 分发到两侧座位。
- 结算：胜方身份图加金色外光，负方身份图降饱和；不要同时显示「图标 + 大文字 + 角标」三重重复信息。

## 4. 关键状态设计规范

- 叫/抢地主：主按钮仍走 token，但座位反馈要配身份/气泡图形；叫地主成功后触发地主角色图短弹入。
- 加倍/超级加倍：使用 `double-badge.svg` 作为基底，普通加倍显示 x2，超级加倍可替换为 x4 并加 1 次金色 pulse。
- 炸弹/王炸：炸弹使用 `bomb.svg`，王炸使用大小王两张牌交叉 + 炸弹徽章；动画不超过 700ms，避免遮挡出牌区太久。
- 春天/反春：使用 `spring.svg`，只在结算层出现一次，不在桌面常驻刷屏。
- 结算：胜利/惜败使用独立徽章图，不再只用 emoji 或纯文字。

## 5. 交给小林的接入清单

1. `CardView.tsx`：普通牌继续组件化，但替换为本规格的纸张、花色、点数层级；大小王直接引用 `/cards/joker-small.svg`、`/cards/joker-big.svg`；背面引用 `/cards/card-back.svg`。
2. `GameTable.tsx`：地主/农民座位身份引用 `/identity/landlord-character.svg`、`/identity/farmer-character.svg`，并按 48x48/96x96 场景缩放。
3. 叫抢/加倍状态：加倍反馈引用 `/states/double-badge.svg`，超级加倍复用基底替换数字或叠加文案。
4. 炸弹/春天/结算：炸弹引用 `/states/bomb.svg`；春天引用 `/states/spring.svg`；结算胜负引用 `/states/victory-badge.svg`、`/states/defeat-badge.svg`。
5. 所有颜色/阴影/圆角接 `--ddz-*` token；SVG 本身作为 v1 可落地资产，后续如果 token 化 SVG 颜色再升级。

## 6. 预览覆盖

本批交付覆盖：扑克牌普通/大小王/背面、地主/农民、加倍、炸弹、春天、胜利/失败结算。四状态合成预览见 `docs/assets/previews/lrm-140-visual-preview.svg`；大厅和整桌场景仍可参考 `docs/assets/doudizhu-p0-table.svg`。
