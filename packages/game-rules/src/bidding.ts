import type { Seat } from './types';

/** 单次叫 / 抢选择：claim=叫或抢（要当地主），pass=不叫 / 不抢。 */
export type BidChoice = 'claim' | 'pass';

/** 一位玩家的出价记录（按实际叫牌顺序收集）。 */
export interface BidEntry {
  seat: Seat;
  choice: BidChoice;
}

export interface BiddingResult {
  /** 地主座位；流局时为 null。 */
  landlord: Seat | null;
  /** 是否流局（无人叫 / 抢）→ 需重发。 */
  redeal: boolean;
  /** 首叫者座位（首个 claim）；无人叫为 null。 */
  callSeat: Seat | null;
}

/**
 * 抢地主结算（MVP：A 方案，单轮线性）。
 *
 * 规则（@阿策 #110 已定）：
 * - 玩家按座位顺序依次出价（首"叫"者 → 后续依次可"抢"）。
 * - `claim` 既表示"叫"也表示"抢"——叫法随时机不同，效果一致（成为候选地主）。
 * - 遍历全部出价后，**最后一个 claim 的座位**为地主。
 * - 全部 `pass` → 流局重发（`redeal=true`，`landlord=null`）。
 *
 * 本函数只做"出价序列 → 结果"的纯结算；叫牌的轮次 / 时机 / 超时由服务端状态机驱动，
 * 把按顺序收集到的 `BidEntry[]` 传进来即可。MVP 不做"反抢"多轮回合。
 */
export function resolveBidding(entries: readonly BidEntry[]): BiddingResult {
  let landlord: Seat | null = null;
  let callSeat: Seat | null = null;
  for (const e of entries) {
    if (e.choice === 'claim') {
      if (callSeat === null) callSeat = e.seat;
      landlord = e.seat;
    }
  }
  return { landlord, redeal: landlord === null, callSeat };
}
