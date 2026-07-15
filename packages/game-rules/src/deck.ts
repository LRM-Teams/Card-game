import { Card, RANK, SEQ_RANK_MAX, SEQ_RANK_MIN, Suit } from './types';

const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond'];

/** 普通牌点数（不含王）：3,4,...,10,J,Q,K,A,2 */
const NORMAL_RANKS = [
  RANK.THREE, RANK.FOUR, RANK.FIVE, RANK.SIX, RANK.SEVEN, RANK.EIGHT, RANK.NINE,
  RANK.TEN, RANK.J, RANK.Q, RANK.K, RANK.A, RANK.TWO,
];

/** 点数 → 展示文本。 */
export function rankDisplay(rank: number): string {
  switch (rank) {
    case RANK.SMALL_JOKER:
      return '小王';
    case RANK.BIG_JOKER:
      return '大王';
    case RANK.J:
      return 'J';
    case RANK.Q:
      return 'Q';
    case RANK.K:
      return 'K';
    case RANK.A:
      return 'A';
    case RANK.TWO:
      return '2';
    default:
      return String(rank);
  }
}

/** 构造一张普通牌。 */
function normalCard(rank: number, suit: Suit): Card {
  return { id: `${suit}${rank}`, rank, suit, display: rankDisplay(rank) };
}

/** 生成一副完整的 54 张牌（4 花色 × 13 点 + 大小王），未洗牌。 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of NORMAL_RANKS) {
    for (const s of SUITS) {
      deck.push(normalCard(r, s));
    }
  }
  deck.push({ id: 'JOKER_S', rank: RANK.SMALL_JOKER, display: rankDisplay(RANK.SMALL_JOKER) });
  deck.push({ id: 'JOKER_B', rank: RANK.BIG_JOKER, display: rankDisplay(RANK.BIG_JOKER) });
  return deck;
}

/** Fisher–Yates 洗牌，返回新数组。可注入随机源以便测试。 */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 发牌结果：3 名玩家各 17 张 + 3 张底牌。 */
export interface DealResult {
  /** 三家手牌，按座位顺序。 */
  hands: [Card[], Card[], Card[]];
  /** 3 张底牌。 */
  bottom: Card[];
}

/** 发牌：默认洗一副新牌，发出 17/17/17 + 3 底牌。可传入已洗好的牌以复现。 */
export function deal(deck: Card[] = shuffle(createDeck())): DealResult {
  if (deck.length !== 54) {
    throw new Error(`deal expects a 54-card deck, got ${deck.length}`);
  }
  const hands: [Card[], Card[], Card[]] = [[], [], []];
  for (let i = 0; i < 51; i++) {
    hands[i % 3]!.push(deck[i]!);
  }
  const bottom = deck.slice(51, 54);
  return { hands, bottom };
}

/** 判断点数能否参与连续序列（顺子/连对/飞机）：3..A。 */
export function isInSeqRange(rank: number): boolean {
  return rank >= SEQ_RANK_MIN && rank <= SEQ_RANK_MAX;
}
