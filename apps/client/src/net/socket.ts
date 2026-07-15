import { io, type Socket } from 'socket.io-client';
import type { ClientAction, ServerEvent } from '@card-game/rules';

/**
 * Socket.IO 客户端传输层（与 apps/server 对接）。
 *
 * - 客户端发：socket.emit('action', ClientAction)
 * - 服务端推：socket.on('event', ServerEvent)
 *
 * 本模块只搬运，不做判定；权威在服务端。
 * store/gameStore.ts 负责订阅事件并镜像成 UI 状态。
 */

export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3000';

export type ConnStatus = 'connecting' | 'connected' | 'disconnected';

type EventHandler = (e: ServerEvent) => void;
type StatusHandler = (s: ConnStatus) => void;

const eventHandlers = new Set<EventHandler>();
const statusHandlers = new Set<StatusHandler>();

let socket: Socket | null = null;

function setStatus(s: ConnStatus): void {
  statusHandlers.forEach((h) => h(s));
}

function ensure(): Socket {
  if (socket) return socket;
  socket = io(SERVER_URL, { autoConnect: false, transports: ['websocket', 'polling'] });
  socket.on('connect', () => setStatus('connected'));
  socket.on('disconnect', () => setStatus('disconnected'));
  socket.on('connect_error', () => setStatus('disconnected'));
  socket.on('event', (e: ServerEvent) => {
    eventHandlers.forEach((h) => h(e));
  });
  return socket;
}

/** 建立连接（幂等）。先 onEvent/onStatus 订阅，再 connect，避免漏首个事件。 */
export function connect(): void {
  ensure().connect();
}

/** 断开并重连（用于「再来一局」进入新房间）。 */
export function reconnect(): void {
  const sk = ensure();
  if (sk.connected) {
    sk.disconnect();
  }
  sk.connect();
}

/** 发送一个客户端动作。未连接时 socket.io 会缓冲，连上后补发。 */
export function send(action: ClientAction): void {
  ensure().emit('action', action);
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
