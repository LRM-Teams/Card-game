# 斗地主 · Modern Pixel 全站 UI 规范（LRM-417）

> 父单 LRM-408 · 接线 LRM-416 · 设计：小雅  
> 目标：主页 + 游戏页统一像素风，资产走 `/pixel/`，样式走 `--ddz-*` + 本节 `--ddz-px-*`。

## 1. 视觉方向

| 项 | 定稿 |
|---|---|
| 风格 | **Modern Pixel（A）** — cel-shaded、硬边、无抗锯齿 |
| 渲染 | `image-rendering: pixelated` / `crisp-edges` 作用于所有像素 PNG |
| 配色 | 沿用 LRM-408 `spec_lock` 16 色 + 现有 `--ddz-felt/gold/room` token |
| 层级 | 全站仅**一个**金色主 CTA 最亮（大厅「快速开始」/ 对局「出牌」） |
| 一屏 | 对局页继续遵守 LRM-246/250 `--ddz-vp-*` 预算 |

## 2. 主页 / 大厅（`Lobby.tsx`）

### 2.1 布局分区（1920×1080 基准，移动端单列）

```
┌─────────────────────────────────────────────┐
│ topbar 44px · 品牌 + 设置（像素 icon 后续）    │
├─────────────────────────────────────────────┤
│ hero 360×160 · lobby_hero.png 全宽 cover     │
│   叠字：斗地主 + 副标题（--ddz-cream）         │
├─────────────────────────────────────────────┤
│ panel 木框面板 · room_bg 平铺暗角              │
│  ├ 身份区：头像框 64 + 昵称 + 豆子 HUD         │
│  ├ 主 CTA：btn_primary.png 九宫格 120×40      │
│  └ 次入口：私房链接卡片（降饱和，无金边）       │
└─────────────────────────────────────────────┘
```

### 2.2 组件 → 资产映射

| 组件 / 类名 | 像素资产 | Token |
|---|---|---|
| `.lobby-hero__art` | `backgrounds/lobby_hero.png` | `--ddz-px-hero-h: 160px` |
| `.lobby` 底 | `backgrounds/room_bg.png` cover | `--ddz-room-*` |
| `.panel` 边框 | 2px `--ddz-rail-wood-700` 硬边 | `--ddz-px-panel-border: 2px` |
| `.btn.primary.cta` | `ui/btn_primary.png` 九宫格 | `--ddz-gold-500/600` |
| `.btn.big` 取消匹配 | 灰金描边面板，无 PNG | `--ddz-lobby-muted` |
| 头像选中环 | 2px `--ddz-gold-500` 方角环 | `--ddz-px-radius-sm: 4px` |

### 2.3 交互

- 主按钮 hover：亮度 +8%（`filter: brightness(1.08)`），禁止外发光
- 匹配中：倒计时用像素数字，禁止脉冲动画抢 CTA

## 3. 游戏页（`GameTable.tsx` + `HandView`）

### 3.1 布局（`.app--game` 一屏）

```
topnav 44 ───────────────────────────── meta-corner(HUD)
        ┌─────────────────────────┐
        │  opponent seats + badge │
        │  ┌──── play zone ────┐  │
        │  │  last play cards  │  │
        │  └───────────────────┘  │
        │  hand dock (LRM-250)    │
        │  controls ≤96px         │
        └─ felt + rail textures ─┘
body bg: room_bg.png
```

### 3.2 组件 → 资产映射

| 区域 | 资产 | 说明 |
|---|---|---|
| `body` / `.app--game` 底 | `backgrounds/room_bg.png` | cover，保留暗角 vignette |
| `.table` 台呢 | `tiles/felt_texture.png` repeat 64 | + 现有 radial token 叠层 |
| `.table` 木轨 | `tiles/rail_texture.png` overlay + box-shadow | LRM-166 厚度 token 不变 |
| 地主座位 | `ui/badge_landlord.png` + `characters/landlord_character.png` 32px | 角标 28 |
| 农民座位 | `ui/badge_farmer.png` | 角标 24 |
| 手牌 | `ui/card_*.png` | LRM-416 已接；禁止双层 HTML 角标 |
| 出牌区 | `ui/card_*` small 40×56 | `tablePlay` |
| 主按钮出牌 | `ui/btn_primary.png` | 唯一最亮 |
| 加倍阶段 | `ui/double_badge.png` 居中 HUD | 阶段提示弱于 CTA |
| 炸弹/春天 | `effects/bomb.png` / `effects/spring.png` | 出牌特效 overlay，260ms |

### 3.3 HUD 层级（弱于主按钮）

| 元素 | 位置 | 样式 |
|---|---|---|
| 倍数 | `.meta-corner--mult` 右上 | `--ddz-cream` 12px，无金边 |
| 倒计时 | 座位旁 48px 环 | 红 ≤5s，其余 `--ddz-cream` |
| 断线 banner | 顶栏下全宽 | 保留 LRM-276 token，像素 2px 边框 |

## 4. 全局 Token 扩展（§14）

见 `docs/doudizhu-design-tokens.md` §14。客户端接线时：

```css
:root {
  --ddz-px-render: pixelated;
  --ddz-px-radius-sm: 4px;
  --ddz-px-radius-md: 8px;
  --ddz-px-panel-border: 2px solid var(--ddz-rail-wood-700);
  --ddz-px-hero-h: 160px;
  --ddz-px-btn-slice: 8; /* 九宫格切片 */
}
img.pixel, .pixel-bg {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

## 5. LRM-416 接线清单

详见 `docs/assets/pixel/wire-list-lrm-416.md`。

## 6. 验收

1. 预览稿：`docs/assets/previews/lrm-417/lobby-pixel-sheet.svg` + `game-pixel-sheet.svg`
2. Token §14 落文档；客户端 PR 引用本节类名
3. 89 环境：大厅 + 对局整页可见像素风；1080p 出牌态无纵滚
4. 与 Frank LRM-406 牌面 hotfix 不冲突（单图层牌面）
