/**
 * 快速匹配队列（LRM-173）。
 * - 入队后发 matching；满 3 真人立即成桌并自动开局（fillBots=false）
 * - 超时仍不足 3 人：成桌 + AI 补位 + 自动开局（fillBots=true）
 * - cancel_match 出队
 */
import type { Seat } from '@card-game/rules';
import type { GuestProfile } from './identity';
import type { GameRoom } from './game/GameRoom';
import type { ActionResult } from './game/types';

export interface MatchWaiter {
  socketId: string;
  profile: GuestProfile;
  enqueuedAt: number;
}

export interface MatchFormed {
  room: GameRoom;
  /** 每位入桌玩家的落座结果（含 you_joined + snapshot 等）。 */
  seats: Array<{ socketId: string; seat: Seat; result: ActionResult }>;
  /** 开局事件（start 之后）。 */
  startResult: ActionResult;
}

type FormRoomFn = (humans: MatchWaiter[]) => {
  room: GameRoom;
  seats: Array<{ socketId: string; seat: Seat; result: ActionResult }>;
};

export class MatchQueue {
  private queue: MatchWaiter[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** 超时后用 AI 补位开局（毫秒）。 */
  private readonly fillAfterMs: number;
  private readonly formRoom: FormRoomFn;
  private readonly onFormed: (formed: MatchFormed) => void;

  constructor(opts: {
    formRoom: FormRoomFn;
    onFormed: (formed: MatchFormed) => void;
    fillAfterMs?: number;
  }) {
    this.formRoom = opts.formRoom;
    this.onFormed = opts.onFormed;
    this.fillAfterMs = opts.fillAfterMs ?? 2000;
  }

  size(): number {
    return this.queue.length;
  }

  hasSocket(socketId: string): boolean {
    return this.queue.some((w) => w.socketId === socketId);
  }

  enqueue(waiter: MatchWaiter): void {
    if (this.queue.some((w) => w.socketId === waiter.socketId)) return;
    // 同 guest 重复入队：踢掉旧的
    this.queue = this.queue.filter((w) => w.profile.guestId !== waiter.profile.guestId);
    this.queue.push(waiter);
    this.armTimer();
    if (this.queue.length >= 3) {
      void this.flush(false);
    }
  }

  /** 取消匹配；返回是否曾在队列中。 */
  cancel(socketId: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((w) => w.socketId !== socketId);
    if (this.queue.length === 0) this.clearTimer();
    return this.queue.length < before;
  }

  /** socket 断开时出队。 */
  dropSocket(socketId: string): void {
    this.cancel(socketId);
  }

  private armTimer(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.queue.length > 0) void this.flush(true);
    }, this.fillAfterMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async flush(fillBots: boolean): Promise<void> {
    this.clearTimer();
    const batch = this.queue.splice(0, 3);
    if (batch.length === 0) return;
    const { room, seats } = this.formRoom(batch);
    const startResult = await room.start(fillBots || batch.length < 3);
    this.onFormed({ room, seats, startResult });
    if (this.queue.length > 0) this.armTimer();
  }
}
