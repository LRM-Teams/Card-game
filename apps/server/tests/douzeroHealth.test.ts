import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyHand, RANK, botChoosePlayByDifficulty } from '@card-game/rules';
import type { Card } from '@card-game/rules';
import { choosePlayWithDouZero, createDouZeroHttpAdapter } from '../src/game/douzeroAdapter';
import {
  probeConfiguredDouZeroInfer,
  probeDouZeroHealth,
  resetDouZeroProbeCache,
  resolveCkptPaths,
  resolveDouZeroInferConfig,
} from '../src/game/douzeroHealth';

function card(rank: number, id?: string): Card {
  return { id: id ?? `c${rank}`, rank, display: String(rank), suit: 'spade' };
}

async function withMockServer(
  listener: (req: IncomingMessage, res: ServerResponse) => void,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server = createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('DouZero health / ckpt config (LRM-310)', () => {
  afterEach(() => {
    resetDouZeroProbeCache();
    vi.restoreAllMocks();
  });

  it('resolveCkptPaths：显式路径优先；否则 CKPT_DIR[/MODEL_ID]/{position}.ckpt', () => {
    expect(
      resolveCkptPaths({
        DOUZERO_LANDLORD_CKPT: '/a/landlord.ckpt',
        DOUZERO_LANDLORD_UP_CKPT: '/a/up.ckpt',
        DOUZERO_LANDLORD_DOWN_CKPT: '/a/down.ckpt',
        DOUZERO_CKPT_DIR: '/ignored',
      }),
    ).toEqual({
      landlord: '/a/landlord.ckpt',
      landlord_up: '/a/up.ckpt',
      landlord_down: '/a/down.ckpt',
    });

    const byDir = resolveCkptPaths({
      DOUZERO_CKPT_DIR: '/models/douzero',
      DOUZERO_MODEL_ID: 'run-42',
    });
    expect(byDir.landlord).toMatch(/run-42[/\\]landlord\.ckpt$/);
    expect(byDir.landlord_up).toMatch(/run-42[/\\]landlord_up\.ckpt$/);
    expect(byDir.landlord_down).toMatch(/run-42[/\\]landlord_down\.ckpt$/);
  });

  it('resolveDouZeroInferConfig 读取 URL / modelId / timeout', () => {
    const cfg = resolveDouZeroInferConfig({
      DOUZERO_INFER_URL: 'http://172.17.0.1:8765/',
      DOUZERO_MODEL_ID: 'stub-v1',
      DOUZERO_INFER_TIMEOUT_MS: '2000',
      DOUZERO_HEALTH_TIMEOUT_MS: '500',
    });
    expect(cfg.url).toBe('http://172.17.0.1:8765');
    expect(cfg.modelId).toBe('stub-v1');
    expect(cfg.timeoutMs).toBe(2000);
    expect(cfg.healthTimeoutMs).toBe(500);
  });

  it('probeDouZeroHealth：200 + status=ok → ok', async () => {
    await withMockServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', models: ['landlord', 'landlord_up', 'landlord_down'] }));
    }, async (base) => {
      const r = await probeDouZeroHealth(base, 1000);
      expect(r.status).toBe('ok');
      expect(r.models).toEqual(['landlord', 'landlord_up', 'landlord_down']);
      expect(r.latencyMs).not.toBeNull();
    });
  });

  it('probeDouZeroHealth：5xx → unhealthy；连接失败 → unreachable', async () => {
    await withMockServer((_req, res) => {
      res.statusCode = 503;
      res.end('{}');
    }, async (base) => {
      expect((await probeDouZeroHealth(base, 1000)).status).toBe('unhealthy');
    });
    const miss = await probeDouZeroHealth('http://127.0.0.1:1', 200);
    expect(miss.status).toBe('unreachable');
  });

  it('未配置 URL 时 probeConfigured 返回 skipped', async () => {
    const r = await probeConfiguredDouZeroInfer({}, { reason: 'startup', force: true });
    expect(r.status).toBe('skipped');
  });
});

describe('DouZero infer fallback → 规则普通档（LRM-260 / LRM-310）', () => {
  it('HTTP 500 时 choosePlayWithDouZero 与 botChoosePlayByDifficulty(normal) 一致且不抛错', async () => {
    await withMockServer((_req, res) => {
      res.statusCode = 500;
      res.end('{"error":"boom"}');
    }, async (base) => {
      const hand = [card(RANK.THREE), card(RANK.FIVE, '5a'), card(RANK.SEVEN, '7a')];
      const prev = identifyHand([card(RANK.FOUR)])!;
      const expected = botChoosePlayByDifficulty(hand, prev, 'normal');
      const chosen = await choosePlayWithDouZero(
        {
          seat: 0,
          landlordSeat: 0,
          hand,
          prev,
          bottom: [],
          handCounts: { 0: 3, 1: 17, 2: 17 },
          history: [],
        },
        createDouZeroHttpAdapter(base, { timeoutMs: 500 }),
      );
      expect(chosen?.map((c) => c.rank)).toEqual(expected?.map((c) => c.rank) ?? undefined);
    });
  });

  it('HTTP 超时后 fallback 普通档，对局决策不挂起', async () => {
    await withMockServer((_req, _res) => {
      // 故意不响应，触发 AbortController 超时
    }, async (base) => {
      const hand = [card(RANK.THREE), card(RANK.FIVE, '5a')];
      const prev = identifyHand([card(RANK.FOUR)])!;
      const expected = botChoosePlayByDifficulty(hand, prev, 'normal');
      const started = Date.now();
      const chosen = await choosePlayWithDouZero(
        {
          seat: 0,
          landlordSeat: 0,
          hand,
          prev,
          bottom: [],
          handCounts: { 0: 2, 1: 17, 2: 17 },
          history: [],
        },
        createDouZeroHttpAdapter(base, { timeoutMs: 80 }),
      );
      const elapsed = Date.now() - started;
      expect(elapsed).toBeLessThan(2000);
      expect(chosen?.map((c) => c.rank)).toEqual(expected?.map((c) => c.rank) ?? undefined);
    });
  });
});
