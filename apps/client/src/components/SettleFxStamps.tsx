import type { MultiplierBreakdown } from '@card-game/rules';
import { NP_FX } from '../lib/narrativeSettleAssets';

/** 结算页加倍/春天/炸弹叙事徽章条（LRM-522） */
export function SettleFxStamps({ breakdown }: { breakdown?: MultiplierBreakdown | null }) {
  if (!breakdown) return null;
  const showDouble = (breakdown.doubleCount ?? 0) > 0;
  const showBomb = (breakdown.bombCount ?? 0) > 0;
  const showSpring = breakdown.spring;
  if (!showDouble && !showBomb && !showSpring) return null;

  return (
    <div className="np-settle-fx-stamps" aria-label="本局特效">
      {showDouble ? (
        <img className="pixel-art" src={NP_FX.double.active} alt="" title="加倍" />
      ) : null}
      {showSpring ? (
        <img className="pixel-art" src={NP_FX.spring} alt="" title="春天" />
      ) : null}
      {showBomb ? (
        <img className="pixel-art" src={NP_FX.bomb} alt="" title="炸弹" />
      ) : null}
    </div>
  );
}
