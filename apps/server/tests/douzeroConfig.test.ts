import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { identifyHand, RANK } from '@card-game/rules';
import type { Card } from '@card-game/rules';
import {
  choosePlayWithDouZero,
  createDouZeroHttpAdapter,
} from '../src/game/douzeroAdapter';
import {
  probeInferHealth,
  resolveDouZeroCkptConfig,
  resolveDouZeroRuntimeConfig,
} from '../src/game/douzeroConfig';

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

describe('DouZero config / probe (LRM-310)', () => {
  it('解析 ckpt 切换接口环境变量（无需改代码）', () => {
    const ckpt = resolveDouZeroCkptConfig({
      DOUZERO_MODEL_ID: 'p100_adp_617',
      DOUZERO_CKPT_DIR: '/data/ckpts',
      DOUZERO_LANDLORD_CKPT: '/data/ckpts/landlord.ckpt',
    });
    expect(ckpt).toEqual({
      modelId: 'p100_adp_617',
      ckptDir: '/data/ckpts',
      landlord: '/data/ckpts/landlord.ckpt',
      landlordUp: null,
      landlordDown: null,
    });
    expect(resolveDouZeroRuntimeConfig({}).inferUrl).toBeNull();
    expect(resolveDouZeroRuntimeConfig({ DOUZERO_INFER_URL: 'http://172.17.0.1:8765' }).inferUrl).toBe(
      'http://172.17.0.1:8765',
    );
  });

  it('probeInferHealth：/health 200 → ok', async () => {
    await withMockServer((req, res) => {
      if (req.url === '/health') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', models: ['landlord'], modelId: 'default' }));
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    }, async (base) => {
      const r = await probeInferHealth(base, 2000);
      expect(r.ok).toBe(true);
      expect(r.statusCode).toBe(200);
      expect((r.body as { modelId?: string }).modelId).toBe('default');
    });
  });

  it('probeInferHealth：连不上 → ok:false 不抛', async () => {
    const r = await probeInferHealth('http://127.0.0.1:1', 200);
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('infer 超时 → choosePlayWithDouZero fallback 规则机器人普通档（不卡局）', async () => {
    await withMockServer((_req, res) => {
      // 故意不响应，拖过 timeout
      setTimeout(() => {
        res.statusCode = 200;
        res.end(JSON.stringify({ action: [5] }));
      }, 500);
    }, async (base) => {
      const chosen = await choosePlayWithDouZero(
        {
          seat: 0,
          landlordSeat: 0,
          hand: [card(RANK.FIVE, '5a'), card(RANK.SIX, '6a')],
          prev: identifyHand([card(RANK.FOUR)])!,
          bottom: [],
          handCounts: { 0: 2, 1: 17, 2: 17 },
          history: [],
        },
        createDouZeroHttpAdapter(base, { timeoutMs: 50 }),
      );
      // fallback 仍应给出能压过 4 的合法出牌（普通档 bot）
      expect(chosen).not.toBeNull();
      expect(chosen!.length).toBeGreaterThan(0);
    });
  });

  it('infer 5xx → fallback 规则机器人', async () => {
    await withMockServer((_req, res) => {
      res.statusCode = 503;
      res.end('{"error":"busy"}');
    }, async (base) => {
      const chosen = await choosePlayWithDouZero(
        {
          seat: 0,
          landlordSeat: 0,
          hand: [card(RANK.FIVE, '5a')],
          prev: null,
          bottom: [],
          handCounts: { 0: 1, 1: 17, 2: 17 },
          history: [],
        },
        createDouZeroHttpAdapter(base, { timeoutMs: 500 }),
      );
      expect(chosen?.map((c) => c.rank)).toEqual([RANK.FIVE]);
    });
  });
});
