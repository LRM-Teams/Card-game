# LRM-313 扑克牌 v2 生产级质感（Phase-2）

> Owner：小雅 · 门禁：LRM-311 · 下游接入：小林（审图通过后 promote）

## 交付物

| 资产 | 路径 | 逻辑尺寸 |
| --- | --- | --- |
| 普通牌模板 | `docs/assets/cards/card-front-template.svg` | 52×74（母版 104×148 @2x） |
| 大王 | `docs/assets/cards/joker-big.svg` | 52×74 |
| 小王 | `docs/assets/cards/joker-small.svg` | 52×74 |
| 牌背 | `docs/assets/cards/card-back.svg` | 40×56 缩略 / 52×74 手牌 |
| 预览 sheet | `card-v2-sheet.svg` | v1→v2 + 三态 + 双尺寸 |
| 演示 | `/fx-demo?scene=cards` | 可交互对比 |

客户端镜像：`apps/client/public/cards/*.svg`（与 docs 同名同步）。

## v1 → v2 变化（相对 LRM-206 基线）

| 维度 | v1（LRM-206） | v2（LRM-313 Phase-2） |
| --- | --- | --- |
| 纸面 | 单层渐变 + 浅纤维 | 双层纸感渐变 + 纤维纹 + 内凹阴影 + 顶部高光 |
| 花色 | 纯色填充 | 红桃渐变（`#d32f2f→#b71c1c`）+ 中央花色微高光 |
| 描边 | 单外描边 | 外木棕 + 内米白细 rim，层次更接近实体牌 |
| 大王 | 红轨 + 平面火焰 | 红轨高光 + 火焰三层（外焰/内焰/核心光） |
| 小王 | 蓝轨 + 平面帽 | 蓝轨高光 + 金帽渐变 + 铃铛高光 |
| 牌背 | 平面酒红格 | 径向 vignette + 双层金 rim + 中心纹章双层星 |

## 三态规格（可测）

| 态 | 场景 | 视觉 | Token / 类名 |
| --- | --- | --- | --- |
| **默认** | 手牌/出牌区未选中 | 纸面正常亮度；阴影 `--ddz-card-shadow` | `.card` |
| **选中** | 手牌区点选待出 | 上移 **34px**（移动端 28px）；描边 `#f6c65b`；`--ddz-glow-gold` + 加深投影；120ms ease-out | `.hand .card.is-selected` · `--card-lift: -34px` |
| **不可出** | 提示未命中 / 规则不允许 | `opacity: 0.55` + `saturate(0.55)`；无位移 | `.card.is-unplayable` |
| **已出** | 中央出牌区 | 正常亮度；飞入动画 260ms；小牌 40×56 | `.card.is-table-play` · `.last-cards` |

红线：选中态仅手牌区生效；不可出态禁止同时金边；已出态禁止降饱和。

## 审图 checklist

- [ ] 纸感接近欢乐斗地主（冷米白、非金底）
- [ ] 红黑花色对比清晰，中央花色有层次
- [ ] 大小王一眼可分（红轨火焰 vs 蓝轨金帽）
- [ ] 牌背无字标、格纹克制
- [ ] 三态在 sheet 与 `/fx-demo?scene=cards` 可对照
- [ ] 52×74 / 40×56 双尺寸可读

## License

见 `docs/assets/cards/LICENSE.md`（内部自绘，可商用，不抄腾讯原图）。
