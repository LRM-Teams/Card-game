import type { BidChoice, BidEntry, Seat } from '@card-game/rules';

/** 单次叫/抢在桌面展示的文案（取决于此前是否已有 claim）。 */
export function bidChoiceLabel(choice: BidChoice, hadPriorClaim: boolean): string {
  if (choice === 'claim') return hadPriorClaim ? '抢地主' : '叫地主';
  return hadPriorClaim ? '不抢' : '不叫';
}

/** 当前轮是否已有任一玩家 claim（决定按钮是叫/不叫还是抢/不抢）。 */
export function biddingHasClaim(history: readonly BidEntry[]): boolean {
  return history.some((e) => e.choice === 'claim');
}

/** 某座位在本轮叫牌中的最新结果文案；尚未表态则 null。 */
export function bidStatusForSeat(history: readonly BidEntry[], seat: Seat): string | null {
  let lastIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.seat === seat) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) return null;
  const entry = history[lastIdx]!;
  const hadPriorClaim = history.slice(0, lastIdx).some((e) => e.choice === 'claim');
  return bidChoiceLabel(entry.choice, hadPriorClaim);
}
