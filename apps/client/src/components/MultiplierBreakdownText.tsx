/** 倍数构成文案（桌面 HUD / 结算共用）。 */
import type { MultiplierBreakdown } from '@card-game/rules';

export function formatMultiplierBreakdown(b: MultiplierBreakdown | null | undefined): string {
  if (!b) return '';
  const parts = [`底${b.base}`];
  if (b.reveal) parts.push('明牌×2');
  if (b.doubleCount > 0) parts.push(`加倍×2^${b.doubleCount}`);
  if (b.bombCount > 0) parts.push(`炸弹×2^${b.bombCount}`);
  if (b.spring) parts.push('春天×2');
  return parts.join(' · ');
}

export function MultiplierBreakdownText({
  breakdown,
  className,
}: {
  breakdown: MultiplierBreakdown | null | undefined;
  className?: string;
}) {
  const text = formatMultiplierBreakdown(breakdown);
  if (!text) return null;
  return (
    <span className={className ?? 'mult-breakdown'} aria-label="倍数构成">
      {text}
    </span>
  );
}
