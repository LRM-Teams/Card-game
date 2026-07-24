/**
 * 房间注册表（内存版，MVP）。
 *
 * - 管理 roomId → GameRoom。
 * - 维护 (roomId, seat) → socketId，用于把私发事件（如 dealt 手牌）送达对应真人。
 * - join：无 roomId 时新建房间；有 roomId 时只加入已存在房间。
 * - match：走 MatchQueue，满员或超时后成桌并自动开局。
 */
import type { Seat } from '@card-game/rules';
import { GamePhase } from '@card-game/rules';
import { GameRoom } from './game/GameRoom';
import { createConfiguredDouZeroAdapter } from './game/douzeroAdapter';
import type { ActionResult } from './game/types';
import { IdentityStore, type GuestProfile } from './identity';
import {
  MatchQueue,
  resolveMatchFillAfterMs,
  type MatchFormed,
  type MatchQueueStatus,
  type MatchWaiter,
} from './matchQueue';
import { opsLog } from './observability';

/** 房间号规范化：去空白、去前导 #（好友房链接复制常见）。 */
export function normalizeRoomId(roomId?: string): string | undefined {
  if (roomId == null) return undefined;
  const trimmed = roomId.trim().replace(/^#+/, '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface JoinOutcome {
  room: GameRoom;
  seat: Seat;
  result: ActionResult;
  /** create=新建私房；join=加入已有房；reconnect=断线重连 */
  kind: 'create' | 'join' | 'reconnect';
}

export interface RoomRegistryOptions {
  /** 快速匹配不足 3 真人时等待多久再补机（毫秒）；默认 20s / MATCH_FILL_AFTER_MS */
  matchFillAfterMs?: number;
}

export class RoomRegistry {
  private rooms = new Map<string, GameRoom>();
  /** roomId → (seat → socketId) */
  private seatSockets = new Map<string, Map<Seat, string>>();
  private seq = 0;
  private readonly aiAdapter = createConfiguredDouZeroAdapter();
  readonly identities = new IdentityStore();
  private matchQueue: MatchQueue;
  private onMatchFormed: ((formed: MatchFormed) => void) | null = null;
  private onMatchQueueUpdate: (() => void) | null = null;

  constructor(opts?: RoomRegistryOptions) {
    this.matchQueue = new MatchQueue({
      formRoom: (humans) => this.formMatchRoom(humans),
      onFormed: (formed) => this.onMatchFormed?.(formed),
      onQueueUpdate: () => this.onMatchQueueUpdate?.(),
      fillAfterMs: resolveMatchFillAfterMs(opts?.matchFillAfterMs),
    });
  }

  /** 当前快速匹配补机超时（毫秒）。 */
  get matchFillAfterMs(): number {
    return this.matchQueue.fillTimeoutMs;
  }

  /** transport 注入：匹配成桌后广播事件 / 绑定 socket。 */
  setMatchFormedHandler(handler: (formed: MatchFormed) => void): void {
    this.onMatchFormed = handler;
  }

  /** transport 注入：队列人数 / 倒计时变更时广播 matching。 */
  setMatchQueueUpdateHandler(handler: () => void): void {
    this.onMatchQueueUpdate = handler;
  }

  getMatchQueueStatus(): MatchQueueStatus | null {
    return this.matchQueue.getQueueStatus();
  }

  getMatchingSocketIds(): string[] {
    return this.matchQueue.waiterSocketIds();
  }

  /** 进房失败写 [ops] room.join_reject，便于 grep 错误路径。 */
  private logJoinReject(
    roomId: string,
    code: string,
    phase: string | undefined,
    kind: JoinOutcome['kind'],
  ): void {
    opsLog({
      event: 'room.join_reject',
      roomId,
      code,
      phase,
      kind,
      humanCount: this.rooms.get(roomId)?.humanCount,
      playerCount: this.rooms.get(roomId)?.playerCount,
    });
  }

  /** 真人加入；返回落座的房间/座位/事件流。失败时 seat=-1、result 为错误。 */
  join(
    profile: GuestProfile,
    socketId: string,
    roomId?: string,
  ): JoinOutcome {
    const normalizedRoomId = normalizeRoomId(roomId);
    let room = normalizedRoomId ? this.rooms.get(normalizedRoomId) : undefined;
    if (normalizedRoomId && !room) {
      this.logJoinReject(normalizedRoomId, 'room_not_found', undefined, 'join');
      return {
        room: new GameRoom(normalizedRoomId, this.aiAdapter),
        seat: -1 as Seat,
        result: { ok: false, code: 'room_not_found', message: '房间不存在，请检查房间号' },
        kind: 'join',
      };
    }
    let kind: JoinOutcome['kind'] = room ? 'join' : 'create';
    if (!room) {
      const id = `room-${(++this.seq).toString(36)}`;
      room = new GameRoom(id, this.aiAdapter);
      this.rooms.set(id, room);
      opsLog({
        event: 'room.create',
        roomId: id,
        phase: room.phase,
        humanCount: 0,
        playerCount: 0,
      });
    }

    const reconnect = room.reconnectHuman(
      profile.displayName,
      profile.guestId,
      profile.avatarId,
      profile.beans,
    );
    if (reconnect) {
      this.bindSeat(room.roomId, reconnect.seat, socketId);
      opsLog({
        event: 'player.reconnect',
        roomId: room.roomId,
        phase: room.phase,
        seat: reconnect.seat,
        humanCount: room.humanCount,
        playerCount: room.playerCount,
      });
      return { room, seat: reconnect.seat, result: reconnect.result, kind: 'reconnect' };
    }

    const seat = room.firstEmptySeat();
    if (seat === null) {
      // 满员：对局中优先提示「已开局」，等待态提示「已满」
      if (room.phase !== GamePhase.WAITING) {
        this.logJoinReject(room.roomId, 'game_already_started', room.phase, kind);
        return {
          room,
          seat: -1 as Seat,
          result: { ok: false, code: 'game_already_started', message: '对局已开始，不能加入' },
          kind,
        };
      }
      this.logJoinReject(room.roomId, 'room_full', room.phase, kind);
      return {
        room,
        seat: -1 as Seat,
        result: { ok: false, code: 'room_full', message: '房间已满（3/3）' },
        kind,
      };
    }
    const result = room.addHuman({
      displayName: profile.displayName,
      guestId: profile.guestId,
      avatarId: profile.avatarId,
      beans: profile.beans,
    });
    if (!result.ok) {
      this.logJoinReject(room.roomId, result.code, room.phase, kind);
      return { room, seat: -1 as Seat, result, kind };
    }
    this.bindSeat(room.roomId, seat, socketId);
    opsLog({
      event: 'room.join',
      roomId: room.roomId,
      phase: room.phase,
      seat,
      humanCount: room.humanCount,
      playerCount: room.playerCount,
    });
    return { room, seat, result, kind };
  }

  /** 进入快速匹配；由 MatchQueue 异步成桌。 */
  enqueueMatch(profile: GuestProfile, socketId: string): void {
    this.matchQueue.enqueue({
      socketId,
      profile,
      enqueuedAt: Date.now(),
    });
  }

  cancelMatch(socketId: string): boolean {
    return this.matchQueue.cancel(socketId);
  }

  isMatching(socketId: string): boolean {
    return this.matchQueue.hasSocket(socketId);
  }

  private formMatchRoom(humans: MatchWaiter[]): {
    room: GameRoom;
    seats: Array<{ socketId: string; seat: Seat; result: ActionResult }>;
  } {
    const id = `match-${(++this.seq).toString(36)}`;
    const room = new GameRoom(id, this.aiAdapter);
    this.rooms.set(id, room);
    opsLog({
      event: 'room.create',
      roomId: id,
      phase: room.phase,
      humanCount: 0,
      playerCount: 0,
      match: true,
    });
    const seats: Array<{ socketId: string; seat: Seat; result: ActionResult }> = [];
    for (const h of humans) {
      const seat = room.firstEmptySeat();
      if (seat === null) break;
      const result = room.addHuman({
        displayName: h.profile.displayName,
        guestId: h.profile.guestId,
        avatarId: h.profile.avatarId,
        beans: h.profile.beans,
      });
      if (!result.ok) continue;
      this.bindSeat(room.roomId, seat, h.socketId);
      opsLog({
        event: 'room.join',
        roomId: room.roomId,
        phase: room.phase,
        seat,
        humanCount: room.humanCount,
        playerCount: room.playerCount,
        match: true,
      });
      seats.push({ socketId: h.socketId, seat, result });
    }
    return { room, seats };
  }

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  bindSeat(roomId: string, seat: Seat, socketId: string): void {
    let m = this.seatSockets.get(roomId);
    if (!m) {
      m = new Map();
      this.seatSockets.set(roomId, m);
    }
    m.set(seat, socketId);
  }

  /** 某座位当前绑定的 socketId（机器人 / 未连接返回 undefined）。 */
  socketOf(roomId: string, seat: Seat): string | undefined {
    return this.seatSockets.get(roomId)?.get(seat);
  }

  disconnect(roomId: string, seat: Seat, socketId: string): ActionResult {
    const sockets = this.seatSockets.get(roomId);
    if (sockets?.get(seat) === socketId) sockets.delete(seat);
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, code: 'room_not_found', message: '房间不存在' };
    const events = room.markDisconnected(seat);
    if (events.length > 0) {
      opsLog({
        event: 'player.disconnect',
        roomId,
        phase: room.phase,
        seat,
        humanCount: room.humanCount,
        playerCount: room.playerCount,
      });
    }
    return { ok: true, events };
  }

  /** 已对哪个 GameResult 结算过豆子（防 drain 重复加减）。 */
  private beansApplied = new WeakSet<object>();

  /** 结算后把得分写入游客豆子；返回更新后的 (guestId → beans)。同一 result 只结算一次。 */
  applySettlementBeans(room: GameRoom): Map<string, number> {
    const updated = new Map<string, number>();
    const result = room.result;
    if (!result || this.beansApplied.has(result)) return updated;
    this.beansApplied.add(result);
    const scores = result.scores;
    for (const seat of [0, 1, 2] as Seat[]) {
      const p = room.players[seat];
      if (!p || p.isBot || !p.guestId) continue;
      const beans = this.identities.applyScore(p.guestId, scores[seat] ?? 0);
      updated.set(p.guestId, beans);
    }
    return updated;
  }
}
