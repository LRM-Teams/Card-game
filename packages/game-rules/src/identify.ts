import { canBeat } from './compare';
import { sortCards } from './sort';
import { Card, Hand, HandType, RANK, SEQ_RANK_MAX, SEQ_RANK_MIN } from './types';

/** 按 rank 统计张数。 */
function countByRank(cards: readonly Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

/** 取张数等于 count 的点数（升序）。 */
function ranksWithCount(counts: Map<number, number>, count: number): number[] {
  const out: number[] = [];
  for (const [rank, cnt] of counts) if (cnt === count) out.push(rank);
  return out.sort((a, b) => a - b);
}

/** 点数数组是否连续递增（长度 ≥ 2）。 */
function isConsecutiveRun(ranks: readonly number[]): boolean {
  if (ranks.length < 2) return false;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1]! + 1) return false;
  }
  return true;
}

/** 全部点数都落在 3..A 区间（2 与王不能进连续序列）。 */
function allInSeqRange(ranks: readonly number[]): boolean {
  return ranks.every((r) => r >= SEQ_RANK_MIN && r <= SEQ_RANK_MAX);
}

/**
 * 识别一组牌的牌型。
 *
 * @returns 合法则返回 Hand（含 type / mainRank / length），否则返回 null。
 *
 * 大小比较语义统一交给 {@link canBeat}；本函数只负责"这组牌是不是某种合法牌型"。
 */
export function identifyHand(input: readonly Card[]): Hand | null {
  if (!input || input.length === 0) return null;

  const cards = sortCards(input);
  const n = cards.length;
  const counts = countByRank(cards);
  const ranks = [...counts.keys()].sort((a, b) => a - b);

  // 王炸：小王 + 大王
  if (n === 2 && counts.get(RANK.SMALL_JOKER) === 1 && counts.get(RANK.BIG_JOKER) === 1) {
    return { type: HandType.ROCKET, cards, mainRank: RANK.BIG_JOKER, length: 1 };
  }

  // 单张
  if (n === 1) {
    return { type: HandType.SINGLE, cards, mainRank: cards[0]!.rank, length: 1 };
  }

  // 对子 / 三张 / 炸弹（单一 rank）
  if (ranks.length === 1) {
    const rank = ranks[0]!;
    if (n === 2) return { type: HandType.PAIR, cards, mainRank: rank, length: 1 };
    if (n === 3) return { type: HandType.TRIPLE, cards, mainRank: rank, length: 1 };
    if (n === 4) return { type: HandType.BOMB, cards, mainRank: rank, length: 1 };
  }

  // 三带一：{3,1}
  {
    const trips = ranksWithCount(counts, 3);
    if (n === 4 && trips.length === 1 && ranksWithCount(counts, 1).length === 1) {
      return { type: HandType.TRIPLE_SINGLE, cards, mainRank: trips[0]!, length: 1 };
    }
  }

  // 三带二：{3,2}
  {
    const trips = ranksWithCount(counts, 3);
    if (n === 5 && trips.length === 1 && ranksWithCount(counts, 2).length === 1) {
      return { type: HandType.TRIPLE_PAIR, cards, mainRank: trips[0]!, length: 1 };
    }
  }

  // 顺子：≥5 张单牌，连续，3..A
  if (n >= 5 && ranks.length === n && ranksWithCount(counts, 1).length === n) {
    if (isConsecutiveRun(ranks) && allInSeqRange(ranks)) {
      return { type: HandType.STRAIGHT, cards, mainRank: ranks[0]!, length: n };
    }
  }

  // 连对：≥3 对，连续，3..A
  {
    const pairs = ranksWithCount(counts, 2);
    if (
      pairs.length >= 3 &&
      pairs.length * 2 === n &&
      pairs.length === ranks.length &&
      isConsecutiveRun(pairs) &&
      allInSeqRange(pairs)
    ) {
      return { type: HandType.PAIR_STRAIGHT, cards, mainRank: pairs[0]!, length: pairs.length };
    }
  }

  // 飞机系列（≥2 个连续三张）
  {
    const trips = ranksWithCount(counts, 3);
    if (trips.length >= 2 && isConsecutiveRun(trips) && allInSeqRange(trips)) {
      const k = trips.length;

      // 飞机不带：仅 k 个三张，n = 3k
      if (n === 3 * k && ranks.length === k) {
        return { type: HandType.PLANE, cards, mainRank: trips[0]!, length: k };
      }

      // 飞机带单：n = 4k，剩余 k 张为互不相同的单牌
      if (n === 4 * k) {
        const wings = ranks.filter((r) => !trips.includes(r));
        const allSingles = wings.every((r) => counts.get(r) === 1);
        if (allSingles && wings.length === k) {
          return { type: HandType.PLANE_SINGLE, cards, mainRank: trips[0]!, length: k };
        }
      }

      // 飞机带对：n = 5k，剩余 k 组为互不相同的对子
      if (n === 5 * k) {
        const wings = ranks.filter((r) => !trips.includes(r));
        const allPairs = wings.every((r) => counts.get(r) === 2);
        if (allPairs && wings.length === k) {
          return { type: HandType.PLANE_PAIR, cards, mainRank: trips[0]!, length: k };
        }
      }
    }
  }

  // 四带二（两张单牌）：n=6，一个四张 + 两个互不相同的单牌
  if (n === 6) {
    const quads = ranksWithCount(counts, 4);
    if (quads.length === 1) {
      const wings = ranks.filter((r) => r !== quads[0]);
      if (wings.length === 2 && wings.every((r) => counts.get(r) === 1)) {
        return { type: HandType.FOUR_TWO_SINGLE, cards, mainRank: quads[0]!, length: 1 };
      }
    }
  }

  // 四带两对：n=8，一个四张 + 两个互不相同的对子
  if (n === 8) {
    const quads = ranksWithCount(counts, 4);
    if (quads.length === 1) {
      const wings = ranks.filter((r) => r !== quads[0]);
      if (wings.length === 2 && wings.every((r) => counts.get(r) === 2)) {
        return { type: HandType.FOUR_TWO_PAIR, cards, mainRank: quads[0]!, length: 1 };
      }
    }
  }

  return null;
}

/**
 * 综合判定：在"上家牌型"约束下，本次出牌是否合法。
 *
 * - `prev` 为 null 表示自由出牌（首出），只要 `cards` 是合法牌型即可。
 * - 否则需 `cards` 是合法牌型，且能压过上家（{@link canBeat}）。
 *
 * 服务端权威校验直接调本函数；客户端做"出牌按钮可用/提示"也可复用同一实现。
 */
export function canPlay(prev: Hand | null, cards: readonly Card[]): boolean {
  const curr = identifyHand(cards);
  if (!curr) return false;
  if (!prev) return true;
  return canBeat(prev, curr);
}
