# 斗地主关键动效正式幅度 / 时长表（LRM-208）

> **状态**：正式锁死（替换 LRM-168 interim）  
> **规格源码常量**：`apps/client/src/lib/motionSpec.ts`  
> **演示页**：`/fx-demo?scene=deal|turn|bomb|rocket|settle`  
> **对标**：欢乐斗地主反馈节奏 —— 清晰、干脆、可读；克制、不刺眼。

---

## 0. 硬边界（不达标即打回）

| 规则 | 可测数值 |
|---|---|
| **单段（one-shot）动效上限** | **≤ 700ms**（写死） |
| 循环类（ambient loop） | 周期可 >700ms，但**幅度必须弱于出牌 CTA**；禁止整屏闪 |
| 禁止大面积闪光 / 强金色泛光 | 爆点半径、glow alpha 见下表上限；台呢禁止金色 inset bloom |
| 出牌 / 叫分 / 再来一局主按钮 | 保持全屏**唯一最高亮**；动效不得抢 CTA |
| `prefers-reduced-motion: reduce` | 所有动画压到近静态（已有全局规则，保持） |

---

## 1. 正式幅度 / 时长表（可测）

| 场景 | 时长 | 幅度 / 缓动 | vs LRM-168 interim | 说明 |
|---|---|---|---|---|
| **发牌散开** | **500ms**；单牌 stagger **24ms** | `translateY 40→0`；`scale 0.88→1`；`cubic-bezier(0.22, 0.9, 0.28, 1)`；无全屏闪光 | **替换**（interim 520 / 28 / Y48 / scale0.86） | 略加快、stagger 更密，贴近欢斗「唰」一下落位 |
| **叫分弹出** | **220ms** | `translateY 10→0`；`scale 0.96→1`；`ease-out` | **正式写入**（interim 表未列；CSS 已是 220ms → **保持**） | 叫分层整体弹入；按钮区禁止二次强闪光 |
| **轮到谁脉冲** | **1000ms** 循环 | 座位边框 glow alpha **0.12↔0.22**；blur 约 **10↔14px**；头像环 scale **≤1.012** | **替换**（interim 1200 / 0.14↔0.26 / scale1.015） | 节拍略快、光更弱；循环豁免 700ms 单段上限 |
| **炸弹** | **400ms** | 局部爆点半径 **≤64px**；轻震 **±3px**（字幕 shake 2 轮）；badge `0.7→1.06→1` | **替换**（interim 420ms / ≤72px） | 更脆；禁止全屏闪光 |
| **王炸** | **520ms** | 同炸弹档、略强；爆点 **≤76px**；震 **±4px** | **替换**（interim 560ms / ≤84px） | 仍局部；禁止大招全屏特效 |
| **结算弹入** | **200ms** | `translateY 10→0`；`scale 0.94→1`；`ease-out` | **替换**（interim 180 / Y12 / scale0.92） | 略柔，避免「啪」一下跳脸 |
| **结算金币** | **640ms**；枚数 **6**；stagger delay **40ms×i** | 行程 **≤48px** 上浮；无 bloom / 无全屏金光；仅胜方 | **替换**（interim 700 / 7枚 / ≤56px / delay45） | 明确压在单段上限内，更克制 |

### 1.1 相关已定、本单不改（保持）

| 场景 | 规格 | 决策 |
|---|---|---|
| 选牌抬起 | 80–120ms 上移（见 LRM-196）；克制 glow | **保持** |
| 出牌飞入 | **260ms**（LRM-209）；方位位移，禁止瞬移 | **保持**（LRM-209） |
| 倒计时末端红脉冲 | **600ms** 循环（LRM-209）；仅 timer 本体，≤3s 进入 | **保持**（LRM-209，≤700） |
| 牌型字幕常驻时长 | `playFxCaptionMs = 2000`（展示窗，非单段位移） | **保持** |
| 身份常驻高亮 | 静态色环 + 角标；禁止与行动共用 glow | **保持**（LRM-167） |

---

## 2. interim → 正式对照速查

| 键（`MOTION.*`） | interim (LRM-168) | 正式 (LRM-208) | 动作 |
|---|---|---|---|
| `dealMs` | 520 | **500** | 替换 |
| `dealStaggerMs` | 28 | **24** | 替换 |
| `dealFromScale` | 0.86 | **0.88** | 替换 |
| `dealFromY` | 48 | **40** | 替换 |
| `bidPopMs` | （未入表） | **220** | 正式写入 |
| `bidFromScale` / `bidFromY` | CSS 0.96 / 10 | **0.96 / 10** | 保持 |
| `turnPulseMs` | 1200 | **1000** | 替换 |
| `turnPulseScale` | 1.015 | **1.012** | 替换 |
| `turnGlowAlphaMin/Max` | 0.14 / 0.26 | **0.12 / 0.22** | 替换 |
| `bombMs` | 420 | **400** | 替换 |
| `bombShakePx` | 3 | **3** | 保持 |
| `bombBurstMaxPx` | 72 | **64** | 替换 |
| `rocketMs` | 560 | **520** | 替换 |
| `rocketShakePx` | 4 | **4** | 保持 |
| `rocketBurstMaxPx` | 84 | **76** | 替换 |
| `settlePopMs` | 180 | **200** | 替换 |
| `settleFromScale` | 0.92 | **0.94** | 替换 |
| `settleFromY` | 12 | **10** | 替换 |
| `coinMs` | 700 | **640** | 替换 |
| `coinCount` | 7 | **6** | 替换 |
| `coinTravelMaxPx` | 56 | **48** | 替换 |
| `coinDelayMs` | 45（硬编码） | **40** | 替换 |

---

## 3. 小林落地勾选清单

> 常量以 `apps/client/src/lib/motionSpec.ts` 为准；CSS 硬编码必须与常量一致。本 PR（LRM-208）已把常量与 CSS 同步到正式值；小林请在演示页目测勾选，并按需重录 `docs/assets/fx-demos/`。

- [x] `motionSpec.ts` 已切到上表正式值（含新增 `bidPop*` / `coinDelayMs`）
- [x] `styles.css`：`.hand.is-dealing` → `500ms`；`@keyframes ddz-deal-fan` → Y40 / scale0.88
- [x] `styles.css`：`.seat-badge.turn-pulse` / avatar / `.is-turn` → `1000ms`；glow alpha 0.12↔0.22；avatar scale 1.012
- [x] `styles.css`：炸弹 badge/burst / shake → `400ms`；burst `max-width/height ≤64px`
- [x] `styles.css`：王炸 → `520ms`；burst ≤76px
- [x] `styles.css`：`.result-card` settle-pop → `200ms`；Y10 / scale0.94
- [x] `styles.css`：`.settle-coin` → `640ms`；keyframes 行程 `-48px`
- [x] `SettleCoins.tsx`：枚数与 delay 读 `MOTION.coinCount` / `MOTION.coinDelayMs`
- [x] 叫分：`ddz-bid-pop 220ms` 与 `MOTION.bidPopMs` 一致（数值保持）
- [x] **目测**：`/fx-demo` 五场景确认无全屏闪光 / 强泛光；出牌 CTA 仍为唯一最高亮（本单已用 preview 截图自证：deal 500/24、turn 1000、bomb 400、rocket 520）
- [x] **目测**：`prefers-reduced-motion` 全局规则仍在 `styles.css`
- [ ] （可选）更新 `docs/assets/fx-demos/` 录屏以替换 interim webm（不阻塞本单）

---

## 4. 变更记录

- LRM-168（2026-07-21，小林）：interim 动效包落地（PR #33）；时长表待小雅正式校准。
- **LRM-208（2026-07-21，小雅）**：正式幅度/时长表锁死；替换 interim 中发牌/轮到谁/炸弹/王炸/结算/金币数值；叫分弹出正式入表；单段 ≤700ms 写死。
