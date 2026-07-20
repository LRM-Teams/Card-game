import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { identifyHand, RANK } from '@card-game/rules';
import type { Card } from '@card-game/rules';
import {
  buildDouZeroPlayState,
  choosePlayWithDouZero,
  createConfiguredDouZeroAdapter,
  createDouZeroCommandAdapter,
  createDouZeroHttpAdapter,
  douZeroPosition,
  fromDouZeroAction,
  listLegalActions,
  rankPlaySuggestions,
  toDouZeroCards,
} from '../src/game/douzeroAdapter';
import { GameRoom } from '../src/game/GameRoom';

function card(rank: number, id?: string): Card {
  return { id: id ?? `c${rank}`, rank, display: String(rank), suit: 'spade' };
}

/** 起一个本地 HTTP mock 服务跑完回调后关闭，用于测试常驻推理客户端。 */
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

describe('DouZero adapter', () => {
  it('转换内部牌到 DouZero 官方不带花色点数编码', () => {
    expect(toDouZeroCards([card(RANK.THREE), card(RANK.TEN), card(RANK.A), card(RANK.TWO)])).toEqual([
      3,
      10,
      14,
      17,
    ]);
    expect(toDouZeroCards([card(RANK.SMALL_JOKER), card(RANK.BIG_JOKER)])).toEqual([20, 30]);
  });

  it('按地主座位映射 DouZero 身份', () => {
    expect(douZeroPosition(1, 1)).toBe('landlord');
    expect(douZeroPosition(2, 1)).toBe('landlord_down');
    expect(douZeroPosition(0, 1)).toBe('landlord_up');
  });

  it('从 DouZero action 回选真实手牌，重复点数按数量消费', () => {
    const hand = [card(RANK.FIVE, '5a'), card(RANK.FIVE, '5b'), card(RANK.SEVEN, '7a')];
    expect(fromDouZeroAction([5, 5], hand)?.map((c) => c.id)).toEqual(['5a', '5b']);
    expect(fromDouZeroAction([5, 5, 5], hand)).toBeNull();
  });

  it('生成当前可压过上家的合法动作列表', () => {
    const hand = [card(RANK.THREE), card(RANK.FIVE), card(RANK.FIVE, '5b'), card(RANK.SMALL_JOKER), card(RANK.BIG_JOKER)];
    const prev = identifyHand([card(RANK.FOUR)])!;
    const actions = listLegalActions(hand, prev).map(toDouZeroCards);
    expect(actions).toContainEqual([5]);
    expect(actions).toContainEqual([20, 30]);
    expect(actions).not.toContainEqual([3]);
  });

  it('按我方规则过滤 DouZero 超集牌型，不生成飞机同点翅', () => {
    const hand = [
      ...Array.from({ length: 4 }, (_, i) => card(RANK.THREE, `3-${i}`)),
      ...Array.from({ length: 4 }, (_, i) => card(RANK.FOUR, `4-${i}`)),
      ...Array.from({ length: 4 }, (_, i) => card(RANK.FIVE, `5-${i}`)),
      ...Array.from({ length: 4 }, (_, i) => card(RANK.SIX, `6-${i}`)),
      ...Array.from({ length: 4 }, (_, i) => card(RANK.SEVEN, `7-${i}`)),
    ];
    const actions = listLegalActions(hand, null).map(toDouZeroCards);

    expect(actions).not.toContainEqual([3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7]);
  });

  it('构造 DouZero 状态包含身份、底牌、手牌数、历史和合法动作', () => {
    const hand = [card(RANK.FIVE), card(RANK.SIX)];
    const prev = identifyHand([card(RANK.FOUR)])!;
    const state = buildDouZeroPlayState({
      seat: 2,
      landlordSeat: 1,
      hand,
      prev,
      bottom: [card(RANK.A)],
      handCounts: { 0: 17, 1: 20, 2: 2 },
      history: [{ seat: 1, cards: [card(RANK.FOUR)], isPass: false }],
    });

    expect(state.position).toBe('landlord_down');
    expect(state.modelKey).toBe('landlord_down');
    expect(state.hand).toEqual([5, 6]);
    expect(state.lastMove).toEqual([4]);
    expect(state.bottom).toEqual([14]);
    expect(state.handCounts[1]).toBe(20);
    expect(state.playedCards).toEqual([4]);
    expect(state.playHistory[0]).toEqual({ position: 'landlord', action: [4], isPass: false });
    expect(state.legalActions).toContainEqual([5]);
    expect(state.legalActions).toContainEqual([]);
  });

  it('命令适配器可通过 JSON stdin/stdout 返回 DouZero action', async () => {
    const adapter = createDouZeroCommandAdapter(
      `node -e "process.stdin.resume();process.stdin.on('data',()=>process.stdout.write(JSON.stringify({action:[5]})))"`,
    );
    const state = buildDouZeroPlayState({
      seat: 0,
      landlordSeat: 0,
      hand: [card(RANK.FIVE)],
      prev: null,
      bottom: [],
      handCounts: { 0: 1, 1: 17, 2: 17 },
      history: [],
    });

    expect(await adapter.choosePlay(state)).toEqual([5]);
  });

  it('配置缺失时不启用 DouZero 外部推理适配器', () => {
    expect(createConfiguredDouZeroAdapter({})).toBeUndefined();
  });

  it('非法模型输出会 fallback 到当前最小合法 bot 行为', async () => {
    const hand = [card(RANK.THREE), card(RANK.FIVE)];
    const prev = identifyHand([card(RANK.FOUR)])!;
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
      { choosePlay: async () => [3] },
    );

    expect(chosen?.map((c) => c.rank)).toEqual([RANK.FIVE]);
  });

  it('模型选择空 action 时按过牌处理而不是强制 fallback 出牌', async () => {
    const chosen = await choosePlayWithDouZero(
      {
        seat: 0,
        landlordSeat: 0,
        hand: [card(RANK.THREE), card(RANK.FIVE)],
        prev: identifyHand([card(RANK.FOUR)])!,
        bottom: [],
        handCounts: { 0: 2, 1: 17, 2: 17 },
        history: [],
      },
      { choosePlay: async () => [] },
    );

    expect(chosen).toBeNull();
  });

  it('端到端 mock：游戏状态→adapter→真实子进程→解析→应用回对局，全链路跑通', async () => {
    // 按 douzero-infer.example.py 的 stdin/stdout 契约写一个假推理子进程：
    // 收 DouZeroPlayState JSON，回 legalActions[0]（合法动作），并按 env 记录被调用身份。
    const mockSrc = [
      "const { appendFileSync } = require('node:fs');",
      "let raw = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (c) => { raw += c; });",
      "process.stdin.on('end', () => {",
      "  let state;",
      "  try { state = JSON.parse(raw); } catch { process.exit(2); }",
      "  const legal = Array.isArray(state.legalActions) ? state.legalActions : [];",
      "  const action = legal.length > 0 ? legal[0] : [];",
      "  if (process.env.DOUMOCK_LOG) { try { appendFileSync(process.env.DOUMOCK_LOG, state.position + '\\n'); } catch {} }",
      "  process.stdout.write(JSON.stringify(action));",
      "  process.exit(0);",
      "});",
    ].join('\n');

    const dir = mkdtempSync(join(tmpdir(), 'douzero-e2e-'));
    const mockScript = join(dir, 'mock-infer.cjs');
    const logPath = join(dir, 'calls.log');
    writeFileSync(mockScript, mockSrc);
    writeFileSync(logPath, '');
    const prevLog = process.env.DOUMOCK_LOG;
    process.env.DOUMOCK_LOG = logPath;

    try {
      const adapter = createDouZeroCommandAdapter(`node ${mockScript}`, { timeoutMs: 5000 });
      const room = new GameRoom('e2e-mock', adapter);

      expect((await room.start(true)).ok).toBe(true);
      await room.drainBots();
      // 全机器人局，全部出牌都经真实子进程推理推进到结算
      expect(room.phase).toBe('settled');
      expect(room.result).not.toBeNull();
      const sum = room.result!.scores.reduce((a, b) => a + b, 0);
      expect(sum).toBe(0); // 零和
      expect(room.playHistory.filter((h) => !h.isPass).length).toBeGreaterThan(0);

      // 证明真实子进程被调用过，且跨身份（地主 + 农民）
      const calls = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls).toContain('landlord');
      expect(calls.some((p) => p === 'landlord_up' || p === 'landlord_down')).toBe(true);
    } finally {
      if (prevLog === undefined) delete process.env.DOUMOCK_LOG;
      else process.env.DOUMOCK_LOG = prevLog;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('配置 DOUZERO_INFER_URL 时启用常驻 HTTP 适配器，空配置仍不启用', () => {
    expect(createConfiguredDouZeroAdapter({ DOUZERO_INFER_URL: 'http://127.0.0.1:8080' })).toBeDefined();
    expect(createConfiguredDouZeroAdapter({ DOUZERO_INFER_URL: '   ' })).toBeUndefined();
  });

  it('HTTP 适配器调用常驻 /infer 返回 DouZero action（200 + {action}）', async () => {
    await withMockServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const st = JSON.parse(body);
        res.setHeader('content-type', 'application/json');
        // 回传 legalActions 里的一个动作，证明会进入合法过滤
        res.end(JSON.stringify({ action: st.legalActions?.[0] ?? [5] }));
      });
    }, async (base) => {
      const adapter = createDouZeroHttpAdapter(base, { timeoutMs: 2000 });
      const state = buildDouZeroPlayState({
        seat: 0,
        landlordSeat: 0,
        hand: [card(RANK.FIVE)],
        prev: null,
        bottom: [],
        handCounts: { 0: 1, 1: 17, 2: 17 },
        history: [],
      });
      expect(await adapter.choosePlay(state)).toEqual([5]);
    });
  });

  it('HTTP 服务 500 / 解析失败 → choosePlay 返回 null，上层可 fallback', async () => {
    await withMockServer((_req, res) => {
      res.statusCode = 500;
      res.end('{}');
    }, async (base) => {
      const adapter = createDouZeroHttpAdapter(base, { timeoutMs: 2000 });
      const state = buildDouZeroPlayState({
        seat: 0,
        landlordSeat: 0,
        hand: [card(RANK.FIVE)],
        prev: null,
        bottom: [],
        handCounts: { 0: 1, 1: 17, 2: 17 },
        history: [],
      });
      expect(await adapter.choosePlay(state)).toBeNull();
    });
  });

  it('choosePlayWithDouZero 经 HTTP 返回的合法动作会被采用', async () => {
    await withMockServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ action: [5] }));
      });
    }, async (base) => {
      const chosen = await choosePlayWithDouZero(
        {
          seat: 0,
          landlordSeat: 0,
          hand: [card(RANK.FIVE, '5a')],
          prev: identifyHand([card(RANK.FOUR)])!,
          bottom: [],
          handCounts: { 0: 1, 1: 17, 2: 17 },
          history: [],
        },
        createDouZeroHttpAdapter(base, { timeoutMs: 2000 }),
      );
      expect(chosen?.map((c) => c.rank)).toEqual([RANK.FIVE]);
    });
  });

  it('HTTP rankActions 返回 top-N 带分，rankPlaySuggestions 给出多条规则合法建议', async () => {
    await withMockServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ action: [5], top: [{ action: [5], value: 0.9 }, { action: [6], value: 0.5 }] }));
    }, async (base) => {
      const suggestions = await rankPlaySuggestions(
        {
          seat: 0,
          landlordSeat: 0,
          hand: [card(RANK.FIVE, '5a'), card(RANK.SIX, '6a')],
          prev: identifyHand([card(RANK.FOUR)])!,
          bottom: [],
          handCounts: { 0: 2, 1: 17, 2: 17 },
          history: [],
        },
        createDouZeroHttpAdapter(base, { timeoutMs: 2000 }),
        5,
      );
      expect(suggestions.map((cs) => cs.map((c) => c.rank))).toEqual([[RANK.FIVE], [RANK.SIX]]);
    });
  });

  it('rankActions 缺失（command 适配器）时退化为 choosePlay top-1', async () => {
    const adapter = createDouZeroCommandAdapter(
      `node -e "process.stdin.resume();process.stdin.on('data',()=>process.stdout.write(JSON.stringify([5])))"`,
    );
    expect(adapter.rankActions).toBeUndefined();
    const suggestions = await rankPlaySuggestions(
      {
        seat: 0,
        landlordSeat: 0,
        hand: [card(RANK.FIVE, '5a')],
        prev: null,
        bottom: [],
        handCounts: { 0: 1, 1: 17, 2: 17 },
        history: [],
      },
      adapter,
      3,
    );
    expect(suggestions.map((cs) => cs.map((c) => c.rank))).toEqual([[RANK.FIVE]]);
  });

  it('rankActions 返回的动作不在手牌/合法集会被规则过滤掉', async () => {
    await withMockServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      // 17(=2) 不在手牌/合法集 → 应被过滤；[5] 合法 → 保留
      res.end(JSON.stringify({ action: [5], top: [{ action: [17], value: 0.99 }, { action: [5], value: 0.4 }] }));
    }, async (base) => {
      const suggestions = await rankPlaySuggestions(
        {
          seat: 0,
          landlordSeat: 0,
          hand: [card(RANK.FIVE, '5a')],
          prev: null,
          bottom: [],
          handCounts: { 0: 1, 1: 17, 2: 17 },
          history: [],
        },
        createDouZeroHttpAdapter(base, { timeoutMs: 2000 }),
        5,
      );
      expect(suggestions.map((cs) => cs.map((c) => c.rank))).toEqual([[RANK.FIVE]]);
    });
  });

  it('GameRoom 机器人出牌可调用适配器，模型异常时仍能 fallback 跑完', async () => {
    const room = new GameRoom('ai-fallback', {
      choosePlay: async () => {
        throw new Error('DouZero service unavailable');
      },
    });

    expect((await room.start(true)).ok).toBe(true);
    await room.drainBots();
    expect(room.phase).toBe('settled');
    expect(room.result).not.toBeNull();
    expect(room.playHistory.length).toBeGreaterThan(0);
  });
});
