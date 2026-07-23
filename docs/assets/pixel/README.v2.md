# 斗地主像素风资产包 v2（LRM-408）

> Modern Pixel · cel-shaded · 生产级 v2 精修

## 规模

- **44 PNG**（42 项需求 + `btn_primary` 热替换别名 + 预览用副本）
- 牌面母版 **104×148**（纸纹+倒角+花色层级）
- 角色 **128×128** 逐像素造型
- 按钮 **normal / pressed / disabled** 三态
- 台呢/木轨多层噪声 + 无缝平铺验证图

## 路径（LRM-416 接线）

```
/pixel/tiles/felt_texture.png
/pixel/ui/btn_primary.png
/pixel/ui/card_front_template.png
/pixel/backgrounds/room_bg.png
...
```

## 生成

```bash
python docs/assets/pixel/generate_assets_v2.py
```

## 预览

- `docs/assets/previews/lrm-408/pixel-preview-sheet-v2.png`
- `docs/assets/previews/lrm-408/felt-seamless-2x2.png`

## 校验

`asset_validator.py` 量化后 PASS（尺寸 warning 为 spec 声明的 per-asset override）
