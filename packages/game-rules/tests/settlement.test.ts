import { describe, it, expect } from 'vitest';
import { settle } from '../src/settlement';

describe('settle（胜负结算）', () => {
  it('地主先出完 → 地主胜：地主 +2u，农民各 -u', () => {
    const r = settle({ landlord: 0, winnerSeat: 0, unit: 2 });
    expect(r.winnerSide).toBe('landlord');
    expect(r.scores).toEqual([4, -2, -2]);
  });

  it('农民先出完 → 农民胜：地主 -2u，农民各 +u', () => {
    const r = settle({ landlord: 0, winnerSeat: 1, unit: 3 });
    expect(r.winnerSide).toBe('farmer');
    expect(r.scores).toEqual([-6, 3, 3]);
  });

  it('地主在座位 2、农民胜', () => {
    const r = settle({ landlord: 2, winnerSeat: 0, unit: 1 });
    expect(r.winnerSide).toBe('farmer');
    expect(r.scores).toEqual([1, 1, -2]);
  });

  it('零和：三家得分之和为 0', () => {
    const r = settle({ landlord: 1, winnerSeat: 1, unit: 5 });
    expect(r.scores.reduce((a, b) => a + b, 0)).toBe(0);
  });
});
