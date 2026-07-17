/**
 * 共享消息协议 —— 服务端权威。
 *
 * 一处定义：服务端发出 / 客户端接收；客户端"出牌可用/提示"复用同一套类型与 game-rules 判定。
 * 与 @老胡（server）、@小林（client）对齐后定稿；改协议先在 #斗地主开发 同步。
 *
 * 状态以服务端为准，客户端只做展示与乐观更新；权威判定走 game-rules。
 * 叫地主 / 倍数 / 结算的语义统一引用 game-rules 的 bidding / multiplier / settlement。
 */
import type { BidChoice, BidRound, DoubleChoice } from './bidding';
import type { Side } from './settlement';
import type { Hand, Seat } from './types';

/** 对局阶段（状态机）。 */
export enum GamePhase {
  WAITING = 'waiting', // 房间等待开局
  DEALING = 'dealing', // 发牌中
  BIDDING = 'bidding', // 叫/抢地主（含 call 轮与 grab 轮，见 BidRound）
  DOUBLING = 'doubling', // 加倍环节（地主敲定后、出牌前；农民/地主各选 加倍/超级加倍/不加倍）
  PLAYING = 'playing', // 出牌中
  SETTLED = 'settled', // 已结算
}

// BidRound / DoubleChoice 定义在 bidding.ts（规则域），此处从 './bidding' 引入并对外 re-export。
export type { BidRound, DoubleChoice };

/** 玩家身份。 */
export type Role = 'landlord' | 'farmer' | undefined;

/**
 * 错误码（服务端拒绝客户端动作时回送，客户端可据此提示）。
 */
export type ErrorCode =
  | 'not_in_room' // 玩家不在任何房间里
  | 'room_full' // 房间已满（3/3）
  | 'invalid_action_for_phase' // 当前阶段不接受该动作
  | 'not_your_turn' // 还没轮到你
  | 'illegal_play' // 出牌不合法（不是有效牌型 / 压不过上家 / 手里没这些牌）
  | 'invalid_bid' // 叫地主动作非法（choice 非 claim/pass）
  | 'invalid_double' // 加倍动作非法（choice 非 double/super/pass，或不在 DOUBLING 阶段）
  | 'must_play_when_leading' // 领出（自由出牌）时不能 pass
  | 'not_enough_players' // 不足 3 名真人且未选择补机器人，无法开局
  | 'not_your_turn'; // 当前不是你的回合（如非自己出牌回合请求出牌提示）

/** 牌桌上某玩家的公开视图（绝不含他人手牌）。 */
export interface PlayerView {
  seat: Seat;
  name: string;
  isBot: boolean;
  connected: boolean;
  role: Role;
  /** 手牌剩余张数（公开）。 */
  handSize: number;
}

/** 一次出牌记录（"上家出了什么"）。 */
export interface PlayRecord {
  seat: Seat;
  hand: Hand;
}

/** 结算结果（得分口径与 game-rules 的 settlement 完全一致）。 */
export interface GameResult {
  /** 赢方阵营（来自 settle；Side = 'landlord' | 'farmer'）。 */
  winnerSide: Side;
  /** 最先出完牌的座位。 */
  winnerSeat: Seat;
  landlordSeat: Seat;
  /** 单注 = 底分 × 倍数（来自 multiplier.unitScore）。 */
  unit: number;
  /** 当前倍数（由 multiplier 规则累积；服务端按已触发的炸弹/王炸/春天等规则写入）。 */
  multiplier: number;
  /** 三家本局得分（+赢 / -输，来自 settlement.settle），按座位 [0,1,2]。 */
  scores: [number, number, number];
}

/** 全量公开快照（客户端可据此渲染整张牌桌；不含任何玩家手牌）。 */
export interface GameStateSnapshot {
  phase: GamePhase;
  players: PlayerView[];
  /** 轮到谁（BIDDING 时为当前叫/抢者；DOUBLING 时为当前加倍决策者；PLAYING 时为当前出牌者）。 */
  turnSeat: Seat | null;
  /** 当前叫抢轮次；仅 BIDDING 阶段有意义，其余为 null。 */
  bidRound: BidRound | null;
  /** 本局叫/抢地主的公开历史（供客户端渲染气泡/回顾）；未进入 BIDDING 时为空数组。 */
  bids: { seat: Seat; choice: BidChoice; round: BidRound }[];
  /** 加倍环节各家选择（公开）；未进入/未经过 DOUBLING 时为空数组。 */
  doubles: { seat: Seat; choice: DoubleChoice }[];
  landlordSeat: Seat | null;
  /** 房主座位（创建房间的真人；WAITING 阶段房主可决定开局/补机器人）。 */
  hostSeat: Seat | null;
  /** 3 张底牌 id；仅当 bottomRevealed 时有意义。 */
  bottom: string[];
  bottomRevealed: boolean;
  /** 当前这一轮最后一次有效出牌；领出/新轮时为 null。 */
  lastPlay: PlayRecord | null;
  /** 当前轮连续 pass 次数（达到 2 则本轮结束、领出者继续）。 */
  passCount: number;
  /** 当前倍数（炸弹/王炸累积），便于客户端展示。 */
  multiplier: number;
  result: GameResult | null;
}

/** 客户端 → 服务端动作。 */
export type ClientAction =
  | { type: 'join'; name: string; roomId?: string }
  | { type: 'start'; fillBots?: boolean } // fillBots=true：不足 3 真人时补机器人开局；默认 false：等人齐（3 真人）才开局
  | { type: 'bid'; choice: BidChoice } // claim=叫/抢（要当地主），pass=不叫/不抢；服务端按当前 BidRound 判定语义
  | { type: 'double'; choice: DoubleChoice } // 加倍环节：double 加倍 / super 超级加倍 / pass 不加倍
  | { type: 'play'; cards: string[] } // 要出的牌 id 列表
  | { type: 'pass' }
  | { type: 'hint' }; // 请求 AI 出牌提示（DouZero top-N 合法出牌建议，按模型分从高到低）

/** 服务端 → 客户端事件。 */
export type ServerEvent =
  // —— 加入 / 房间 ——
  | { type: 'you_joined'; seat: Seat; roomId: string }
  // —— 全量公开快照（任何状态变更后都会推，客户端可直接渲染）——
  | { type: 'snapshot'; state: GameStateSnapshot }
  // —— 阶段 ——
  | { type: 'phase'; phase: GamePhase }
  // —— 私有：只发给对应玩家 ——
  | { type: 'dealt'; hand: string[] } // 你的手牌（card id）
  // —— 叫/抢地主 ——
  | { type: 'bid'; seat: Seat; choice: BidChoice; round?: BidRound } // round 供客户端区分「叫地主」与「抢地主」气泡文案（缺省视为 call）
  | { type: 'landlord'; seat: Seat; bottom: string[] } // 地主敲定 + 底牌公开
  // —— 加倍 ——
  | { type: 'doubled'; seat: Seat; choice: DoubleChoice } // 某玩家的加倍决策（公开）
  // —— 出牌回合 ——
  | { type: 'turn'; seat: Seat }
  | { type: 'played'; seat: Seat; hand: Hand }
  | { type: 'passed'; seat: Seat }
  // —— 结算 ——
  | { type: 'settled'; result: GameResult }
  // —— AI 出牌提示（私发给请求者；按模型分从高到低的合法出牌建议，每组为 card id 列表；空数组表示建议不出）——
  | { type: 'hint'; suggestions: string[][] }
  // —— 错误（只回送给发起动作的客户端）——
  | { type: 'error'; code: ErrorCode; message: string };
