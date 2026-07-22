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
 * 状态机：WAITING → DEALING → BIDDING → REVEALING → DOUBLING → PLAYING → SETTLED。
 * 真人不足时补机器人到 3 人；机器人用 bot.ts 的最小合法 AI 自动行棋。
 * 纯逻辑：不依赖 socket.io，可被 transport 和单测直接驱动。
 *
 * 每个公开 handle* 方法做"校验 + 推进"，返回 ActionResult（事件流 or 错误码）。
 * 事件流里的 scope 决定下发范围：'room' 广播，{seat} 仅私发该座位。
 */
import {
  applyDouble,
  applyPlay,
  applyReveal,
  canPlay,
  createMultiplier,
  deal,
  GamePhase,
  identifyHand,
  isDoublingPlay,
  isSocialEmoteId,
  isSocialPhraseId,
  resolveBidding,
  settle,
  SOCIAL_COOLDOWN_MS,
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
  MultiplierBreakdown,
  MultiplierState,
  PlayerView,
  Seat,
  SocialEmoteId,
  SocialKind,
  SocialPhraseId,
} from '@card-game/rules';
import { botBid, botDouble, botName, botReveal } from './bot';
import { botThinkDelayMs, sleep } from './botTiming';
import { choosePlayWithDouZero, rankPlaySuggestions } from './douzeroAdapter';
import type { BotPlayHistoryEntry, DouZeroBotAdapter } from './douzeroAdapter';
import type { ActionResult, BidState, LastPlay, PlayerState, RoomEvent } from './types';

const SEATS: readonly Seat[] = [0, 1, 2];
const MAX_REDEALS = 5;
const BOT_LOOP_GUARD = 2000;
/** AI 出牌提示一次返回的建议条数（按模型分从高到低，不足时用合法出牌补足，前端循环切换）。 */
const HINT_TOP_N = 5;
/** 明牌 / 加倍决策窗口（毫秒）；超时自动跳过。可用环境变量覆盖。 */
const DECISION_WINDOW_MS = Number(process.env.DECISION_WINDOW_MS ?? 15_000);
/** 断线真人行棋宽限（毫秒）；超时自动 pass/跳过，避免纯人局卡死。 */
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS ?? 30_000);

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
  /** 倍数状态（底分 1，每出一个炸弹/王炸 ×2；明牌/加倍另计）。 */
  mult: MultiplierState = createMultiplier();
  result: GameResult | null = null;
  /** 出牌/过牌历史，供 DouZero 适配层构造观测状态。 */
  playHistory: BotPlayHistoryEntry[] = [];
  /** 机器人思考中（已广播 snapshot，动作尚未执行）。 */
  botThinkingSeat: Seat | null = null;
  /** 各座位上次成功发送表情/快捷语的时间戳（限频）。 */
  private socialLastSentAt: [number, number, number] = [0, 0, 0];
  /** 地主是否已明牌。 */
  landlordRevealed = false;
  /** 已选择加倍的座位。 */
  doubledSeats: Seat[] = [];
  /** DOUBLING 阶段尚未表态的座位。 */
  pendingDoubleSeats: Seat[] = [];
  /** 出牌阶段炸弹/王炸翻倍次数。 */
  bombCount = 0;
  /** 明牌/加倍决策截止时间戳；null 表示无窗口。 */
  decisionDeadlineAt: number | null = null;
  /** 断线真人行棋宽限截止；null 表示无需等待重连。 */
  disconnectDeadlineAt: number | null = null;

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

  /**
   * 断线真人恢复原座位与私有手牌。
   * 优先 guestId（含仍 connected 的刷新接管，避免旧 socket 未断开导致 room_full）；
   * 否则回退同昵称断线座位（兼容旧客户端）。
   */
  reconnectHuman(
    displayName: string,
    guestId?: string,
    avatarId?: string,
    beans = 1000,
  ): { seat: Seat; result: ActionResult } | null {
    const trimmed = displayName.trim();
    const gid = guestId?.trim() || '';
    const findSeat = (pred: (p: NonNullable<(typeof this.players)[number]>) => boolean): number =>
      this.players.findIndex((p) => p !== null && !p.isBot && pred(p));

    let idx = -1;
    if (gid) {
      // 1) 已标记断线的同 guest
      idx = findSeat((p) => !p.connected && p.guestId === gid);
      // 2) 刷新竞态：旧连接尚未 disconnect，仍允许同 guest 接管座位
      if (idx === -1) idx = findSeat((p) => p.guestId === gid);
    }
    if (idx === -1 && trimmed) {
      idx = findSeat((p) => !p.connected && p.displayName === trimmed);
    }
    if (idx === -1) return null;

    const seat = idx as Seat;
    const p = this.players[seat]!;
    p.connected = true;
    if (trimmed) p.displayName = trimmed;
    if (avatarId) p.avatarId = avatarId;
    if (gid) p.guestId = gid;
    this.disconnectDeadlineAt = null;
    const events: RoomEvent[] = [
      {
        scope: { seat },
        event: {
          type: 'you_joined',
          seat,
          roomId: this.roomId,
          guestId: p.guestId ?? guestId ?? `legacy-${seat}`,
          beans,
        },
      },
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
    this.armDisconnectGraceIfNeeded();
    return [{ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } }];
  }

  // ---------------- 房间 / 开局 ----------------

  /** 真人加入，占第一个空座位。 */
  addHuman(opts: {
    displayName: string;
    guestId: string;
    avatarId: string;
    beans: number;
  }): ActionResult {
    if (this.phase !== GamePhase.WAITING) return err('invalid_action_for_phase', '对局已开始，不能加入');
    const idx = this.players.findIndex((p) => p === null);
    if (idx === -1) return err('room_full', '房间已满（3/3）');
    const seat = idx as Seat;
    this.players[seat] = {
      seat,
      displayName: opts.displayName.trim() || `玩家${seat + 1}`,
      avatarId: opts.avatarId || 'av-1',
      guestId: opts.guestId,
      isBot: false,
      connected: true,
      role: undefined,
      hand: [],
    };
    // 首位真人即为房主（创建房间者）
    if (this.hostSeat === null) this.hostSeat = seat;
    return ok([
      {
        scope: { seat },
        event: {
          type: 'you_joined',
          seat,
          roomId: this.roomId,
          guestId: opts.guestId,
          beans: opts.beans,
        },
      },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ]);
  }

  /**
   * 开局：fillBots=true 时不足 3 人补机器人；默认 fillBots=false 要求 3 名真人（纯人对战）。
   * 产品上由房主触发或满 3 真人自动开局；引擎允许全机器人局，便于联机/自动化测试。
   */
  async start(fillBots = false): Promise<ActionResult> {
    if (this.phase === GamePhase.SETTLED) return this.dealAndBeginBid(); // 再来一局：保留座位重新发牌
    if (this.phase !== GamePhase.WAITING) return err('invalid_action_for_phase', '当前阶段不能开局');
    if (fillBots) {
      this.fillBots();
    } else if (this.humanCount < 3) {
      return err('not_enough_players', '人数不足 3 人，等人加入或选择补机器人');
    }
    return this.dealAndBeginBid();
  }

  /**
   * 私房满 3 真人且仍在 WAITING 时自动纯人开局。
   * 返回 null 表示未触发（未满员或已开局）。
   */
  async maybeAutoStartWhenFull(): Promise<ActionResult | null> {
    if (this.phase !== GamePhase.WAITING) return null;
    if (this.humanCount < 3) return null;
    return this.start(false);
  }

  private fillBots(): void {
    for (const seat of SEATS) {
      if (this.players[seat] === null) {
        this.botCounter += 1;
        this.players[seat] = {
          seat,
          displayName: botName(this.botCounter),
          avatarId: 'bot',
          isBot: true,
          connected: true,
          role: undefined,
          hand: [],
        };
      }
    }
  }

  private async dealAndBeginBid(): Promise<ActionResult> {
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
    this.landlordRevealed = false;
    this.doubledSeats = [];
    this.pendingDoubleSeats = [];
    this.bombCount = 0;
    this.decisionDeadlineAt = null;

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

    return ok(events);
  }

  // ---------------- 叫地主（抢地主，规则在 game-rules.resolveBidding） ----------------

  async handleBid(seat: Seat, choice: BidChoice): Promise<ActionResult> {
    if (this.phase !== GamePhase.BIDDING || !this.bid) return err('invalid_action_for_phase', '当前不是叫地主阶段');
    const b = this.bid;
    if (seat !== b.order[b.index]) return err('not_your_turn', '还没轮到你叫');
    if (choice !== 'claim' && choice !== 'pass') return err('invalid_bid', '叫地主动作必须是 claim 或 pass');

    const events: RoomEvent[] = this.iBid(seat, choice);
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
    this.landlordRevealed = false;
    this.doubledSeats = [];
    this.pendingDoubleSeats = [];
    this.bombCount = 0;
    // 进入明牌窗口（可选）；结束后再加倍，再出牌
    this.phase = GamePhase.REVEALING;
    this.turnSeat = seat;
    this.leaderSeat = seat;
    this.lastPlay = null;
    this.passCount = 0;
    this.armDecisionDeadline();
    return [
      // 地主的新手牌（20 张）私发
      { scope: { seat }, event: { type: 'dealt', hand: this.players[seat]!.hand.map((c) => c.id) } },
      { scope: 'room', event: { type: 'landlord', seat, bottom: this.bottom.map((c) => c.id) } },
      { scope: 'room', event: { type: 'phase', phase: GamePhase.REVEALING } },
      { scope: 'room', event: { type: 'turn', seat } },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ];
  }

  private armDecisionDeadline(now = Date.now()): void {
    this.decisionDeadlineAt = now + Math.max(0, DECISION_WINDOW_MS);
  }

  /** 剩余决策毫秒；无窗口时返回 null。 */
  decisionRemainingMs(now = Date.now()): number | null {
    if (this.decisionDeadlineAt == null) return null;
    return Math.max(0, this.decisionDeadlineAt - now);
  }

  /**
   * 明牌/加倍窗口超时：自动跳过未决策项并推进。
   * transport 在截止时调用；单测可直接调用。
   */
  expireDecisionWindow(now = Date.now()): RoomEvent[] {
    if (this.decisionDeadlineAt == null || now < this.decisionDeadlineAt) return [];
    if (this.phase === GamePhase.REVEALING && this.landlordSeat !== null) {
      return this.iReveal(this.landlordSeat, false);
    }
    if (this.phase === GamePhase.DOUBLING) {
      const events: RoomEvent[] = [];
      for (const seat of [...this.pendingDoubleSeats]) {
        events.push(...this.iDouble(seat, false));
      }
      return events;
    }
    return [];
  }

  /**
   * 当前需要行动且已断线的真人座位（叫/明牌/加倍/出牌）。
   * 用于 30s 重连宽限；超时后自动推进，避免纯人局卡死。
   */
  pendingDisconnectedHumanSeat(): Seat | null {
    if (this.phase === GamePhase.SETTLED || this.phase === GamePhase.WAITING) return null;
    if (this.phase === GamePhase.BIDDING && this.bid) {
      const seat = this.bid.order[this.bid.index]!;
      const p = this.players[seat];
      return p && !p.isBot && !p.connected ? seat : null;
    }
    if (this.phase === GamePhase.REVEALING && this.landlordSeat !== null) {
      const p = this.players[this.landlordSeat];
      return p && !p.isBot && !p.connected ? this.landlordSeat : null;
    }
    if (this.phase === GamePhase.DOUBLING) {
      for (const seat of this.pendingDoubleSeats) {
        const p = this.players[seat];
        if (p && !p.isBot && !p.connected) return seat;
      }
      return null;
    }
    if (this.phase === GamePhase.PLAYING && this.turnSeat !== null) {
      const p = this.players[this.turnSeat];
      return p && !p.isBot && !p.connected ? this.turnSeat : null;
    }
    return null;
  }

  /** 若轮到断线真人，启动/保持 30s 宽限；否则清除。 */
  armDisconnectGraceIfNeeded(now = Date.now()): void {
    if (this.pendingDisconnectedHumanSeat() === null) {
      this.disconnectDeadlineAt = null;
      return;
    }
    if (this.disconnectDeadlineAt == null) {
      this.disconnectDeadlineAt = now + Math.max(0, RECONNECT_GRACE_MS);
    }
  }

  /** 断线宽限剩余毫秒；无需等待时返回 null。 */
  disconnectGraceRemainingMs(now = Date.now()): number | null {
    if (this.disconnectDeadlineAt == null) return null;
    return Math.max(0, this.disconnectDeadlineAt - now);
  }

  /**
   * 断线宽限到期：替断线真人自动 pass / 跳过 / 最小领出，推进局面。
   */
  expireDisconnectGrace(now = Date.now()): RoomEvent[] {
    if (this.disconnectDeadlineAt == null || now < this.disconnectDeadlineAt) return [];
    const seat = this.pendingDisconnectedHumanSeat();
    this.disconnectDeadlineAt = null;
    if (seat === null) return [];

    if (this.phase === GamePhase.BIDDING) {
      return this.iBid(seat, 'pass');
    }
    if (this.phase === GamePhase.REVEALING) {
      return this.iReveal(seat, false);
    }
    if (this.phase === GamePhase.DOUBLING) {
      return this.iDouble(seat, false);
    }
    if (this.phase === GamePhase.PLAYING) {
      const p = this.players[seat];
      if (!p) return [];
      if (this.lastPlay === null) {
        const cards = smallestFallback(p.hand);
        if (cards.length === 0) return [];
        return this.iPlay(seat, cards);
      }
      return this.iPass(seat);
    }
    return [];
  }

  async handleReveal(seat: Seat, reveal: boolean): Promise<ActionResult> {
    if (this.phase !== GamePhase.REVEALING) return err('invalid_action_for_phase', '当前不是明牌阶段');
    if (seat !== this.landlordSeat) return err('not_your_turn', '只有地主可以明牌');
    return ok(this.iReveal(seat, reveal));
  }

  private iReveal(seat: Seat, reveal: boolean): RoomEvent[] {
    if (reveal) {
      this.landlordRevealed = true;
      this.mult = applyReveal(this.mult);
    }
    const hand = reveal ? this.players[seat]!.hand.map((c) => c.id) : undefined;
    const events: RoomEvent[] = [
      {
        scope: 'room',
        event: {
          type: 'revealed',
          seat,
          revealed: reveal,
          hand,
          multiplier: this.mult.multiplier,
        },
      },
    ];
    events.push(...this.enterDoubling());
    return events;
  }

  private enterDoubling(): RoomEvent[] {
    this.phase = GamePhase.DOUBLING;
    this.pendingDoubleSeats = [...SEATS];
    this.turnSeat = null;
    this.armDecisionDeadline();
    return [
      { scope: 'room', event: { type: 'phase', phase: GamePhase.DOUBLING } },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ];
  }

  async handleDouble(seat: Seat, doubled: boolean): Promise<ActionResult> {
    if (this.phase !== GamePhase.DOUBLING) return err('invalid_action_for_phase', '当前不是加倍阶段');
    if (!this.pendingDoubleSeats.includes(seat)) {
      return err('invalid_action_for_phase', '你已完成加倍选择或无权加倍');
    }
    return ok(this.iDouble(seat, doubled));
  }

  private iDouble(seat: Seat, doubled: boolean): RoomEvent[] {
    this.pendingDoubleSeats = this.pendingDoubleSeats.filter((s) => s !== seat);
    if (doubled) {
      this.doubledSeats.push(seat);
      this.mult = applyDouble(this.mult);
    }
    const events: RoomEvent[] = [
      {
        scope: 'room',
        event: { type: 'doubled', seat, doubled, multiplier: this.mult.multiplier },
      },
    ];
    if (this.pendingDoubleSeats.length === 0) {
      events.push(...this.beginPlaying());
    } else {
      events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    }
    return events;
  }

  private beginPlaying(): RoomEvent[] {
    const seat = this.landlordSeat!;
    this.phase = GamePhase.PLAYING;
    this.turnSeat = seat;
    this.leaderSeat = seat;
    this.lastPlay = null;
    this.passCount = 0;
    this.decisionDeadlineAt = null;
    return [
      { scope: 'room', event: { type: 'phase', phase: GamePhase.PLAYING } },
      { scope: 'room', event: { type: 'turn', seat } },
      { scope: 'room', event: { type: 'snapshot', state: this.snapshot() } },
    ];
  }

  // ---------------- 出牌回合（合法性走 game-rules，倍数走 multiplier） ----------------

  async handlePlay(seat: Seat, cardIds: readonly string[]): Promise<ActionResult> {
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
    if (isDoublingPlay(hand)) this.bombCount += 1;
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

  async handlePass(seat: Seat): Promise<ActionResult> {
    if (this.phase !== GamePhase.PLAYING) return err('invalid_action_for_phase', '当前不是出牌阶段');
    if (this.turnSeat !== seat) return err('not_your_turn', '还没轮到你');
    if (this.lastPlay === null) return err('must_play_when_leading', '你领出，必须出牌，不能 pass');

    const events: RoomEvent[] = this.iPass(seat);
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
    const remainingHands: [string[], string[], string[]] = [
      this.players[0]?.hand.map((c) => c.id) ?? [],
      this.players[1]?.hand.map((c) => c.id) ?? [],
      this.players[2]?.hand.map((c) => c.id) ?? [],
    ];
    const result: GameResult = {
      winnerSide: s.winnerSide,
      winnerSeat,
      landlordSeat,
      unit,
      multiplier: this.mult.multiplier,
      multiplierBreakdown: this.breakdown(),
      scores: s.scores,
      remainingHands,
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

  /** 当前是否轮到机器人且需要推进（叫牌 / 明牌 / 加倍 / 出牌）。 */
  private pendingBotSeat(): Seat | null {
    if (this.phase === GamePhase.SETTLED) return null;
    if (this.phase === GamePhase.BIDDING && this.bid) {
      const seat = this.bid.order[this.bid.index]!;
      const p = this.players[seat];
      return p?.isBot ? seat : null;
    }
    if (this.phase === GamePhase.REVEALING && this.landlordSeat !== null) {
      const p = this.players[this.landlordSeat];
      return p?.isBot ? this.landlordSeat : null;
    }
    if (this.phase === GamePhase.DOUBLING) {
      for (const seat of this.pendingDoubleSeats) {
        const p = this.players[seat];
        if (p?.isBot) return seat;
      }
      return null;
    }
    if (this.phase === GamePhase.PLAYING && this.turnSeat !== null) {
      const p = this.players[this.turnSeat];
      return p?.isBot ? this.turnSeat : null;
    }
    return null;
  }

  private async runOneBotAction(): Promise<RoomEvent[]> {
    if (this.phase === GamePhase.BIDDING && this.bid) {
      const seat = this.bid.order[this.bid.index]!;
      const p = this.players[seat];
      if (!p || !p.isBot) return [];
      return this.iBid(seat, botBid(p.hand));
    }
    if (this.phase === GamePhase.REVEALING && this.landlordSeat !== null) {
      const seat = this.landlordSeat;
      const p = this.players[seat];
      if (!p || !p.isBot) return [];
      return this.iReveal(seat, botReveal(p.hand));
    }
    if (this.phase === GamePhase.DOUBLING) {
      const seat = this.pendingDoubleSeats.find((s) => this.players[s]?.isBot);
      if (seat === undefined) return [];
      const p = this.players[seat]!;
      return this.iDouble(seat, botDouble(p.hand, seat === this.landlordSeat));
    }
    if (this.phase === GamePhase.PLAYING) {
      const seat = this.turnSeat;
      if (seat === null) return [];
      const p = this.players[seat];
      if (!p || !p.isBot) return [];
      const prev = this.lastPlay ? this.lastPlay.hand : null;
      const cards = await choosePlayWithDouZero(
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
      if (cards && cards.length > 0) return this.iPlay(seat, cards);
      if (this.lastPlay === null) return this.iPlay(seat, smallestFallback(p.hand));
      return this.iPass(seat);
    }
    return [];
  }

  /**
   * 推进所有机器人回合。`emit` 存在时按步下发（思考 snapshot → 延迟 → 动作），供 Socket 层实时展示；
   * 测试可省略 emit 并设 BOT_THINK_MS_MIN=0 快速跑完。
   */
  async drainBots(emit?: (events: RoomEvent[]) => void | Promise<void>): Promise<RoomEvent[]> {
    const collected: RoomEvent[] = [];
    const flush = async (batch: RoomEvent[]) => {
      if (batch.length === 0) return;
      collected.push(...batch);
      if (emit) await emit(batch);
    };

    for (let guard = 0; guard < BOT_LOOP_GUARD; guard++) {
      const seat = this.pendingBotSeat();
      if (seat === null) break;

      this.botThinkingSeat = seat;
      await flush([{ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } }]);
      await sleep(botThinkDelayMs());

      this.botThinkingSeat = null;
      const step = await this.runOneBotAction();
      await flush(step);
      if (step.length === 0) break;
    }
    return collected;
  }

  // ---------------- 路由 / 视图 ----------------

  /** 按动作类型路由（join 由 registry 处理，这里只处理座位绑定的动作）。 */
  async handleAction(seat: Seat, action: ClientAction): Promise<ActionResult> {
    switch (action.type) {
      case 'bid':
        return this.handleBid(seat, action.choice);
      case 'reveal':
        return this.handleReveal(seat, action.reveal);
      case 'double':
        return this.handleDouble(seat, action.double);
      case 'play':
        return this.handlePlay(seat, action.cards);
      case 'pass':
        return this.handlePass(seat);
      case 'start':
        if (this.hostSeat !== null && seat !== this.hostSeat) {
          return err('not_host', '只有房主可以开局');
        }
        return this.start(action.fillBots ?? false);
      case 'hint':
        return this.handleHint(seat);
      case 'social':
        return this.handleSocial(seat, action.kind, action.id);
      default:
        return err('invalid_action_for_phase', `当前阶段不支持动作：${(action as { type: string }).type}`);
    }
  }

  /**
   * 局内表情 / 固定快捷语：白名单校验 + 座位限频后房间广播。
   * 不改变牌局状态；叫分/出牌/结算阶段可用。
   */
  private handleSocial(
    seat: Seat,
    kind: SocialKind,
    id: SocialEmoteId | SocialPhraseId,
  ): ActionResult {
    if (
      this.phase !== GamePhase.BIDDING &&
      this.phase !== GamePhase.REVEALING &&
      this.phase !== GamePhase.DOUBLING &&
      this.phase !== GamePhase.PLAYING &&
      this.phase !== GamePhase.SETTLED
    ) {
      return err('invalid_action_for_phase', '当前阶段不能发送表情/快捷语');
    }
    const p = this.players[seat];
    if (!p || p.isBot) return err('illegal_play', '座位无玩家');
    if (kind === 'emote') {
      if (!isSocialEmoteId(id)) return err('invalid_social', '未知表情');
    } else if (kind === 'phrase') {
      if (!isSocialPhraseId(id)) return err('invalid_social', '未知快捷语');
    } else {
      return err('invalid_social', '未知社交类型');
    }
    const now = Date.now();
    const last = this.socialLastSentAt[seat] ?? 0;
    if (now - last < SOCIAL_COOLDOWN_MS) {
      return err('rate_limited', `发送过快，请稍候 ${Math.ceil((SOCIAL_COOLDOWN_MS - (now - last)) / 1000)} 秒`);
    }
    this.socialLastSentAt[seat] = now;
    return ok([
      {
        scope: 'room',
        event: { type: 'social', seat, kind, id },
      },
    ]);
  }

  /**
   * AI 出牌提示：私发给请求者，返回按模型分从高到低的合法出牌建议。
   * 当前实现返回 DouZero argmax（top-1）；top-N 带分扩展见 LRM-135（@actor_9）。
   * 不改变对局状态，仅基于当前局面计算并私发；建议来自规则合法动作，安全链不变。
   */
  private async handleHint(seat: Seat): Promise<ActionResult> {
    if (this.phase !== GamePhase.PLAYING || this.turnSeat !== seat) {
      return err('not_your_turn', '出牌提示仅在自己的出牌回合可用');
    }
    const p = this.players[seat];
    if (!p) return err('illegal_play', '座位无玩家');
    const prev = this.lastPlay ? this.lastPlay.hand : null;
    const suggestions = (await rankPlaySuggestions(
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
      HINT_TOP_N,
    )).map((cs) => cs.map((c) => c.id));
    return ok([{ scope: { seat }, event: { type: 'hint', suggestions } }]);
  }

  private breakdown(): MultiplierBreakdown {
    return {
      base: this.mult.base,
      reveal: this.landlordRevealed,
      doubleCount: this.doubledSeats.length,
      doubleSeats: [...this.doubledSeats],
      bombCount: this.bombCount,
      spring: false,
      current: this.mult.multiplier,
    };
  }

  /** 生成全量公开快照（不含任何玩家手牌；底牌未公开前不下发；明牌座位例外）。 */
  snapshot(): GameStateSnapshot {
    const players: PlayerView[] = [];
    for (const seat of SEATS) {
      const p = this.players[seat];
      if (p) {
        const view: PlayerView = {
          seat,
          displayName: p.displayName,
          avatarId: p.avatarId,
          isBot: p.isBot,
          connected: p.connected,
          role: p.role,
          handSize: p.hand.length,
          doubled: this.doubledSeats.includes(seat),
        };
        if (this.landlordRevealed && seat === this.landlordSeat) {
          view.openHand = p.hand.map((c) => c.id);
        }
        players.push(view);
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
      multiplierBreakdown: this.breakdown(),
      pendingDoubleSeats: this.phase === GamePhase.DOUBLING ? [...this.pendingDoubleSeats] : [],
      result: this.result,
      botThinkingSeat: this.botThinkingSeat,
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
