import { describe, expect, it } from 'vitest';
import { createDeck, deal, shuffle } from '../src/deck';
import { RANK } from '../src/types';

describe('deck / deal', () => {
  it('一副牌 54 张、id 唯一', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(54);
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(54);
    // 含大小王
    expect(deck.some((c) => c.rank === RANK.SMALL_JOKER)).toBe(true);
    expect(deck.some((c) => c.rank === RANK.BIG_JOKER)).toBe(true);
  });

  it('发牌：17/17/17 + 3 底牌，无重复', () => {
    const { hands, bottom } = deal();
    expect(hands[0]).toHaveLength(17);
    expect(hands[1]).toHaveLength(17);
    expect(hands[2]).toHaveLength(17);
    expect(bottom).toHaveLength(3);
    const all = [...hands[0], ...hands[1], ...hands[2], ...bottom];
    expect(new Set(all.map((c) => c.id)).size).toBe(54);
  });

  it('shuffle 不丢牌、可注入随机源', () => {
    const deck = createDeck();
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const a = shuffle(deck, rng);
    expect(a).toHaveLength(54);
    expect(new Set(a.map((c) => c.id)).size).toBe(54);
  });
});
