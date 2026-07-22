import { describe, expect, it } from 'vitest';
import {
  canPlay,
  choosePlayNormal,
  decideBid,
  decideBidScore,
  identifyHand,
  listLegalPlays,
  RANK,
} from '../src/index';
import { card, cards } from './helpers';

describe('decideBidScore（普通档叫分启发式）', () => {
  it('有王炸倾向叫高分（≥2，通常为 3）', () => {
    const hand = cards('小 大 3 4 5 6 7 8 9 10 J Q K');
    const score = decideBidScore(hand);
    expect(score).toBeGreaterThanOrEqual(2);
    expect(decideBid(hand)).toBe('claim');
  });

  it('王炸 + 炸弹 → 叫 3 分', () => {
    const hand = cards('小 大 7 7 7 7 3 4 5 6 8 9 10');
    expect(decideBidScore(hand)).toBe(3);
  });

  it('弱牌 → 不叫（0）', () => {
    const hand = cards('3 4 5 6 7 8 9 10 J Q K A 3');
    expect(decideBidScore(hand)).toBe(0);
    expect(decideBid(hand)).toBe('pass');
  });

  it('单炸弹 + 若干 2 可叫中高分', () => {
    const hand = cards('8 8 8 8 2 2 3 4 5 6 7 9 10');
    const score = decideBidScore(hand);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(3);
  });
});

describe('choosePlayNormal（普通档出牌）', () => {
  it('自由出：能一手走完时直接走完', () => {
    const hand = cards('5 5');
    const play = choosePlayNormal(hand, null);
    expect(play).not.toBeNull();
    expect(play!).toHaveLength(2);
    expect(canPlay(null, play!)).toBe(true);
    expect(identifyHand(play!)?.type).toBe('pair');
  });

  it('自由出：优先能走完的最小组合（整手一对优于拆成单张）', () => {
    const hand = cards('3 3');
    const play = choosePlayNormal(hand, null)!;
    expect(play).toHaveLength(2);
  });

  it('自由出：有炸弹时不轻出炸弹，先出小组合', () => {
    const hand = cards('3 4 5 5 5 5');
    const play = choosePlayNormal(hand, null)!;
    expect(canPlay(null, play)).toBe(true);
    const id = identifyHand(play)!;
    expect(id.type).not.toBe('bomb');
  });

  it('跟牌：有散单时不拆无谓炸弹', () => {
    // 上家单张 6；手牌有 7 与炸弹 9，应出 7 而非拆 9
    const hand = cards('7 9 9 9 9');
    const prev = identifyHand(cards('6'))!;
    const play = choosePlayNormal(hand, prev)!;
    expect(play).toHaveLength(1);
    expect(play[0]!.rank).toBe(RANK.SEVEN);
    expect(canPlay(prev, play)).toBe(true);
  });

  it('跟牌：压不过则 pass', () => {
    const hand = cards('3 4 5');
    const prev = identifyHand(cards('2'))!;
    expect(choosePlayNormal(hand, prev)).toBeNull();
  });

  it('跟牌：仅炸弹可压时允许出炸弹', () => {
    const hand = cards('8 8 8 8');
    const prev = identifyHand(cards('K'))!;
    const play = choosePlayNormal(hand, prev)!;
    expect(identifyHand(play)?.type).toBe('bomb');
    expect(canPlay(prev, play)).toBe(true);
  });
});

describe('listLegalPlays', () => {
  it('自由出包含单张/对子/三张等', () => {
    const hand = cards('3 3 3 4 5');
    const legal = listLegalPlays(hand, null);
    expect(legal.some((p) => p.length === 1)).toBe(true);
    expect(legal.some((p) => p.length === 2)).toBe(true);
    expect(legal.some((p) => p.length === 3)).toBe(true);
  });

  it('跟牌只返回能压过的组合', () => {
    const hand = [card('3'), card('7'), card('8')];
    const prev = identifyHand([card('5')])!;
    const legal = listLegalPlays(hand, prev);
    expect(legal.every((p) => canPlay(prev, p))).toBe(true);
    expect(legal.every((p) => p.length === 1 && p[0]!.rank > RANK.FIVE)).toBe(true);
  });
});
