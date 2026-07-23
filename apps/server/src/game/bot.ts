/**
 * 补位机器人入口（服务端）。
 *
 * 决策逻辑在 @card-game/rules 的 botStrategy（单一来源）；
 * 本文件只做薄封装 + 显示名，方便 GameRoom / DouZero fallback 调用。
 */
import {
  botBidByDifficulty,
  botChoosePlayByDifficulty,
  decideBidByDifficulty,
  decidePlayByDifficulty,
  type BotBidDecision,
  type BotDifficulty,
  type BotPlayDecision,
} from '@card-game/rules';
import type { BidChoice, Card, Hand } from '@card-game/rules';

const DEFAULT_DIFFICULTY: BotDifficulty = 'normal';

/** 生成机器人显示名。 */
export function botName(n: number): string {
  return `机器人${n}`;
}

/** 机器人是否叫地主（普通档启发式）。 */
export function botBid(hand: readonly Card[]): BidChoice {
  return botBidByDifficulty(hand, DEFAULT_DIFFICULTY);
}

/** 带理由的叫分决策（LRM-523 可观测）。 */
export function botBidDecision(hand: readonly Card[]): BotBidDecision {
  return decideBidByDifficulty(hand, DEFAULT_DIFFICULTY);
}

/** 地主是否明牌：大牌够强则亮（×2 代价换信息战）。 */
export function botReveal(hand: readonly Card[]): boolean {
  return botBid(hand) === 'claim';
}

/** 是否加倍：手力够则加倍；地主略激进一点。 */
export function botDouble(hand: readonly Card[], isLandlord: boolean): boolean {
  const claim = botBid(hand) === 'claim';
  if (isLandlord) return claim;
  return claim && hand.length <= 17;
}

/**
 * 出牌决策（普通档规则策略）。
 * @returns 出牌的 Card[]；找不到（或策略上选择不压）则返回 null（= pass）。
 */
export function botChoosePlay(hand: readonly Card[], prev: Hand | null): Card[] | null {
  return botChoosePlayByDifficulty(hand, prev, DEFAULT_DIFFICULTY);
}

/** 带理由的出牌决策（LRM-523 可观测）。 */
export function botPlayDecision(hand: readonly Card[], prev: Hand | null): BotPlayDecision {
  return decidePlayByDifficulty(hand, prev, DEFAULT_DIFFICULTY);
}
