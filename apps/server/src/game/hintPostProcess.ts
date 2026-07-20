import { identifyHand, type Card } from '@card-game/rules';

function countByRank(cards: readonly Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

/**
 * 提示后处理评分（LRM-160）：数值越小越优先。
 * - 少拆炸弹 / 三张（从成组牌里抠牌出牌重罚）
 * - 同牌型压牌时优先更小 mainRank
 */
export function scoreHintSuggestion(hand: readonly Card[], play: readonly Card[]): number {
  const handBy = countByRank(hand);
  const playBy = countByRank(play);
  let penalty = 0;

  for (const [rank, used] of playBy) {
    const have = handBy.get(rank) ?? 0;
    if (have >= 4 && used > 0 && used < 4) penalty += 10_000;
    if (have === 3 && used > 0 && used < 3) penalty += 5_000;
  }

  const identified = identifyHand([...play]);
  const rankCost = identified?.mainRank ?? 0;
  return penalty * 100 + rankCost;
}

/** 在保持合法性的前提下重排 DouZero top-N 提示（产品向，非改模型）。 */
export function refinePlaySuggestions(hand: readonly Card[], suggestions: Card[][]): Card[][] {
  if (suggestions.length <= 1) return suggestions;
  return [...suggestions].sort(
    (a, b) => scoreHintSuggestion(hand, a) - scoreHintSuggestion(hand, b),
  );
}
