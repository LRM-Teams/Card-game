import { HandType, type Hand } from './types';

/**
 * 倍数状态（纯数据，不可变更新）。
 *
 * MVP 倍数规则（@阿策 #110 已定）：
 * - 底分固定 1；
 * - 每出一个**炸弹 ×2**、**王炸 ×2**；
 * - **春天 / 反春 ×2**（按"欢乐斗地主"规则，@caozs2 指示纳入）。
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
