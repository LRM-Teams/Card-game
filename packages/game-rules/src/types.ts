/**
 * 斗地主规则引擎 — 核心类型定义
 *
 * 这是服务端（校验）与客户端（提示）共用的"单一事实来源"。
 * 修改本文件的牌型/判定语义前，先在 #斗地主开发 与 @阿策 对齐。
 */

/** 花色（仅展示用，不参与大小比较）。大小王无花色。 */
export type Suit = 'spade' | 'heart' | 'club' | 'diamond';

/** 牌面点数（同时也是大小比较的权重）。3..15 为普通牌，16/17 为王。 */
export const RANK = {
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  TWO: 15,
  SMALL_JOKER: 16, // 小王
  BIG_JOKER: 17, // 大王
} as const;

/** 顺序（由小到大）：3 < 4 < ... < A < 2 < 小王 < 大王 */
export const RANK_ORDER_MIN = RANK.THREE;
export const RANK_ORDER_MAX = RANK.BIG_JOKER;

/** 可参与顺子/连对/飞机的连续序列的最大点数（A=14）；2 与王不能进连续序列。 */
export const SEQ_RANK_MAX = RANK.A;
/** 连续序列最小点数（3）。 */
export const SEQ_RANK_MIN = RANK.THREE;

/** 一张牌。rank 是比较依据；id 在整副牌内唯一。 */
export interface Card {
  /** 全局唯一 id（如 "spade3"、"JOKER_S"）。 */
  id: string;
  /** 点数权重，3..17。 */
  rank: number;
  /** 花色；王为 undefined。 */
  suit?: Suit;
  /** 展示文本，如 "3"、"A"、"2"、"小王"、"大王"。 */
  display: string;
}

/** 全部牌型（细分到带牌结构，便于精确比较）。 */
export enum HandType {
  SINGLE = 'single', // 单张
  PAIR = 'pair', // 对子
  TRIPLE = 'triple', // 三张
  TRIPLE_SINGLE = 'triple_single', // 三带一
  TRIPLE_PAIR = 'triple_pair', // 三带二（一对）
  STRAIGHT = 'straight', // 顺子（≥5 张连续单牌）
  PAIR_STRAIGHT = 'pair_straight', // 连对（≥3 对连续）
  PLANE = 'plane', // 飞机（≥2 个连续三张，不带）
  PLANE_SINGLE = 'plane_single', // 飞机带单（每个三张带 1 单牌）
  PLANE_PAIR = 'plane_pair', // 飞机带对（每个三张带 1 对）
  FOUR_TWO_SINGLE = 'four_two_single', // 四带二（两张单牌）
  FOUR_TWO_PAIR = 'four_two_pair', // 四带两对
  BOMB = 'bomb', // 炸弹（四张同点）
  ROCKET = 'rocket', // 王炸 / 火箭（大王 + 小王）
}

/** 识别后的一个合法牌型。 */
export interface Hand {
  type: HandType;
  /** 参与构成该牌型的牌（按点数升序）。 */
  cards: Card[];
  /** 用于比较的关键点数（顺子/连对/飞机取最低点数；带牌取主体点数）。 */
  mainRank: number;
  /** 多单元牌型的单元数（顺子张数 / 连对对数 / 飞机三张数）；单单元牌型为 1。 */
  length: number;
}

/** 一次出牌即一个合法牌型；`Play` 是 `Hand` 的别名，语义更贴近"出牌"场景。 */
export type Play = Hand;

/** 玩家位置（地主 / 农民1 / 农民2）。 */
export type Seat = 0 | 1 | 2;
