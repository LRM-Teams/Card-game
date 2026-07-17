/**
 * GameRoom —— 服务端权威对局状态机。
 *
 * 规则一律调用 @card-game/rules，服务端不另写：
 * - 叫/抢地主：多轮 call→grab→反抢，收口判定 `isBiddingComplete`、结算 `resolveBidding`（最后 claim 者当地主）。
 * - 倍数：`createMultiplier` → `applyGrabClaims`（抢地主 2^抢次数）→ `applyDoubles`（加倍环节）→ 出牌 `applyPlay`（炸弹/王炸 ×2）→ `unitScore`。
 * - 胜负/结算：`settle({ landlord, winnerSeat, unit })`。
 * - 地主拿底牌：`withBottom`。
 * - 出牌合法性：`canPlay` / `identifyHand`。
 *
 * 状态机：WAITING → DEALING → BIDDING → DOUBLING → PLAYING → SETTLED。
 * BIDDING 是多轮：首叫后转抢，抢过可被反抢，直到一圈无人再抢（`isBiddingComplete` 收口）。
 * DOUBLING：地主敲定、底牌公开后，地主+两农民依次选 加倍/超级加倍/不加倍，连乘进倍数再开打。
 * 真人不足时补机器人到 3 人；机器人用 bot.ts 的最小合法 AI 自动行棋。
 * 纯逻辑：不依赖 socket.io，可被 transport 和单测直接驱动。
 *
 * 每个公开 handle* 方法做"校验 + 推进"，返回 ActionResult（事件流 or 错误码）。
 * 事件流里的 scope 决定下发范围：'room' 广播，{seat} 仅私发该座位。
 */
import {
  applyDoubles,
  applyGrabClaims,
  applyPlay,
  canPlay,
  createMultiplier,
  deal,
  GamePhase,
  identifyHand,
  isBiddingComplete,
  resolveBidding,
  settle,
  sortCards,
  unitScore,
  withBottom,
} from '@card-game/rules';
import type {
  BidChoice,
  BidRound,
  Card,
  ClientAction,
  DoubleChoice,
  ErrorCode,
  GameResult,
  GameStateSnapshot,
  Hand,
  MultiplierState,
  PlayerView,
  Seat,
} from '@card-game/rules';
import { botBid, botDouble, botName } from './bot';
import { choosePlayWithDouZero, rankPlaySuggestions } from './douzeroAdapter';
import type { BotPlayHistoryEntry, DouZeroBotAdapter } from './douzeroAdapter';
import type { ActionResult, BidState, DoublingState, LastPlay, PlayerState, RoomEvent } from './types';

const SEATS: readonly Seat[] = [0, 1, 2];
const MAX_REDEALS = 5;
const BOT_LOOP_GUARD = 2000;
/** AI 出牌提示一次返回的建议条数（按模型分从高到低，前端可循环切换）。 */
const HINT_TOP_N = 3;

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
  /** 加倍进行态（DOUBLING 阶段有效；其余为 null）。 */
  doubling: DoublingState | null = null;
  /** 倍数状态（底分 1；抢地主/加倍/炸弹逐步 ×2）。 */
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

    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'phase', phase: GamePhase.DEALING } }];
    for (const seat of SEATS) {
      events.push({ scope: { seat }, event: { type: 'dealt', hand: this.players[seat]!.hand.map((c) => c.id) } });
    }
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });

    // 进入叫/抢地主（多轮 call→grab→反抢，收口走 game-rules.isBiddingComplete）
    this.phase = GamePhase.BIDDING;
    this.bid = { startSeat: 0, current: 0, entries: [], redeals: 0 };
    this.turnSeat = this.bid.current;
    events.push({ scope: 'room', event: { type: 'phase', phase: GamePhase.BIDDING } });
    if (this.turnSeat !== null) {
      events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat } });
    }
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });

    events.push(...(await this.autoBots()));
    return ok(events);
  }

  // ---------------- 叫地主（抢地主，规则在 game-rules.resolveBidding） ----------------

  async handleBid(seat: Seat, choice: BidChoice): Promise<ActionResult> {
    if (this.phase !== GamePhase.BIDDING || !this.bid) return err('invalid_action_for_phase', '当前不是叫地主阶段');
    if (seat !== this.bid.current) return err('not_your_turn', '还没轮到你叫');
    if (choice !== 'claim' && choice !== 'pass') return err('invalid_bid', '叫地主动作必须是 claim 或 pass');

    const events: RoomEvent[] = this.iBid(seat, choice);
    events.push(...(await this.autoBots()));
    return ok(events);
  }

  private iBid(seat: Seat, choice: BidChoice): RoomEvent[] {
    const b = this.bid!;
    // 首个 claim 之前是「叫地主」(call)，其后是「抢地主」(grab)——供客户端选气泡文案。
    const round: BidRound = this.currentBidRound();
    b.entries.push({ seat, choice });
    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'bid', seat, choice, round } }];

    // 收口判定单一事实来源在 game-rules。
    const progress = isBiddingComplete(b.startSeat, b.entries);
    if (progress.complete) {
      if (progress.redeal || progress.landlord === null) {
        events.push(...this.redealOrForce());
      } else {
        events.push(...this.setLandlord(progress.landlord));
      }
      return events;
    }
    // 未收口：轮到下一个还欠表态的座位（call 轮下一家 / grab 轮可反抢的非地主家）。
    b.current = this.nextBidder();
    this.turnSeat = b.current;
    if (b.current !== null) events.push({ scope: 'room', event: { type: 'turn', seat: b.current } });
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    return events;
  }

  /** 当前叫抢轮次：已出现 claim → grab（抢/反抢），否则 call（叫）。 */
  private currentBidRound(): BidRound {
    return this.bid!.entries.some((e) => e.choice === 'claim') ? 'grab' : 'call';
  }

  /**
   * 下一个该表态的座位（多轮驱动，与 game-rules.isBiddingComplete 的收口口径一致）。
   * - call 轮（尚无 claim）：从上一位的下家起，找还没叫过的座位。
   * - grab 轮：从上一位的下家起，找「最后一次 claim 之后」还没表态、且非当前临时地主的座位（允许反抢）。
   */
  private nextBidder(): Seat | null {
    const entries = this.bid!.entries;
    let lastClaimIdx = -1;
    let lastClaimSeat: Seat | null = null;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i]!.choice === 'claim') {
        lastClaimIdx = i;
        lastClaimSeat = entries[i]!.seat;
      }
    }
    const lastBidder = entries.length ? entries[entries.length - 1]!.seat : null;
    const from: Seat = lastBidder === null ? this.bid!.startSeat : nextSeat(lastBidder);

    if (lastClaimSeat === null) {
      const bidded = new Set(entries.map((e) => e.seat));
      for (let k = 0; k < 3; k++) {
        const s = ((from + k) % 3) as Seat;
        if (!bidded.has(s)) return s;
      }
      return null;
    }
    const respondedAfter = new Set(
      entries.slice(lastClaimIdx + 1).filter((e) => e.seat !== lastClaimSeat).map((e) => e.seat),
    );
    for (let k = 0; k < 3; k++) {
      const s = ((from + k) % 3) as Seat;
      if (s !== lastClaimSeat && !respondedAfter.has(s)) return s;
    }
    return null;
  }

  /** 流局：未达重发上限则重发重叫；达上限强制座位 0 当地主兜底。 */
  private redealOrForce(): RoomEvent[] {
    const b = this.bid!;
    if (b.redeals < MAX_REDEALS) {
      b.redeals += 1;
      return this.redeal();
    }
    return this.setLandlord(0);
  }

  private redeal(): RoomEvent[] {
    const { hands, bottom } = deal();
    for (const seat of SEATS) this.players[seat]!.hand = sortCards(hands[seat]);
    this.bottom = bottom;
    const b = this.bid!;
    b.entries = [];
    b.current = b.startSeat;
    this.turnSeat = b.startSeat;
    const events: RoomEvent[] = [];
    for (const seat of SEATS) {
      events.push({ scope: { seat }, event: { type: 'dealt', hand: this.players[seat]!.hand.map((c) => c.id) } });
    }
    events.push({ scope: 'room', event: { type: 'turn', seat: b.startSeat } });
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    return events;
  }

  /** 地主敲定：分派身份、公开底牌、把抢地主倍数折进 mult，随后进入加倍环节（DOUBLING）。 */
  private setLandlord(seat: Seat): RoomEvent[] {
    this.landlordSeat = seat;
    for (const s of SEATS) {
      this.players[s]!.role = s === seat ? 'landlord' : 'farmer';
    }
    // 地主拿底牌（共 20 张）
    this.players[seat]!.hand = withBottom(this.players[seat]!.hand, this.bottom);
    this.bottomRevealed = true;
    // 抢地主倍数：每抢/反抢一次 ×2（规则来自 game-rules.resolveBidding.grabClaims）。
    this.mult = applyGrabClaims(this.mult, resolveBidding(this.bid?.entries ?? []).grabClaims);
    this.bid = { ...this.bid!, current: null };
    const events: RoomEvent[] = [
      // 地主的新手牌（20 张）私发
      { scope: { seat }, event: { type: 'dealt', hand: this.players[seat]!.hand.map((c) => c.id) } },
      { scope: 'room', event: { type: 'landlord', seat, bottom: this.bottom.map((c) => c.id) } },
    ];
    events.push(...this.enterDoubling(seat));
    return events;
  }

  // ---------------- 加倍环节（地主敲定后、出牌前；倍数走 game-rules.applyDoubles） ----------------

  /** 进入 DOUBLING：地主先、两农民后，依次决定 加倍/超级加倍/不加倍。 */
  private enterDoubling(landlordSeat: Seat): RoomEvent[] {
    const order: Seat[] = [landlordSeat, ...SEATS.filter((s) => s !== landlordSeat)];
    this.doubling = { order, index: 0, choices: [] };
    this.phase = GamePhase.DOUBLING;
    this.turnSeat = order[0] ?? null;
    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'phase', phase: GamePhase.DOUBLING } }];
    if (this.turnSeat !== null) events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat } });
    events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    return events;
  }

  async handleDouble(seat: Seat, choice: DoubleChoice): Promise<ActionResult> {
    if (this.phase !== GamePhase.DOUBLING || !this.doubling) return err('invalid_double', '当前不是加倍阶段');
    const d = this.doubling;
    if (seat !== d.order[d.index]) return err('not_your_turn', '还没轮到你加倍');
    if (choice !== 'double' && choice !== 'super' && choice !== 'pass') {
      return err('invalid_double', '加倍动作必须是 double / super / pass');
    }
    const events: RoomEvent[] = this.iDouble(seat, choice);
    events.push(...(await this.autoBots()));
    return ok(events);
  }

  private iDouble(seat: Seat, choice: DoubleChoice): RoomEvent[] {
    const d = this.doubling!;
    d.choices.push({ seat, choice });
    const events: RoomEvent[] = [{ scope: 'room', event: { type: 'doubled', seat, choice } }];
    d.index += 1;
    if (d.index >= d.order.length) {
      events.push(...this.finishDoubling());
    } else {
      this.turnSeat = d.order[d.index] ?? null;
      if (this.turnSeat !== null) events.push({ scope: 'room', event: { type: 'turn', seat: this.turnSeat } });
      events.push({ scope: 'room', event: { type: 'snapshot', state: this.snapshot() } });
    }
    return events;
  }

  /** 各家加倍收齐 → 连乘进倍数 → 开打（地主领出）。 */
  private finishDoubling(): RoomEvent[] {
    const d = this.doubling!;
    this.mult = applyDoubles(this.mult, d.choices.map((c) => c.choice));
    const seat = this.landlordSeat!;
    this.phase = GamePhase.PLAYING;
    this.turnSeat = seat;
    this.leaderSeat = seat;
    this.lastPlay = null;
    this.passCount = 0;
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
    events.push(...(await this.autoBots()));
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

  async handlePass(seat: Seat): Promise<ActionResult> {
    if (this.phase !== GamePhase.PLAYING) return err('invalid_action_for_phase', '当前不是出牌阶段');
    if (this.turnSeat !== seat) return err('not_your_turn', '还没轮到你');
    if (this.lastPlay === null) return err('must_play_when_leading', '你领出，必须出牌，不能 pass');

    const events: RoomEvent[] = this.iPass(seat);
    events.push(...(await this.autoBots()));
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
  private async autoBots(): Promise<RoomEvent[]> {
    const events: RoomEvent[] = [];
    for (let guard = 0; guard < BOT_LOOP_GUARD; guard++) {
      if (this.phase === GamePhase.SETTLED) break;

      if (this.phase === GamePhase.BIDDING && this.bid) {
        const seat = this.bid.current;
        if (seat === null) break;
        const p = this.players[seat];
        if (!p || !p.isBot) break;
        // 机器人不反抢自己：已叫/抢过的座位再轮到时直接不抢，保证收口（否则确定性策略会无限反抢）。
        const alreadyClaimed = this.bid.entries.some((e) => e.seat === seat && e.choice === 'claim');
        events.push(...this.iBid(seat, alreadyClaimed ? 'pass' : botBid(p.hand)));
        continue;
      }

      if (this.phase === GamePhase.DOUBLING && this.doubling) {
        const seat = this.doubling.order[this.doubling.index]!;
        const p = this.players[seat];
        if (!p || !p.isBot) break;
        events.push(...this.iDouble(seat, botDouble(p.hand)));
        continue;
      }

      if (this.phase === GamePhase.PLAYING) {
        const seat = this.turnSeat;
        if (seat === null) break;
        const p = this.players[seat];
        if (!p || !p.isBot) break;
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
  async handleAction(seat: Seat, action: ClientAction): Promise<ActionResult> {
    switch (action.type) {
      case 'bid':
        return this.handleBid(seat, action.choice);
      case 'double':
        return this.handleDouble(seat, action.choice);
      case 'play':
        return this.handlePlay(seat, action.cards);
      case 'pass':
        return this.handlePass(seat);
      case 'start':
        return this.start(action.fillBots ?? false);
      case 'hint':
        return this.handleHint(seat);
      default:
        return err('invalid_action_for_phase', `当前阶段不支持动作：${action.type}`);
    }
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
      // 当前叫抢轮次：首个 claim 前为 call（叫地主），其后为 grab（抢地主）。
      bidRound: this.phase === GamePhase.BIDDING && this.bid ? this.currentBidRound() : null,
      // 叫/抢公开历史，逐条带轮次标签（此条之前出现过 claim 即为 grab），供客户端渲染气泡。
      bids: this.bid ? bidsWithRounds(this.bid.entries) : [],
      doubles: this.doubling ? this.doubling.choices.map((c) => ({ seat: c.seat, choice: c.choice })) : [],
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

/** 给叫抢历史逐条打轮次标签：某条之前出现过 claim 即为 grab（抢/反抢），否则 call（叫）。 */
function bidsWithRounds(
  entries: readonly { seat: Seat; choice: BidChoice }[],
): { seat: Seat; choice: BidChoice; round: BidRound }[] {
  let claimed = false;
  return entries.map((e) => {
    const round: BidRound = claimed ? 'grab' : 'call';
    if (e.choice === 'claim') claimed = true;
    return { seat: e.seat, choice: e.choice, round };
  });
}

export type { Hand };
