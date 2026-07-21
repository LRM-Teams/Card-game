# LRM-206 牌面精修说明

## 相对 P0 的变化

| 项 | P0 | LRM-206 |
| --- | --- | --- |
| 纸面 | 偏黄金渐变 + 粗金描边 | 冷米白纸感 + 木棕细描边 + 纤维点 |
| 花色 | `#c72d2d` / `#263247` | `#c62828` / `#1a1a1a`（对比更清晰） |
| 大王/小王 | 造型接近、靠色差 | **红轨 vs 蓝轨** + 火焰 vs 丑角帽，一眼可分 |
| 牌背 | 大红底 + 「DDZ」字 | 酒红格子 + 中心纹章，去字标 |

## 可测规格

见 `docs/front-end-visual-assets.md` §2（已更新）与本目录预览 `card-face-sheet.svg`。

## 给小林的接入路径

1. 替换/热更：`/cards/card-front-template.svg`、`card-back.svg`、`joker-big.svg`、`joker-small.svg`
2. `CardView`：普通牌仍组件拼点数/花色，纸面白/描边/阴影对齐新 token；大小王与牌背直接 `img`/`background` 引上述路径
3. 状态：选中抬起 **34px**（已落地 LRM-196）；不可出 `opacity:0.55` + 滤镜降饱和
4. 尺寸不变：`--ddz-card-*` 52×74 / 40×56
