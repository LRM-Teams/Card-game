# Poker card face assets (LRM-206)

## Paths

| Asset | Spec source | Client public |
| --- | --- | --- |
| 普通牌模板 | `docs/assets/cards/card-front-template.svg` | `apps/client/public/cards/card-front-template.svg` |
| 牌背 | `docs/assets/cards/card-back.svg` | `apps/client/public/cards/card-back.svg` |
| 小王 | `docs/assets/cards/joker-small.svg` | `apps/client/public/cards/joker-small.svg` |
| 大王 | `docs/assets/cards/joker-big.svg` | `apps/client/public/cards/joker-big.svg` |
| 花色图标 | `docs/assets/cards/suit-*.svg` | `apps/client/public/cards/suit-*.svg`（可选接入） |
| 四花色示范 | `docs/assets/cards/demo-ace-*.svg` | 仅 docs 审图用，不进运行时 |

## Source / License

- **Source**: 内部自绘（小雅，LRM-206）
- **License**: 内部自绘，可商用
- **Reference boundary**: 对标腾讯《欢乐斗地主》的纸质感、信息层级与大小王可辨识度；**不使用**竞品原图、商标化纹样或未授权位图
- **Font note**: 模板内嵌字样使用系统通用衬线/无衬体面（Georgia / Microsoft YaHei），无第三方字体文件依赖

## Notes

- 普通牌仍采用「通用纸张模板 + 组件点数/花色」方案；本批升级纸面质感、花色色值、圆角/描边/阴影与状态规格。
- 大小王必须引用专用 SVG，禁止纯文字占位。
