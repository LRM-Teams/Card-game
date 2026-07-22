/**
 * DouZero 推理探活与 ckpt/model 配置脚手架（LRM-310）。
 *
 * - 启动 / 对局前对 `DOUZERO_INFER_URL/health` 探活并打日志
 * - 探活失败不阻断开局；出牌路径仍靠 adapter 超时/5xx → 规则机器人普通档
 * - `DOUZERO_MODEL_ID` / `DOUZERO_CKPT_DIR` 供训模 Agent 切换 ckpt，无需改代码
 */
import { join } from 'node:path';

export interface DouZeroInferConfig {
  /** 常驻推理 HTTP 基址（无尾斜杠），未配置则为 null */
  url: string | null;
  timeoutMs: number;
  /** 探活专用超时，默认短于推理超时 */
  healthTimeoutMs: number;
  /** 可选模型 id（训模侧切换用；可 stub） */
  modelId: string | null;
  /** 可选 ckpt 根目录；与 modelId 组合解析三身份路径 */
  ckptDir: string | null;
  /** 解析后的三身份 ckpt 路径（仅文档/日志/透传；TS 不加载权重） */
  ckptPaths: {
    landlord: string | null;
    landlord_up: string | null;
    landlord_down: string | null;
  };
}

export type DouZeroHealthStatus = 'ok' | 'unreachable' | 'unhealthy' | 'skipped';

export interface DouZeroHealthResult {
  status: DouZeroHealthStatus;
  url: string | null;
  latencyMs: number | null;
  detail?: string;
  models?: string[];
  modelId: string | null;
}

const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_HEALTH_TIMEOUT_MS = 800;
/** 对局前探活缓存，避免每局都打一次 */
const PROBE_CACHE_TTL_MS = 60_000;

let lastProbe: { at: number; result: DouZeroHealthResult } | null = null;

export function resolveDouZeroTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.DOUZERO_INFER_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function resolveDouZeroHealthTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.DOUZERO_HEALTH_TIMEOUT_MS ?? String(DEFAULT_HEALTH_TIMEOUT_MS));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HEALTH_TIMEOUT_MS;
}

/**
 * 解析 ckpt 路径约定（与 Python douzero_lib.load_ckpt_paths 对齐）：
 * 1. 显式 `DOUZERO_LANDLORD_*_CKPT`
 * 2. 否则 `DOUZERO_CKPT_DIR`[+`DOUZERO_MODEL_ID`]/{position}.ckpt
 */
export function resolveCkptPaths(env: NodeJS.ProcessEnv = process.env): DouZeroInferConfig['ckptPaths'] {
  const modelId = env.DOUZERO_MODEL_ID?.trim() || null;
  const ckptDir = env.DOUZERO_CKPT_DIR?.trim() || null;
  const base = ckptDir ? (modelId ? join(ckptDir, modelId) : ckptDir) : null;

  const pick = (explicit: string | undefined, file: string): string | null => {
    const e = explicit?.trim();
    if (e) return e;
    return base ? join(base, file) : null;
  };

  return {
    landlord: pick(env.DOUZERO_LANDLORD_CKPT, 'landlord.ckpt'),
    landlord_up: pick(env.DOUZERO_LANDLORD_UP_CKPT, 'landlord_up.ckpt'),
    landlord_down: pick(env.DOUZERO_LANDLORD_DOWN_CKPT, 'landlord_down.ckpt'),
  };
}

export function resolveDouZeroInferConfig(env: NodeJS.ProcessEnv = process.env): DouZeroInferConfig {
  const raw = env.DOUZERO_INFER_URL?.trim() || null;
  const url = raw ? raw.replace(/\/+$/, '') : null;
  return {
    url,
    timeoutMs: resolveDouZeroTimeout(env),
    healthTimeoutMs: resolveDouZeroHealthTimeout(env),
    modelId: env.DOUZERO_MODEL_ID?.trim() || null,
    ckptDir: env.DOUZERO_CKPT_DIR?.trim() || null,
    ckptPaths: resolveCkptPaths(env),
  };
}

/** 结构化探活日志：`[douzero]` 前缀，便于 `docker logs | grep douzero`。 */
export function douzeroLog(fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: 'card-game-server',
    ...fields,
  });
  // eslint-disable-next-line no-console
  console.log(`[douzero] ${line}`);
}

/**
 * GET `${url}/health`。任何网络错误 / 非 2xx / 非 ok payload → 非 ok 状态。
 * 调用方不得因失败阻断对局。
 */
export async function probeDouZeroHealth(
  url: string,
  timeoutMs: number = DEFAULT_HEALTH_TIMEOUT_MS,
): Promise<DouZeroHealthResult> {
  const base = url.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        status: 'unhealthy',
        url: base,
        latencyMs,
        detail: `HTTP ${res.status}`,
        modelId: null,
      };
    }
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      return {
        status: 'unhealthy',
        url: base,
        latencyMs,
        detail: 'invalid JSON',
        modelId: null,
      };
    }
    const status =
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { status?: unknown }).status === 'ok'
        ? 'ok'
        : 'unhealthy';
    const models =
      typeof payload === 'object' &&
      payload !== null &&
      Array.isArray((payload as { models?: unknown }).models)
        ? ((payload as { models: unknown[] }).models.filter((m) => typeof m === 'string') as string[])
        : undefined;
    return {
      status,
      url: base,
      latencyMs,
      models,
      detail: status === 'ok' ? undefined : 'status!=ok',
      modelId: null,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const detail = err instanceof Error ? err.name === 'AbortError' ? 'timeout' : err.message : 'error';
    return {
      status: 'unreachable',
      url: base,
      latencyMs,
      detail,
      modelId: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function logDouZeroHealthResult(
  result: DouZeroHealthResult,
  reason: 'startup' | 'pre_game' | 'manual',
  config?: DouZeroInferConfig,
): void {
  douzeroLog({
    event: 'infer.health',
    reason,
    status: result.status,
    url: result.url,
    latencyMs: result.latencyMs,
    detail: result.detail,
    models: result.models,
    modelId: config?.modelId ?? result.modelId,
    ckptDir: config?.ckptDir ?? null,
    fallback: result.status === 'ok' ? 'douzero' : 'rules_normal',
  });
}

/**
 * 按环境配置探活一次并打日志。未配置 URL 时记 skipped，不抛错。
 * `force` 跳过缓存（启动探活用）。
 */
export async function probeConfiguredDouZeroInfer(
  env: NodeJS.ProcessEnv = process.env,
  options: { reason?: 'startup' | 'pre_game' | 'manual'; force?: boolean } = {},
): Promise<DouZeroHealthResult> {
  const reason = options.reason ?? 'manual';
  const config = resolveDouZeroInferConfig(env);

  if (!config.url) {
    const skipped: DouZeroHealthResult = {
      status: 'skipped',
      url: null,
      latencyMs: null,
      detail: 'DOUZERO_INFER_URL unset',
      modelId: config.modelId,
    };
    if (reason === 'startup') {
      douzeroLog({
        event: 'infer.config',
        reason,
        url: null,
        modelId: config.modelId,
        ckptDir: config.ckptDir,
        ckptPaths: config.ckptPaths,
        note: 'DouZero infer disabled; bot uses rules normal (LRM-260)',
      });
    }
    return skipped;
  }

  if (!options.force && lastProbe && Date.now() - lastProbe.at < PROBE_CACHE_TTL_MS) {
    return lastProbe.result;
  }

  if (reason === 'startup') {
    douzeroLog({
      event: 'infer.config',
      reason,
      url: config.url,
      timeoutMs: config.timeoutMs,
      healthTimeoutMs: config.healthTimeoutMs,
      modelId: config.modelId,
      ckptDir: config.ckptDir,
      ckptPaths: config.ckptPaths,
    });
  }

  const result = await probeDouZeroHealth(config.url, config.healthTimeoutMs);
  result.modelId = config.modelId;
  lastProbe = { at: Date.now(), result };
  logDouZeroHealthResult(result, reason, config);
  return result;
}

/** 测试用：清空探活缓存。 */
export function resetDouZeroProbeCache(): void {
  lastProbe = null;
}
