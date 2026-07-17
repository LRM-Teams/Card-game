import { describe, it, expect } from 'vitest';
import { HandType, type Hand } from '../src/types';
import { createMultiplier, applyPlay, computeMultiplier, isDoublingPlay, unitScore, applySpring, applyAntiSpring, applyReveal, applyGrab, applyGrabClaims, doubleFactor, applyDouble, applyDoubles } from '../src/multiplier';

const hand = (type: HandType): Hand => ({ type, cards: [], mainRank: 3, length: 1 });

describe('multiplier', () => {
  it('初始：底分 1、倍数 1', () => {
    const s = createMultiplier();
    expect(s.base).toBe(1);
    expect(s.multiplier).toBe(1);
    expect(unitScore(s)).toBe(1);
  });

  it('炸弹 / 王炸 ×2，其余不变（不可变）', () => {
    let s = createMultiplier();
    s = applyPlay(s, hand(HandType.BOMB));
    expect(s.multiplier).toBe(2);
    s = applyPlay(s, hand(HandType.SINGLE)); // 非炸弹不变
    expect(s.multiplier).toBe(2);
    s = applyPlay(s, hand(HandType.ROCKET));
    expect(s.multiplier).toBe(4);
  });

  it('isDoublingPlay', () => {
    expect(isDoublingPlay(hand(HandType.BOMB))).toBe(true);
    expect(isDoublingPlay(hand(HandType.ROCKET))).toBe(true);
    expect(isDoublingPlay(hand(HandType.PAIR))).toBe(false);
  });

  it('computeMultiplier 汇总 + unitScore', () => {
    const s = computeMultiplier([hand(HandType.BOMB), hand(HandType.BOMB), hand(HandType.PAIR)]);
    expect(s.multiplier).toBe(4);
    expect(unitScore(s)).toBe(4);
  });

  it('春天 ×2', () => {
    expect(applySpring(createMultiplier()).multiplier).toBe(2);
  });

  it('反春 ×2（与炸弹叠加）', () => {
    let s = applyPlay(createMultiplier(), hand(HandType.BOMB)); // 2
    s = applyAntiSpring(s); // 4
    expect(unitScore(s)).toBe(4);
  });

  it('明牌 ×2', () => {
    expect(applyReveal(createMultiplier()).multiplier).toBe(2);
  });

  it('applyPlay 不修改原状态', () => {
    const s = createMultiplier();
    const s2 = applyPlay(s, hand(HandType.BOMB));
    expect(s.multiplier).toBe(1); // 原状态不变
    expect(s2.multiplier).toBe(2);
  });
});

describe('multiplier — 抢地主 / 加倍累积', () => {
  it('applyGrab 每次 ×2', () => {
    let s = createMultiplier();
    s = applyGrab(s);
    expect(s.multiplier).toBe(2);
    s = applyGrab(s);
    expect(s.multiplier).toBe(4);
  });

  it('applyGrabClaims 一次性折算：3 次抢 → ×8；0 次不变', () => {
    expect(applyGrabClaims(createMultiplier(), 3).multiplier).toBe(8);
    expect(applyGrabClaims(createMultiplier(), 0).multiplier).toBe(1);
  });

  it('doubleFactor：加倍 2 / 超级 4 / 不加倍 1', () => {
    expect(doubleFactor('double')).toBe(2);
    expect(doubleFactor('super')).toBe(4);
    expect(doubleFactor('pass')).toBe(1);
  });

  it('applyDouble：加倍 ×2、超级 ×4、不加倍不变', () => {
    expect(applyDouble(createMultiplier(), 'double').multiplier).toBe(2);
    expect(applyDouble(createMultiplier(), 'super').multiplier).toBe(4);
    expect(applyDouble(createMultiplier(), 'pass').multiplier).toBe(1);
  });

  it('applyDoubles：多家选择连乘（加倍 + 超级 → ×8）', () => {
    const s = applyDoubles(createMultiplier(), ['double', 'super', 'pass']);
    expect(s.multiplier).toBe(8);
  });

  it('加倍叠炸弹全链路：叫抢×2 + 加倍×2 + 炸弹×2 + 王炸×2 → 底分1 × 16', () => {
    let s = createMultiplier(); // 1
    s = applyGrabClaims(s, 1); // 一抢 → 2
    s = applyDouble(s, 'double'); // 加倍 → 4
    s = applyPlay(s, hand(HandType.BOMB)); // 炸弹 → 8
    s = applyPlay(s, hand(HandType.ROCKET)); // 王炸 → 16
    expect(s.multiplier).toBe(16);
    expect(unitScore(s)).toBe(16);
  });

  it('超级加倍叠双炸：底分1 → 超级×4 → 炸×2 → 炸×2 = 16', () => {
    let s = applyDouble(createMultiplier(), 'super'); // 4
    s = applyPlay(s, hand(HandType.BOMB)); // 8
    s = applyPlay(s, hand(HandType.BOMB)); // 16
    expect(s.multiplier).toBe(16);
  });

  it('applyGrabClaims / applyDouble 不修改原状态', () => {
    const s = createMultiplier();
    expect(applyGrabClaims(s, 2).multiplier).toBe(4);
    expect(applyDouble(s, 'super').multiplier).toBe(4);
    expect(s.multiplier).toBe(1);
  });
});
