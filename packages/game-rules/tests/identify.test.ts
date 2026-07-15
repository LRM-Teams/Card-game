import { describe, expect, it } from 'vitest';
import { identifyHand } from '../src/identify';
import { HandType } from '../src/types';
import { cards } from './helpers';

describe('identifyHand — 基础牌型', () => {
  it('单张', () => {
    const h = identifyHand(cards('3'));
    expect(h?.type).toBe(HandType.SINGLE);
    expect(h?.mainRank).toBe(3);
    expect(h?.length).toBe(1);
  });

  it('对子', () => {
    const h = identifyHand(cards('5 5'));
    expect(h?.type).toBe(HandType.PAIR);
    expect(h?.mainRank).toBe(5);
  });

  it('三张', () => {
    const h = identifyHand(cards('7 7 7'));
    expect(h?.type).toBe(HandType.TRIPLE);
    expect(h?.mainRank).toBe(7);
  });

  it('炸弹（四张同点）', () => {
    const h = identifyHand(cards('5 5 5 5'));
    expect(h?.type).toBe(HandType.BOMB);
    expect(h?.mainRank).toBe(5);
  });

  it('王炸（小王 + 大王）', () => {
    const h = identifyHand(cards('小 大'));
    expect(h?.type).toBe(HandType.ROCKET);
  });
});

describe('identifyHand — 三带', () => {
  it('三带一', () => {
    const h = identifyHand(cards('7 7 7 3'));
    expect(h?.type).toBe(HandType.TRIPLE_SINGLE);
    expect(h?.mainRank).toBe(7);
  });

  it('三带一（带王也行）', () => {
    const h = identifyHand(cards('7 7 7 小'));
    expect(h?.type).toBe(HandType.TRIPLE_SINGLE);
  });

  it('三带二（对）', () => {
    const h = identifyHand(cards('7 7 7 3 3'));
    expect(h?.type).toBe(HandType.TRIPLE_PAIR);
    expect(h?.mainRank).toBe(7);
  });
});

describe('identifyHand — 顺子 / 连对', () => {
  it('顺子 3-7', () => {
    const h = identifyHand(cards('3 4 5 6 7'));
    expect(h?.type).toBe(HandType.STRAIGHT);
    expect(h?.mainRank).toBe(3);
    expect(h?.length).toBe(5);
  });

  it('顺子 10-J-Q-K-A', () => {
    const h = identifyHand(cards('10 J Q K A'));
    expect(h?.type).toBe(HandType.STRAIGHT);
    expect(h?.length).toBe(5);
  });

  it('长顺子 3..A（12 张）', () => {
    const h = identifyHand(cards('3 4 5 6 7 8 9 10 J Q K A'));
    expect(h?.type).toBe(HandType.STRAIGHT);
    expect(h?.length).toBe(12);
  });

  it('顺子不能含 2 / 王', () => {
    expect(identifyHand(cards('A 2 3 4 5'))).toBeNull();
    expect(identifyHand(cards('3 4 5 6 小'))).toBeNull();
  });

  it('顺子至少 5 张', () => {
    expect(identifyHand(cards('3 4 5 6'))).toBeNull();
  });

  it('连对 33 44 55', () => {
    const h = identifyHand(cards('3 3 4 4 5 5'));
    expect(h?.type).toBe(HandType.PAIR_STRAIGHT);
    expect(h?.mainRank).toBe(3);
    expect(h?.length).toBe(3);
  });

  it('连对至少 3 对', () => {
    expect(identifyHand(cards('3 3 4 4'))).toBeNull();
  });
});

describe('identifyHand — 飞机', () => {
  it('飞机不带 333 444', () => {
    const h = identifyHand(cards('3 3 3 4 4 4'));
    expect(h?.type).toBe(HandType.PLANE);
    expect(h?.mainRank).toBe(3);
    expect(h?.length).toBe(2);
  });

  it('飞机带单 333 444 + 5 6', () => {
    const h = identifyHand(cards('3 3 3 4 4 4 5 6'));
    expect(h?.type).toBe(HandType.PLANE_SINGLE);
    expect(h?.length).toBe(2);
  });

  it('飞机带单 翅膀必须互不相同', () => {
    // 333 444 + 5 5 不合法（翅膀是对子，且数量也对不上）
    expect(identifyHand(cards('3 3 3 4 4 4 5 5'))).toBeNull();
  });

  it('飞机带对 333 444 + 55 66', () => {
    const h = identifyHand(cards('3 3 3 4 4 4 5 5 6 6'));
    expect(h?.type).toBe(HandType.PLANE_PAIR);
    expect(h?.length).toBe(2);
  });

  it('三连飞机 333 444 555', () => {
    const h = identifyHand(cards('3 3 3 4 4 4 5 5 5'));
    expect(h?.type).toBe(HandType.PLANE);
    expect(h?.length).toBe(3);
  });

  it('飞机不能含 2', () => {
    expect(identifyHand(cards('A A A 2 2 2'))).toBeNull();
  });
});

describe('identifyHand — 四带二', () => {
  it('四带二（两单）', () => {
    const h = identifyHand(cards('4 4 4 4 5 6'));
    expect(h?.type).toBe(HandType.FOUR_TWO_SINGLE);
    expect(h?.mainRank).toBe(4);
  });

  it('四带二两单必须不同点', () => {
    // 4444 + 55 不合法
    expect(identifyHand(cards('4 4 4 4 5 5'))).toBeNull();
  });

  it('四带两对', () => {
    const h = identifyHand(cards('4 4 4 4 5 5 6 6'));
    expect(h?.type).toBe(HandType.FOUR_TWO_PAIR);
    expect(h?.mainRank).toBe(4);
  });
});

describe('identifyHand — 非法牌型', () => {
  it('两张散牌不是对子', () => {
    expect(identifyHand(cards('3 4'))).toBeNull();
  });

  it('三张散牌', () => {
    expect(identifyHand(cards('3 4 5'))).toBeNull();
  });

  it('炸弹 + 单张（5 张）不合法', () => {
    expect(identifyHand(cards('5 5 5 5 3'))).toBeNull();
  });

  it('两对散开（不连续）不合法', () => {
    expect(identifyHand(cards('3 3 5 5'))).toBeNull();
  });

  it('空输入', () => {
    expect(identifyHand([])).toBeNull();
  });
});
