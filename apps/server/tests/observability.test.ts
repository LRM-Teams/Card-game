import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHealthPayload,
  detectClientBundle,
  opsLog,
} from '../src/observability';

describe('observability', () => {
  const envKeys = ['GIT_COMMIT', 'BUILD_COMMIT', 'COMMIT_SHA', 'BUILD_BUNDLE', 'CLIENT_BUNDLE'] as const;
  const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
      delete saved[k];
    }
    vi.restoreAllMocks();
  });

  function stashEnv(): void {
    for (const k of envKeys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  }

  it('detectClientBundle 取 assets 下最新 index-*.js', () => {
    const root = mkdtempSync(join(tmpdir(), 'cg-obs-'));
    const assets = join(root, 'assets');
    mkdirSync(assets);
    writeFileSync(join(assets, 'index-aaa.js'), '');
    writeFileSync(join(assets, 'index-zzz.js'), '');
    writeFileSync(join(assets, 'other.js'), '');
    expect(detectClientBundle(root)).toBe('index-zzz.js');
  });

  it('buildHealthPayload 优先 GIT_COMMIT / BUILD_BUNDLE', () => {
    stashEnv();
    process.env.GIT_COMMIT = 'abc1234';
    process.env.BUILD_BUNDLE = 'index-test.js';
    expect(buildHealthPayload('')).toEqual({
      ok: true,
      service: 'card-game-server',
      commit: 'abc1234',
      bundle: 'index-test.js',
    });
  });

  it('opsLog 输出 [ops] 前缀 JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    opsLog({
      event: 'room.join',
      roomId: 'room-1',
      phase: 'idle',
      seat: 0,
      humanCount: 1,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0] ?? '');
    expect(line.startsWith('[ops] ')).toBe(true);
    const payload = JSON.parse(line.slice('[ops] '.length)) as Record<string, unknown>;
    expect(payload.event).toBe('room.join');
    expect(payload.roomId).toBe('room-1');
    expect(payload.service).toBe('card-game-server');
    expect(typeof payload.ts).toBe('string');
  });
});
