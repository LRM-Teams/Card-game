import type { CSSProperties } from 'react';
import { MOTION } from '../lib/motionSpec';

/** 结算层克制金币：少量短距粒子，无全屏泛光。 */
export function SettleCoins({ win }: { win: boolean }) {
  if (!win) return null;
  const coins = Array.from({ length: MOTION.coinCount }, (_, i) => i);
  return (
    <div className="settle-coins" aria-hidden="true">
      {coins.map((i) => (
        <span
          key={i}
          className="settle-coin"
          style={
            {
              '--coin-i': i,
              '--coin-x': `${((i % 4) - 1.5) * 16}px`,
              '--coin-delay': `${i * MOTION.coinDelayMs}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
