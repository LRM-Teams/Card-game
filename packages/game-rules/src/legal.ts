import { canPlay } from './identify';
import type { Card, Hand } from './types';
import { SEQ_RANK_MAX, SEQ_RANK_MIN } from './types';

/**
 * 枚举手牌在给定上家约束下的全部合法出牌（不含 pass）。
 * 供机器人策略、提示、DouZero adapter 等共用；合法性最终仍以 {@link canPlay} 为准。
 */
export function listLegalPlays(hand: readonly Card[], prev: Hand | null): Card[][] {
  const byRank = groupByRank(hand);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const seqRanks = ranks.filter((rank) => rank >= SEQ_RANK_MIN && rank <= SEQ_RANK_MAX);
  const seen = new Set<string>();
  const result: Card[][] = [];

  const add = (cards: readonly Card[]): void => {
    if (cards.length === 0 || !canPlay(prev, cards)) return;
    const key = actionKey(cards);
    if (seen.has(key)) return;
    seen.add(key);
    result.push([...cards]);
  };

  for (const rank of ranks) {
    add(take(byRank, rank, 1));
    add(take(byRank, rank, 2));
    add(take(byRank, rank, 3));
    add(take(byRank, rank, 4));
  }

  addRocket(byRank, add);
  addRuns(seqRanks, byRank, 1, 5, add); // 顺子
  addRuns(seqRanks, byRank, 2, 3, add); // 连对
  addRuns(seqRanks, byRank, 3, 2, add); // 飞机不带

  for (const tripRank of ranks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 3)) {
    const trip = take(byRank, tripRank, 3);
    for (const wingRank of ranks.filter((rank) => rank !== tripRank)) {
      add([...trip, ...take(byRank, wingRank, 1)]);
      add([...trip, ...take(byRank, wingRank, 2)]);
    }
  }

  addPlaneWings(seqRanks, byRank, 1, add);
  addPlaneWings(seqRanks, byRank, 2, add);

  for (const quadRank of ranks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 4)) {
    const quad = take(byRank, quadRank, 4);
    const wingRanks = ranks.filter((rank) => rank !== quadRank);
    for (const pair of combinations(
      wingRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 1),
      2,
    )) {
      add([...quad, ...pair.flatMap((rank) => take(byRank, rank, 1))]);
    }
    for (const pair of combinations(
      wingRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 2),
      2,
    )) {
      add([...quad, ...pair.flatMap((rank) => take(byRank, rank, 2))]);
    }
  }

  return result;
}

function groupByRank(cards: readonly Card[]): Map<number, Card[]> {
  const byRank = new Map<number, Card[]>();
  for (const card of cards) {
    const group = byRank.get(card.rank) ?? [];
    group.push(card);
    byRank.set(card.rank, group);
  }
  return byRank;
}

function take(byRank: Map<number, Card[]>, rank: number, count: number): Card[] {
  const cards = byRank.get(rank) ?? [];
  return cards.length >= count ? cards.slice(0, count) : [];
}

function actionKey(cards: readonly Card[]): string {
  return cards
    .map((card) => card.rank)
    .sort((a, b) => a - b)
    .join(',');
}

function addRocket(byRank: Map<number, Card[]>, add: (cards: readonly Card[]) => void): void {
  const small = take(byRank, 16, 1);
  const big = take(byRank, 17, 1);
  if (small.length === 1 && big.length === 1) add([...small, ...big]);
}

function addRuns(
  seqRanks: readonly number[],
  byRank: Map<number, Card[]>,
  countPerRank: number,
  minLength: number,
  add: (cards: readonly Card[]) => void,
): void {
  const eligible = seqRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= countPerRank);
  for (const run of consecutiveRuns(eligible)) {
    for (let len = minLength; len <= run.length; len++) {
      for (let start = 0; start + len <= run.length; start++) {
        const ranks = run.slice(start, start + len);
        add(ranks.flatMap((rank) => take(byRank, rank, countPerRank)));
      }
    }
  }
}

function addPlaneWings(
  seqRanks: readonly number[],
  byRank: Map<number, Card[]>,
  wingCount: 1 | 2,
  add: (cards: readonly Card[]) => void,
): void {
  const tripleRanks = seqRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 3);
  const wingRanks = [...byRank.keys()]
    .sort((a, b) => a - b)
    .filter((rank) => (byRank.get(rank)?.length ?? 0) >= wingCount);
  for (const run of consecutiveRuns(tripleRanks)) {
    for (let len = 2; len <= run.length; len++) {
      for (let start = 0; start + len <= run.length; start++) {
        const trips = run.slice(start, start + len);
        const pickedWingRanks = wingRanks.filter((rank) => !trips.includes(rank));
        for (const picked of combinations(pickedWingRanks, len)) {
          add([
            ...trips.flatMap((rank) => take(byRank, rank, 3)),
            ...picked.flatMap((rank) => take(byRank, rank, wingCount)),
          ]);
        }
      }
    }
  }
}

function consecutiveRuns(ranks: readonly number[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  for (const rank of ranks) {
    if (current.length === 0 || rank === current[current.length - 1]! + 1) {
      current.push(rank);
      continue;
    }
    runs.push(current);
    current = [rank];
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const result: T[][] = [];
  const picked: T[] = [];
  function visit(start: number): void {
    if (picked.length === size) {
      result.push([...picked]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      picked.push(items[i]!);
      visit(i + 1);
      picked.pop();
    }
  }
  visit(0);
  return result;
}
