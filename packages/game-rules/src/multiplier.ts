import { HandType, type Hand } from './types';
import type { DoubleChoice } from './protocol';

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

/**
 * 一次「抢/反抢」→ 倍数 ×2（叫地主本身不翻倍，是基础 1）。
 *
 * 与 {@link resolveBidding} 的 `biddingMultiplier` 口径一致：叫=1、每次抢/反抢 ×2。
 * 服务端可对每次 grab claim 调一次，或用 {@link applyGrabClaims} 一次性折算。
 */
export function applyGrab(state: MultiplierState): MultiplierState {
  return { ...state, multiplier: state.multiplier * 2 };
}

/** 一次性折算 `grabClaims` 次抢/反抢：倍数 ×`2 ** grabClaims`。 */
export function applyGrabClaims(state: MultiplierState, grabClaims: number): MultiplierState {
  if (grabClaims <= 0) return state;
  return { ...state, multiplier: state.multiplier * 2 ** grabClaims };
}

/** 单个加倍选择的倍数系数：加倍 ×2、超级加倍 ×4、不加倍 ×1。 */
export function doubleFactor(choice: DoubleChoice): number {
  switch (choice) {
    case 'double':
      return 2;
    case 'super':
      return 4;
    case 'pass':
      return 1;
  }
}

/**
 * 应用一名玩家的加倍选择（DOUBLING 阶段）→ 新倍数状态。
 * 加倍 ×2、超级加倍 ×4、不加倍不变。多名玩家各自的选择相乘累积。
 */
export function applyDouble(state: MultiplierState, choice: DoubleChoice): MultiplierState {
  const f = doubleFactor(choice);
  return f === 1 ? state : { ...state, multiplier: state.multiplier * f };
}

/** 一次性折算全部玩家的加倍选择：各系数连乘。 */
export function applyDoubles(
  state: MultiplierState,
  choices: readonly DoubleChoice[],
): MultiplierState {
  let st = state;
  for (const c of choices) st = applyDouble(st, c);
  return st;
}
