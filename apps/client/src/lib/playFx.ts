import { HandType } from '@card-game/rules';

/** 牌型字幕动效档位（LRM-156：重点牌型加强；LRM-168：炸弹/王炸分档）。 */
export function handTypeFxClass(type: HandType): string {
  switch (type) {
    case HandType.PAIR:
      return 'fx-pair';
    case HandType.BOMB:
      return 'fx-bomb';
    case HandType.ROCKET:
      return 'fx-bomb fx-rocket';
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

export function isBombLike(type: HandType): boolean {
  return type === HandType.BOMB || type === HandType.ROCKET;
}

export function relativeSeats(mySeat: number): { left: number; right: number } {
  return { left: (mySeat + 2) % 3, right: (mySeat + 1) % 3 };
}
