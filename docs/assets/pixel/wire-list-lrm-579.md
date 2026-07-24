# LRM-579 大厅场景接线清单（小雅 → 小林）

> 锁定基准：曹总确认 attachment `019f92b9` = `scene-full-1920x1080.png`  
> **禁止**再叠几何色块 far/mid/fg 或旧 `NarrativeSceneElements` 占位精灵。

## 当前正确接线（已在 PR #116）

| 项 | 路径 / 代码 | 说明 |
|---|---|---|
| 全场景 bake | `public/narrative-pixel/scene/scene-full-1920x1080.png` | 唯一可见场景层 |
| 原生栅格 | `scene/ddz-street-scene-v3-640x360.png` | 640×360 companion |
| 同款备份 | `scene/ddz-street-scene-v3-1920x1080.png` | 与 bake 同内容 |
| Lobby | `apps/client/src/components/Lobby.tsx` | 只渲染 `narrativePixelScene.full` |
| 资产常量 | `apps/client/src/lib/narrativePixelAssets.ts` | `narrativePixelScene.full` |
| 热点 | `narrativePixelHotspots` | 电视/站牌/登记簿 % 定位不变 |

## 分层策略（防漂移）

| 层 | 文件 | 状态 |
|---|---|---|
| full | `scene-full-1920x1080.png` | **锁定 bake**（SHA256 对齐 019f92b9） |
| mid | `layer-mid-buildings-1920x1080.png` | = full bake 副本（备用，非叠画） |
| far / fg / lighting | 透明 1920×1080 | 占位清空，**勿再启用叠层** |

视差可后续从 bake 无损拆层；未拆前保持单 bake。

## 元素包

旧 `props/` `buildings/` 等几何占位精灵 **不要重新挂回大厅**。  
真元素包须从锁定 bake 裁切/generate2dsprite 对齐后另提 PR，过目后再接线。

## 验收

- [ ] `pnpm --filter @card-game/client build` PASS
- [ ] `/` 大厅视觉 = 锁定 bake（非色块）
- [ ] 开始游戏 / 创建 / 加入 可用
- [ ] 合 main 后 89：tip/bundle/health + 1920/390 截图回 LRM-579
