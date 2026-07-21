/**
 * LRM-208 关键动效正式表（替换 LRM-168 interim）。
 *
 * 来源：docs/doudizhu-design-tokens.md §8。
 * 硬边界：
 * - 禁止全屏闪光 / 强金色泛光
 * - 出牌主按钮（.btn.primary.cta）保持唯一最高亮
 * - 单段非循环动效 ≤700ms
 */

export const MOTION = {
  /** 发牌散开 */
  dealMs: 480,
  dealStaggerMs: 24,
  dealFromScale: 0.86,
  dealFromY: 48,

  /** 选中抬起（对齐 LRM-196） */
  selectMs: 120,
  selectLiftPx: 34,

  /** 轮到谁：座位边框/头像环局部金色脉冲 */
  turnPulseMs: 1000,
  turnPulseScale: 1.012,
  turnGlowAlphaMin: 0.12,
  turnGlowAlphaMax: 0.22,

  /** 叫分 / 加倍弹出 */
  bidPopMs: 220,
  doublePopMs: 280,

  /** 炸弹：局部爆点 + 轻震，≤700ms */
  bombMs: 420,
  bombShakePx: 3,
  bombBurstMaxPx: 72,

  /** 王炸 */
  rocketMs: 560,
  rocketShakePx: 4,
  rocketBurstMaxPx: 84,

  /** 结算卡片弹入 */
  settlePopMs: 180,
  settleFromScale: 0.92,
  settleFromY: 12,

  /** 克制金币 */
  coinMs: 700,
  coinCount: 7,
  coinTravelMaxPx: 56,

  /** 出牌飞入 / 飞向中央 */
  playFlyInMs: 160,
  playFlyToCenterMs: 220,

  /** 牌型字幕 */
  playFxCaptionMs: 2000,

  /** LRM-209：倒计时末端红脉冲（仅 timer 本体，无全屏闪红） */
  timerDangerSec: 3,
  timerDangerPulseMs: 600,

  /** LRM-209：出牌飞向座位出牌区（明确位移，建议 180–320ms） */
  playFlyMs: 260,
  playFlyFromY: 88,
  playFlyFromX: 56,
  playFlyFromScale: 0.88,
} as const;

export type FxDemoScene =
  | 'deal'
  | 'select'
  | 'turn'
  | 'timer'
  | 'playFly'
  | 'cards'
  | 'bomb'
  | 'rocket'
  | 'settle'
  | 'reveal'
  | 'double'
  | 'mult';

export const FX_DEMO_SCENES: FxDemoScene[] = [
  'deal',
  'select',
  'turn',
  'timer',
  'playFly',
  'cards',
  'bomb',
  'rocket',
  'settle',
  'reveal',
  'double',
  'mult',
];
