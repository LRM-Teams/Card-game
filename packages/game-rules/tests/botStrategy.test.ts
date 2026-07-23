import { describe, it, expect } from 'vitest';
import {
  botBidByDifficulty,
  botChoosePlayByDifficulty,
  decidePlayByDifficulty,
  estimateBidStrength,
  evaluateHandPower,
} from '../src/botStrategy';
import { deal } from '../src/deck';
import { canPlay, identifyHand } from '../src/identify';
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

  it('单炸弹倾向中高强度并 claim', () => {
    const hand = cards('7 7 7 7 3 4 5 6 8 9 10 J Q K A 2 3');
    expect(estimateBidStrength(hand)).toBeGreaterThanOrEqual(2);
    expect(botBidByDifficulty(hand, 'normal')).toBe('claim');
  });

  it('强度分布不全 0/不全 3，与手力弱相关（LRM-523）', () => {
    const hist = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const samples: { power: number; strength: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const { hands } = deal();
      const hand = hands[i % 3]!;
      const strength = estimateBidStrength(hand);
      const power = evaluateHandPower(hand);
      hist[strength as 0 | 1 | 2 | 3]++;
      samples.push({ power, strength });
    }
    expect(hist[0]).toBeGreaterThan(0);
    expect(hist[2] + hist[3]).toBeGreaterThan(0);
    const nonzero = Object.values(hist).filter((n) => n > 0).length;
    expect(nonzero).toBeGreaterThanOrEqual(2);

    samples.sort((a, b) => a.power - b.power);
    const low = samples.slice(0, 20);
    const high = samples.slice(-20);
    const avg = (xs: { strength: number }[]) => xs.reduce((a, x) => a + x.strength, 0) / xs.length;
    expect(avg(high)).toBeGreaterThanOrEqual(avg(low));
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
    expect(play!.map((c) => c.rank).sort((a, b) => a - b)).toEqual([5, 5]);
  });

  it('跟不上则 pass（不强行拆炸打单）', () => {
    const hand = cards('8 8 8 8 3 3');
    const prev = identifyHand(cards('K'))!;
    const play = botChoosePlayByDifficulty(hand, prev, 'normal');
    expect(play).toBeNull();
  });

  it('decidePlay 给出可解释 kind（跟/过）且出牌合法', () => {
    const beat = decidePlayByDifficulty(cards('8 8 8 8 5 5 3'), identifyHand(cards('4 4'))!, 'normal');
    expect(beat.kind).toBe('beat');
    expect(beat.reason).toMatch(/beat/);
    expect(beat.cards).not.toBeNull();
    expect(canPlay(identifyHand(cards('4 4'))!, beat.cards!)).toBe(true);

    const pass = decidePlayByDifficulty(cards('8 8 8 8 3 3'), identifyHand(cards('K'))!, 'normal');
    expect(pass.kind).toBe('pass');
    expect(pass.cards).toBeNull();
  });

  it('中等手力（strength=1）普通档偏 pass（不全叫）', () => {
    // 无炸/无王，大牌密度中等 → strength 多为 1
    const hand = cards('3 4 5 6 7 8 9 10 J Q K A K Q J 10 9');
    const s = estimateBidStrength(hand);
    expect(s).toBeLessThanOrEqual(1);
    if (s === 1) expect(botBidByDifficulty(hand, 'normal')).toBe('pass');
  });
});
