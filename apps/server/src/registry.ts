/**
 * 房间注册表（内存版，MVP）。
 *
 * - 管理 roomId → GameRoom。
 * - 维护 (roomId, seat) → socketId，用于把私发事件（如 dealt 手牌）送达对应真人。
 * - join：复用指定房间或新建；把真人落座到第一个空位。
 */
import type { Seat } from '@card-game/rules';
import { GameRoom } from './game/GameRoom';
import { createConfiguredDouZeroAdapter } from './game/douzeroAdapter';
import type { ActionResult } from './game/types';

function isSeat(value: unknown): value is Seat {
  return value === 0 || value === 1 || value === 2;
}

export interface JoinOutcome {
  room: GameRoom;
  seat: Seat;
  result: ActionResult;
}

export interface ReconnectOutcome {
  room?: GameRoom;
  previousSocketId?: string;
  result: ActionResult;
}

export class RoomRegistry {
  private rooms = new Map<string, GameRoom>();
  /** roomId → (seat → socketId) */
  private seatSockets = new Map<string, Map<Seat, string>>();
  private seq = 0;
  private readonly aiAdapter = createConfiguredDouZeroAdapter();

  /** 真人加入；返回落座的房间/座位/事件流。失败时 seat=-1、result 为错误。 */
  join(name: string, socketId: string, roomId?: string): JoinOutcome {
    let room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) {
      const id = roomId ?? `room-${(++this.seq).toString(36)}`;
      room = new GameRoom(id, this.aiAdapter);
      this.rooms.set(id, room);
    }

    const reconnect = room.reconnectHumanByName(name);
    if (reconnect) {
      this.bindSeat(room.roomId, reconnect.seat, socketId);
      return { room, seat: reconnect.seat, result: reconnect.result };
    }

    const seat = room.firstEmptySeat();
    if (seat === null) {
      return { room, seat: -1 as Seat, result: { ok: false, code: 'room_full', message: '房间已满（3/3）' } };
    }
    const result = room.addHuman(name);
    if (!result.ok) return { room, seat: -1 as Seat, result };
    this.bindSeat(room.roomId, seat, socketId);
    return { room, seat, result };
  }

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  reconnect(roomId: string, seat: Seat, socketId: string): ReconnectOutcome {
    const room = this.rooms.get(roomId);
    if (!room || !isSeat(seat)) {
      return { result: { ok: false, code: 'invalid_reconnect', message: '房间或座位不存在' } };
    }
    const previousSocketId = this.socketOf(roomId, seat);
    const result = room.reconnectHuman(seat);
    if (result.ok) this.bindSeat(roomId, seat, socketId);
    return { room, previousSocketId, result };
  }

  bindSeat(roomId: string, seat: Seat, socketId: string): void {
    let m = this.seatSockets.get(roomId);
    if (!m) {
      m = new Map();
      this.seatSockets.set(roomId, m);
    }
    m.set(seat, socketId);
  }

  unbindSeat(roomId: string, seat: Seat, socketId: string): void {
    const m = this.seatSockets.get(roomId);
    if (m?.get(seat) === socketId) m.delete(seat);
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
    return room.markDisconnected(seat);
  }
}
