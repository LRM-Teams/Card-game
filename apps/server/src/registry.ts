/**
 * 房间注册表（内存版，MVP）。
 *
 * - 管理 roomId → GameRoom。
 * - 维护 (roomId, seat) → socketId，用于把私发事件（如 dealt 手牌）送达对应真人。
 * - join：无 roomId 时新建房间；有 roomId 时只加入已存在房间。
 * - match：走 MatchQueue，满员或超时后成桌并自动开局。
 */
import type { Seat } from '@card-game/rules';
import { GameRoom } from './game/GameRoom';
import { createConfiguredDouZeroAdapter } from './game/douzeroAdapter';
import type { ActionResult } from './game/types';
import { IdentityStore, type GuestProfile } from './identity';
import { MatchQueue, type MatchFormed, type MatchWaiter } from './matchQueue';

export interface JoinOutcome {
  room: GameRoom;
  seat: Seat;
  result: ActionResult;
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

  constructor() {
    this.matchQueue = new MatchQueue({
      formRoom: (humans) => this.formMatchRoom(humans),
      onFormed: (formed) => this.onMatchFormed?.(formed),
      fillAfterMs: 2000,
    });
  }

  /** transport 注入：匹配成桌后广播事件 / 绑定 socket。 */
  setMatchFormedHandler(handler: (formed: MatchFormed) => void): void {
    this.onMatchFormed = handler;
  }

  /** 真人加入；返回落座的房间/座位/事件流。失败时 seat=-1、result 为错误。 */
  join(
    profile: GuestProfile,
    socketId: string,
    roomId?: string,
  ): JoinOutcome {
    let room = roomId ? this.rooms.get(roomId) : undefined;
    if (roomId && !room) {
      return {
        room: new GameRoom(roomId, this.aiAdapter),
        seat: -1 as Seat,
        result: { ok: false, code: 'not_in_room', message: '房间不存在，请检查房间号' },
      };
    }
    if (!room) {
      const id = `room-${(++this.seq).toString(36)}`;
      room = new GameRoom(id, this.aiAdapter);
      this.rooms.set(id, room);
    }

    const reconnect = room.reconnectHuman(
      profile.name,
      profile.guestId,
      profile.avatarId,
      profile.beans,
    );
    if (reconnect) {
      this.bindSeat(room.roomId, reconnect.seat, socketId);
      return { room, seat: reconnect.seat, result: reconnect.result };
    }

    const seat = room.firstEmptySeat();
    if (seat === null) {
      return { room, seat: -1 as Seat, result: { ok: false, code: 'room_full', message: '房间已满（3/3）' } };
    }
    const result = room.addHuman({
      name: profile.name,
      guestId: profile.guestId,
      avatarId: profile.avatarId,
      beans: profile.beans,
    });
    if (!result.ok) return { room, seat: -1 as Seat, result };
    this.bindSeat(room.roomId, seat, socketId);
    return { room, seat, result };
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
    const seats: Array<{ socketId: string; seat: Seat; result: ActionResult }> = [];
    for (const h of humans) {
      const seat = room.firstEmptySeat();
      if (seat === null) break;
      const result = room.addHuman({
        name: h.profile.name,
        guestId: h.profile.guestId,
        avatarId: h.profile.avatarId,
        beans: h.profile.beans,
      });
      if (!result.ok) continue;
      this.bindSeat(room.roomId, seat, h.socketId);
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
    if (!room) return { ok: false, code: 'not_in_room', message: '房间不存在' };
    return { ok: true, events: room.markDisconnected(seat) };
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
