/**
 * 补位机器人 + 最小合法 AI（占位实现）。
 *
 * 边界说明：可配置难度的"机器人决策"是 @大伟 的职责（规则&AI）。
 * 服务端这里只需要一个"能做出合法动作、让 3 人局跑完"的最小 stub；
 * 大伟的 AI 接口就绪后，替换 botBid / botChoosePlay 即可，对局状态机不动。
 */
import { canPlay, HandType, RANK } from '@card-game/rules';
import type { BidChoice, Card, DoubleChoice, Hand } from '@card-game/rules';

/** 生成机器人显示名。 */
export function botName(n: number): string {
  return `机器人${n}`;
}

/** 按点数把手牌分组（保留实际 Card，便于取出）。 */
function groupByRank(hand: readonly Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of hand) {
    const arr = m.get(c.rank);
    if (arr) arr.push(c);
    else m.set(c.rank, [c]);
  }
  return m;
}

/** 是否持有王炸（小王 + 大王）。 */
function hasRocket(hand: readonly Card[]): boolean {
  return hand.some((c) => c.rank === RANK.SMALL_JOKER) && hand.some((c) => c.rank === RANK.BIG_JOKER);
}

/**
 * 机器人是否叫地主（启发式占位）：大牌 / 炸弹 / 王炸够多就 claim，否则 pass。
 * 叫法语义统一走 game-rules 的 BidChoice；具体倍数 / 叫分 MVP 不做。
 */
export function botBid(hand: readonly Card[]): BidChoice {
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);

  let power = 0;
  if (hasRocket(hand)) power += 6;
  for (const [rank, n] of counts) {
    if (n === 4) power += 6; // 炸弹
    if (rank === RANK.TWO) power += 2 * n; // 2
    if (rank === RANK.SMALL_JOKER) power += 3;
    if (rank === RANK.BIG_JOKER) power += 4;
  }

  return power >= 5 ? 'claim' : 'pass';
}

/**
 * 机器人加倍决策（启发式占位）：手牌够强就加倍，非常强（王炸/多炸）超级加倍，否则不加倍。
 * 具体强度模型是 @大伟 的 AI 职责；这里只保证能做出合法选择、让加倍环节跑完。
 */
export function botDouble(hand: readonly Card[]): DoubleChoice {
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  let bombs = 0;
  for (const [, n] of counts) if (n === 4) bombs += 1;
  const rocket = hasRocket(hand);
  if (rocket && bombs >= 1) return 'super';
  if (rocket || bombs >= 1) return 'double';
  return 'pass';
}

/** 取一组同点数牌里 id 最小的 n 张。 */
function takeN(group: Card[], n: number): Card[] {
  return [...group].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, n);
}

/** 最小的一张单牌（领出用）。 */
function smallestSingle(hand: readonly Card[]): Card[] {
  const sorted = [...hand].sort((a, b) => a.rank - b.rank);
  const c = sorted[0];
  return c ? [c] : [];
}

/**
 * 在"上家牌型"约束下，尝试找一个能压过的最小合法出牌。
 * @returns 出牌的 Card[]；找不到（或策略上选择不压）则返回 null（= pass）。
 */
export function botChoosePlay(hand: readonly Card[], prev: Hand | null): Card[] | null {
  // 领出：打一张最小单牌，保证局面向前推进。
  if (!prev) {
    const lead = smallestSingle(hand);
    return lead.length === 1 ? lead : null;
  }

  const groups = groupByRank(hand);
  const sameTypeBeat = findSameTypeBeat(groups, prev);
  if (sameTypeBeat) return sameTypeBeat;

  // 同型压不过时，若有王炸则兜底（保证能终结本轮、避免死局）。
  if (prev.type !== HandType.ROCKET && hasRocket(hand)) {
    const rocket = makeRocket(hand);
    if (rocket && canPlay(prev, rocket)) return rocket;
  }
  return null; // pass
}

/** 构造王炸（小王 + 大王）。 */
function makeRocket(hand: readonly Card[]): Card[] | null {
  const s = hand.find((c) => c.rank === RANK.SMALL_JOKER);
  const b = hand.find((c) => c.rank === RANK.BIG_JOKER);
  if (s && b) return [s, b];
  return null;
}

/** 找手牌里最小、且不等于 excludeRank 的一对。 */
function smallestPairOtherThan(groups: Map<number, Card[]>, excludeRank: number): Card[] | null {
  for (const [r, arr] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (r !== excludeRank && arr.length >= 2) return takeN(arr, 2);
  }
  return null;
}

/**
 * 针对 prev 牌型，找"同型同长、关键点数更大"的最小出牌。
 * 复杂牌型（顺子/连对/飞机/四带二）占位实现里不主动凑，返回 null（交由王炸/pass 兜底）。
 */
function findSameTypeBeat(groups: Map<number, Card[]>, prev: Hand): Card[] | null {
  const ranksAsc = [...groups.keys()].sort((a, b) => a - b);

  const pickSingle = (): Card[] | null => {
    for (const r of ranksAsc) if (r > prev.mainRank) return takeN(groups.get(r)!, 1);
    return null;
  };
  const pickPair = (): Card[] | null => {
    for (const r of ranksAsc) if (r > prev.mainRank && (groups.get(r)?.length ?? 0) >= 2) return takeN(groups.get(r)!, 2);
    return null;
  };
  const pickTriple = (): Card[] | null => {
    for (const r of ranksAsc) if (r > prev.mainRank && (groups.get(r)?.length ?? 0) >= 3) return takeN(groups.get(r)!, 3);
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
    case HandType.BOMB: {
      for (const r of ranksAsc) if (r > prev.mainRank && (groups.get(r)?.length ?? 0) === 4) return takeN(groups.get(r)!, 4);
      return null;
    }
    default:
      // 顺子/连对/飞机/四带二：占位不凑。
      return null;
  }
}

/** groups → 扁平手牌。 */
function flatHand(groups: Map<number, Card[]>): Card[] {
  return [...groups.values()].flat();
}

/** 手牌里最小的一张单牌，但排除给定牌集。 */
function smallestSingleOtherThan(groups: Map<number, Card[]>, excludeRank: number): Card[] | null {
  const sorted = [...flatHand(groups)].filter((c) => c.rank !== excludeRank).sort((a, b) => a.rank - b.rank);
  const c = sorted[0];
  return c ? [c] : null;
}
