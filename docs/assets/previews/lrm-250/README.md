# LRM-250 hand dock

- sheet: `hand-dock-sheet.svg` / `.png`（规格示意 + token 标注）
- smoke: `before-play-fixture-1920x1080.png` / `after-play-fixture-1920x1080.png`
- crop: `before-play-bottom-crop.png` / `after-play-bottom-crop.png`
- 规格：`docs/doudizhu-design-tokens.md` §11.4
- 实现：`apps/client/src/styles.css` 的 `--ddz-vp-table-pad-bottom` / `--ddz-vp-hand-pad-*` / `--ddz-vp-controls-pull|gap` + `.hand { margin-top: auto }`
- 实测（1920×1080 fixture）：按钮下空档 568→14px；手牌底边 434→998；仍无纵滚
