import { HandType, RANK, type Card, type Suit } from '@card-game/rules';

/** 花色 → 符号（仅展示用）。 */
export const SUIT_SYMBOL: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  club: '♣',
  diamond: '♦',
};

/** 牌面颜色（红/黑），用于展示。 */
export function cardColor(card: Card): 'red' | 'black' {
  if (card.rank === RANK.BIG_JOKER) return 'red';
  if (card.rank === RANK.SMALL_JOKER) return 'black';
  return card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black';
}

/** 牌型中文名（展示用）。 */
export const HAND_TYPE_LABEL: Record<HandType, string> = {
  [HandType.SINGLE]: '单张',
  [HandType.PAIR]: '对子',
  [HandType.TRIPLE]: '三张',
  [HandType.TRIPLE_SINGLE]: '三带一',
  [HandType.TRIPLE_PAIR]: '三带二',
  [HandType.STRAIGHT]: '顺子',
  [HandType.PAIR_STRAIGHT]: '连对',
  [HandType.PLANE]: '飞机',
  [HandType.PLANE_SINGLE]: '飞机带单',
  [HandType.PLANE_PAIR]: '飞机带对',
  [HandType.FOUR_TWO_SINGLE]: '四带二',
  [HandType.FOUR_TWO_PAIR]: '四带两对',
  [HandType.BOMB]: '炸弹',
  [HandType.ROCKET]: '王炸',
};
