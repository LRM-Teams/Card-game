/**
 * LRM-208 关键动效正式规格（替换 LRM-168 interim）。
 * LRM-209 增量：倒计时末端红脉冲、出牌飞入方位位移（并入本常量，≤700ms）。
 *
 * 规格文档：docs/doudizhu-motion-spec.md
 * Token 摘要：docs/doudizhu-design-tokens.md §8
 *
 * 硬边界：
 * - 单段（one-shot）动效 ≤ 700ms
 * - 禁止全屏闪光 / 强金色泛光
 * - 出牌主按钮（.btn.primary.cta）保持唯一最高亮
 * - 循环类（轮到谁）可 >700ms，但幅度必须弱于 CTA
 */

export const MOTION = {
  /** 发牌散开：总时长；单牌 stagger 见 dealStaggerMs */
  dealMs: 500,
  dealStaggerMs: 24,
  dealFromScale: 0.88,
  dealFromY: 40,

  /** 叫分按钮区弹出（正式入表；与 CSS ddz-bid-pop 对齐） */
  bidPopMs: 220,
  bidFromScale: 0.96,
  bidFromY: 10,

  /** 轮到谁：座位边框/头像环局部金色脉冲（非全屏；循环豁免 700ms 单段上限） */
  turnPulseMs: 1000,
  turnPulseScale: 1.012,
  turnGlowAlphaMin: 0.12,
  turnGlowAlphaMax: 0.22,

  /** 炸弹：局部爆点 + 轻震，≤700ms */
  bombMs: 400,
  bombShakePx: 3,
  bombBurstMaxPx: 64,

  /** 王炸：略长但仍局部 */
  rocketMs: 520,
  rocketShakePx: 4,
  rocketBurstMaxPx: 76,

  /** 结算卡片弹入 */
  settlePopMs: 200,
  settleFromScale: 0.94,
  settleFromY: 10,

  /** 克制金币：少量、短距、无 bloom */
  coinMs: 640,
  coinCount: 6,
  coinTravelMaxPx: 48,
  coinDelayMs: 40,

  /** 牌型字幕展示窗（非单段位移；保持） */
  playFxCaptionMs: 2000,

  /** LRM-209：倒计时末端红脉冲（仅 timer 本体，无全屏闪红） */
  timerDangerSec: 3,
  timerDangerPulseMs: 600,

  /** LRM-209：出牌飞向座位出牌区（明确位移，建议 180–320ms） */
  playFlyMs: 260,
  playFlyFromY: 88,
  playFlyFromX: 56,
  playFlyFromScale: 0.88,

  /** 单段动效硬上限（验收红线） */
  oneShotMaxMs: 700,
} as const;

export type FxDemoScene =
  | 'deal'
  | 'select'
  | 'turn'
  | 'timer'
  | 'playFly'
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
  'bomb',
  'rocket',
  'settle',
  'reveal',
  'double',
  'mult',
];
