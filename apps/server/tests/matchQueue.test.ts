import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchQueue } from '../src/matchQueue';

describe('MatchQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('3 人入队立刻开桌，不补机器人', async () => {
    const matches: { names: string[]; fillBots: boolean }[] = [];
    const q = new MatchQueue({
      botFillDelayMs: 5000,
      onMatch: (table) => {
        matches.push({ names: table.players.map((p) => p.name), fillBots: table.fillBots });
      },
    });

    expect(q.enqueue({ socketId: 'a', name: 'A' }).ok).toBe(true);
    expect(q.enqueue({ socketId: 'b', name: 'B' }).ok).toBe(true);
    expect(q.size()).toBe(2);
    expect(q.enqueue({ socketId: 'c', name: 'C' }).ok).toBe(true);

    expect(matches).toHaveLength(1);
    expect(matches[0]!.names).toEqual(['A', 'B', 'C']);
    expect(matches[0]!.fillBots).toBe(false);
    expect(q.size()).toBe(0);
  });

  it('不足 3 人等待 botFillDelayMs 后 AI 补位开桌', () => {
    vi.useFakeTimers();
    const matches: { names: string[]; fillBots: boolean }[] = [];
    const q = new MatchQueue({
      botFillDelayMs: 3000,
      onMatch: (table) => {
        matches.push({ names: table.players.map((p) => p.name), fillBots: table.fillBots });
      },
    });

    q.enqueue({ socketId: 'a', name: 'Solo' });
    expect(matches).toHaveLength(0);

    vi.advanceTimersByTime(2999);
    expect(matches).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.names).toEqual(['Solo']);
    expect(matches[0]!.fillBots).toBe(true);
    expect(q.size()).toBe(0);
  });

  it('2 人排队到期后补 1 机器人开桌', () => {
    vi.useFakeTimers();
    const matches: { n: number; fillBots: boolean }[] = [];
    const q = new MatchQueue({
      botFillDelayMs: 2000,
      onMatch: (table) => {
        matches.push({ n: table.players.length, fillBots: table.fillBots });
      },
    });

    q.enqueue({ socketId: 'a', name: 'A' });
    q.enqueue({ socketId: 'b', name: 'B' });
    vi.advanceTimersByTime(2000);
    expect(matches).toEqual([{ n: 2, fillBots: true }]);
  });

  it('取消匹配后不再开桌', () => {
    vi.useFakeTimers();
    const matches: unknown[] = [];
    const q = new MatchQueue({
      botFillDelayMs: 1000,
      onMatch: (table) => {
        matches.push(table);
      },
    });

    q.enqueue({ socketId: 'a', name: 'A' });
    expect(q.cancel('a')).toBe(true);
    expect(q.size()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(matches).toHaveLength(0);
  });

  it('重复入队拒绝；已在队列可取消', () => {
    const q = new MatchQueue({
      botFillDelayMs: 10_000,
      onMatch: () => undefined,
    });
    expect(q.enqueue({ socketId: 'a', name: 'A' }).ok).toBe(true);
    expect(q.enqueue({ socketId: 'a', name: 'A2' }).ok).toBe(false);
    expect(q.has('a')).toBe(true);
    expect(q.cancel('a')).toBe(true);
    expect(q.cancel('a')).toBe(false);
  });
});
