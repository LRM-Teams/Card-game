/**
 * 房间注册表（内存版，MVP）。
 *
 * - 管理 roomId → GameRoom。
 * - 维护 (roomId, seat) → socketId，用于把私发事件（如 dealt 手牌）送达对应真人。
 * - join：无 roomId 时新建房间；有 roomId 时只加入已存在房间。
 * - createMatchedRoom：快速匹配凑桌后落座并自动开局（不足 3 真人时补机器人）。
 */
import type { Seat } from '@card-game/rules';
import { GameRoom } from './game/GameRoom';
import { createConfiguredDouZeroAdapter } from './game/douzeroAdapter';
import type { ActionResult, RoomEvent } from './game/types';
import type { MatchPlayer } from './matchQueue';

export interface JoinOutcome {
  room: GameRoom;
  seat: Seat;
  result: ActionResult;
}

export interface MatchedRoomOutcome {
  room: GameRoom;
  seats: { socketId: string; seat: Seat }[];
  events: RoomEvent[];
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

    const reconnect = room.reconnectHuman(name);
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

  /**
   * 快速匹配开桌：按入队顺序落座，再自动 start。
   * fillBots=true 时不足 3 真人补机器人；=false 时要求恰好 3 真人。
   */
  async createMatchedRoom(players: MatchPlayer[], fillBots: boolean): Promise<MatchedRoomOutcome> {
    if (players.length === 0 || players.length > 3) {
      throw new Error(`createMatchedRoom: invalid player count ${players.length}`);
    }
    const id = `room-${(++this.seq).toString(36)}`;
    const room = new GameRoom(id, this.aiAdapter);
    this.rooms.set(id, room);

    const events: RoomEvent[] = [];
    const seats: { socketId: string; seat: Seat }[] = [];

    for (const p of players) {
      const seat = room.firstEmptySeat();
      if (seat === null) throw new Error('createMatchedRoom: room unexpectedly full');
      const result = room.addHuman(p.name);
      if (!result.ok) throw new Error(result.message);
      events.push(...result.events);
      this.bindSeat(room.roomId, seat, p.socketId);
      seats.push({ socketId: p.socketId, seat });
    }

    const started = await room.start(fillBots);
    if (!started.ok) throw new Error(started.message);
    events.push(...started.events);
    return { room, seats, events };
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
}
