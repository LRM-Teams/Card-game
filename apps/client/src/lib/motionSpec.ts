/**
 * LRM-168 关键动效规格（克制、不刺眼）。
 *
 * 来源：docs/doudizhu-design-tokens.md §7 + baseline v7「可先用克制动效」。
 * 小雅若在 issue 评论给出正式时长/幅度表，以评论为准并回写本文件。
 *
 * 硬边界：
 * - 禁止全屏闪光 / 强金色泛光
 * - 出牌主按钮（.btn.primary.cta）保持唯一最高亮
 */

export const MOTION = {
  /** 发牌散开：总时长；单牌 stagger 见 dealStaggerMs */
  dealMs: 520,
  dealStaggerMs: 28,
  dealFromScale: 0.86,
  dealFromY: 48,

  /** 轮到谁：座位边框/头像环局部金色脉冲（非全屏） */
  turnPulseMs: 1200,
  turnPulseScale: 1.015,
  turnGlowAlphaMin: 0.14,
  turnGlowAlphaMax: 0.26,

  /** 炸弹：局部爆点 + 轻震，≤700ms */
  bombMs: 420,
  bombShakePx: 3,
  bombBurstMaxPx: 72,

  /** 王炸：略长但仍局部 */
  rocketMs: 560,
  rocketShakePx: 4,
  rocketBurstMaxPx: 84,

  /** 结算卡片弹入 */
  settlePopMs: 180,
  settleFromScale: 0.92,
  settleFromY: 12,

  /** 克制金币：少量、短距、无 bloom */
  coinMs: 700,
  coinCount: 7,
  coinTravelMaxPx: 56,

  /** 牌型字幕（已有） */
  playFxCaptionMs: 2000,
} as const;

export type FxDemoScene =
  | 'deal'
  | 'turn'
  | 'bomb'
  | 'rocket'
  | 'settle'
  | 'reveal'
  | 'double'
  | 'mult';

export const FX_DEMO_SCENES: FxDemoScene[] = [
  'deal',
  'turn',
  'bomb',
  'rocket',
  'settle',
  'reveal',
  'double',
  'mult',
];
