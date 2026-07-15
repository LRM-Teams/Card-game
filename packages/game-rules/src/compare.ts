import { Hand, HandType } from './types';

/** 是否为炸弹类（含王炸）。炸弹类可压制非炸弹牌型。 */
export function isBombLike(h: Hand): boolean {
  return h.type === HandType.BOMB || h.type === HandType.ROCKET;
}

/**
 * 判定 `curr` 能否压过 `prev`（上家）。
 *
 * 规则：
 * 1. 王炸压一切（仅一副牌，不存在两个王炸）。
 * 2. 炸弹压所有非炸弹牌型；炸弹之间比点数大小。
 * 3. 非炸弹牌型只能压"同型 + 同长度"的牌型，比关键点数（mainRank）。
 *
 * 注意：本函数假设 prev / curr 均已是合法 Hand（由 identifyHand 产出）。
 */
export function canBeat(prev: Hand, curr: Hand): boolean {
  // 王炸压一切
  if (curr.type === HandType.ROCKET) {
    return prev.type !== HandType.ROCKET;
  }

  // 炸弹
  if (curr.type === HandType.BOMB) {
    if (prev.type === HandType.ROCKET) return false;
    if (prev.type === HandType.BOMB) return curr.mainRank > prev.mainRank;
    return true; // 炸弹压所有非炸弹牌型
  }

  // curr 为非炸弹：prev 若是炸弹类则压不过
  if (isBombLike(prev)) return false;

  // 必须同型 + 同长度，再比关键点数
  if (curr.type !== prev.type) return false;
  if (curr.length !== prev.length) return false;
  return curr.mainRank > prev.mainRank;
}
