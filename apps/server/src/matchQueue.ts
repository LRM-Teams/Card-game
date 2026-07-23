/**
 * 快速匹配队列（LRM-173 / LRM-309）。
 * - 入队后发 matching；满 3 真人立即成桌并自动开局（fillBots=false）
 * - 超时仍不足 3 人：成桌 + AI 补位 + 自动开局（fillBots=true）
 * - 超时默认 20s（MATCH_FILL_AFTER_MS，建议 15–30s），真人优先配对
 * - cancel_match 出队
 */
import type { Seat } from '@card-game/rules';
import type { GuestProfile } from './identity';
import type { GameRoom } from './game/GameRoom';
import type { ActionResult } from './game/types';
import { opsLog } from './observability';

/** 默认等待真人凑桌时长（毫秒）；可用 MATCH_FILL_AFTER_MS 覆盖。 */
export const DEFAULT_MATCH_FILL_AFTER_MS = 20_000;

export function resolveMatchFillAfterMs(override?: number): number {
  if (override != null && Number.isFinite(override) && override >= 0) return override;
  const raw = process.env.MATCH_FILL_AFTER_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_MATCH_FILL_AFTER_MS;
}

export interface MatchWaiter {
  socketId: string;
  profile: GuestProfile;
  enqueuedAt: number;
}

/** 匹配队列对外可见状态（LRM-317 客户端等待态）。 */
export interface MatchQueueStatus {
  humans: number;
  fillDeadlineAt: number;
}

export interface MatchFormed {
  room: GameRoom;
  /** 每位入桌玩家的落座结果（含 you_joined + snapshot 等）。 */
  seats: Array<{ socketId: string; seat: Seat; result: ActionResult }>;
  /** 开局事件（start 之后）。 */
  startResult: ActionResult;
  /** 成桌时是否补了机器人。 */
  fillBots: boolean;
}

type FormRoomFn = (humans: MatchWaiter[]) => {
  room: GameRoom;
  seats: Array<{ socketId: string; seat: Seat; result: ActionResult }>;
};

export class MatchQueue {
  private queue: MatchWaiter[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** 当前补机倒计时起点（首人入队时 armTimer）。 */
  private timerStartedAt: number | null = null;
  /** 超时后用 AI 补位开局（毫秒）。 */
  private readonly fillAfterMs: number;
  private readonly formRoom: FormRoomFn;
  private readonly onFormed: (formed: MatchFormed) => void;
  private readonly onQueueUpdate: (() => void) | null;

  constructor(opts: {
    formRoom: FormRoomFn;
    onFormed: (formed: MatchFormed) => void;
    onQueueUpdate?: () => void;
    fillAfterMs?: number;
  }) {
    this.formRoom = opts.formRoom;
    this.onFormed = opts.onFormed;
    this.onQueueUpdate = opts.onQueueUpdate ?? null;
    this.fillAfterMs = resolveMatchFillAfterMs(opts.fillAfterMs);
  }

  /** 当前配置的补机超时（毫秒）。 */
  get fillTimeoutMs(): number {
    return this.fillAfterMs;
  }

  size(): number {
    return this.queue.length;
  }

  hasSocket(socketId: string): boolean {
    return this.queue.some((w) => w.socketId === socketId);
  }

  /** 队列内所有等待 socket（用于广播 matching 状态）。 */
  waiterSocketIds(): string[] {
    return this.queue.map((w) => w.socketId);
  }

  /** 当前队列可见状态；空队列返回 null。 */
  getQueueStatus(): MatchQueueStatus | null {
    if (this.queue.length === 0) return null;
    const started = this.timerStartedAt ?? this.queue[0]!.enqueuedAt;
    return {
      humans: this.queue.length,
      fillDeadlineAt: started + this.fillAfterMs,
    };
  }

  private notifyQueueUpdate(): void {
    if (this.queue.length > 0) this.onQueueUpdate?.();
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
    this.notifyQueueUpdate();
  }

  /** 取消匹配；返回是否曾在队列中。 */
  cancel(socketId: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((w) => w.socketId !== socketId);
    if (this.queue.length === 0) this.clearTimer();
    const cancelled = this.queue.length < before;
    if (cancelled) this.notifyQueueUpdate();
    return cancelled;
  }

  /** socket 断开时出队。 */
  dropSocket(socketId: string): void {
    this.cancel(socketId);
  }

  private armTimer(): void {
    if (this.timer) return;
    this.timerStartedAt = Date.now();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.timerStartedAt = null;
      if (this.queue.length > 0) void this.flush(true);
    }, this.fillAfterMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timerStartedAt = null;
  }

  private async flush(fillBots: boolean): Promise<void> {
    this.clearTimer();
    const batch = this.queue.splice(0, 3);
    if (batch.length === 0) return;
    const fill = fillBots || batch.length < 3;
    const oldest = batch.reduce((min, w) => Math.min(min, w.enqueuedAt), batch[0]!.enqueuedAt);
    const { room, seats } = this.formRoom(batch);
    const startResult = await room.start(fill);
    opsLog({
      event: 'match.form',
      roomId: room.roomId,
      phase: room.phase,
      humanCount: batch.length,
      playerCount: room.playerCount,
      fillBots: fill,
      waitMs: Date.now() - oldest,
      queueRemaining: this.queue.length,
    });
    this.onFormed({ room, seats, startResult, fillBots: fill });
    if (this.queue.length > 0) this.armTimer();
  }
}
