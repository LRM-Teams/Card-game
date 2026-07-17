import { describe, it, expect } from 'vitest';
import { resolveBidding, isBiddingComplete, type BidEntry } from '../src/bidding';

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

describe('resolveBidding — 叫抢倍数（叫=1，每抢/反抢 ×2）', () => {
  it('无人叫：grabClaims=0、倍数 1、流局', () => {
    const r = resolveBidding([pass(0), pass(1), pass(2)]);
    expect(r.grabClaims).toBe(0);
    expect(r.biddingMultiplier).toBe(1);
    expect(r.redeal).toBe(true);
  });

  it('只叫不抢：grabClaims=0、倍数 1', () => {
    const r = resolveBidding([claim(0), pass(1), pass(2)]);
    expect(r.grabClaims).toBe(0);
    expect(r.biddingMultiplier).toBe(1);
    expect(r.landlord).toBe(0);
  });

  it('叫 + 一抢：grabClaims=1、倍数 2', () => {
    const r = resolveBidding([claim(0), claim(1), pass(2)]);
    expect(r.grabClaims).toBe(1);
    expect(r.biddingMultiplier).toBe(2);
    expect(r.landlord).toBe(1);
  });

  it('多轮反抢：叫0→抢1→抢2→反抢0，grabClaims=3、倍数 8、地主=0', () => {
    const r = resolveBidding([claim(0), claim(1), claim(2), pass(1), claim(0)]);
    expect(r.grabClaims).toBe(3);
    expect(r.biddingMultiplier).toBe(8);
    expect(r.landlord).toBe(0);
    expect(r.callSeat).toBe(0);
  });
});

describe('isBiddingComplete — 收口判定', () => {
  it('call 轮进行中（还没轮完三家）→ 未收口', () => {
    expect(isBiddingComplete(0, [pass(0)])).toMatchObject({ complete: false, redeal: false });
  });

  it('call 轮三家全 pass → 流局收口', () => {
    expect(isBiddingComplete(0, [pass(0), pass(1), pass(2)])).toMatchObject({
      complete: true,
      redeal: true,
      landlord: null,
    });
  });

  it('刚出现首叫、其余两家还没表态 → 未收口（等抢/不抢）', () => {
    expect(isBiddingComplete(0, [claim(0)])).toMatchObject({ complete: false });
    expect(isBiddingComplete(0, [claim(0), pass(1)])).toMatchObject({ complete: false });
  });

  it('叫后两家都不抢 → 收口，首叫者当地主', () => {
    expect(isBiddingComplete(0, [claim(0), pass(1), pass(2)])).toMatchObject({
      complete: true,
      redeal: false,
      landlord: 0,
    });
  });

  it('有人抢后，反抢窗口重开：抢者之后其余两家未全表态 → 未收口', () => {
    // 叫0 抢1；1 抢完后，0 和 2 还没就「反抢」表态
    expect(isBiddingComplete(0, [claim(0), claim(1)])).toMatchObject({ complete: false });
    expect(isBiddingComplete(0, [claim(0), claim(1), pass(2)])).toMatchObject({ complete: false });
  });

  it('抢后两家都放弃反抢 → 收口，最后抢者当地主', () => {
    expect(isBiddingComplete(0, [claim(0), claim(1), pass(2), pass(0)])).toMatchObject({
      complete: true,
      landlord: 1,
    });
  });
});
