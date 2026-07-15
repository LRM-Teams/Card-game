import { describe, expect, it } from 'vitest';
import { canBeat } from '../src/compare';
import { identifyHand } from '../src/identify';
import { cards } from './helpers';

/** 便捷：把 token 串识别成 Hand（测试用，已知合法）。 */
function hand(str: string) {
  const h = identifyHand(cards(str));
  if (!h) throw new Error(`expected legal hand: ${str}`);
  return h;
}

describe('canBeat — 同型比较', () => {
  it('单张：大压小', () => {
    expect(canBeat(hand('3'), hand('5'))).toBe(true);
    expect(canBeat(hand('5'), hand('3'))).toBe(false);
  });

  it('对子', () => {
    expect(canBeat(hand('5 5'), hand('7 7'))).toBe(true);
    expect(canBeat(hand('7 7'), hand('5 5'))).toBe(false);
  });

  it('三带一比的是三张点数', () => {
    expect(canBeat(hand('7 7 7 3'), hand('K K K 5'))).toBe(true);
    expect(canBeat(hand('K K K 5'), hand('7 7 7 3'))).toBe(false);
  });

  it('三带二', () => {
    expect(canBeat(hand('7 7 7 3 3'), hand('8 8 8 5 5'))).toBe(true);
  });
});

describe('canBeat — 顺子 / 连对 / 飞机', () => {
  it('顺子同长度比起点', () => {
    expect(canBeat(hand('3 4 5 6 7'), hand('4 5 6 7 8'))).toBe(true);
    expect(canBeat(hand('4 5 6 7 8'), hand('3 4 5 6 7'))).toBe(false);
  });

  it('顺子不同长度不能互压', () => {
    expect(canBeat(hand('3 4 5 6 7'), hand('4 5 6 7 8 9'))).toBe(false);
  });

  it('连对同长度比起点', () => {
    expect(canBeat(hand('3 3 4 4 5 5'), hand('4 4 5 5 6 6'))).toBe(true);
  });

  it('飞机同结构比起点', () => {
    expect(canBeat(hand('3 3 3 4 4 4 5 6'), hand('4 4 4 5 5 5 6 7'))).toBe(true);
  });

  it('飞机带单 vs 飞机带对 不能互压', () => {
    expect(canBeat(hand('3 3 3 4 4 4 5 6'), hand('3 3 3 4 4 4 5 5 6 6'))).toBe(false);
  });
});

describe('canBeat — 炸弹 / 王炸', () => {
  it('炸弹压非炸弹', () => {
    expect(canBeat(hand('A'), hand('5 5 5 5'))).toBe(true);
    expect(canBeat(hand('A A'), hand('5 5 5 5'))).toBe(true);
  });

  it('大炸弹压小炸弹', () => {
    expect(canBeat(hand('5 5 5 5'), hand('K K K K'))).toBe(true);
    expect(canBeat(hand('K K K K'), hand('5 5 5 5'))).toBe(false);
  });

  it('王炸压一切（含炸弹）', () => {
    expect(canBeat(hand('A A A A'), hand('小 大'))).toBe(true);
    expect(canBeat(hand('A'), hand('小 大'))).toBe(true);
  });

  it('炸弹压不过王炸', () => {
    expect(canBeat(hand('小 大'), hand('A A A A'))).toBe(false);
  });

  it('非炸弹压不过炸弹', () => {
    expect(canBeat(hand('5 5 5 5'), hand('A'))).toBe(false);
  });
});

describe('canBeat — 跨型不可压', () => {
  it('单张压不了对子', () => {
    expect(canBeat(hand('5 5'), hand('A'))).toBe(false);
  });

  it('对子压不了三带一', () => {
    expect(canBeat(hand('7 7 7 3'), hand('A A'))).toBe(false);
  });
});
