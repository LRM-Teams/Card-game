/**
 * apps/server 内部对局状态类型（服务端私有，不下发客户端）。
 * 客户端可见的协议类型统一来自 @card-game/rules 的 protocol.ts。
 * 叫地主 / 倍数 / 结算的语义直接复用 game-rules 的类型，不在服务端另定义。
 */
import type {
  BidEntry,
  Card,
  DoubleChoice,
  ErrorCode,
  GamePhase,
  MultiplierState,
  Role,
  Seat,
  ServerEvent,
} from '@card-game/rules';

/** 单个玩家的完整服务端状态（含私密手牌）。 */
export interface PlayerState {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  role: Role;
  /** 完整手牌（仅服务端持有；客户端只拿到自己的）。 */
  hand: Card[];
}

/** 叫地主进行态（收集 BidEntry，最后交给 game-rules 的 resolveBidding 结算）。 */
export interface BidState {
  /** 叫牌顺序（座位序列）。 */
  order: Seat[];
  /** 当前轮到 order 的第几位。 */
  index: number;
  /** 按顺序收集的出价记录。 */
  entries: BidEntry[];
  /** 重发计数（流局时重发，封顶防死循环）。 */
  redeals: number;
}

/** 加倍进行态（地主敲定后、出牌前，按 order 依次收集各家加倍选择）。 */
export interface DoublingState {
  /** 加倍决策顺序（地主先，两农民后）。 */
  order: Seat[];
  /** 当前轮到 order 的第几位。 */
  index: number;
  /** 已收集的加倍选择。 */
  choices: { seat: Seat; choice: DoubleChoice }[];
}

/** 一次出牌记录（服务端内部用，含已识别的 Hand）。 */
export interface LastPlay {
  seat: Seat;
  hand: import('@card-game/rules').Hand;
}

/**
 * 一次动作产生的下发事件。
 * - scope='room'：广播给房内所有人。
 * - scope={seat}：私发给该座位（仅人类玩家有连接时才真正送达）。
 */
export interface RoomEvent {
  scope: 'room' | { seat: Seat };
  event: ServerEvent;
}

/** 状态机动作的统一返回：成功带事件流，失败带错误码。 */
export type ActionResult =
  | { ok: true; events: RoomEvent[] }
  | { ok: false; code: ErrorCode; message: string };

/** 复用 game-rules 的类型（仅用于类型导入保持）。 */
export type { GamePhase, MultiplierState };
