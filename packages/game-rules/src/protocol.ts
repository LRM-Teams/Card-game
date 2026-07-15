/**
 * 共享消息协议 —— 与 @老胡（server）、@小林（client）对齐后定稿。
 * 一处定义：服务端发出 / 客户端接收，客户端提示复用同一套类型。
 *
 * 状态以服务端为准，客户端只做展示与乐观更新；权威判定走 game-rules。
 */

/** 对局阶段（状态机）。 */
export enum GamePhase {
  WAITING = 'waiting', // 房间等待开局
  DEALING = 'dealing', // 发牌中
  BIDDING = 'bidding', // 叫地主
  PLAYING = 'playing', // 出牌中
  SETTLED = 'settled', // 已结算
}

/** 玩家身份。 */
export type Role = 'landlord' | 'farmer' | undefined;

// TODO(老胡/大伟 对齐)：下列事件为初稿骨架，后续补充叫地主、回合、结算、错误码等。
export type ServerEvent =
  | { type: 'phase'; phase: GamePhase }
  | { type: 'dealt'; hand: string[] } // 玩家自己的手牌（card id）
  | { type: 'turn'; player: number } // 轮到谁
  | { type: 'played'; player: number; cards: string[] } // 某玩家出牌
  | { type: 'passed'; player: number } // 某玩家过牌
  | { type: 'error'; code: string; message: string };

// TODO：客户端动作（join/play/pass/bid）的事件类型待与 server 对齐后补全。
