/**
 * 房间内规则机器人策略（非 DouZero）。
 *
 * 普通档：叫分看手力启发式；出牌优先能走完 / 少拆炸弹，全部经 canPlay 校验。
 * DouZero adapter 不可用时服务端 fallback 到本模块。
 */
import type { BidChoice } from './bidding';
import { canPlay, identifyHand } from './identify';
import type { Card, Hand } from './types';
import { HandType, RANK, SEQ_RANK_MAX, SEQ_RANK_MIN } from './types';
export type BotDifficulty = 'easy' | 'normal' | 'hard';

/** 0=不叫 … 3=强叫（MVP 状态机仍映射为 claim/pass）。 */
export type BidStrength = 0 | 1 | 2 | 3;

function groupByRank(hand: readonly Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of hand) {
    const arr = m.get(c.rank);
    if (arr) arr.push(c);
    else m.set(c.rank, [c]);
  }
  return m;
}

function hasRocket(hand: readonly Card[]): boolean {
  return (
    hand.some((c) => c.rank === RANK.SMALL_JOKER) && hand.some((c) => c.rank === RANK.BIG_JOKER)
  );
}

function takeN(group: Card[], n: number): Card[] {
  return [...group].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, n);
}

function bombRanks(groups: Map<number, Card[]>): number[] {
  const out: number[] = [];
  for (const [r, arr] of groups) if (arr.length === 4) out.push(r);
  return out.sort((a, b) => a - b);
}

/** 手力分（越大越强）。 */
export function evaluateHandPower(hand: readonly Card[]): number {
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);

  let power = 0;
  if (hasRocket(hand)) power += 8;
  for (const [rank, n] of counts) {
    if (n === 4) power += 6;
    if (rank === RANK.TWO) power += 2 * n;
    if (rank === RANK.SMALL_JOKER && !hasRocket(hand)) power += 3;
    if (rank === RANK.BIG_JOKER && !hasRocket(hand)) power += 4;
    if (rank === RANK.A) power += n;
    if (rank === RANK.K) power += 0.5 * n;
  }
  return power;
}

/**
 * 估计叫分强度 0..3。
 * - 王炸 / 双炸 → 3
 * - 单炸或大牌够密 → 2
 * - 中等手力 → 1
 * - 弱牌 → 0
 */
export function estimateBidStrength(hand: readonly Card[]): BidStrength {
  const power = evaluateHandPower(hand);
  const groups = groupByRank(hand);
  const bombs = bombRanks(groups).length;
  const rocket = hasRocket(hand);

  if (rocket || bombs >= 2 || power >= 14) return 3;
  if (bombs >= 1 || power >= 8) return 2;
  if (power >= 5) return 1;
  return 0;
}

/** 普通档叫地主：强度 ≥1 则 claim。 */
export function botBidByDifficulty(
  hand: readonly Card[],
  difficulty: BotDifficulty = 'normal',
): BidChoice {
  const strength = estimateBidStrength(hand);
  if (difficulty === 'easy') return strength >= 2 ? 'claim' : 'pass';
  if (difficulty === 'hard') return strength >= 1 ? 'claim' : 'pass';
  return strength >= 1 ? 'claim' : 'pass';
}

function makeRocket(hand: readonly Card[]): Card[] | null {
  const s = hand.find((c) => c.rank === RANK.SMALL_JOKER);
  const b = hand.find((c) => c.rank === RANK.BIG_JOKER);
  if (s && b) return [s, b];
  return null;
}

function flatHand(groups: Map<number, Card[]>): Card[] {
  return [...groups.values()].flat();
}

function smallestSingleOtherThan(groups: Map<number, Card[]>, excludeRank: number): Card[] | null {
  const sorted = [...flatHand(groups)]
    .filter((c) => c.rank !== excludeRank)
    .sort((a, b) => a.rank - b.rank);
  const c = sorted[0];
  return c ? [c] : null;
}

function smallestPairOtherThan(groups: Map<number, Card[]>, excludeRank: number): Card[] | null {
  for (const [r, arr] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (r !== excludeRank && arr.length >= 2 && arr.length < 4) return takeN(arr, 2);
  }
  for (const [r, arr] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (r !== excludeRank && arr.length >= 2) return takeN(arr, 2);
  }
  return null;
}

/** 优先从「恰好 1 张」的点数取单，避免拆对/拆三/拆炸。 */
function smallestSingleton(groups: Map<number, Card[]>): Card[] | null {
  for (const [r, arr] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (arr.length === 1) return takeN(arr, 1);
  }
  return null;
}

function pickStraight(groups: Map<number, Card[]>, minLen = 5): Card[] | null {
  const singles = [...groups.entries()]
    .filter(([, arr]) => arr.length >= 1)
    .map(([r]) => r)
    .filter((r) => r >= SEQ_RANK_MIN && r <= SEQ_RANK_MAX)
    .sort((a, b) => a - b);

  for (let len = Math.min(singles.length, 12); len >= minLen; len--) {
    for (let i = 0; i <= singles.length - len; i++) {
      const slice = singles.slice(i, i + len);
      let ok = true;
      for (let j = 1; j < slice.length; j++) {
        if (slice[j] !== slice[j - 1]! + 1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // 不拆炸弹凑顺
      if (slice.some((r) => (groups.get(r)?.length ?? 0) === 4)) continue;
      const cards: Card[] = [];
      for (const r of slice) cards.push(...takeN(groups.get(r)!, 1));
      if (identifyHand(cards)?.type === HandType.STRAIGHT) return cards;
    }
  }
  return null;
}

function pickPairStraight(groups: Map<number, Card[]>, minPairs = 3): Card[] | null {
  const pairs = [...groups.entries()]
    .filter(([, arr]) => arr.length >= 2 && arr.length < 4)
    .map(([r]) => r)
    .filter((r) => r >= SEQ_RANK_MIN && r <= SEQ_RANK_MAX)
    .sort((a, b) => a - b);

  for (let len = Math.min(pairs.length, 10); len >= minPairs; len--) {
    for (let i = 0; i <= pairs.length - len; i++) {
      const slice = pairs.slice(i, i + len);
      let ok = true;
      for (let j = 1; j < slice.length; j++) {
        if (slice[j] !== slice[j - 1]! + 1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const cards: Card[] = [];
      for (const r of slice) cards.push(...takeN(groups.get(r)!, 2));
      if (identifyHand(cards)?.type === HandType.PAIR_STRAIGHT) return cards;
    }
  }
  return null;
}

/** 自由出：优先一手走完，再组合，再单张；尽量不主动炸。 */
function chooseLead(hand: readonly Card[], difficulty: BotDifficulty): Card[] | null {
  if (hand.length === 0) return null;
  // 一手走完
  if (identifyHand(hand)) return [...hand];

  const groups = groupByRank(hand);

  // 普通/困难：优先连对 / 顺子 / 三带
  if (difficulty !== 'easy') {
    const ps = pickPairStraight(groups);
    if (ps) return ps;
    const st = pickStraight(groups);
    if (st) return st;

    for (const [r, arr] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      if (arr.length === 3) {
        const wing = smallestSingleOtherThan(groups, r);
        if (wing) {
          const play = [...takeN(arr, 3), ...wing];
          if (canPlay(null, play)) return play;
        }
        return takeN(arr, 3);
      }
    }

    for (const [r, arr] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      if (arr.length === 2) return takeN(arr, 2);
    }
  }

  const singleton = smallestSingleton(groups);
  if (singleton) return singleton;

  // 不得不拆：最小一张（仍避开炸弹主体，除非只剩炸）
  for (const [r, arr] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (arr.length < 4) return takeN(arr, 1);
  }
  // 只剩炸弹：打最小炸
  const bombs = bombRanks(groups);
  if (bombs.length > 0) return takeN(groups.get(bombs[0]!)!, 4);

  const sorted = [...hand].sort((a, b) => a.rank - b.rank);
  return sorted[0] ? [sorted[0]] : null;
}

function findSameTypeBeat(
  groups: Map<number, Card[]>,
  prev: Hand,
  avoidBombSplit: boolean,
): Card[] | null {
  const ranksAsc = [...groups.keys()].sort((a, b) => a - b);

  const usable = (r: number, need: number): boolean => {
    const n = groups.get(r)?.length ?? 0;
    if (n < need) return false;
    if (avoidBombSplit && n === 4 && need < 4) return false;
    return true;
  };

  const pickSingle = (): Card[] | null => {
    // 先恰好 1 张的更大单
    for (const r of ranksAsc) {
      if (r > prev.mainRank && (groups.get(r)?.length ?? 0) === 1) return takeN(groups.get(r)!, 1);
    }
    for (const r of ranksAsc) {
      if (r > prev.mainRank && usable(r, 1)) return takeN(groups.get(r)!, 1);
    }
    return null;
  };
  const pickPair = (): Card[] | null => {
    for (const r of ranksAsc) {
      if (r > prev.mainRank && (groups.get(r)?.length ?? 0) === 2) return takeN(groups.get(r)!, 2);
    }
    for (const r of ranksAsc) {
      if (r > prev.mainRank && usable(r, 2)) return takeN(groups.get(r)!, 2);
    }
    return null;
  };
  const pickTriple = (): Card[] | null => {
    for (const r of ranksAsc) {
      if (r > prev.mainRank && (groups.get(r)?.length ?? 0) === 3) return takeN(groups.get(r)!, 3);
    }
    for (const r of ranksAsc) {
      if (r > prev.mainRank && usable(r, 3)) return takeN(groups.get(r)!, 3);
    }
    return null;
  };

  switch (prev.type) {
    case HandType.SINGLE:
      return pickSingle();
    case HandType.PAIR:
      return pickPair();
    case HandType.TRIPLE:
      return pickTriple();
    case HandType.TRIPLE_SINGLE: {
      const tri = pickTriple();
      if (!tri) return null;
      const wing = smallestSingleOtherThan(groups, tri[0]!.rank);
      return wing ? [...tri, ...wing] : null;
    }
    case HandType.TRIPLE_PAIR: {
      const tri = pickTriple();
      if (!tri) return null;
      const wing = smallestPairOtherThan(groups, tri[0]!.rank);
      return wing ? [...tri, ...wing] : null;
    }
    case HandType.STRAIGHT: {
      const len = prev.length;
      const startMin = prev.mainRank + 1;
      const startMax = SEQ_RANK_MAX - len + 1;
      for (let start = startMin; start <= startMax; start++) {
        const ranks: number[] = [];
        let ok = true;
        for (let i = 0; i < len; i++) {
          const r = start + i;
          if (!usable(r, 1)) {
            ok = false;
            break;
          }
          ranks.push(r);
        }
        if (!ok) continue;
        const cards: Card[] = [];
        for (const r of ranks) cards.push(...takeN(groups.get(r)!, 1));
        if (canPlay(prev, cards)) return cards;
      }
      return null;
    }
    case HandType.PAIR_STRAIGHT: {
      const len = prev.length;
      const startMin = prev.mainRank + 1;
      const startMax = SEQ_RANK_MAX - len + 1;
      for (let start = startMin; start <= startMax; start++) {
        const ranks: number[] = [];
        let ok = true;
        for (let i = 0; i < len; i++) {
          const r = start + i;
          if (!usable(r, 2)) {
            ok = false;
            break;
          }
          ranks.push(r);
        }
        if (!ok) continue;
        const cards: Card[] = [];
        for (const r of ranks) cards.push(...takeN(groups.get(r)!, 2));
        if (canPlay(prev, cards)) return cards;
      }
      return null;
    }
    case HandType.BOMB: {
      for (const r of ranksAsc) {
        if (r > prev.mainRank && (groups.get(r)?.length ?? 0) === 4) return takeN(groups.get(r)!, 4);
      }
      return null;
    }
    default:
      return null;
  }
}

function pickBomb(groups: Map<number, Card[]>): Card[] | null {
  const bombs = bombRanks(groups);
  if (bombs.length === 0) return null;
  return takeN(groups.get(bombs[0]!)!, 4);
}

/**
 * 普通档出牌。
 * @returns Card[] 出牌；null = 不要
 */
export function botChoosePlayByDifficulty(
  hand: readonly Card[],
  prev: Hand | null,
  difficulty: BotDifficulty = 'normal',
): Card[] | null {
  if (!prev) {
    const lead = chooseLead(hand, difficulty);
    return lead && canPlay(null, lead) ? lead : null;
  }

  const groups = groupByRank(hand);
  const avoidSplit = difficulty !== 'easy';

  const same = findSameTypeBeat(groups, prev, avoidSplit);
  if (same && canPlay(prev, same)) return same;

  // 跟不上同型时：普通档仅在手牌很少或上家是炸弹时才炸（避免无谓炸单）
  const shouldBomb =
    difficulty === 'easy'
      ? false
      : difficulty === 'hard'
        ? hand.length <= 10 || prev.length >= 5 || prev.type === HandType.BOMB
        : hand.length <= 4 || prev.type === HandType.BOMB;

  if (shouldBomb && prev.type !== HandType.ROCKET) {
    const bomb = pickBomb(groups);
    if (bomb && canPlay(prev, bomb)) return bomb;
    if (hasRocket(hand)) {
      const rocket = makeRocket(hand);
      if (rocket && canPlay(prev, rocket)) return rocket;
    }
  }

  // 兜底：王炸可压非王炸（避免死局）——仅当手牌 ≤6
  if (difficulty !== 'easy' && hand.length <= 6 && prev.type !== HandType.ROCKET && hasRocket(hand)) {
    const rocket = makeRocket(hand);
    if (rocket && canPlay(prev, rocket)) return rocket;
  }

  return null;
}
