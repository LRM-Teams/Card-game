/**
 * 房间注册表（内存版，MVP）。
 *
 * - 管理 roomId → GameRoom。
 * - 维护 (roomId, seat) → socketId，用于把私发事件（如 dealt 手牌）送达对应真人。
 * - join：无 roomId 时新建房间；有 roomId 时只加入已存在房间。
 * - match：走 MatchQueue，满员或超时后成桌并自动开局。
 */
import { GamePhase, type Seat } from '@card-game/rules';
import { GameRoom } from './game/GameRoom';
import { createConfiguredDouZeroAdapter } from './game/douzeroAdapter';
import type { ActionResult } from './game/types';
import { IdentityStore, type GuestProfile } from './identity';
import { MatchQueue, type MatchFormed, type MatchWaiter } from './matchQueue';
import { opsLog } from './observability';

/** 房间号归一：去空白、去前缀 #（复制时常见）。 */
export function normalizeRoomId(roomId?: string): string | undefined {
  const t = roomId?.trim().replace(/^#/, '') ?? '';
  return t || undefined;
}

export interface JoinOutcome {
  room: GameRoom;
  seat: Seat;
  result: ActionResult;
  /** create=新建私房；join=加入已有房；reconnect=断线重连 */
  kind: 'create' | 'join' | 'reconnect';
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
    const wantedId = normalizeRoomId(roomId);
    let room = wantedId ? this.rooms.get(wantedId) : undefined;
    if (wantedId && !room) {
      return {
        room: new GameRoom(wantedId, this.aiAdapter),
        seat: -1 as Seat,
        result: {
          ok: false,
          code: 'room_not_found',
          message: '房间不存在，请检查房间号或重新获取分享链接',
        },
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
      // 对局中三席都占满：优先明确「已开局」而非笼统满员
      if (room.phase !== GamePhase.WAITING) {
        return {
          room,
          seat: -1 as Seat,
          result: {
            ok: false,
            code: 'game_already_started',
            message: '对局已开始，无法加入；请让房主新建房间再分享',
          },
          kind,
        };
      }
      return {
        room,
        seat: -1 as Seat,
        result: { ok: false, code: 'room_full', message: '房间已满（3/3），请让房主新建房间再分享' },
        kind,
      };
    }
    const result = room.addHuman({
      displayName: profile.displayName,
      guestId: profile.guestId,
      avatarId: profile.avatarId,
      beans: profile.beans,
    });
    if (!result.ok) return { room, seat: -1 as Seat, result, kind };
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
