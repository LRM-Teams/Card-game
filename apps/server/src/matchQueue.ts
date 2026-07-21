/**
 * 快速匹配队列（内存版，MVP）。
 *
 * - 3 名真人入队即立刻开桌（不补机器人）。
 * - 不足 3 人时等待 botFillDelayMs，到期用 AI 补位至 3 人开桌。
 * - 可取消；断线由 transport 调用 cancel。
 */

export interface MatchPlayer {
  socketId: string;
  name: string;
}

export interface MatchTable {
  players: MatchPlayer[];
  /** true：真人不足 3，开局时补机器人。 */
  fillBots: boolean;
}

export interface MatchQueueOptions {
  /** 排队后等待更多真人的最长时间；到期 AI 补位开桌。默认 3000ms。 */
  botFillDelayMs?: number;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
  onMatch: (table: MatchTable) => void | Promise<void>;
}

const DEFAULT_BOT_FILL_MS = 3000;
const TABLE_SIZE = 3;

export class MatchQueue {
  private queue: MatchPlayer[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly botFillDelayMs: number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly onMatch: MatchQueueOptions['onMatch'];

  constructor(opts: MatchQueueOptions) {
    this.botFillDelayMs = opts.botFillDelayMs ?? DEFAULT_BOT_FILL_MS;
    this.setTimeoutFn = opts.setTimeout ?? setTimeout;
    this.clearTimeoutFn = opts.clearTimeout ?? clearTimeout;
    this.onMatch = opts.onMatch;
  }

  size(): number {
    return this.queue.length;
  }

  has(socketId: string): boolean {
    return this.queue.some((p) => p.socketId === socketId);
  }

  /** 入队。已在队列则拒绝。成功后尝试立即凑桌或启动补位计时。 */
  enqueue(player: MatchPlayer): { ok: true; queueSize: number } | { ok: false; reason: 'already_queued' } {
    if (this.has(player.socketId)) return { ok: false, reason: 'already_queued' };
    const name = player.name.trim() || '玩家';
    this.queue.push({ socketId: player.socketId, name });
    this.tryMatchOrSchedule();
    return { ok: true, queueSize: this.queue.length };
  }

  /** 出队。返回是否曾在队列中。队列空则清计时器。 */
  cancel(socketId: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((p) => p.socketId !== socketId);
    if (this.queue.length === 0) this.clearTimer();
    return this.queue.length !== before;
  }

  /** 测试/运维：立即触发一次补位开桌（若队列非空且不足 3 人）。 */
  flushForTest(): void {
    this.clearTimer();
    this.openWithBotsIfNeeded();
  }

  private tryMatchOrSchedule(): void {
    while (this.queue.length >= TABLE_SIZE) {
      this.clearTimer();
      const players = this.queue.splice(0, TABLE_SIZE);
      void this.onMatch({ players, fillBots: false });
    }
    if (this.queue.length > 0 && this.timer === null) {
      this.timer = this.setTimeoutFn(() => {
        this.timer = null;
        this.openWithBotsIfNeeded();
      }, this.botFillDelayMs) as ReturnType<typeof setTimeout>;
    }
  }

  private openWithBotsIfNeeded(): void {
    if (this.queue.length === 0) return;
    if (this.queue.length >= TABLE_SIZE) {
      this.tryMatchOrSchedule();
      return;
    }
    const players = this.queue.splice(0, this.queue.length);
    void this.onMatch({ players, fillBots: true });
    if (this.queue.length > 0) this.tryMatchOrSchedule();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
  }
}
