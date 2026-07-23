# Narrative Pixel 资产许可说明

**项目**：斗地主网络对战（LRM-Teams / Card-game）  
**资产包**：`apps/client/public/narrative-pixel/`  
**规范**：`docs/doudizhu-narrative-pixel-spec.md`（LRM-417 Narrative Pixel v3）

## 版权与使用范围

- 本目录下叙事像素精灵、场景层与 UI 状态帧为 **LRM-Teams 斗地主项目专用** 美术资产。
- 仅限本仓库客户端/预览/CI 举证使用；**禁止**脱离本项目单独商用或再分发。
- 资产由项目内工具链生成或设计交付（见 `docs/assets/narrative-pixel/generate_narrative_assets.py` 与各 issue 举证）。

## 第三方与参考

- 画风为原创 Narrative Pixel（老街茶馆室外叙事），不对标、不复制任何竞品美术。
- 字体与 UI 文案遵循项目 `docs/doudizhu-design-tokens.md` §15 `--ddz-np-*`。

## 室内线交叉引用（LRM-408 v2）

室外大厅资产以本目录 + `docs/assets/narrative-pixel/manifest.json` 为单一事实来源。  
**对局室内线**（台呢、牌面、木轨、角色等）由 **LRM-408 v2** 双线清单维护：

- 清单：`docs/assets/previews/lrm-417/scene-asset-manifest.md`（86 项 · 室外+室内）
- 室内 Modern Pixel 组件参考：`docs/doudizhu-pixel-ui-spec.md`
- 已接线室内资产（工程门已过）：`apps/client/public/pixel/`（LRM-416）
- 408 v2 终态替换时保持 **路径/ID 可热替换**，客户端通过 `pixelAssets.ts` / `narrativePixelElements.ts` 消费

## 联系人

视觉资产问题 @小雅；客户端接线 @小林。
