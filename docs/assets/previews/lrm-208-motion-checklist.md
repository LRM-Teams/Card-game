# LRM-208 小林落地勾选清单（rebase 后含 LRM-209）

正式表：`docs/doudizhu-design-tokens.md` §8 + `apps/client/src/lib/motionSpec.ts`。

## 已由本 PR 直接改动

- [x] `MOTION.dealMs=480` / `dealStaggerMs=24`
- [x] `MOTION.turnPulseMs=1000` / scale 1.012 / glow 0.12–0.22
- [x] CSS `.hand.is-dealing` 480ms；`.turn-pulse` 1000ms
- [x] 选中抬起规格写入正式表（34px / 120ms）
- [x] 炸弹 420 / 王炸 560 / 结算 180 / 金币 700 **保持**
- [x] **保留 LRM-209**：`timerDanger*` + `playFly*`（260ms / 600ms），rebase main 后不覆盖

## 可选复核

- [ ] `/fx-demo?scene=deal|turn|timer|playFly|bomb|rocket|settle`
- [ ] 89 滚 tip 后截图交群管终关
