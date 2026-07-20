/**
 * 出牌提示后处理（LRM-160）：在 DouZero top-N 合法建议上重排/补全，
 * 不改动 infer 模型。策略：少拆三张/炸弹、同型压牌优先更小 mainRank、
 * 地主残局（≤2 张）时农民侧避免明显送最小牌。
 */
import { HandType, identifyHand } from '@card-game/rules';
import type { Card } from '@card-game/rules';
import type { BotPlayContext } from './douzeroAdapter';
import { botChoosePlay } from './bot';

function countByRank(cards: readonly Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

function cardSetKey(cards: readonly Card[]): string {
  return [...cards].map((c) => c.id).sort().join(',');
}

/** 从完整手牌视角：该出牌是否「拆」了三张或炸弹。 */
export function splitStructurePenalty(hand: readonly Card[], play: readonly Card[]): number {
  if (play.length === 0) return 0;
  const handCounts = countByRank(hand);
  const playCounts = countByRank(play);
  const identified = identifyHand(play);
  let penalty = 0;

  for (const [rank, used] of playCounts) {
    const inHand = handCounts.get(rank) ?? 0;
    if (inHand < 3 || used === 0) continue;

    const playsAsBomb = identified?.type === HandType.BOMB && identified.mainRank === rank && used === 4;
    const playsAsTriple =
      (identified?.type === HandType.TRIPLE ||
        identified?.type === HandType.TRIPLE_SINGLE ||
        identified?.type === HandType.TRIPLE_PAIR) &&
      identified.mainRank === rank &&
      used >= 3;

    if (inHand === 4 && !playsAsBomb && used < 4) penalty += 200;
    else if (inHand >= 3 && !playsAsTriple && !playsAsBomb && used < 3) penalty += 150;
  }
  return penalty;
}

/** 地主剩牌很少时，农民出最小单/对视为「送牌」倾向。 */
export function endgameGiftPenalty(ctx: BotPlayContext, play: readonly Card[]): number {
  if (ctx.seat === ctx.landlordSeat) return 0;
  const landlordLeft = ctx.handCounts[ctx.landlordSeat] ?? 17;
  if (landlordLeft > 2) return 0;

  const identified = identifyHand(play);
  if (!identified) return 0;

  if (!ctx.prev) {
    const handRanks = [...ctx.hand].map((c) => c.rank).sort((a, b) => a - b);
    if (handRanks.length === 0) return 0;
    if (identified.type === HandType.SINGLE) {
      const minRank = handRanks[0]!;
      if (identified.mainRank === minRank) return 120;
    }
    if (identified.type === HandType.PAIR) {
      const pairRanks = [...countByRank(ctx.hand).entries()]
        .filter(([, n]) => n >= 2)
        .map(([r]) => r)
        .sort((a, b) => a - b);
      const minPairRank = pairRanks[0];
      if (minPairRank !== undefined && identified.mainRank === minPairRank) return 120;
    }
    return 0;
  }

  const prev = ctx.prev;
  if (identified.type === HandType.PAIR && prev.type === HandType.PAIR) {
    const pairRanks = [...countByRank(ctx.hand).entries()]
      .filter(([, n]) => n >= 2)
      .map(([r]) => r)
      .sort((a, b) => a - b);
    const minBeatRank = pairRanks.find((r) => r > prev.mainRank);
    if (minBeatRank !== undefined && identified.mainRank === minBeatRank) return 120;
  }

  if (identified.type === HandType.SINGLE && prev.type === HandType.SINGLE) {
    const singles = [...ctx.hand].map((c) => c.rank).sort((a, b) => a - b);
    const minBeatRank = singles.find((r) => r > prev.mainRank);
    if (minBeatRank !== undefined && identified.mainRank === minBeatRank) return 120;
  }

  return 0;
}

function suggestionScore(ctx: BotPlayContext, play: readonly Card[], index: number): number {
  const hand = ctx.hand;
  const identified = identifyHand(play);
  const split = splitStructurePenalty(hand, play);
  const gift = endgameGiftPenalty(ctx, play);
  const mainRank = identified?.mainRank ?? 99;
  return split * 10_000 + gift * 100 + mainRank * 10 + index;
}

/**
 * 对模型 top-N 建议重排；必要时插入规则启发的一手（仍经 identify + 与 prev 合法性由上游保证）。
 */
export function postProcessHintSuggestions(ctx: BotPlayContext, suggestions: Card[][]): Card[][] {
  let list = suggestions.filter((s) => s.length > 0);
  if (list.length === 0) return list;

  const heuristic = botChoosePlay([...ctx.hand], ctx.prev);
  if (heuristic && heuristic.length > 0) {
    const key = cardSetKey(heuristic);
    const exists = list.some((s) => cardSetKey(s) === key);
    const topSplit = splitStructurePenalty(ctx.hand, list[0]!);
    const heuristicSplit = splitStructurePenalty(ctx.hand, heuristic);
    if (!exists && heuristicSplit < topSplit) {
      list = [heuristic, ...list];
    }
  }

  const indexed = list.map((play, index) => ({ play, index }));
  indexed.sort((a, b) => suggestionScore(ctx, a.play, a.index) - suggestionScore(ctx, b.play, b.index));

  const seen = new Set<string>();
  const out: Card[][] = [];
  for (const { play } of indexed) {
    const key = cardSetKey(play);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([...play]);
  }
  return out;
}
