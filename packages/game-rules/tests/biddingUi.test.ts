import { describe, expect, it } from 'vitest';
import { bidChoiceLabel, bidStatusForSeat, biddingHasClaim } from '../../../apps/client/src/lib/biddingUi';

describe('biddingUi (LRM-155)', () => {
  it('首叫前叫地主/不叫，已有 claim 后抢地主/不抢', () => {
    expect(bidChoiceLabel('claim', false)).toBe('叫地主');
    expect(bidChoiceLabel('pass', false)).toBe('不叫');
    expect(bidChoiceLabel('claim', true)).toBe('抢地主');
    expect(bidChoiceLabel('pass', true)).toBe('不抢');
  });

  it('0 叫→1 抢→2 不抢：各座展示与最后 claim 座位一致', () => {
    const history = [
      { seat: 0 as const, choice: 'claim' as const },
      { seat: 1 as const, choice: 'claim' as const },
      { seat: 2 as const, choice: 'pass' as const },
    ];
    expect(biddingHasClaim(history)).toBe(true);
    expect(bidStatusForSeat(history, 0)).toBe('叫地主');
    expect(bidStatusForSeat(history, 1)).toBe('抢地主');
    expect(bidStatusForSeat(history, 2)).toBe('不抢');
  });
});
