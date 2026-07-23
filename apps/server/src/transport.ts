/**
 * Socket.IO 传输层：把客户端动作接到 GameRoom / MatchQueue，把 ServerEvent 下发回去。
 *
 * - 客户端发：socket.emit('action', <ClientAction>)
 * - 服务端收：socket.on('event', <ServerEvent>)
 *
 * 传输层不做任何规则判定，只搬运；权威判定全在 GameRoom + @card-game/rules。
 */
import type { Server as IoServer, Socket } from 'socket.io';
import type { ClientAction, ErrorCode, Seat, ServerEvent } from '@card-game/rules';
import { GamePhase, isValidDisplayName, normalizeDisplayName } from '@card-game/rules';
import type { ActionResult, RoomEvent } from './game/types';
import type { GameRoom } from './game/GameRoom';
import { opsLog } from './observability';
import { RoomRegistry } from './registry';
import type { MatchFormed } from './matchQueue';

type Binding = { roomId: string; seat: Seat };

export function createGame(io: IoServer): RoomRegistry {
  const registry = new RoomRegistry();
  /** socketId → 当前房间绑定（匹配成桌后也会写入）。 */
  const bindings = new Map<string, Binding>();
  /** 按房间串行化异步动作。 */
  const roomLocks = new Map<string, Promise<void>>();

  const runRoomAction = (roomId: string, task: () => Promise<void>): void => {
    const prev = roomLocks.get(roomId) ?? Promise.resolve();
    const next = prev.then(task, task).then(
      () => undefined,
      () => undefined,
    );
    roomLocks.set(roomId, next);
  };

  const fail = (socket: Socket, code: ErrorCode, message: string): void => {
    const ev: ServerEvent = { type: 'error', code, message };
    socket.emit('event', ev);
  };

  const matchingEvent = (status: { humans: number; fillDeadlineAt: number }): ServerEvent => ({
    type: 'matching',
    humans: status.humans,
    fillDeadlineAt: status.fillDeadlineAt,
  });

  const emitMatching = (socket: Socket): void => {
    const status = registry.getMatchQueueStatus();
    if (!status) return;
    socket.emit('event', matchingEvent(status));
  };

  const broadcastMatchQueue = (): void => {
    const status = registry.getMatchQueueStatus();
    if (!status) return;
    const ev = matchingEvent(status);
    for (const socketId of registry.getMatchingSocketIds()) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.emit('event', ev);
    }
  };

  const resolveIdentity = (
    action: Extract<ClientAction, { type: 'join' } | { type: 'match' }>,
  ) => {
    const displayName = normalizeDisplayName(action.displayName);
    if (!isValidDisplayName(displayName)) {
      return { ok: false as const, message: '昵称需 2–12 个字符（不含首尾空白）' };
    }
    return {
      ok: true as const,
      profile: registry.identities.resolve({
        displayName,
        guestId: action.guestId,
        avatarId: action.avatarId,
        beans: action.beans,
      }),
    };
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

  /** 已打印 settle 日志的 GameResult（防 drain 重复刷屏） */
  const settleLogged = new WeakSet<object>();

  const pumpBots = async (room: GameRoom, roomId: string): Promise<void> => {
    await room.drainBots((events) => {
      apply(roomId, events);
    });
    scheduleDecisionTimeout(room, roomId);
    scheduleDisconnectGrace(room, roomId);
    if (room.result && !settleLogged.has(room.result)) {
      settleLogged.add(room.result);
      opsLog({
        event: 'game.settle',
        roomId,
        phase: room.phase,
        humanCount: room.humanCount,
        playerCount: room.playerCount,
        winnerSeat: room.result.winnerSeat,
        scores: room.result.scores,
      });
      const updated = registry.applySettlementBeans(room);
      for (const seat of [0, 1, 2] as Seat[]) {
        const p = room.players[seat];
        if (!p?.guestId || p.isBot) continue;
        const beans = updated.get(p.guestId);
        if (beans === undefined) continue;
        const sid = registry.socketOf(roomId, seat);
        if (!sid) continue;
        const ev: ServerEvent = { type: 'beans', beans };
        io.to(sid).emit('event', ev);
      }
    }
  };

  const logGameStart = (room: GameRoom): void => {
    opsLog({
      event: 'game.start',
      roomId: room.roomId,
      phase: room.phase,
      humanCount: room.humanCount,
      playerCount: room.playerCount,
    });
  };

  /** roomId → 明牌/加倍决策超时定时器 */
  const decisionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** roomId → 断线真人行棋宽限定时器 */
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const scheduleDecisionTimeout = (room: GameRoom, roomId: string): void => {
    const prev = decisionTimers.get(roomId);
    if (prev) clearTimeout(prev);
    decisionTimers.delete(roomId);
    const remaining = room.decisionRemainingMs();
    if (remaining == null) return;
    if (remaining <= 0) {
      runRoomAction(roomId, async () => {
        const events = room.expireDecisionWindow();
        if (events.length === 0) return;
        apply(roomId, events);
        await pumpBots(room, roomId);
      });
      return;
    }
    const timer = setTimeout(() => {
      decisionTimers.delete(roomId);
      runRoomAction(roomId, async () => {
        const live = registry.get(roomId);
        if (!live) return;
        const events = live.expireDecisionWindow();
        if (events.length === 0) return;
        apply(roomId, events);
        await pumpBots(live, roomId);
      });
    }, remaining);
    decisionTimers.set(roomId, timer);
  };

  const scheduleDisconnectGrace = (room: GameRoom, roomId: string): void => {
    const prev = disconnectTimers.get(roomId);
    if (prev) clearTimeout(prev);
    disconnectTimers.delete(roomId);
    room.armDisconnectGraceIfNeeded();
    const remaining = room.disconnectGraceRemainingMs();
    if (remaining == null) return;
    if (remaining <= 0) {
      runRoomAction(roomId, async () => {
        const events = room.expireDisconnectGrace();
        if (events.length === 0) return;
        apply(roomId, events);
        await pumpBots(room, roomId);
      });
      return;
    }
    const timer = setTimeout(() => {
      disconnectTimers.delete(roomId);
      runRoomAction(roomId, async () => {
        const live = registry.get(roomId);
        if (!live) return;
        const events = live.expireDisconnectGrace();
        if (events.length === 0) return;
        apply(roomId, events);
        await pumpBots(live, roomId);
      });
    }, remaining);
    disconnectTimers.set(roomId, timer);
  };

  const deliverMatch = (formed: MatchFormed): void => {
    for (const s of formed.seats) {
      if (!s.result.ok) continue;
      bindings.set(s.socketId, { roomId: formed.room.roomId, seat: s.seat });
      apply(formed.room.roomId, s.result.events);
      const sock = io.sockets.sockets.get(s.socketId);
      if (sock) void sock.join(formed.room.roomId);
    }
    if (!formed.startResult.ok) return;
    logGameStart(formed.room);
    apply(formed.room.roomId, formed.startResult.events);
    void pumpBots(formed.room, formed.room.roomId);
  };

  registry.setMatchFormedHandler(deliverMatch);
  registry.setMatchQueueUpdateHandler(broadcastMatchQueue);

  io.on('connection', (socket) => {
    socket.on('action', async (action: ClientAction) => {
      if (action.type === 'match') {
        if (bindings.has(socket.id)) {
          fail(socket, 'already_in_room', '已在房间内，请先离开再匹配');
          return;
        }
        if (registry.isMatching(socket.id)) {
          emitMatching(socket);
          return;
        }
        const resolved = resolveIdentity(action);
        if (!resolved.ok) {
          fail(socket, 'invalid_display_name', resolved.message);
          return;
        }
        registry.enqueueMatch(resolved.profile, socket.id);
        emitMatching(socket);
        return;
      }

      if (action.type === 'cancel_match') {
        if (!registry.cancelMatch(socket.id)) {
          fail(socket, 'not_matching', '当前不在匹配中');
          return;
        }
        socket.emit('event', { type: 'match_cancelled' } satisfies ServerEvent);
        return;
      }

      if (action.type === 'join') {
        if (registry.isMatching(socket.id)) registry.cancelMatch(socket.id);
        const resolved = resolveIdentity(action);
        if (!resolved.ok) {
          fail(socket, 'invalid_display_name', resolved.message);
          return;
        }
        const { room, seat, result } = registry.join(resolved.profile, socket.id, action.roomId);
        if (!result.ok) {
          fail(socket, result.code, result.message);
          return;
        }
        bindings.set(socket.id, { roomId: room.roomId, seat });
        void socket.join(room.roomId);
        apply(room.roomId, result.events);
        scheduleDisconnectGrace(room, room.roomId);
        // 私房满 3 真人 → 自动纯人开局（也可房主手动 start）
        if (room.phase === GamePhase.WAITING && room.humanCount >= 3) {
          runRoomAction(room.roomId, async () => {
            const started = await room.maybeAutoStartWhenFull();
            if (!started?.ok) return;
            logGameStart(room);
            apply(room.roomId, started.events);
            await pumpBots(room, room.roomId);
          });
        }
        return;
      }

      const binding = bindings.get(socket.id);
      if (!binding) {
        fail(socket, 'not_in_room', '请先 join 房间或完成匹配');
        return;
      }
      const room = registry.get(binding.roomId);
      if (!room) {
        fail(socket, 'room_not_found', '房间不存在');
        return;
      }

      runRoomAction(binding.roomId, async () => {
        const beforePhase = room.phase;
        const result: ActionResult = await room.handleAction(binding.seat, action);
        if (!result.ok) {
          fail(socket, result.code, result.message);
          return;
        }
        if (action.type === 'start' && beforePhase !== room.phase) {
          logGameStart(room);
        }
        apply(binding.roomId, result.events);
        await pumpBots(room, binding.roomId);
      });
    });

    socket.on('disconnect', () => {
      registry.cancelMatch(socket.id);
      const binding = bindings.get(socket.id);
      bindings.delete(socket.id);
      if (!binding) return;
      const result = registry.disconnect(binding.roomId, binding.seat, socket.id);
      if (result.ok) apply(binding.roomId, result.events);
      const live = registry.get(binding.roomId);
      if (live) scheduleDisconnectGrace(live, binding.roomId);
    });
  });

  return registry;
}
