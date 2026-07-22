/**
 * 房间内规则机器人（非 DouZero）策略 —— 普通档。
 *
 * 叫分用 0/1/2/3 启发式；出牌优先「能走完 / 少拆炸弹」的组合。
 * DouZero adapter 不可用时由服务端 fallback 到本模块，保证不卡局。
 */
import { identifyHand } from './identify';
import { listLegalPlays } from './legal';
import type { BidChoice } from './bidding';
import type { Card, Hand } from './types';
import { HandType, RANK } from './types';

/** 叫分档位：0=不叫，1/2/3=叫分强度（当前协议 claim/pass 时 ≥1 映射为 claim）。 */
export type BidScore = 0 | 1 | 2 | 3;

/** 机器人难度；本期实现 normal，easy/hard 预留接口。 */
export type BotDifficulty = 'easy' | 'normal' | 'hard';

function countByRank(cards: readonly Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

function hasRocket(hand: readonly Card[]): boolean {
  return (
    hand.some((c) => c.rank === RANK.SMALL_JOKER) && hand.some((c) => c.rank === RANK.BIG_JOKER)
  );
}

/**
 * 手牌强度 → 叫分 0..3。
 *
 * 启发式：王炸/炸弹权重大，2/王/A 计大牌密度。
 * 验收锚点：持有王炸倾向叫高分（≥2，常为 3）。
 */
export function decideBidScore(hand: readonly Card[]): BidScore {
  const counts = countByRank(hand);
  let power = 0;

  if (hasRocket(hand)) power += 12;

  for (const [rank, n] of counts) {
    if (n === 4) power += 6; // 炸弹（王炸已单独计，不会走到这里）
    if (rank === RANK.TWO) power += 2 * n;
    if (rank === RANK.A) power += 1 * n;
    // 单王（未成炸）仍算大牌；成炸时上面已 +12，这里不再重复加
    if (!hasRocket(hand)) {
      if (rank === RANK.SMALL_JOKER) power += 3;
      if (rank === RANK.BIG_JOKER) power += 4;
    }
  }

  if (power >= 12) return 3;
  if (power >= 8) return 2;
  if (power >= 5) return 1;
  return 0;
}

/** 将叫分映射到当前抢地主协议的 claim/pass。 */
export function bidScoreToChoice(score: BidScore): BidChoice {
  return score >= 1 ? 'claim' : 'pass';
}

/** 普通档叫地主决策（服务端直接调用）。 */
export function decideBid(hand: readonly Card[]): BidChoice {
  return bidScoreToChoice(decideBidScore(hand));
}

/**
 * 评估一次出牌的「拆解友好度」：数值越小越优先。
 * - 能一手走完：绝对优先
 * - 从炸弹/三张里抠牌：重罚（跟牌不拆无谓炸弹）
 * - 自由出优先张数更多的自然组合；炸弹/王炸非走完不轻出
 */
export function scorePlayCandidate(
  hand: readonly Card[],
  play: readonly Card[],
  prev: Hand | null,
): number {
  const identified = identifyHand(play);
  if (!identified) return Number.POSITIVE_INFINITY;

  const remaining = hand.length - play.length;
  if (remaining === 0) {
    // 能走完：同档内略偏好较小主点数（更「最小」）
    return -1_000_000 + identified.mainRank;
  }

  const handBy = countByRank(hand);
  const playBy = countByRank(play);
  let score = 0;

  for (const [rank, used] of playBy) {
    const have = handBy.get(rank) ?? 0;
    // 拆炸弹出非炸：无谓拆
    if (have >= 4 && used > 0 && used < 4) score += 100_000;
    // 拆三张
    if (have === 3 && used > 0 && used < 3) score += 20_000;
  }

  const isBombLike =
    identified.type === HandType.BOMB || identified.type === HandType.ROCKET;

  if (!prev) {
    // 自由出：非走完不轻出炸弹/王炸
    if (isBombLike) score += 80_000;
    // 优先更大组合（张数多 → 分低），再比主点数
    score += (30 - play.length) * 100;
    score += identified.mainRank;
  } else {
    // 跟牌：能同型压则炸弹延后；炸弹/王炸非走完加重罚（可压但「无谓」）
    if (isBombLike && prev.type !== HandType.BOMB && prev.type !== HandType.ROCKET) {
      score += 60_000;
    }
    score += identified.mainRank;
  }

  return score;
}

/**
 * 普通档出牌：从合法出牌中选分最低者；跟牌无合法则 pass（null）。
 * 自由出保证至少有一手（手牌非空时 listLegalPlays 必含单张等）。
 */
export function choosePlayNormal(hand: readonly Card[], prev: Hand | null): Card[] | null {
  if (hand.length === 0) return null;

  const legal = listLegalPlays(hand, prev);
  if (legal.length === 0) return null;

  let best = legal[0]!;
  let bestScore = scorePlayCandidate(hand, best, prev);
  for (let i = 1; i < legal.length; i++) {
    const cand = legal[i]!;
    const s = scorePlayCandidate(hand, cand, prev);
    if (s < bestScore) {
      best = cand;
      bestScore = s;
    }
  }
  return best;
}

/**
 * 按难度选出牌。本期 normal 为完整策略；easy 退化为最小单牌/最小同型；
 * hard 暂与 normal 相同（后续可加深）。
 */
export function choosePlay(
  hand: readonly Card[],
  prev: Hand | null,
  difficulty: BotDifficulty = 'normal',
): Card[] | null {
  if (difficulty === 'easy') return choosePlayEasy(hand, prev);
  return choosePlayNormal(hand, prev);
}

/** 简单档：领出最小单；跟牌找最小同型（可拆组），否则 pass。 */
function choosePlayEasy(hand: readonly Card[], prev: Hand | null): Card[] | null {
  if (!prev) {
    const sorted = [...hand].sort((a, b) => a.rank - b.rank);
    const c = sorted[0];
    return c ? [c] : null;
  }
  const legal = listLegalPlays(hand, prev);
  if (legal.length === 0) return null;
  // 优先同型非炸，再炸弹
  const scored = [...legal].sort(
    (a, b) => scorePlayCandidate(hand, a, prev) - scorePlayCandidate(hand, b, prev),
  );
  return scored[0] ?? null;
}

/** 明牌：叫分 ≥2 时亮牌。 */
export function decideReveal(hand: readonly Card[]): boolean {
  return decideBidScore(hand) >= 2;
}

/** 加倍：叫分够强则加倍；地主略激进。 */
export function decideDouble(hand: readonly Card[], isLandlord: boolean): boolean {
  const score = decideBidScore(hand);
  if (isLandlord) return score >= 2;
  return score >= 2 && hand.length <= 20;
}
