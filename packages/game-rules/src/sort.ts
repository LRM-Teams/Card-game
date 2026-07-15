import type { Card } from './types';

/** 返回按点数升序排列的新数组（不修改原数组）。 */
export function sortCards(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) =>
    a.rank !== b.rank ? a.rank - b.rank : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}
