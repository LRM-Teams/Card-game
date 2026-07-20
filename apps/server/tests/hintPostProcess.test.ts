import { describe, expect, it } from 'vitest';
import { HandType, RANK, identifyHand } from '@card-game/rules';
import type { Card, Seat } from '@card-game/rules';
import type { BotPlayContext } from '../src/game/douzeroAdapter';
import {
  endgameGiftPenalty,
  postProcessHintSuggestions,
  splitStructurePenalty,
} from '../src/game/hintPostProcess';

function c(rank: number, id: string): Card {
  return { id, rank, display: String(rank), suit: 'spade' };
}

function ctx(partial: Partial<BotPlayContext> & Pick<BotPlayContext, 'hand' | 'prev'>): BotPlayContext {
  return {
    seat: 1 as Seat,
    landlordSeat: 0 as Seat,
    bottom: [],
    handCounts: { 0: 1, 1: 10, 2: 10 },
    history: [],
    ...partial,
  };
}

describe('hintPostProcess', () => {
  it('对 3 压牌时优先 44/88，不拆 JJJ', () => {
    const hand = [
      c(RANK.J, 'j1'),
      c(RANK.J, 'j2'),
      c(RANK.J, 'j3'),
      c(RANK.FOUR, '4a'),
      c(RANK.FOUR, '4b'),
      c(RANK.EIGHT, '8a'),
      c(RANK.EIGHT, '8b'),
    ];
    const prev = identifyHand([c(RANK.THREE, '3a'), c(RANK.THREE, '3b')])!;
    const suggestions = [
      [c(RANK.J, 'j1'), c(RANK.J, 'j2')],
      [c(RANK.FOUR, '4a'), c(RANK.FOUR, '4b')],
      [c(RANK.EIGHT, '8a'), c(RANK.EIGHT, '8b')],
    ];
    expect(splitStructurePenalty(hand, suggestions[0]!)).toBeGreaterThan(0);
    expect(splitStructurePenalty(hand, suggestions[1]!)).toBe(0);

    const ordered = postProcessHintSuggestions(
      ctx({ hand, prev, handCounts: { 0: 15, 1: 7, 2: 10 } }),
      suggestions,
    );
    expect(ordered[0]!.map((x) => x.rank)).toEqual([RANK.FOUR, RANK.FOUR]);
    expect(identifyHand(ordered[0]!)!.type).toBe(HandType.PAIR);
  });

  it('地主剩 1 张时农民领出不优先最小单张', () => {
    const hand = [c(RANK.THREE, '3'), c(RANK.K, 'k'), c(RANK.A, 'a')];
    const playSmall = [c(RANK.THREE, '3')];
    const playBig = [c(RANK.K, 'k')];
    const base = ctx({
      hand,
      prev: null,
      seat: 1 as Seat,
      landlordSeat: 0 as Seat,
      handCounts: { 0: 1, 1: 3, 2: 10 },
    });
    expect(endgameGiftPenalty(base, playSmall)).toBeGreaterThan(0);
    expect(endgameGiftPenalty(base, playBig)).toBe(0);

    const ordered = postProcessHintSuggestions(base, [playSmall, playBig]);
    expect(ordered[0]!.map((x) => x.rank)).toEqual([RANK.K]);
  });

  it('地主剩 2 张时农民压对子不优先最小对', () => {
    const hand = [
      c(RANK.FOUR, '4a'),
      c(RANK.FOUR, '4b'),
      c(RANK.NINE, '9a'),
      c(RANK.NINE, '9b'),
      c(RANK.K, 'k'),
    ];
    const prev = identifyHand([c(RANK.THREE, '3a'), c(RANK.THREE, '3b')])!;
    const smallPair = [c(RANK.FOUR, '4a'), c(RANK.FOUR, '4b')];
    const bigPair = [c(RANK.NINE, '9a'), c(RANK.NINE, '9b')];
    const base = ctx({
      hand,
      prev,
      handCounts: { 0: 2, 1: 5, 2: 10 },
    });
    expect(endgameGiftPenalty(base, smallPair)).toBeGreaterThan(0);
    expect(endgameGiftPenalty(base, bigPair)).toBe(0);

    const ordered = postProcessHintSuggestions(base, [smallPair, bigPair]);
    expect(ordered[0]!.map((x) => x.rank)).toEqual([RANK.NINE, RANK.NINE]);
  });

  it('模型只给拆三张一手时插入 bot 最小同型压牌', () => {
    const hand = [
      c(RANK.J, 'j1'),
      c(RANK.J, 'j2'),
      c(RANK.J, 'j3'),
      c(RANK.FIVE, '5a'),
      c(RANK.FIVE, '5b'),
    ];
    const prev = identifyHand([c(RANK.THREE, '3a'), c(RANK.THREE, '3b')])!;
    const splitOnly = [[c(RANK.J, 'j1'), c(RANK.J, 'j2')]];
    const ordered = postProcessHintSuggestions(ctx({ hand, prev }), splitOnly);
    expect(ordered[0]!.map((x) => x.rank)).toEqual([RANK.FIVE, RANK.FIVE]);
  });
});
