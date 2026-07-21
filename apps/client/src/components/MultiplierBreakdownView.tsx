import type { MultiplierBreakdown } from '@card-game/rules';
import { breakdownParts, fallbackBreakdown } from '../lib/multiplierDisplay';

type Variant = 'hud' | 'settle';

/**
 * 倍数构成展示（LRM-194）。
 * - hud：桌面弱 HUD，总倍数 + 五段构成
 * - settle：结算页，构成更醒目但不抢胜负主层级
 */
export function MultiplierBreakdownView({
  breakdown,
  multiplier,
  variant = 'hud',
}: {
  breakdown?: MultiplierBreakdown | null;
  multiplier: number;
  variant?: Variant;
}) {
  const b = breakdown ?? fallbackBreakdown(multiplier);
  const parts = breakdownParts(b);
  const total = b.current || multiplier;

  return (
    <div
      className={`mult-breakdown mult-breakdown--${variant}`}
      aria-label={`当前倍数 ×${total}，构成 ${parts.map((p) => `${p.label}×${p.factor}`).join('、')}`}
    >
      <div className="mult-breakdown-total">
        倍数 <strong>×{total}</strong>
      </div>
      <ul className="mult-breakdown-parts">
        {parts.map((p) => (
          <li
            key={p.key}
            className={`mult-part${p.active && p.key !== 'bid' ? ' is-active' : ''}`}
          >
            <span className="mult-part-label">{p.label}</span>
            <span className="mult-part-factor">×{p.factor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
