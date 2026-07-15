import { deal, type Card } from '@card-game/rules';

export interface MockDeal {
  /** 我（地主）的手牌：17 + 3 底牌 = 20。 */
  mine: Card[];
  /** 上家（农民）。 */
  left: Card[];
  /** 下家（农民）。 */
  right: Card[];
}

/**
 * 本地 mock 发牌：复用 @card-game/rules 的 deal()。
 * 真实联网后由服务端 `dealt` 事件下发，本函数仅用于静态原型。
 */
export function mockDeal(): MockDeal {
  const { hands, bottom } = deal();
  return {
    mine: [...hands[0], ...bottom],
    left: hands[1],
    right: hands[2],
  };
}
