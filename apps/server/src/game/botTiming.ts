/**
 * 机器人行动前「像人思考」延迟（LRM-141 / LRM-154 / LRM-523）。
 * 默认 500–1000ms；可用环境变量覆盖，硬顶默认 ≤2000ms 避免演示卡顿。
 */
const DEFAULT_CAP_MS = 2000;

export function botThinkDelayMs(): number {
  const capRaw = Number(process.env.BOT_THINK_MS_CAP ?? DEFAULT_CAP_MS);
  const cap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : DEFAULT_CAP_MS;

  let min = Number(process.env.BOT_THINK_MS_MIN ?? 500);
  let max = Number(process.env.BOT_THINK_MS_MAX ?? 1000);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return Math.min(750, cap);
  if (min <= 0 && max <= 0) return 0;

  // 演示节奏：默认钳到 cap（通常 2s）
  min = Math.min(min, cap);
  max = Math.min(max, cap);

  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo === hi) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
