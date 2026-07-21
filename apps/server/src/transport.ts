/**
 * Socket.IO 传输层：把客户端动作接到 GameRoom / MatchQueue，把 ServerEvent 下发回去。
 *
 * - 客户端发：socket.emit('action', <ClientAction>)
 * - 服务端收：socket.on('event', <ServerEvent>)  （'room' 事件广播全房；'dealt' 等私发到本人）
 *
 * 传输层不做任何规则判定，只搬运；权威判定全在 GameRoom + @card-game/rules。
 * 快速匹配：MatchQueue 凑桌后 registry.createMatchedRoom 落座并自动开局。
 */
import type { Server as IoServer } from 'socket.io';
import type { ClientAction, ErrorCode, Seat, ServerEvent } from '@card-game/rules';
import type { ActionResult, RoomEvent } from './game/types';
import type { GameRoom } from './game/GameRoom';
import { MatchQueue } from './matchQueue';
import { RoomRegistry } from './registry';

const MATCH_BOT_FILL_MS = Number(process.env.MATCH_BOT_FILL_MS ?? 3000);

export function createGame(io: IoServer): RoomRegistry {
  const registry = new RoomRegistry();
  /** socketId → 当前房间绑定（匹配入座 / 私房 join 后写入）。 */
  const bindings = new Map<string, { roomId: string; seat: Seat }>();
  /** 按房间串行化异步动作：机器人推理期间，同房间的真人动作排队，避免状态竞态。 */
  const roomLocks = new Map<string, Promise<void>>();
  const runRoomAction = (roomId: string, task: () => Promise<void>): void => {
    const prev = roomLocks.get(roomId) ?? Promise.resolve();
    const next = prev.then(task, task).then(
      () => undefined,
      () => undefined,
    );
    roomLocks.set(roomId, next);
  };

  const apply = (roomId: string, events: RoomEvent[]): void => {
    for (const re of events) {
      if (re.scope === 'room') {
        io.to(roomId).emit('event', re.event);
      } else {
        const sid = registry.socketOf(roomId, re.scope.seat);
        if (sid) io.to(sid).emit('event', re.event);
      }
    }
  };

  const pumpBots = async (room: GameRoom, roomId: string): Promise<void> => {
    await room.drainBots((events) => {
      apply(roomId, events);
    });
  };

  const matchQueue = new MatchQueue({
    botFillDelayMs: Number.isFinite(MATCH_BOT_FILL_MS) && MATCH_BOT_FILL_MS >= 0 ? MATCH_BOT_FILL_MS : 3000,
    onMatch: async (table) => {
      try {
        const outcome = await registry.createMatchedRoom(table.players, table.fillBots);
        for (const { socketId, seat } of outcome.seats) {
          bindings.set(socketId, { roomId: outcome.room.roomId, seat });
          const sock = io.sockets.sockets.get(socketId);
          if (sock) sock.join(outcome.room.roomId);
        }
        apply(outcome.room.roomId, outcome.events);
        await pumpBots(outcome.room, outcome.room.roomId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[match] createMatchedRoom failed', err);
        for (const p of table.players) {
          const sock = io.sockets.sockets.get(p.socketId);
          if (!sock) continue;
          const ev: ServerEvent = {
            type: 'error',
            code: 'invalid_action_for_phase',
            message: '匹配开桌失败，请重试',
          };
          sock.emit('event', ev);
        }
      }
    },
  });

  io.on('connection', (socket) => {
    const fail = (code: ErrorCode, message: string): void => {
      const ev: ServerEvent = { type: 'error', code, message };
      socket.emit('event', ev);
    };

    socket.on('action', async (action: ClientAction) => {
      // —— 快速匹配 ——
      if (action.type === 'quick_match') {
        if (bindings.has(socket.id)) {
          fail('already_in_room', '已在房间中，请先离开再匹配');
          return;
        }
        const enqueued = matchQueue.enqueue({ socketId: socket.id, name: action.name });
        if (!enqueued.ok) {
          fail('already_in_match', '已在匹配队列中');
          return;
        }
        const ev: ServerEvent = { type: 'match_queued', queueSize: enqueued.queueSize };
        socket.emit('event', ev);
        return;
      }

      if (action.type === 'cancel_match') {
        if (!matchQueue.cancel(socket.id)) {
          fail('not_in_match', '当前不在匹配中');
          return;
        }
        const ev: ServerEvent = { type: 'match_cancelled' };
        socket.emit('event', ev);
        return;
      }

      // —— 私房 join：若在匹配队列则先出队 ——
      if (action.type === 'join') {
        matchQueue.cancel(socket.id);
        if (bindings.has(socket.id)) {
          fail('already_in_room', '已在房间中');
          return;
        }
        const { room, seat, result } = registry.join(action.name, socket.id, action.roomId);
        if (!result.ok) {
          fail(result.code, result.message);
          return;
        }
        bindings.set(socket.id, { roomId: room.roomId, seat });
        socket.join(room.roomId);
        apply(room.roomId, result.events);
        return;
      }

      const binding = bindings.get(socket.id);
      if (!binding) {
        fail('not_in_room', '请先 join 房间或快速开始');
        return;
      }
      const roomId = binding.roomId;
      const room = registry.get(roomId);
      if (!room) {
        fail('not_in_room', '房间不存在');
        return;
      }

      const seat = binding.seat;
      runRoomAction(roomId, async () => {
        const result: ActionResult = await room.handleAction(seat, action);
        if (!result.ok) {
          fail(result.code, result.message);
          return;
        }
        apply(roomId, result.events);
        await pumpBots(room, roomId);
      });
    });

    socket.on('disconnect', () => {
      matchQueue.cancel(socket.id);
      const binding = bindings.get(socket.id);
      if (!binding) return;
      const result = registry.disconnect(binding.roomId, binding.seat, socket.id);
      bindings.delete(socket.id);
      if (result.ok) apply(binding.roomId, result.events);
    });
  });

  return registry;
}
