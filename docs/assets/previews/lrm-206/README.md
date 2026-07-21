# LRM-206 牌面精修预览

## 预览文件

- 合成总览（SVG）：`card-face-sheet.svg`
- 合成总览（PNG）：`card-face-preview.png`
- 单牌 PNG：`front-*.png` / `joker-*.png` / `card-back.png`

## 相对 P0 的变化

| 项 | P0 | LRM-206 |
| --- | --- | --- |
| 纸面 | 偏黄金渐变 + 粗金描边 | 冷米白纸感 + 木棕细描边 + 纤维点 |
| 花色 | `#c72d2d` / `#263247` | `#c62828` / `#1a1a1a` |
| 大王/小王 | 造型接近、靠色差 | **红轨 vs 蓝轨** + 火焰 vs 丑角帽 |
| 牌背 | 大红底 + 「DDZ」字 | 酒红格子 + 中心纹章，去字标 |

## 可测规格

见 `docs/front-end-visual-assets.md` §2。

## 给小林的接入路径

1. 替换：`/cards/card-front-template.svg`、`card-back.svg`、`joker-big.svg`、`joker-small.svg`
2. `CardView`：普通牌组件拼点数/花色；大小王与牌背引上述路径
3. 状态：选中抬起 **34px**；不可出 `opacity:0.55` + 降饱和
4. 尺寸不变：`--ddz-card-*` 52×74 / 40×56

## 版权

`docs/assets/cards/LICENSE.md`（内部自绘）
