import { io, type Socket } from 'socket.io-client';
import type { ClientAction, ServerEvent } from '@card-game/rules';

/**
 * Socket.IO 客户端传输层（与 apps/server 对接）。
 *
 * - 客户端发：socket.emit('action', <ClientAction>)
 * - 服务端推：socket.on('event', <ServerEvent>)
 *
 * 服务端地址来自 VITE_SERVER_URL，默认 http://localhost:3000（apps/server dev 端口）。
 * 本模块只搬运，不做任何判定；权威在服务端。
 */

export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3000';

export type ConnStatus = 'connecting' | 'connected' | 'disconnected';

type EventHandler = (e: ServerEvent) => void;
type StatusHandler = (s: ConnStatus) => void;

const eventHandlers = new Set<EventHandler>();
const statusHandlers = new Set<StatusHandler>();

let socket: Socket | null = null;

function emitStatus(s: ConnStatus): void {
  statusHandlers.forEach((h) => h(s));
}

function ensureSocket(): Socket {
  if (socket) return socket;
  socket = io(SERVER_URL, { autoConnect: true, reconnection: true });
  socket.on('connect', () => emitStatus('connected'));
  socket.on('disconnect', () => emitStatus('disconnected'));
  socket.on('connect_error', () => emitStatus('disconnected'));
  socket.on('event', (e: ServerEvent) => {
    eventHandlers.forEach((h) => h(e));
  });
  return socket;
}

/** 触发连接（幂等）。 */
export function connect(): Socket {
  return ensureSocket();
}

/** 发送一个客户端动作。 */
export function send(action: ClientAction): void {
  connect().emit('action', action);
}

/** 订阅服务端事件，返回取消订阅函数。 */
export function onEvent(h: EventHandler): () => void {
  eventHandlers.add(h);
  return () => {
    eventHandlers.delete(h);
  };
}

/** 订阅连接状态，返回取消订阅函数。 */
export function onStatus(h: StatusHandler): () => void {
  statusHandlers.add(h);
  return () => {
    statusHandlers.delete(h);
  };
}
