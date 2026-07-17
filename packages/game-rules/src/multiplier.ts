import type { DoubleChoice } from './bidding';
import { HandType, type Hand } from './types';

/**
 * 倍数状态（纯数据，不可变更新）。
 *
 * 倍数规则（按腾讯"欢乐斗地主"，@caozs2 指示完全对齐）：
 * - 底分固定 1；
 * - 每出一个**炸弹 ×2**、**王炸 ×2**；
 * - **春天 / 反春 ×2**；
 * - **明牌 ×2**（地主开局亮明手牌）。
 *
 * 服务端在每次出牌后调用 `applyPlay` 累积倍数；结算时用 `unitScore` 折算进 `settle`。
 */
export interface MultiplierState {
  /** 底分（MVP 固定 1）。 */
  base: number;
  /** 当前倍数（从 1 起，每炸弹 / 王炸 ×2）。 */
  multiplier: number;
}

/** 初始倍数状态（底分 1、倍数 1）。 */
export function createMultiplier(base = 1): MultiplierState {
  return { base, multiplier: 1 };
}

/** 一次出牌是否触发翻倍（炸弹 / 王炸）。 */
export function isDoublingPlay(hand: Hand): boolean {
  return hand.type === HandType.BOMB || hand.type === HandType.ROCKET;
}

/** 应用一次出牌，返回**新的**倍数状态（不修改入参）。炸弹 / 王炸 ×2，其余不变。 */
export function applyPlay(state: MultiplierState, hand: Hand): MultiplierState {
  if (isDoublingPlay(hand)) return { ...state, multiplier: state.multiplier * 2 };
  return state;
}

/** 给定一组已出的牌型，直接算出最终倍数状态（便捷函数）。 */
export function computeMultiplier(plays: readonly Hand[], base = 1): MultiplierState {
  let st = createMultiplier(base);
  for (const h of plays) st = applyPlay(st, h);
  return st;
}

/** 底分 × 倍数 = 单注结算单位，喂给 {@link settle}。 */
export function unitScore(state: MultiplierState): number {
  return state.base * state.multiplier;
}

/** 春天（地主胜且农民一张未出）→ 倍数 ×2。是否触发由服务端按出牌历史判定后调用。 */
export function applySpring(state: MultiplierState): MultiplierState {
  return { ...state, multiplier: state.multiplier * 2 };
}

/** 反春（农民胜且地主底牌外只出一手）→ 倍数 ×2。是否触发由服务端按出牌历史判定后调用。 */
export function applyAntiSpring(state: MultiplierState): MultiplierState {
  return { ...state, multiplier: state.multiplier * 2 };
}

/** 明牌（地主开局亮明手牌）→ 倍数 ×2。是否明牌由地主选择（客户端 UI + 服务端流程触发）。 */
export function applyReveal(state: MultiplierState): MultiplierState {
  return { ...state, multiplier: state.multiplier * 2 };
}

/** 单个加倍选择的倍数因子：不加倍 ×1、加倍 ×2、超级加倍 ×4。 */
export function doubleFactor(choice: DoubleChoice): number {
  return choice === 'super' ? 4 : choice === 'double' ? 2 : 1;
}

/**
 * 抢地主翻倍：把抢的次数折算进倍数（每抢一次 ×2）。服务端在地主敲定后调用一次。
 * factor 来自 game-rules 的 {@link grabFactor}（叫抢序列 → 2^抢次数）。
 */
export function applyGrab(state: MultiplierState, factor: number): MultiplierState {
  return { ...state, multiplier: state.multiplier * factor };
}

/**
 * 加倍环节：把各家（地主+农民）的加倍选择连乘进倍数。服务端在 DOUBLING 阶段结束后调用一次。
 * 例：地主 super(×4) + 一农民 double(×2) + 一农民 pass(×1) → ×8。
 */
export function applyDoubles(state: MultiplierState, choices: readonly DoubleChoice[]): MultiplierState {
  const factor = choices.reduce((f, c) => f * doubleFactor(c), 1);
  return { ...state, multiplier: state.multiplier * factor };
}
