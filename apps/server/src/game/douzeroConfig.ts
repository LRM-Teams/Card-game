/**
 * DouZero 推理脚手架配置（LRM-310）。
 * 训模冻结期只探活 + 文档化切换接口，不接真 ckpt、不上线人机对战。
 */
export interface DouZeroCkptConfig {
  /** 逻辑模型 id（运维/训模 Agent 切换用，可不对应真实路径） */
  modelId: string;
  /** 可选：ckpt 根目录；训模 Agent 约定子路径即可，服务端不解析 */
  ckptDir: string | null;
  /** 三角色 ckpt；未设则为 null（stub） */
  landlord: string | null;
  landlordUp: string | null;
  landlordDown: string | null;
}

export interface DouZeroRuntimeConfig {
  inferUrl: string | null;
  timeoutMs: number;
  ckpt: DouZeroCkptConfig;
}

export function resolveDouZeroTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.DOUZERO_INFER_TIMEOUT_MS ?? '1500');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1500;
}

export function resolveDouZeroCkptConfig(env: NodeJS.ProcessEnv = process.env): DouZeroCkptConfig {
  const modelId =
    env.DOUZERO_MODEL_ID?.trim() ||
    env.DOUZERO_CKPT?.trim() ||
    'default';
  const ckptDir = env.DOUZERO_CKPT_DIR?.trim() || null;
  return {
    modelId,
    ckptDir,
    landlord: env.DOUZERO_LANDLORD_CKPT?.trim() || null,
    landlordUp: env.DOUZERO_LANDLORD_UP_CKPT?.trim() || null,
    landlordDown: env.DOUZERO_LANDLORD_DOWN_CKPT?.trim() || null,
  };
}

export function resolveDouZeroRuntimeConfig(env: NodeJS.ProcessEnv = process.env): DouZeroRuntimeConfig {
  const url = env.DOUZERO_INFER_URL?.trim() || null;
  return {
    inferUrl: url,
    timeoutMs: resolveDouZeroTimeout(env),
    ckpt: resolveDouZeroCkptConfig(env),
  };
}

export interface InferHealthResult {
  ok: boolean;
  url: string;
  statusCode: number | null;
  body: unknown;
  error?: string;
  elapsedMs: number;
}

/** GET `{inferUrl}/health`；超时/网络错误 → ok:false（不抛）。 */
export async function probeInferHealth(
  inferUrl: string,
  timeoutMs = 2000,
): Promise<InferHealthResult> {
  const base = inferUrl.replace(/\/+$/, '');
  const url = `${base}/health`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return {
      ok: res.ok,
      url,
      statusCode: res.status,
      body,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      url,
      statusCode: null,
      body: null,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 启动时写一行探活日志；未配置 URL 则跳过。 */
export async function logInferProbeOnBoot(env: NodeJS.ProcessEnv = process.env): Promise<InferHealthResult | null> {
  const cfg = resolveDouZeroRuntimeConfig(env);
  if (!cfg.inferUrl) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: 'douzero.probe.skip',
        reason: 'DOUZERO_INFER_URL unset',
        ckpt: cfg.ckpt,
      }),
    );
    return null;
  }
  const result = await probeInferHealth(cfg.inferUrl, Math.min(cfg.timeoutMs, 3000));
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: result.ok ? 'douzero.probe.ok' : 'douzero.probe.fail',
      inferUrl: cfg.inferUrl,
      timeoutMs: cfg.timeoutMs,
      ckpt: cfg.ckpt,
      statusCode: result.statusCode,
      elapsedMs: result.elapsedMs,
      error: result.error,
      body: result.body,
    }),
  );
  return result;
}
