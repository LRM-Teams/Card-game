/**
 * 最小可观测性（LRM-275）：结构化对局日志 + health 版本信息。
 * 一行一条 JSON，便于 `docker logs ddz | grep room.join` 复盘。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type OpsEvent =
  | 'room.create'
  | 'room.join'
  | 'game.start'
  | 'game.settle'
  | 'player.reconnect'
  /** 快速匹配成桌（fillBots=true 时为超时补机路径，可 grep match.form） */
  | 'match.form';

export interface OpsLogFields {
  event: OpsEvent;
  roomId: string;
  phase?: string;
  seat?: number | null;
  humanCount?: number;
  playerCount?: number;
  [key: string]: unknown;
}

/** 结构化日志：stdout 一行 JSON，前缀便于 grep。 */
export function opsLog(fields: OpsLogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: 'card-game-server',
    ...fields,
  });
  // eslint-disable-next-line no-console
  console.log(`[ops] ${line}`);
}

function readGitCommitFallback(): string | undefined {
  // 开发态：尝试读 .git/HEAD → ref
  try {
    const gitDir = resolve(process.cwd(), '../../.git');
    const headPath = join(gitDir, 'HEAD');
    if (!existsSync(headPath)) return undefined;
    const head = readFileSync(headPath, 'utf8').trim();
    if (head.startsWith('ref:')) {
      const ref = head.slice(4).trim();
      const refPath = join(gitDir, ref);
      if (existsSync(refPath)) return readFileSync(refPath, 'utf8').trim().slice(0, 40);
    }
    return head.slice(0, 40);
  } catch {
    return undefined;
  }
}

/** 从 CLIENT_DIST/assets 里找主 bundle 名（Vite：index-XXXX.js）。 */
export function detectClientBundle(clientDist: string): string | null {
  if (!clientDist) return null;
  try {
    const assets = join(clientDist, 'assets');
    if (!existsSync(assets)) return null;
    const names = readdirSync(assets).filter((n) => /^index-.*\.js$/.test(n));
    names.sort();
    return names[names.length - 1] ?? null;
  } catch {
    return null;
  }
}

export interface HealthPayload {
  ok: true;
  service: 'card-game-server';
  /** deployed tip / git SHA（短或长均可；优先 GIT_COMMIT / BUILD_COMMIT） */
  commit: string;
  /** 前端主 bundle 文件名；未知时为 null */
  bundle: string | null;
}

export function buildHealthPayload(clientDist = ''): HealthPayload {
  const commit =
    process.env.GIT_COMMIT?.trim() ||
    process.env.BUILD_COMMIT?.trim() ||
    process.env.COMMIT_SHA?.trim() ||
    readGitCommitFallback() ||
    'unknown';
  const bundle =
    process.env.BUILD_BUNDLE?.trim() ||
    process.env.CLIENT_BUNDLE?.trim() ||
    detectClientBundle(clientDist) ||
    null;
  return {
    ok: true,
    service: 'card-game-server',
    commit,
    bundle,
  };
}
