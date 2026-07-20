import { describe, expect, it } from 'vitest';
import { RANK, type Card } from '@card-game/rules';
import { refinePlaySuggestions, scoreHintSuggestion } from '../src/game/hintPostProcess';

const card = (rank: number, id?: string): Card => ({
  id: id ?? `c-${rank}`,
  rank,
  suit: 'spade',
  display: String(rank),
});

describe('hintPostProcess (LRM-160)', () => {
  it('压牌时优先更小点数，且不拆三张', () => {
    const hand = [
      card(RANK.JACK, 'j1'),
      card(RANK.JACK, 'j2'),
      card(RANK.JACK, 'j3'),
      card(RANK.FIVE, '5a'),
      card(RANK.FIVE, '5b'),
    ];
    const breakTriplePair = [card(RANK.JACK, 'j1'), card(RANK.JACK, 'j2')];
    const smallPair = [card(RANK.FIVE, '5a'), card(RANK.FIVE, '5b')];
    expect(scoreHintSuggestion(hand, smallPair)).toBeLessThan(scoreHintSuggestion(hand, breakTriplePair));

    const ordered = refinePlaySuggestions(hand, [breakTriplePair, smallPair]);
    expect(ordered[0]?.map((c) => c.id)).toEqual(['5a', '5b']);
  });

  it('不拆炸弹：单张/对子从四张里抠牌重罚', () => {
    const hand = [
      card(RANK.KING, 'k1'),
      card(RANK.KING, 'k2'),
      card(RANK.KING, 'k3'),
      card(RANK.KING, 'k4'),
      card(RANK.SIX, '6a'),
    ];
    const breakBombSingle = [card(RANK.KING, 'k1')];
    const smallSingle = [card(RANK.SIX, '6a')];
    expect(scoreHintSuggestion(hand, breakBombSingle)).toBeGreaterThan(
      scoreHintSuggestion(hand, smallSingle),
    );
  });
});
