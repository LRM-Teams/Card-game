import type { Seat } from './types';

/** 单次叫 / 抢选择：claim=叫或抢（要当地主），pass=不叫 / 不抢。 */
export type BidChoice = 'claim' | 'pass';

/**
 * 叫/抢地主的轮次标签（对标腾讯欢乐斗地主：先「叫地主」，首个 claim 之后转「抢地主」）。
 * 客户端据此选气泡/按钮文案（叫地主/不叫 vs 抢地主/不抢）。
 */
export type BidRound = 'call' | 'grab';

/** 加倍选择（DOUBLING 阶段，每名玩家一次）：不加倍 ×1 / 加倍 ×2 / 超级加倍 ×4。 */
export type DoubleChoice = 'double' | 'super' | 'pass';

/**
 * 抢地主产生的倍数因子（单一事实来源）。
 * 规则（对标欢乐斗地主）：首个 claim 是「叫地主」（基础，不翻倍）；其后每一个 claim 都是「抢地主」，各 ×2。
 * @returns 2^(抢的次数)。无人叫/只有一人叫 → 1。
 */
export function grabFactor(entries: readonly BidEntry[]): number {
  const claims = entries.filter((e) => e.choice === 'claim').length;
  const grabs = Math.max(0, claims - 1);
  return 2 ** grabs;
}

/** 给定叫抢序列，返回某次出价属于「叫」还是「抢」轮（首个 claim 之前均为 call，其后为 grab）。 */
export function roundAt(entries: readonly BidEntry[], index: number): BidRound {
  for (let i = 0; i < index && i < entries.length; i++) {
    if (entries[i]!.choice === 'claim') return 'grab';
  }
  return 'call';
}

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
