/**
 * GameRoom —— 服务端权威对局状态机。
 *
 * 规则一律调用 @card-game/rules，服务端不另写：
 * - 叫地主：抢地主（A 方案）→ 收集 BidEntry[] 交给 `resolveBidding`。
 * - 倍数：`createMultiplier` + 每次出牌 `applyPlay`（炸弹/王炸 ×2）→ `unitScore`。
 * - 胜负/结算：`settle({ landlord, winnerSeat, unit })`。
 * - 地主拿底牌：`withBottom`。
 * - 出牌合法性：`canPlay` / `identifyHand`。
 *
 * 状态机：WAITING → DEALING → BIDDING → PLAYING → SETTLED。
 * 真人不足时补机器人到 3 人；机器人用 bot.ts 的最小合法 AI 自动行棋。
 * 纯逻辑：不依赖 socket.io，可被 transport 和单测直接驱动。
 *
 * 每个公开 handle* 方法做"校验 + 推进"，返回 ActionResult（事件流 or 错误码）。
 * 事件流里的 scope 决定下发范围：'room' 广播，{seat} 仅私发该座位。
 */
import {
  applyPlay,
  canPlay,
  createMultiplier,
  deal,
  GamePhase,
  identifyHand,
  resolveBidding,
  settle,
  sortCards,
  unitScore,
  withBottom,
} from '@card-game/rules';
import type {
  BidChoice,
  Card,
  ClientAction,
  ErrorCode,
  GameResult,
  GameStateSnapshot,
  Hand,
  MultiplierState,
  PlayerView,
  Seat,
} from '@card-game/rules';
import { botBid, botName } from './bot';
import { choosePlayWithDouZero } from './douzeroAdapter';
import type { BotPlayHistoryEntry, DouZeroBotAdapter } from './douzeroAdapter';
import type { ActionResult, BidState, LastPlay, PlayerState, RoomEvent } from './types';

const SEATS: readonly Seat[] = [0, 1, 2];
const MAX_REDEALS = 5;
const BOT_LOOP_GUARD = 2000;

function ok(events: RoomEvent[]): ActionResult {
  return { ok: true, events };
}
function err(code: ErrorCode, message: string): ActionResult {
  return { ok: false, code, message };
}
function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 3) as Seat;
}

export class GameRoom {
  readonly roomId: string;
  phase: GamePhase = GamePhase.WAITING;
  /** 三个座位；WAITING 时未占座位为 null，开局后全部填满（真人 + 机器人）。 */
  players: (PlayerState | null)[] = [null, null, null];
  /** 房主座位（首位加入的真人）；WAITING 阶段由房主决定等人 / 补机器人 / 开局。 */
  hostSeat: Seat | null = null;
  turnSeat: Seat | null = null;
  landlordSeat: Seat | null = null;
  bottom: Card[] = [];
  bottomRevealed = false;
  lastPlay: LastPlay | null = null;
  passCount = 0;
  /** 当前轮的领出者（赢得上一轮 / 本轮起始）。 */
  leaderSeat: Seat | null = null;
  bid: BidState | null = null;
  /** 倍数状态（底分 1，每出一个炸弹/王炸 ×2）。 */
  mult: MultiplierState = createMultiplier();
  result: GameResult | null = null;
  /** 出牌/过牌历史，供 DouZero 适配层构造观测状态。 */
  playHistory: BotPlayHistoryEntry[] = [];

  private botCounter = 0;

  constructor(roomId: string, private readonly aiAdapter?: DouZeroBotAdapter) {
    this.roomId = roomId;
  }

  get humanCount(): number {
    return this.players.filter((p) => p !== null && !p.isBot).length;
  }
  get playerCount(): number {
    return this.players.filter((p) => p !== null).length;
  }

  /** 第一个空座位（无则 null）。registry 据此确定新人落座。 */
  firstEmptySeat(): Seat | null {
    const idx = this.players.findIndex((p) => p === null);
    return idx === -1 ? null : (idx as Seat);
  }

  /** 断线真人用同房间 + 同昵称恢复原座位与私有手牌。 */
  reconnectHuman(name: string): { seat: Seat; result: ActionResult } | null {
    const trimmed = name.trim();
    const idx = this.players.findIndex((p) => p !== null && !p.isBot && !p.connected && p.name === trimmed);
    if (idx === -1) return null;

    const seat = idx as Seat;
    const p = this.players[seat]!;
    p.connected = true;
    const events: RoomEvent[] = [
      { scope: { seat }, event: { type: 'you_joined', seat, roomId: this.roomId } },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ];
    if (p.hand.length > 0) {
      events.splice(1, 0, { scope: { seat }, event: { type: 'dealt', hand: p.hand.map((c) => c.id) } });
    }
    return { seat, result: ok(events) };
  }

  markDisconnected(seat: Seat): RoomEvent[] {
    const p = this.players[seat];
    if (!p || p.isBot || !p.connected) return [];
    p.connected = false;
    return [{ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } }];
  }

  // ---------------- 房间 / 开局 ----------------

  /** 真人加入，占第一个空座位。 */
  addHuman(name: string): ActionResult {
    if (this.phase !== GamePhase.WAITING) return err('invalid_action_for_phase', '对局已开始，不能加入');
    const idx = this.players.findIndex((p) => p === null);
    if (idx === -1) return err('room_full', '房间已满（3/3）');
    const seat = idx as Seat;
    this.players[seat] = {
      seat,
      name: name.trim() || `玩家${seat + 1}`,
      isBot: false,
      connected: true,
      role: undefined,
      hand: [],
    };
    // 首位真人即为房主（创建房间者）
    if (this.hostSeat === null) this.hostSeat = seat;
    return ok([
      { scope: { seat }, event: { type: 'you_joined', seat, roomId: this.roomId } },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ]);
  }

  /**
   * 开局：不足 3 人则补机器人，然后发牌 + 进入叫地主。
   * 产品上由真人触发（transport 层保证至少 1 名真人）；引擎允许全机器人局，便于联机/自动化测试。
   */
  /**
   * 开局：fillBots=true 时不足 3 人补机器人；默认 fillBots=false 要求 3 名真人（纯人对战）。
   * 产品上由真人触发（transport 层保证至少 1 名真人）；引擎允许全机器人局，便于联机/自动化测试。
   */
  start(fillBots = false): ActionResult {
    if (this.phase !== GamePhase.WAITING) return err('invalid_action_for_phase', '当前阶段不能开局');
    if (fillBots) {
      this.fillBots();
    } else if (this.humanCount < 3) {
      return err('not_enough_players', '人数不足 3 人，等人加入或选择补机器人');
    }
    return this.dealAndBeginBid();
  }

  private fillBots(): void {
    for (const seat of SEATS) {
      if (this.players[seat] === null) {
        this.botCounter += 1;
        this.players[seat] = {
          seat,
          name: botName(this.botCounter),
          isBot: true,
          connected: true,
          role: undefined,
          hand: [],
        };
      }
    }
  }

  private dealAndBeginBid(): ActionResult {
    const { hands, bottom } = deal();
    for (const seat of SEATS) {
      const p = this.players[seat]!;
      p.hand = sortCards(hands[seat]);
      p.role = undefined;
    }
    this.bottom = bottom;
    this.bottomRevealed = false;
    this.lastPlay = null;
    this.passCount = 0;
    this.leaderSeat = null;
    this.landlordSeat = null;
    this.result = null;
    this.mult = createMultiplier();
    this.playHistory = [];

    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'phase', phase: GamePhase.DEALING } }];
    for (const seat of SEATS) {
      events.push({ scope: { seat }, event: { type: 'dealt', hand: this.players[seat]!.hand.map((c) => c.id) } });
    }
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });

    // 进入叫地主（抢地主 A 方案，按座位顺序单轮线性收集 BidEntry）
    this.phase = GamePhase.BIDDING;
    this.bid = { order: [0, 1, 2], index: 0, entries: [], redeals: 0 };
    this.turnSeat = this.bid.order[this.bid.index] ?? null;
    events.push({ scope: 'room', event: { type: 'phase', phase: GamePhase.BIDDING } });
    if (this.turnSeat !== null) {
      events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat } });
    }
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });

    events.push(...this.autoBots());
    return ok(events);
  }

  // ---------------- 叫地主（抢地主，规则在 game-rules.resolveBidding） ----------------

  handleBid(seat: Seat, choice: BidChoice): ActionResult {
    if (this.phase !== GamePhase.BIDDING || !this.bid) return err('invalid_action_for_phase', '当前不是叫地主阶段');
    const b = this.bid;
    if (seat !== b.order[b.index]) return err('not_your_turn', '还没轮到你叫');
    if (choice !== 'claim' && choice !== 'pass') return err('invalid_bid', '叫地主动作必须是 claim 或 pass');

    const events: RoomEvent[] = this.iBid(seat, choice);
    events.push(...this.autoBots());
    return ok(events);
  }

  private iBid(seat: Seat, choice: BidChoice): RoomEvent[] {
    const b = this.bid!;
    b.entries.push({ seat, choice });
    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'bid', seat, choice } }];
    b.index += 1;
    if (b.index >= b.order.length) {
      events.push(...this.finishBidding());
    } else {
      this.turnSeat = b.order[b.index] ?? null;
      if (this.turnSeat !== null) {
        events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat } });
      }
      events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    }
    return events;
  }

  /** 三家叫完 → 交给 resolveBidding 结算；流局则重发（封顶后强制座位 0 当地主）。 */
  private finishBidding(): RoomEvent[] {
    const b = this.bid!;
    const res = resolveBidding(b.entries);
    if (!res.redeal && res.landlord !== null) {
      return this.setLandlord(res.landlord);
    }
    if (b.redeals < MAX_REDEALS) {
      b.redeals += 1;
      return this.redeal();
    }
    return this.setLandlord(0); // 封顶兜底
  }

  private redeal(): RoomEvent[] {
    const { hands, bottom } = deal();
    for (const seat of SEATS) this.players[seat]!.hand = sortCards(hands[seat]);
    this.bottom = bottom;
    const b = this.bid!;
    b.index = 0;
    b.entries = [];
    const events: RoomEvent[] = [];
    for (const seat of SEATS) {
      events.push({ scope: { seat }, event: { type: 'dealt', hand: this.players[seat]!.hand.map((c) => c.id) } });
    }
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    return events;
  }

  private setLandlord(seat: Seat): RoomEvent[] {
    this.landlordSeat = seat;
    for (const s of SEATS) {
      this.players[s]!.role = s === seat ? 'landlord' : 'farmer';
    }
    // 地主拿底牌（共 20 张）
    this.players[seat]!.hand = withBottom(this.players[seat]!.hand, this.bottom);
    this.bottomRevealed = true;
    this.phase = GamePhase.PLAYING;
    this.turnSeat = seat;
    this.leaderSeat = seat;
    this.lastPlay = null;
    this.passCount = 0;
    return [
      // 地主的新手牌（20 张）私发
      { scope: { seat }, event: { type: 'dealt', hand: this.players[seat]!.hand.map((c) => c.id) } },
      { scope: 'room', event: { type: 'landlord', seat, bottom: this.bottom.map((c) => c.id) } },
      { scope: 'room', event: { type: 'phase', phase: GamePhase.PLAYING } },
      { scope: 'room', event: { type: 'turn', seat } },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ];
  }

  // ---------------- 出牌回合（合法性走 game-rules，倍数走 multiplier） ----------------

  handlePlay(seat: Seat, cardIds: readonly string[]): ActionResult {
    if (this.phase !== GamePhase.PLAYING) return err('invalid_action_for_phase', '当前不是出牌阶段');
    if (this.turnSeat !== seat) return err('not_your_turn', '还没轮到你出');
    const p = this.players[seat]!;

    // 解析：每张牌必须在手里，且 id 不重复
    const byId = new Map(p.hand.map((c) => [c.id, c]));
    const cards: Card[] = [];
    for (const id of cardIds) {
      const c = byId.get(id);
      if (!c) return err('illegal_play', `手里没有这张牌：${id}`);
      cards.push(c);
      byId.delete(id);
    }
    if (cards.length === 0) return err('illegal_play', '没有选出任何牌');

    const prev = this.lastPlay ? this.lastPlay.hand : null;
    if (!canPlay(prev, cards)) {
      return err('illegal_play', prev ? '压不过上家' : '不是合法牌型');
    }

    const events: RoomEvent[] = this.iPlay(seat, cards);
    events.push(...this.autoBots());
    return ok(events);
  }

  private iPlay(seat: Seat, cards: readonly Card[]): RoomEvent[] {
    const p = this.players[seat]!;
    const ids = new Set(cards.map((c) => c.id));
    p.hand = p.hand.filter((c) => !ids.has(c.id));
    const hand = identifyHand(cards)!; // 已由 handlePlay 校验合法
    this.lastPlay = { seat, hand };
    this.leaderSeat = seat;
    this.passCount = 0;
    this.playHistory.push({ seat, cards: [...cards], isPass: false });
    this.mult = applyPlay(this.mult, hand); // 炸弹 / 王炸 ×2

    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'played', seat, hand } }];

    if (p.hand.length === 0) {
      events.push(...this.iSettle(seat));
      return events;
    }
    this.turnSeat = nextSeat(seat);
    events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat } });
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    return events;
  }

  handlePass(seat: Seat): ActionResult {
    if (this.phase !== GamePhase.PLAYING) return err('invalid_action_for_phase', '当前不是出牌阶段');
    if (this.turnSeat !== seat) return err('not_your_turn', '还没轮到你');
    if (this.lastPlay === null) return err('must_play_when_leading', '你领出，必须出牌，不能 pass');

    const events: RoomEvent[] = this.iPass(seat);
    events.push(...this.autoBots());
    return ok(events);
  }

  private iPass(seat: Seat): RoomEvent[] {
    this.passCount += 1;
    this.playHistory.push({ seat, cards: [], isPass: true });
    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'passed', seat } }];
    if (this.passCount >= 2) {
      // 两人连过 → 本轮结束，领出者继续领出
      this.lastPlay = null;
      this.passCount = 0;
      this.turnSeat = this.leaderSeat;
      events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat! } });
    } else {
      this.turnSeat = nextSeat(seat);
      events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat } });
    }
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    return events;
  }

  private iSettle(winnerSeat: Seat): RoomEvent[] {
    const landlordSeat = this.landlordSeat!;
    const unit = unitScore(this.mult);
    const s = settle({ landlord: landlordSeat, winnerSeat, unit });
    const result: GameResult = {
      winnerSide: s.winnerSide,
      winnerSeat,
      landlordSeat,
      unit,
      multiplier: this.mult.multiplier,
      scores: s.scores,
    };
    this.result = result;
    this.phase = GamePhase.SETTLED;
    this.turnSeat = null;
    return [
      { scope: 'room', event: { type: 'settled', result } },
      { scope: 'room', event: { type: 'phase', phase: GamePhase.SETTLED } },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ];
  }

  // ---------------- 机器人自动行棋 ----------------

  /** 当轮到机器人（叫牌/出牌）时自动推进，直到轮到真人或局面终结。 */
  private autoBots(): RoomEvent[] {
    const events: RoomEvent[] = [];
    for (let guard = 0; guard < BOT_LOOP_GUARD; guard++) {
      if (this.phase === GamePhase.SETTLED) break;

      if (this.phase === GamePhase.BIDDING && this.bid) {
        const seat = this.bid.order[this.bid.index]!;
        const p = this.players[seat];
        if (!p || !p.isBot) break;
        events.push(...this.iBid(seat, botBid(p.hand)));
        continue;
      }

      if (this.phase === GamePhase.PLAYING) {
        const seat = this.turnSeat;
        if (seat === null) break;
        const p = this.players[seat];
        if (!p || !p.isBot) break;
        const prev = this.lastPlay ? this.lastPlay.hand : null;
        const cards = choosePlayWithDouZero(
          {
            seat,
            landlordSeat: this.landlordSeat!,
            hand: p.hand,
            prev,
            bottom: this.bottom,
            handCounts: {
              0: this.players[0]!.hand.length,
              1: this.players[1]!.hand.length,
              2: this.players[2]!.hand.length,
            },
            history: this.playHistory,
          },
          this.aiAdapter,
        );
        if (cards && cards.length > 0) events.push(...this.iPlay(seat, cards));
        else if (this.lastPlay === null) {
          events.push(...this.iPlay(seat, smallestFallback(p.hand))); // 领出兜底
        } else {
          events.push(...this.iPass(seat));
        }
        continue;
      }
      break;
    }
    return events;
  }

  // ---------------- 路由 / 视图 ----------------

  /** 按动作类型路由（join 由 registry 处理，这里只处理座位绑定的动作）。 */
  handleAction(seat: Seat, action: ClientAction): ActionResult {
    switch (action.type) {
      case 'bid':
        return this.handleBid(seat, action.choice);
      case 'play':
        return this.handlePlay(seat, action.cards);
      case 'pass':
        return this.handlePass(seat);
      case 'start':
        return this.start(action.fillBots ?? false);
      default:
        return err('invalid_action_for_phase', `当前阶段不支持动作：${action.type}`);
    }
  }

  /** 生成全量公开快照（不含任何玩家手牌；底牌未公开前不下发）。 */
  snapshot(): GameStateSnapshot {
    const players: PlayerView[] = [];
    for (const seat of SEATS) {
      const p = this.players[seat];
      if (p) {
        players.push({
          seat,
          name: p.name,
          isBot: p.isBot,
          connected: p.connected,
          role: p.role,
          handSize: p.hand.length,
        });
      }
    }
    return {
      phase: this.phase,
      players,
      turnSeat: this.turnSeat,
      landlordSeat: this.landlordSeat,
      hostSeat: this.hostSeat,
      bottom: this.bottomRevealed ? this.bottom.map((c) => c.id) : [],
      bottomRevealed: this.bottomRevealed,
      lastPlay: this.lastPlay ? { seat: this.lastPlay.seat, hand: this.lastPlay.hand } : null,
      passCount: this.passCount,
      multiplier: this.mult.multiplier,
      result: this.result,
    };
  }
}

/** 最小兜底出牌：一张最小单牌（确保局面推进）。 */
function smallestFallback(hand: readonly Card[]): Card[] {
  const sorted = [...hand].sort((a, b) => a.rank - b.rank);
  const c = sorted[0];
  return c ? [c] : [];
}

export type { Hand };
