import { describe, it, expect } from 'vitest';
import { resolveBidding, type BidEntry } from '../src/bidding';

const claim = (seat: 0 | 1 | 2): BidEntry => ({ seat, choice: 'claim' });
const pass = (seat: 0 | 1 | 2): BidEntry => ({ seat, choice: 'pass' });

describe('resolveBidding（抢地主 A 方案）', () => {
  it('全部不叫 → 流局重发', () => {
    const r = resolveBidding([pass(0), pass(1), pass(2)]);
    expect(r.redeal).toBe(true);
    expect(r.landlord).toBeNull();
    expect(r.callSeat).toBeNull();
  });

  it('一人叫、无人抢 → 该座位为地主', () => {
    const r = resolveBidding([pass(0), claim(1), pass(2)]);
    expect(r.redeal).toBe(false);
    expect(r.landlord).toBe(1);
    expect(r.callSeat).toBe(1);
  });

  it('首叫 + 后续抢 → 最后抢者为地主，首叫者记录在 callSeat', () => {
    const r = resolveBidding([claim(0), claim(1), pass(2)]);
    expect(r.landlord).toBe(1); // 最后 claim
    expect(r.callSeat).toBe(0); // 首叫
  });

  it('首叫 + 两家都抢 → 最后一家为地主', () => {
    const r = resolveBidding([claim(0), claim(1), claim(2)]);
    expect(r.landlord).toBe(2);
    expect(r.callSeat).toBe(0);
  });
});
