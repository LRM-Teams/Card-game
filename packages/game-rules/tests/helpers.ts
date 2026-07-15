import { Card } from '../src/types';

/** token → rank 映射，便于测试时书写牌组。 */
const TOKEN_RANK: Record<string, number> = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14, '2': 15,
  小: 16, // 小王
  大: 17, // 大王
};

let counter = 0;

/** 按点数造一张牌（id 唯一，便于造对子/三张等重复点数）。 */
export function card(token: keyof typeof TOKEN_RANK | string): Card {
  const rank = TOKEN_RANK[token];
  if (rank === undefined) throw new Error(`unknown card token: ${token}`);
  return { id: `t${counter++}`, rank, display: String(token) };
}

/** 解析形如 "7 7 7 3" / "3 4 5 6 7" / "小 大" 的字符串为 Card[]。 */
export function cards(str: string): Card[] {
  return str.trim().split(/\s+/).map(card);
}

/** 取 Hand 的 mainRank，便于断言。 */
export function mainRankOf(h: { mainRank: number } | null): number {
  if (!h) throw new Error('expected a Hand but got null');
  return h.mainRank;
}
