/**
 * Socket.IO 传输层：把客户端动作接到 GameRoom，把 ServerEvent 下发回去。
 *
 * - 客户端发：socket.emit('action', <ClientAction>)
 * - 服务端收：socket.on('event', <ServerEvent>)  （'room' 事件广播全房；'dealt' 等私发到本人）
 *
 * 传输层不做任何规则判定，只搬运；权威判定全在 GameRoom + @card-game/rules。
 */
import type { Server as IoServer } from 'socket.io';
import type { ClientAction, ErrorCode, Seat, ServerEvent } from '@card-game/rules';
import type { ActionResult, RoomEvent } from './game/types';
import { RoomRegistry } from './registry';

export function createGame(io: IoServer): RoomRegistry {
  const registry = new RoomRegistry();

  io.on('connection', (socket) => {
    let binding: { roomId: string; seat: Seat } | null = null;

    const fail = (code: ErrorCode, message: string): void => {
      const ev: ServerEvent = { type: 'error', code, message };
      socket.emit('event', ev);
    };

    const apply = (roomId: string, events: RoomEvent[]): void => {
      for (const re of events) {
        if (re.scope === 'room') {
          io.to(roomId).emit('event', re.event);
        } else {
          // 私发到该座位的真人连接（机器人 / 未连接则丢弃）
          const sid = registry.socketOf(roomId, re.scope.seat);
          if (sid) io.to(sid).emit('event', re.event);
        }
      }
    };

    socket.on('action', (action: ClientAction) => {
      // join：落座并加入房间
      if (action.type === 'join') {
        const { room, seat, result } = registry.join(action.name, socket.id, action.roomId);
        if (!result.ok) {
          fail(result.code, result.message);
          return;
        }
        binding = { roomId: room.roomId, seat };
        socket.join(room.roomId);
        apply(room.roomId, result.events);
        return;
      }

      if (!binding) {
        fail('not_in_room', '请先 join 房间');
        return;
      }
      const room = registry.get(binding.roomId);
      if (!room) {
        fail('not_in_room', '房间不存在');
        return;
      }

      const result: ActionResult = room.handleAction(binding.seat, action);
      if (!result.ok) {
        fail(result.code, result.message);
        return;
      }
      apply(binding.roomId, result.events);
    });

    socket.on('disconnect', () => {
      if (!binding) return;
      const result = registry.disconnect(binding.roomId, binding.seat, socket.id);
      if (result.ok) apply(binding.roomId, result.events);
    });
  });

  return registry;
}
