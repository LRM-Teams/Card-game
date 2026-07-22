import { describe, it, expect } from 'vitest';
import {
  botBidByDifficulty,
  botChoosePlayByDifficulty,
  estimateBidStrength,
} from '../src/botStrategy';
import { identifyHand } from '../src/identify';
import { HandType } from '../src/types';
import { cards } from './helpers';

describe('estimateBidStrength / botBidByDifficulty', () => {
  it('有王炸倾向叫高强度（≥2）并 claim', () => {
    const hand = cards('3 4 5 6 7 8 9 10 J Q K A 2 小 大 3 4');
    expect(estimateBidStrength(hand)).toBeGreaterThanOrEqual(2);
    expect(botBidByDifficulty(hand, 'normal')).toBe('claim');
  });

  it('弱牌不叫', () => {
    const hand = cards('3 4 5 6 7 8 9 10 J Q K 3 4 5 6 7 8');
    expect(estimateBidStrength(hand)).toBe(0);
    expect(botBidByDifficulty(hand, 'normal')).toBe('pass');
  });

  it('单炸弹倾向中高强度', () => {
    const hand = cards('7 7 7 7 3 4 5 6 8 9 10 J Q K A 2 3');
    expect(estimateBidStrength(hand)).toBeGreaterThanOrEqual(2);
    expect(botBidByDifficulty(hand, 'normal')).toBe('claim');
  });
});

describe('botChoosePlayByDifficulty（普通档）', () => {
  it('自由出：一手能走完则全出', () => {
    const hand = cards('3 4 5 6 7');
    const play = botChoosePlayByDifficulty(hand, null, 'normal');
    expect(play).not.toBeNull();
    expect(identifyHand(play!)?.type).toBe(HandType.STRAIGHT);
    expect(play!).toHaveLength(5);
  });

  it('自由出：优先出对子而非拆炸', () => {
    const hand = cards('5 5 9 9 9 9 3');
    const play = botChoosePlayByDifficulty(hand, null, 'normal');
    expect(play).not.toBeNull();
    const h = identifyHand(play!);
    expect(h?.type).not.toBe(HandType.BOMB);
    expect([HandType.PAIR, HandType.SINGLE, HandType.TRIPLE]).toContain(h!.type);
  });

  it('跟牌：同型压过且不无谓拆炸', () => {
    const hand = cards('8 8 8 8 5 5 3');
    const prev = identifyHand(cards('4 4'))!;
    const play = botChoosePlayByDifficulty(hand, prev, 'normal');
    expect(play).not.toBeNull();
    expect(identifyHand(play!)?.type).toBe(HandType.PAIR);
    // 跟对子应出 5 5，而不是拆 8 炸
    expect(play!.map((c) => c.rank).sort((a, b) => a - b)).toEqual([5, 5]);
  });

  it('跟不上则 pass（不强行拆炸打单）', () => {
    const hand = cards('8 8 8 8 3 3');
    const prev = identifyHand(cards('K'))!;
    const play = botChoosePlayByDifficulty(hand, prev, 'normal');
    // 手牌不算很少，普通档不无谓炸 K
    expect(play).toBeNull();
  });
});
