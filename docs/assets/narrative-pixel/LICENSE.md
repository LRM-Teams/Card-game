# 叙事像素资产许可说明（LRM-417 / LRM-466）

本目录及 `apps/client/public/narrative-pixel/` 下全部图像均为 **团队原创可商用素材**，供斗地主客户端叙事像素大厅与场景装饰使用。

## 来源

| 类别 | 路径 | 生成方式 |
|------|------|----------|
| 室外场景精灵 | `props/`、`buildings/`、`characters/`、`tiles/` | `docs/assets/narrative-pixel/generate_narrative_assets.py`（PIL 程序化占位 / 小雅手绘迭代） |
| UI 状态帧 | `ui/states/` | 同上；含 `tv_screen_error`、`ui_error_stamp`（U10）等 |
| 场景分层 | `scene/`、`lighting/` | 1920×1080 分层输出 |
| 元素目录 | `elements-catalog.json` | 与 `apps/client/src/lib/narrative-pixel-elements-catalog.json` 同步 |

## 版权声明

- **不含**任何腾讯 / 欢乐斗地主 / Eastward 等第三方游戏的美术资产、截图或再采样。
- 素材由 LRM-Teams 项目组自行创作，可随仓库商用与二次替换。
- 对标竞品仅参考信息层级与反馈强度，不复制具体图案。

## 双线资产关系

| 线 | 场景 | 本目录 | 关联 |
|----|------|--------|------|
| A 室外·大厅 | 老街茶馆叙事背景 | 本目录 `narrative-pixel/`（87+ 项） | LRM-417 叙事像素规格 |
| B 室内·对局 | 牌桌台呢 / 牌面 / HUD | **不在此目录** | 见 [LRM-408 v2 Modern Pixel](../pixel/manifest.json) 与 `apps/client/public/pixel/` |

室内线（台呢、牌背、按钮、结算徽章等）由 **LRM-408 v2** 交付，客户端经 `apps/client/src/lib/pixelAssets.ts` 接线；本目录仅覆盖室外叙事线与大厅世界化 UI。

## 文件索引

```
ui/states/tv_screen_error.png   连接/服务失败时电视雪花错误帧
ui/states/ui_error_stamp.png    红章错误态（U10，叠在站牌）
scene/layer-*-1920x1080.png     远景/中景/前景/灯光分层
elements-catalog.json           87+ 项元素路径与尺寸
manifest.json                   版本与室内线交叉引用
```
