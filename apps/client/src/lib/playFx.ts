import { HandType } from '@card-game/rules';

/** 牌型字幕动效档位（LRM-156：重点牌型加强，其余统一轻量飘字）。 */
export function handTypeFxClass(type: HandType): string {
  switch (type) {
    case HandType.PAIR:
      return 'fx-pair';
    case HandType.BOMB:
    case HandType.ROCKET:
      return 'fx-bomb';
    case HandType.PLANE:
    case HandType.PLANE_SINGLE:
    case HandType.PLANE_PAIR:
      return 'fx-plane';
    case HandType.PAIR_STRAIGHT:
      return 'fx-pair-straight';
    default:
      return 'fx-common';
  }
}

export function relativeSeats(mySeat: number): { left: number; right: number } {
  return { left: (mySeat + 2) % 3, right: (mySeat + 1) % 3 };
}
