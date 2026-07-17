import { describe, it, expect } from 'vitest';
import { HandType, type Hand } from '../src/types';
import { createMultiplier, applyPlay, computeMultiplier, isDoublingPlay, unitScore, applySpring, applyAntiSpring, applyReveal, applyGrab, applyDoubles, doubleFactor } from '../src/multiplier';

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

describe('抢地主 / 加倍倍数', () => {
  it('doubleFactor：pass ×1、double ×2、super ×4', () => {
    expect(doubleFactor('pass')).toBe(1);
    expect(doubleFactor('double')).toBe(2);
    expect(doubleFactor('super')).toBe(4);
  });

  it('applyGrab：把抢地主因子乘进倍数（不改入参）', () => {
    const s = createMultiplier();
    const s2 = applyGrab(s, 4);
    expect(s2.multiplier).toBe(4);
    expect(s.multiplier).toBe(1); // 原状态不变
  });

  it('applyDoubles：各家加倍选择连乘（super×4 · double×2 · pass×1 = ×8）', () => {
    const s = applyDoubles(createMultiplier(), ['super', 'double', 'pass']);
    expect(s.multiplier).toBe(8);
  });

  it('抢地主 ×2 叠加加倍 ×8 → 累积 ×16', () => {
    let s = createMultiplier();
    s = applyGrab(s, 2);
    s = applyDoubles(s, ['double', 'double', 'pass']); // ×4
    expect(s.multiplier).toBe(8);
  });
});
