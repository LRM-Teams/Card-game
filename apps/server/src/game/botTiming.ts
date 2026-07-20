/** 机器人行动前「像人思考」延迟（LRM-141 / LRM-154）。可通过环境变量覆盖。 */
export function botThinkDelayMs(): number {
  const min = Number(process.env.BOT_THINK_MS_MIN ?? 500);
  const max = Number(process.env.BOT_THINK_MS_MAX ?? 1000);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 750;
  if (min <= 0 && max <= 0) return 0;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo === hi) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
