import type { Seat } from './types';
import type { BidRound } from './protocol';

/** 单次叫 / 抢选择：claim=叫或抢（要当地主），pass=不叫 / 不抢。 */
export type BidChoice = 'claim' | 'pass';

/**
 * 一位玩家的出价记录（按实际叫牌顺序收集）。
 *
 * `round` 区分 call 轮（叫地主）与 grab 轮（抢/反抢）。历史数据 / MVP 序列可缺省，
 * 缺省不影响结算（{@link resolveBidding} 只按 claim 顺序判定），因此老序列行为不变。
 */
export interface BidEntry {
  seat: Seat;
  choice: BidChoice;
  round?: BidRound;
}

export interface BiddingResult {
  /** 地主座位；流局时为 null。 */
  landlord: Seat | null;
  /** 是否流局（无人叫 / 抢）→ 需重发。 */
  redeal: boolean;
  /** 首叫者座位（首个 claim）；无人叫为 null。 */
  callSeat: Seat | null;
  /** grab 轮的 claim 次数（抢 + 反抢）；首个 claim（叫）不计入。 */
  grabClaims: number;
  /** 叫抢环节倍数：叫=1，每一次抢/反抢 ×2 → `2 ** grabClaims`。 */
  biddingMultiplier: number;
}

/** 座位数（斗地主固定 3）。 */
const SEATS = 3;

/**
 * 抢地主结算（多轮 call → grab → 反抢）。
 *
 * 规则（对标腾讯欢乐斗地主，@阿策 #110 定 + 贝克汉姆 长期方案）：
 * - call 轮：从首叫位起依次 claim(叫) / pass(不叫)。首个 claim 者成为临时地主，进入 grab 轮。
 * - grab 轮：其余玩家依次 claim(抢) / pass；抢过之后可被「反抢」，直到一圈无人再抢。
 * - **最后一个 claim 的座位**当地主；call 轮全 pass → 流局重发。
 * - 倍数：叫=基础 1；每一次「抢/反抢」×2（即 `2 ** grabClaims`）。
 *
 * 本函数是纯结算：给定**已收集完整**的出价序列 → 结果。叫牌的轮次 / 时机 / 超时由服务端
 * 状态机驱动（用 {@link isBiddingComplete} 判定何时收口），把有序 `BidEntry[]` 传进来即可。
 */
export function resolveBidding(entries: readonly BidEntry[]): BiddingResult {
  let landlord: Seat | null = null;
  let callSeat: Seat | null = null;
  let claimCount = 0;
  for (const e of entries) {
    if (e.choice === 'claim') {
      if (callSeat === null) callSeat = e.seat;
      landlord = e.seat;
      claimCount += 1;
    }
  }
  // 首个 claim 是「叫」，其余都是「抢/反抢」。
  const grabClaims = claimCount === 0 ? 0 : claimCount - 1;
  return {
    landlord,
    redeal: landlord === null,
    callSeat,
    grabClaims,
    biddingMultiplier: 2 ** grabClaims,
  };
}

/** {@link isBiddingComplete} 的返回。 */
export interface BiddingProgress {
  /** 叫抢是否已收口（流局或地主敲定）。 */
  complete: boolean;
  /** 收口时是否流局（全 pass）。 */
  redeal: boolean;
  /** 收口时的地主座位；未收口 / 流局为 null。 */
  landlord: Seat | null;
}

/**
 * 判定叫抢是否收口（单一事实来源，供服务端 grab 轮状态机调用）。
 *
 * - call 轮：三家全 pass → 流局收口；出现首个 claim → 进入 grab 轮。
 * - grab 轮：**最后一次 claim 之后，其余两家都已再次表态且均为 pass**（一圈无人再抢）→ 收口，
 *   最后 claim 者当地主。任何一次新的 claim（抢/反抢）都会重置这一圈，允许继续反抢。
 * - 只要还有非地主座位在「最后一次 claim 之后」未表态，就未收口（那家还欠一次抢/不抢决定）。
 *
 * 纯函数、只从已收集出价推断（不依赖服务端出牌顺序）。`startSeat` 预留给服务端语义，
 * 当前实现只需出价序列即可判定。
 */
export function isBiddingComplete(_startSeat: Seat, entries: readonly BidEntry[]): BiddingProgress {
  let lastClaimIdx = -1;
  let lastClaimSeat: Seat | null = null;
  let callSeen = false;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.choice === 'claim') {
      lastClaimIdx = i;
      lastClaimSeat = e.seat;
      callSeen = true;
    }
  }

  if (!callSeen) {
    // call 轮无人叫：三家都 pass 过一遍才算流局收口，否则还在 call 轮。
    const passedSeats = new Set(entries.filter((e) => e.choice === 'pass').map((e) => e.seat));
    if (passedSeats.size >= SEATS) {
      return { complete: true, redeal: true, landlord: null };
    }
    return { complete: false, redeal: false, landlord: null };
  }

  // 已有 claim：grab 收口需最后 claim 之后，其余两家都已 pass（且未再 claim）。
  const after = entries.slice(lastClaimIdx + 1);
  const passedAfter = new Set(
    after.filter((e) => e.choice === 'pass' && e.seat !== lastClaimSeat).map((e) => e.seat),
  );
  const othersDeclined = passedAfter.size >= SEATS - 1; // 其余两家均已放弃反抢
  if (othersDeclined) {
    return { complete: true, redeal: false, landlord: lastClaimSeat };
  }
  return { complete: false, redeal: false, landlord: null };
}
