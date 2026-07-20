/** AI 自动出牌前的可感知思考延迟（LRM-141 / LRM-154）。 */
export const BOT_THINK_MS_MIN = 500;
export const BOT_THINK_MS_MAX = 1000;

export function botThinkDelay(): Promise<void> {
  const span = BOT_THINK_MS_MAX - BOT_THINK_MS_MIN + 1;
  const ms = BOT_THINK_MS_MIN + Math.floor(Math.random() * span);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
