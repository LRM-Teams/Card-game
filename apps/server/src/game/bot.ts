/**
 * 服务端机器人入口：决策逻辑在 @card-game/rules 的 AI 模块（单一来源）。
 * DouZero adapter 不可用时 fallback 到本处导出的 choosePlay（普通档）。
 */
import {
  choosePlay as rulesChoosePlay,
  decideBid,
  decideDouble,
  decideReveal,
  type BotDifficulty,
  type Card,
  type Hand,
  type BidChoice,
} from '@card-game/rules';

export type { BotDifficulty };

/** 生成机器人显示名。 */
export function botName(n: number): string {
  return `机器人${n}`;
}

/** 机器人叫地主（普通档启发式 → claim/pass）。 */
export function botBid(hand: readonly Card[]): BidChoice {
  return decideBid(hand);
}

/** 地主是否明牌。 */
export function botReveal(hand: readonly Card[]): boolean {
  return decideReveal(hand);
}

/** 是否加倍。 */
export function botDouble(hand: readonly Card[], isLandlord: boolean): boolean {
  return decideDouble(hand, isLandlord);
}

/**
 * 机器人出牌（默认普通档）。
 * @returns 出牌 Card[]；找不到则 null（= pass）。自由出保证有合法牌时不返回 null。
 */
export function botChoosePlay(
  hand: readonly Card[],
  prev: Hand | null,
  difficulty: BotDifficulty = 'normal',
): Card[] | null {
  return rulesChoosePlay(hand, prev, difficulty);
}
