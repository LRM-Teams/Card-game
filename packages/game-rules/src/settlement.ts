import type { Seat } from './types';

export interface SettlementInput {
  /** 地主座位。 */
  landlord: Seat;
  /** 最先出完手牌的座位（决定胜负）。 */
  winnerSeat: Seat;
  /** 单注结算单位（底分 × 倍数），由 {@link './multiplier'} 的 `unitScore` 给出。 */
  unit: number;
}

export type Side = 'landlord' | 'farmer';

export interface Settlement {
  /** 胜方阵营。 */
  winnerSide: Side;
  /** 三家本局得分（+赢得 / -输掉），按座位顺序 [seat0, seat1, seat2]。 */
  scores: [number, number, number];
}

/**
 * 胜负与结算（纯函数）。
 *
 * - `winnerSeat === landlord` → 地主胜：地主 +2×unit，两农民各 -unit。
 * - 否则 → 农民胜：地主 -2×unit，两农民各 +unit。
 *
 * MVP 不计春天 / 反春；倍数已通过 `unit` 折算进来。
 */
export function settle(input: SettlementInput): Settlement {
  const { landlord, winnerSeat, unit } = input;
  const landlordWins = winnerSeat === landlord;
  const winnerSide: Side = landlordWins ? 'landlord' : 'farmer';
  const scores: [number, number, number] = [0, 0, 0];
  for (let s = 0; s < 3; s++) {
    if (s === landlord) {
      scores[s] = landlordWins ? 2 * unit : -2 * unit;
    } else {
      scores[s] = landlordWins ? -unit : unit;
    }
  }
  return { winnerSide, scores };
}
