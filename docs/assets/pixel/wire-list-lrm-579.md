# LRM-579 室外大厅接线清单（小雅 → 小林）

> 曹总锁定基准：`scene-full-1920x1080.png`（附件 019f92b9）  
> 约束：**可见背景必须以全场景 bake 为准**，禁止几何色块层顶替；分层包仅用于视差/增强，不得偏离 bake。

## 运行时主视觉（已接线）

| z | 资产 | 路径 | 说明 |
|---|---|---|---|
| 3 | 全场景 bake | `narrative-pixel/scene/scene-full-1920x1080.png` | `Lobby.tsx` 当前主层 `np-lobby__layer--full` |
| — | 640×360 伴生 | `narrative-pixel/scene/ddz-street-scene-v3-640x360.png` | 低带宽/缩略 |

## 真视差分层包（入库，待接线）

| z | 资产 | 路径 | 滚动 | 说明 |
|---|---|---|---|---|
| 1 | far | `scene/layer-far-bg-1920x1080.png` | `--np-parallax-x * 0.3` | 由 bake 派生的远景（天空/远山） |
| 2 | mid | `scene/layer-mid-buildings-1920x1080.png` | `* 0.6` | bake 派生建筑层（天空透明） |
| 4 | lighting | `lighting/layer-lighting-1920x1080.png` | 无 / 微动 | `mix-blend-mode: screen; opacity: .55` |
| 5 | fg | `scene/layer-fg-occluder-1920x1080.png` | `* 1.2` | bake 派生前景遮挡 |

**接线建议（可选增强，须经曹总过目）：**

1. 保留 `layer--full` 为可读主层（验收基准）。
2. 若开视差：在 full **下方**叠 far/mid，full 保持不透明；或 full 改半透明仅作 QA——**上线默认仍是 full bake**。
3. fg/lighting 可叠在 full 之上做轻微遮挡/光晕，透明度保守（≤0.35），避免糊掉 CTA。

TS 路径已在 `narrativePixelAssets.ts` → `narrativePixelScene.layers`。

## 元素包（优先 20 项，manifest 已录）

见 `docs/assets/narrative-pixel/lobby-v3-elements-manifest.json`。

大厅摆放参考：`narrativeSceneLayout.ts` → `narrativeLobbyScenePlacements`。

| id | sprite | 目录 |
|---|---|---|
| B01 | `building_teahouse_main` | buildings/ |
| B03 | `building_left_apartment` | buildings/ |
| B04 | `building_right_apartment` | buildings/ |
| B14 | `power_pole` | buildings/ |
| P01 | `sign_teahouse_neon` | props/ |
| P09 | `lantern_hanging` | props/ |
| P06 | `card_table_outdoor` | props/ |
| P07 | `card_stack` | props/ |
| P05 | `traffic_cone` | props/ |
| P03 | `bottle_crate_stack` | props/ |
| V08 | `hanging_laundry` | props/ |
| P27 | `poster_peeling` | props/ |
| B17 | `fence_wood` | props/ |
| C05 | `npc_bicycle` / `bicycle_parked` | characters/ · props/ |
| C03 | `npc_card_players` | characters/ |
| C02 | `npc_old_man_walk` | characters/ |
| C04 | `npc_cat_walk` | characters/ |
| V12 | `bush_foreground` | characters/ |

`NarrativeSceneElements` 可按 placements 叠层；**默认大厅仍只渲 bake**，元素层留给交互动画/局部增强。

## 世界化 UI 热点（勿改偏）

沿用 `narrativePixelHotspots`：

| 热点 | 用途 |
|---|---|
| tvStart | 开始游戏 |
| stationBoard | 房间码 |
| ledger | 昵称/头像 |

## Manifest / 校验

```bash
# 从仓库根
python docs/assets/narrative-pixel/asset_validator.py
```

- 分层：`lobby-v3-layers-manifest.json`
- 元素：`lobby-v3-elements-manifest.json`
- 场景锁：`lobby-scene-manifest-lrm-579.json`
- 预览：`docs/assets/previews/lrm-579/`

## 验收截图

- 1920×1080 / 390×844 整页与锁定 bake 场景密度一致、主 CTA 可读
- 曹总书面 OK 前不合 main；OK 后合入并滚 89
