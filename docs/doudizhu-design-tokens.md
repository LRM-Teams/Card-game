# 斗地主设计 Token（P0 → LRM-166 出牌态精修）

> 目标：给 `apps/client` 一套可直接落地的 CSS token。所有颜色、圆角、阴影、字号、间距和卡牌尺寸先走变量，避免后续 UI 打磨时散落硬编码。
>
> **LRM-166 校准**：桌沿木色 rail、台呢降饱和去泛光、按钮/信息层级权重、卡牌尺寸 `52×74` / `40×56` 已锁死；客户端以 `:root` 的 `--ddz-*` 为准，本文为规格源。

## 1. 视觉方向

- **方向名**：喜庆金绿牌桌。
- **关键词**：明亮、轻快、可读、像斗地主、有一点竞技感。
- **参考边界**：可参考欢乐斗地主的绿色牌桌、金色按钮、红黑牌面信息层级；不直接搬竞品原图、原音频或商标化素材。
- **实现方式**：P0 优先 CSS/SVG/组件拼装，减少图片依赖；后续精修再补位图或动效序列帧。
- **出牌态铁律**：全屏只允许**一个**金色主按钮最亮；倒计时与倍数收进角落弱 HUD，不与主按钮抢权重。

## 2. 色彩 · 台呢（降饱和、去泛光）

| Token | 值 | 用途 |
|---|---|---|
| `--ddz-felt-900` | `#0b2218` | 页面最深背景、暗角 |
| `--ddz-felt-800` | `#14352a` | 牌桌暗绿、面板底 |
| `--ddz-felt-700` | `#1b4a37` | 主牌桌台呢（降饱和） |
| `--ddz-felt-600` | `#2a6349` | 台呢高光、可交互绿（柔） |
| `--ddz-felt-mid` | `#1f5540` | 台呢径向渐变中段 |
| `--ddz-felt-soft` | `rgba(168, 198, 178, 0.14)` | 台呢顶部柔光（**禁止**大面积金色外发光） |
| `--ddz-gold-500` | `#e8bc3a` | 主按钮强调、轮到提示（略降饱和） |
| `--ddz-gold-600` | `#c49218` | 金色按下态、描边 |
| `--ddz-red-500` | `#d63031` | 红桃/方片、危险按钮、地主角标 |
| `--ddz-red-600` | `#a82020` | 红色按下态 |
| `--ddz-settle-win-1` / `--ddz-settle-win-2` | `#7a1c14` / `#3d140f` | 结算胜方暖金红底 |
| `--ddz-settle-lose-1` / `--ddz-settle-lose-2` | `#2a3544` / `#1a222c` | 结算负方蓝灰底（降饱和） |
| `--ddz-settle-win-title` / `--ddz-settle-lose-title` | `#ffe08a` / `#b8c4d4` | 结算胜负标题色 |
| `--ddz-paper` | `#fbfbf6` | 卡牌牌面 |
| `--ddz-ink` | `#1c1c1c` | 黑桃/梅花、正文深色 |
| `--ddz-cream` | `#fff3c4` | 说明文字、浅金标签 |
| `--ddz-line` | `rgba(255, 255, 255, 0.14)` | 深色背景上的分割线 |
| `--ddz-shadow` | `rgba(0, 0, 0, 0.32)` | 面板/卡牌投影 |
| `--ddz-room-from` | `#33221a` | 房间背景起点（暖木色，与台呢拉开落差） |
| `--ddz-room-mid` | `#43301f` | 房间背景中段 |
| `--ddz-room-to` | `#241612` | 房间背景终点 |

**台呢验收**：主色饱和度相对旧版 `#0f5132` / `#176b43` 明显下降；桌面径向过渡只用 `--ddz-felt-*` + `--ddz-felt-soft`，**不得**再出现 `0 0 46px` 级金色 inset glow。

## 3. 桌沿 Rail（木色厚度/颜色）

| Token | 值 | 用途 |
|---|---|---|
| `--ddz-rail-thickness` | `18px` | 桌面木色主轨厚度（桌面端） |
| `--ddz-rail-rim` | `3px` | 外缘浅木描边厚度 |
| `--ddz-rail-wood-900` | `#4a2e18` | 木轨最深（贴台呢一侧） |
| `--ddz-rail-wood-700` | `#6b4424` | 木轨主色 |
| `--ddz-rail-wood-500` | `#8a5c34` | 木轨外缘高光 |
| `--ddz-rail-inner-line` | `rgba(255, 243, 196, 0.10)` | 台呢内侧发丝线（弱，非金光） |
| `--ddz-rail-thickness-mobile` | `8px` | ≤680px 断点木轨厚度 |
| `--ddz-rail-rim-mobile` | `3px` | ≤680px 外缘厚度 |

**桌沿实现约定（给小林）**：

```css
box-shadow:
  0 0 0 var(--ddz-rail-thickness) var(--ddz-rail-wood-700),
  0 0 0 calc(var(--ddz-rail-thickness) + var(--ddz-rail-rim)) var(--ddz-rail-wood-500),
  inset 0 0 0 1px var(--ddz-rail-inner-line),
  /* 体积阴影，不是金色泛光 */
  inset 0 18px 40px rgba(255, 255, 255, 0.04),
  inset 0 -28px 56px rgba(0, 0, 0, 0.28),
  0 28px 64px rgba(0, 0, 0, 0.42);
```

禁止：金色外圈 `rgba(245,197,66,…)` 作为桌沿；禁止桌沿厚度回到刺眼的「金箍 + 厚木」双抢戏。

## 4. 字体与字号

| Token | 值 | 用途 |
|---|---|---|
| `--ddz-font-display` | `"Arial Rounded MT Bold", "Microsoft YaHei", sans-serif` | 标题、倍数、胜负字样 |
| `--ddz-font-body` | `"Microsoft YaHei", "PingFang SC", sans-serif` | 常规 UI 文案 |
| `--ddz-text-xs` | `12px` | 标签、状态说明、角落 HUD |
| `--ddz-text-sm` | `14px` | 按钮、辅助说明 |
| `--ddz-text-md` | `16px` | 正文、表单 |
| `--ddz-text-lg` | `20px` | 小标题、倍率 |
| `--ddz-text-xl` | `28px` | 页面标题 |
| `--ddz-text-2xl` | `40px` | 结算胜负标题（全屏最大字） |

## 5. 间距、圆角、阴影

| Token | 值 | 用途 |
|---|---|---|
| `--ddz-space-1` | `4px` | 紧密间距 |
| `--ddz-space-2` | `8px` | 小组件间距 |
| `--ddz-space-3` | `12px` | 按钮/卡片内边距 |
| `--ddz-space-4` | `16px` | 模块间距 |
| `--ddz-space-5` | `20px` | 牌桌区块间距（非对局壳默认） |
| `--ddz-space-6` | `24px` | 页面块间距 |
| `--ddz-vp-topnav-h` | `44px` | **LRM-246** 对局顶栏目标高度 |
| `--ddz-vp-table-pad-y` | `18px` | **LRM-246** 椭圆台呢上下内边距 |
| `--ddz-vp-table-gap` | `10px` | **LRM-246** 桌内竖向区块间距（替代对局壳内 space-5） |
| `--ddz-vp-stage-min` | `140px` | **LRM-246** 中央舞台最小高度 |
| `--ddz-vp-hand-min` | `132px` | **LRM-246** 手牌区最小高度（含选中抬起余量） |
| `--ddz-vp-controls-budget` | `96px` | **LRM-246** 提示+按钮区高度预算 |
| `--ddz-vp-ellipse-y` | `28%` | **LRM-246** 台呢纵向椭圆比（原 34%，压扁减高度） |
| `--ddz-radius-sm` | `8px` | 小标签、输入框 |
| `--ddz-radius-md` | `12px` | 按钮、座位卡 |
| `--ddz-radius-lg` | `18px` | 面板、桌面容器 |
| `--ddz-radius-card` | `8px` | 卡牌圆角 |
| `--ddz-shadow-card` | `0 6px 12px rgba(0, 0, 0, 0.22)` | 卡牌/按钮浮起 |
| `--ddz-shadow-panel` | `0 16px 40px rgba(0, 0, 0, 0.30)` | 弹窗/大面板 |
| `--ddz-glow-gold` | `0 0 0 2px rgba(232, 188, 58, 0.20), 0 0 10px rgba(232, 188, 58, 0.12)` | 选中牌 / 轮到座位（克制，禁止大面积泛光） |
| `--ddz-lobby-bg-900` | `#24100e` | 大厅面板最深底（暖红，与台呢绿区分） |
| `--ddz-lobby-bg-700` | `#5a2218` | 大厅面板中调 |
| `--ddz-lobby-bg-500` | `#8a3424` | 大厅高光暖红 |
| `--ddz-lobby-muted` | `rgba(255, 243, 196, 0.42)` | 大厅次级文案/标签 |
| `--ddz-identity-landlord-ring` | `0 0 0 2px rgba(214, 48, 49, 0.42)` | 地主身份静态环（无脉冲） |
| `--ddz-identity-farmer-ring` | `0 0 0 2px rgba(46, 139, 87, 0.38)` | 农民身份静态环（无脉冲） |
| `--ddz-action-glow` | `0 0 0 2px rgba(245, 197, 66, 0.5), 0 0 14px rgba(245, 197, 66, 0.32)` | 轮到谁行动高亮基底 |
| `--ddz-badge-corner` | `28px` | 地主角标显示尺寸 |
| `--ddz-badge-corner-farmer` | `24px` | 农民角标（略弱于地主） |

## 6. 组件尺寸

| Token | 值 | 用途 |
|---|---|---|
| `--ddz-card-w` | `52px` | 手牌逻辑宽度（LRM-166 锁定） |
| `--ddz-card-h` | `74px` | 手牌逻辑高度 |
| `--ddz-card-small-w` | `40px` | 对手/桌面小牌宽度 |
| `--ddz-card-small-h` | `56px` | 对手/桌面小牌高度 |
| `--ddz-avatar-size` | `56px` | 牌桌玩家头像 |
| `--ddz-avatar-lg` | `96px` | 房间/资料头像资源尺寸 |
| `--ddz-button-h` | `40px` | 常规/次按钮高度 |
| `--ddz-button-h-lg` | `48px` | 主操作按钮高度 |
| `--ddz-button-h-cta` | `56px` | 出牌 CTA 高度 |
| `--ddz-timer-size` | `28px` | 角落倒计时环（弱 HUD，不得大于次按钮） |
| `--ddz-landlord-badge` | `48px` | 地主角标/帽子 |
| `--ddz-meta-opacity` | `0.58` | 角落倍数/倒计时/阶段 HUD 透明度上限 |

## 7. 按钮状态与信息层级（可测）

### 7.1 按钮 Token

| Token | 值 | 用途 |
|---|---|---|
| `--ddz-btn-primary-from` | `#f0d06a` | 主按钮渐变顶 |
| `--ddz-btn-primary-mid` | `#e0b83a` | 主按钮渐变中 |
| `--ddz-btn-primary-to` | `#c48a14` | 主按钮渐变底 |
| `--ddz-btn-primary-text` | `#2c1d00` | 主按钮文字 |
| `--ddz-btn-primary-shadow` | `0 0 0 1px rgba(255, 224, 116, 0.22), 0 8px 16px rgba(196, 138, 20, 0.22), inset 0 2px 0 rgba(255, 255, 255, 0.45), inset 0 -3px 0 rgba(150, 96, 0, 0.20)` | 主按钮投影（克制） |
| `--ddz-btn-cta-shadow` | `0 0 0 2px rgba(255, 224, 116, 0.26), 0 10px 22px rgba(196, 138, 20, 0.26), inset 0 2px 0 rgba(255, 255, 255, 0.5), inset 0 -4px 0 rgba(150, 96, 0, 0.22)` | 出牌 CTA 投影 |
| `--ddz-btn-secondary-bg` | `linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.14))` | 次按钮底 |
| `--ddz-btn-secondary-border` | `rgba(255, 243, 196, 0.16)` | 次按钮描边 |
| `--ddz-btn-secondary-text` | `#fff8e8` | 次按钮文字 |

### 7.2 状态视觉

| 状态 | 视觉 |
|---|---|
| 主按钮 normal | `--ddz-btn-primary-*` 渐变 + `--ddz-btn-primary-shadow` |
| 主按钮 hover | 亮度 +5%，投影略加强 |
| 主按钮 active | 下压 `translateY(1px)`，使用 `--ddz-gold-600` |
| 主按钮 disabled | 透明度 0.45，去投影 |
| 次按钮 normal | `--ddz-btn-secondary-*`，**禁止**金色填充 |
| 危险按钮 normal | 红色渐变 `#d63031 -> #a82020`，白字 |
| 幽灵按钮 normal | 透明底 + 金色文字/描边（仅辅助入口，不出牌态主区） |

### 7.3 出牌态信息层级规则（验收用 · LRM-166）

| 层级 | 内容 | 视觉约束（可测） |
|---|---|---|
| **L0 唯一最高亮** | 当前主动作按钮（出牌 / 叫地主 / 再来一局） | 全屏唯一使用金色填充渐变；高度 ≥ `--ddz-button-h-lg`；出牌用 `.btn.primary.cta` |
| **L1 主信息** | 中央出牌区、我的手牌 | 居中/底部；不使用金色大面积底 |
| **L2 次信息** | 轮到谁文案 | 可用金色**文字**，禁止金色 glow ≥ 12px；字重可加粗 |
| **L3 弱 HUD** | **倒计时 + 倍数**（合并到同一 `.meta-corner`） | `opacity ≤ --ddz-meta-opacity`；字号 `--ddz-text-xs`；倒计时直径 ≤ `--ddz-timer-size`；**无金色填充、无金色外发光**；不得与主按钮同排抢视觉 |
| **L4 背景** | 身份徽章、剩余牌数、阶段标签 | 常驻、降饱和；身份与行动高亮分离 |

**红线（不达标即打回）**：

1. 同时出现 ≥2 个金色填充按钮 → 不合格。
2. 倒计时环或倍数条使用与主按钮同级的金色渐变/强 glow → 不合格。
3. 倒计时与倍数分列两个亮色独立控件抢戏 → 不合格（必须同角落合并）。
4. 台呢或桌沿出现大面积金色外发光 → 不合格。

## 8. 关键动效正式表（LRM-208，替换 LRM-168 interim）

> 硬边界：禁止大面积闪光 / 强金色泛光；出牌主按钮（`.btn.primary.cta`）唯一最高亮；**单段非循环动效 ≤700ms**（循环脉冲除外）。  
> 源码常量：`apps/client/src/lib/motionSpec.ts`（本表 = 正式口径，不再标 interim）。

| 场景 | 正式规格 | vs interim / 备注 |
|---|---|---|
| **选牌/抬起** | **120ms** 上移 **34px** + 克制金边；取消同时长回落 | 替换「8px/80ms」；对齐 LRM-196 |
| **出牌飞入** | **260ms**（区间 180–320）自座位方向飞入 + `scale 0.88→1`；本席自下、左右席侧向；禁止瞬移 | **LRM-209** 正式值（替换旧 160ms 瞬切感） |
| **叫分弹出** | CTA 区 **220ms** pop（`ddz-bid-pop`） | **保持** |
| **加倍弹出** | **280ms** pop | **保持** |
| **倒计时危急** | ≤**3s** 红脉冲 **600ms** 周期 + 外环；仅 timer 本体，禁止全屏闪红 | **LRM-209**（替换旧弱脉冲） |
| **发牌散开** | **480ms**；stagger **24ms**；`scale 0.86→1`；fill-mode `backwards` | 替换 520/28 |
| **轮到谁** | 座位局部金脉冲 **1000ms** 循环；头像 scale **≤1.012**；glow **0.12↔0.22** | 替换 1200ms / 1.015 / 0.14–0.26 |
| **身份常驻** | 角标静态 + 身份色环；禁止与行动共用 glow | **保持** |
| **炸弹** | 爆点 ≤72px + 轻震 **420ms** | **保持**（已 ≤700） |
| **王炸** | 爆点 ≤84px + 轻震 **560ms** | **保持** |
| **结算弹入** | **180ms**（`12→0` / `0.92→1`） | **保持** |
| **结算金币** | **7** 枚、**700ms**、行程 ≤56px；无 bloom | **保持**（卡在上限） |
| 演示入口 | `/fx-demo?scene=deal|turn|timer|playFly|bomb|rocket|settle` | 含 LRM-209 场景 |

## 9. 接入优先级

1. **先接 token**：`apps/client/src/styles.css` 的 `:root` 已对齐本文；旧硬编码逐步替换。
2. **再接桌面/座位**：`.table` 使用 rail/felt token；`.meta-corner` 承载倒计时+倍数。
3. **再接按钮层级**：出牌 `.btn.primary.cta`；不出/提示/清空走次按钮 token。
4. **卡牌尺寸**：维持 `--ddz-card-w/h` = 52×74、`--ddz-card-small-*` = 40×56，移动端可等比缩小但不得回到 64×90。
5. **对局一屏**：`.app--game` 锁 `100dvh` + `--ddz-vp-*` 预算（LRM-246），见 §11。

## 10. 变更记录

- P0（2026-07-17，小雅）：首版 token。
- LRM-166（2026-07-21，小雅）：锁死桌沿木色 rail 厚度/颜色、台呢降饱和去泛光、按钮/HUD 信息层级可测规则、卡牌 52×74 / 40×56；同步客户端 `:root`。
- LRM-206（2026-07-21，小雅）：牌面纸质感精修（冷米白/红黑花色/大小王轨色/牌背去字）。
- LRM-208（2026-07-21，小雅）：关键动效正式时长表，替换 LRM-168 interim；同步 `motionSpec.ts`。
- LRM-246（2026-07-22，小雅）：对局页一屏视口预算 `--ddz-vp-*`；椭圆纵比 34%→28%；对局壳隐藏 footer、压缩手牌/按钮区。
- LRM-246 follow-up（2026-07-22，小雅）：手牌 `margin-top: auto` 下沉贴底，控件上移贴紧手牌（Frank 反馈）。

## 11. 对局页一屏视口（LRM-246）

> 目标视口：`1920×1080` 与常见 27″ 浏览器全屏（含约 `1440×900`）。出牌态**首屏无纵向滚动**，顶栏 + 对手区 + 中央出牌/倒计时 + 手牌 + 底栏按钮同屏可见。

### 11.1 垂直分区预算（1080 高）

| 分区 | 目标高度 | Token / 实现 |
|---|---|---|
| 顶栏 | ≤44px | `--ddz-vp-topnav-h`；`.app--game .topnav` |
| 内容边距 | ≤10px | `.app--game .content` padding |
| 椭圆台呢内边距（上下） | 18px + **4px** | `--ddz-vp-table-pad-y`；底边收紧贴操作区 |
| 中央舞台 | 140–220px | `--ddz-vp-stage-min`；`max-height: min(220px, 26vh)` |
| 手牌区 | ≥132px | `--ddz-vp-hand-min`；`.hand { margin-top: auto }` 下沉贴底 |
| 提示+按钮 | ≤96px | `--ddz-vp-controls-budget`；相对手牌 `margin-top: -8px` |
| 页脚 | 0（对局壳隐藏） | `.app--game .foot { display: none }` |

### 11.2 硬规则

1. `.app--game`：`height/max-height: 100dvh; overflow: hidden` — 禁止对局页整页纵滚。
2. 台呢椭圆纵比 `--ddz-vp-ellipse-y: 28%`（原 34%），只压高度不改木色 rail。
3. **不改**牌面 SVG、手牌逻辑尺寸 52×74、动效正式表（LRM-208/209）。
4. 结算态 `.table.settled` 允许区内滚动（内容可长），但不撑破外层 `100dvh`。
5. 验收：同视口 before/after 对照；预览 `docs/assets/previews/lrm-246/viewport-fit-sheet.svg`。

### 11.3 给小林的落地核对

- 改动面：`apps/client/src/styles.css`（`.app--game` 作用域）+ token 文档本节。
- 烟测：`/game` 与 `/fx-demo?scene=cards` 在 1920×1080；底栏五键完整可见且无 `document` 级纵滚。
- 若仍溢出：优先再压 `--ddz-vp-stage-min` / `--ddz-vp-table-pad-y`，勿缩小牌面到不可读。
