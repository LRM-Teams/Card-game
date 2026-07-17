import { spawnSync } from 'node:child_process';
import { canPlay } from '@card-game/rules';
import type { Card, Hand, Seat } from '@card-game/rules';
import { HandType, identifyHand } from '@card-game/rules';
import { botChoosePlay } from './bot';

export type DouZeroPosition = 'landlord' | 'landlord_up' | 'landlord_down';
/** DouZero official rank encoding: 3..14(A), 17(2), 20(small joker), 30(big joker). */
export type DouZeroCard = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 17 | 20 | 30;
export type DouZeroAction = DouZeroCard[];

export interface BotPlayHistoryEntry {
  seat: Seat;
  cards: Card[];
  isPass: boolean;
}

export interface DouZeroPlayState {
  /** Determines which independent DouZero checkpoint to load. */
  position: DouZeroPosition;
  /** Alias kept explicit for external model loaders. */
  modelKey: DouZeroPosition;
  hand: DouZeroCard[];
  lastMove: DouZeroAction;
  bottom: DouZeroCard[];
  handCounts: Record<Seat, number>;
  playedCards: DouZeroCard[];
  playHistory: Array<{
    position: DouZeroPosition;
    action: DouZeroAction;
    isPass: boolean;
  }>;
  legalActions: DouZeroAction[];
}

export interface BotPlayContext {
  seat: Seat;
  landlordSeat: Seat;
  hand: readonly Card[];
  prev: Hand | null;
  bottom: readonly Card[];
  handCounts: Record<Seat, number>;
  history: readonly BotPlayHistoryEntry[];
}

export interface DouZeroBotAdapter {
  choosePlay(state: DouZeroPlayState): DouZeroAction | null;
  /**
   * 对所有合法出牌打分并返回 top-N（按分从高到低）。
   * - 复用 choosePlay 同一次推理的 value 头：AI 取 argmax，提示取 top-N。
   * - 未实现 / 不可用时返回 null，由调用方回退到启发式合法排序。
   * 仅作建议；输出仍须经 legalActions + canPlay 复校（权威在服务端）。
   */
  rankPlays?(state: DouZeroPlayState, topN?: number): RankedDouZeroPlay[] | null;
}

/** DouZero 打分后的一个候选动作（分数越高越优先）。 */
export interface RankedDouZeroPlay {
  action: DouZeroAction;
  score: number;
}

export interface DouZeroCommandAdapterOptions {
  timeoutMs?: number;
}

export function createConfiguredDouZeroAdapter(env: NodeJS.ProcessEnv = process.env): DouZeroBotAdapter | undefined {
  const command = env.DOUZERO_INFER_COMMAND?.trim();
  if (!command) return undefined;
  const parsedTimeout = Number(env.DOUZERO_INFER_TIMEOUT_MS ?? '1500');
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 1500;
  return createDouZeroCommandAdapter(command, { timeoutMs });
}

export function createDouZeroCommandAdapter(
  command: string,
  options: DouZeroCommandAdapterOptions = {},
): DouZeroBotAdapter {
  const timeoutMs = options.timeoutMs ?? 1500;
  return {
    choosePlay(state) {
      const child = spawnSync(command, {
        input: JSON.stringify(state),
        encoding: 'utf8',
        shell: true,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      });
      if (child.error || child.status !== 0) return null;
      try {
        const payload: unknown = JSON.parse(child.stdout.trim());
        const action = Array.isArray(payload)
          ? payload
          : typeof payload === 'object' && payload !== null && Array.isArray((payload as { action?: unknown }).action)
            ? (payload as { action: unknown[] }).action
            : null;
        return isDouZeroAction(action) ? action : null;
      } catch {
        return null;
      }
    },
    rankPlays(state, topN = 3) {
      // 让推理子进程返回全部合法动作的打分（同一 forward pass），而不是只回 argmax。
      const child = spawnSync(command, {
        input: JSON.stringify(state),
        encoding: 'utf8',
        shell: true,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, DOUZERO_RETURN_RANKED: '1' },
      });
      if (child.error || child.status !== 0) return null;
      let payload: unknown;
      try {
        payload = JSON.parse(child.stdout.trim());
      } catch {
        return null;
      }
      const rankedRaw =
        typeof payload === 'object' &&
        payload !== null &&
        Array.isArray((payload as { ranked?: unknown }).ranked)
          ? (payload as { ranked: unknown[] }).ranked
          : null;
      if (!rankedRaw) return null;
      const ranked: RankedDouZeroPlay[] = [];
      for (const item of rankedRaw) {
        if (!item || typeof item !== 'object') continue;
        const action = (item as { action?: unknown }).action;
        const score = (item as { score?: unknown }).score;
        if (!isDouZeroAction(action)) continue;
        const s = typeof score === 'number' ? score : Number(score);
        ranked.push({ action, score: Number.isFinite(s) ? s : 0 });
      }
      ranked.sort((a, b) => b.score - a.score);
      return ranked.slice(0, Math.max(1, topN));
    },
  };
}

function isDouZeroAction(action: unknown): action is DouZeroAction {
  if (!Array.isArray(action)) return false;
  return action.every((code) => typeof code === 'number' && DOUZERO_TO_RANK.has(code as DouZeroCard));
}

const RANK_TO_DOUZERO = new Map<number, DouZeroCard>([
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [7, 7],
  [8, 8],
  [9, 9],
  [10, 10],
  [11, 11],
  [12, 12],
  [13, 13],
  [14, 14],
  [15, 17],
  [16, 20],
  [17, 30],
]);

const DOUZERO_TO_RANK = new Map<DouZeroCard, number>([...RANK_TO_DOUZERO.entries()].map(([rank, code]) => [code, rank]));

export function toDouZeroCard(card: Card): DouZeroCard {
  const code = RANK_TO_DOUZERO.get(card.rank);
  if (!code) throw new Error(`Unsupported card rank for DouZero: ${card.rank}`);
  return code;
}

export function toDouZeroCards(cards: readonly Card[]): DouZeroCard[] {
  return cards.map(toDouZeroCard);
}

export function douZeroPosition(seat: Seat, landlordSeat: Seat): DouZeroPosition {
  if (seat === landlordSeat) return 'landlord';
  return seat === (((landlordSeat + 1) % 3) as Seat) ? 'landlord_down' : 'landlord_up';
}

export function fromDouZeroAction(action: readonly DouZeroCard[], hand: readonly Card[]): Card[] | null {
  const remaining = [...hand];
  const picked: Card[] = [];
  for (const code of action) {
    const rank = DOUZERO_TO_RANK.get(code);
    if (!rank) return null;
    const idx = remaining.findIndex((c) => c.rank === rank);
    if (idx === -1) return null;
    picked.push(remaining[idx]!);
    remaining.splice(idx, 1);
  }
  return picked;
}

export function listLegalActions(hand: readonly Card[], prev: Hand | null): Card[][] {
  const byRank = groupByRank(hand);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const seqRanks = ranks.filter((rank) => rank >= 3 && rank <= 14);
  const seen = new Set<string>();
  const result: Card[][] = [];

  const add = (cards: readonly Card[]): void => {
    if (cards.length === 0 || !canPlay(prev, cards)) return;
    const key = actionKey(cards);
    if (seen.has(key)) return;
    seen.add(key);
    result.push([...cards]);
  };

  for (const rank of ranks) {
    add(take(byRank, rank, 1));
    add(take(byRank, rank, 2));
    add(take(byRank, rank, 3));
    add(take(byRank, rank, 4));
  }

  addRocket(byRank, add);
  addRuns(seqRanks, byRank, 1, 5, add);
  addRuns(seqRanks, byRank, 2, 3, add);

  for (const tripRank of ranks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 3)) {
    const trip = take(byRank, tripRank, 3);
    for (const wingRank of ranks.filter((rank) => rank !== tripRank)) {
      add([...trip, ...take(byRank, wingRank, 1)]);
      add([...trip, ...take(byRank, wingRank, 2)]);
    }
  }

  addPlaneWings(seqRanks, byRank, 1, add);
  addPlaneWings(seqRanks, byRank, 2, add);

  for (const quadRank of ranks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 4)) {
    const quad = take(byRank, quadRank, 4);
    const wingRanks = ranks.filter((rank) => rank !== quadRank);
    for (const pair of combinations(wingRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 1), 2)) {
      add([...quad, ...pair.flatMap((rank) => take(byRank, rank, 1))]);
    }
    for (const pair of combinations(wingRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 2), 2)) {
      add([...quad, ...pair.flatMap((rank) => take(byRank, rank, 2))]);
    }
  }

  return result;
}

function groupByRank(cards: readonly Card[]): Map<number, Card[]> {
  const byRank = new Map<number, Card[]>();
  for (const card of cards) {
    const group = byRank.get(card.rank) ?? [];
    group.push(card);
    byRank.set(card.rank, group);
  }
  return byRank;
}

function take(byRank: Map<number, Card[]>, rank: number, count: number): Card[] {
  const cards = byRank.get(rank) ?? [];
  return cards.length >= count ? cards.slice(0, count) : [];
}

function actionKey(cards: readonly Card[]): string {
  return cards
    .map((card) => card.rank)
    .sort((a, b) => a - b)
    .join(',');
}

function addRocket(byRank: Map<number, Card[]>, add: (cards: readonly Card[]) => void): void {
  const small = take(byRank, 16, 1);
  const big = take(byRank, 17, 1);
  if (small.length === 1 && big.length === 1) add([...small, ...big]);
}

function addRuns(
  seqRanks: readonly number[],
  byRank: Map<number, Card[]>,
  countPerRank: number,
  minLength: number,
  add: (cards: readonly Card[]) => void,
): void {
  const eligible = seqRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= countPerRank);
  for (const run of consecutiveRuns(eligible)) {
    for (let len = minLength; len <= run.length; len++) {
      for (let start = 0; start + len <= run.length; start++) {
        const ranks = run.slice(start, start + len);
        add(ranks.flatMap((rank) => take(byRank, rank, countPerRank)));
      }
    }
  }
}

function addPlaneWings(
  seqRanks: readonly number[],
  byRank: Map<number, Card[]>,
  wingCount: 1 | 2,
  add: (cards: readonly Card[]) => void,
): void {
  const tripleRanks = seqRanks.filter((rank) => (byRank.get(rank)?.length ?? 0) >= 3);
  const wingRanks = [...byRank.keys()].sort((a, b) => a - b).filter((rank) => (byRank.get(rank)?.length ?? 0) >= wingCount);
  for (const run of consecutiveRuns(tripleRanks)) {
    for (let len = 2; len <= run.length; len++) {
      for (let start = 0; start + len <= run.length; start++) {
        const trips = run.slice(start, start + len);
        const pickedWingRanks = wingRanks.filter((rank) => !trips.includes(rank));
        for (const picked of combinations(pickedWingRanks, len)) {
          add([
            ...trips.flatMap((rank) => take(byRank, rank, 3)),
            ...picked.flatMap((rank) => take(byRank, rank, wingCount)),
          ]);
        }
      }
    }
  }
}

function consecutiveRuns(ranks: readonly number[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  for (const rank of ranks) {
    if (current.length === 0 || rank === current[current.length - 1]! + 1) {
      current.push(rank);
      continue;
    }
    runs.push(current);
    current = [rank];
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const result: T[][] = [];
  const picked: T[] = [];
  function visit(start: number): void {
    if (picked.length === size) {
      result.push([...picked]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      picked.push(items[i]!);
      visit(i + 1);
      picked.pop();
    }
  }
  visit(0);
  return result;
}

export function buildDouZeroPlayState(ctx: BotPlayContext): DouZeroPlayState {
  const legalActions = listLegalActions(ctx.hand, ctx.prev);
  const lastMove = ctx.prev ? toDouZeroCards(ctx.prev.cards) : [];
  const position = douZeroPosition(ctx.seat, ctx.landlordSeat);
  return {
    position,
    modelKey: position,
    hand: toDouZeroCards(ctx.hand),
    lastMove,
    bottom: toDouZeroCards(ctx.bottom),
    handCounts: ctx.handCounts,
    playedCards: ctx.history.flatMap((entry) => toDouZeroCards(entry.cards)),
    playHistory: ctx.history.map((entry) => ({
      position: douZeroPosition(entry.seat, ctx.landlordSeat),
      action: toDouZeroCards(entry.cards),
      isPass: entry.isPass,
    })),
    legalActions: [...legalActions.map(toDouZeroCards), ...(ctx.prev ? [[]] : [])],
  };
}

function sameDouZeroAction(a: readonly DouZeroCard[], b: readonly DouZeroCard[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<DouZeroCard, number>();
  for (const code of a) counts.set(code, (counts.get(code) ?? 0) + 1);
  for (const code of b) {
    const n = counts.get(code) ?? 0;
    if (n === 0) return false;
    if (n === 1) counts.delete(code);
    else counts.set(code, n - 1);
  }
  return counts.size === 0;
}

export function choosePlayWithDouZero(ctx: BotPlayContext, adapter?: DouZeroBotAdapter): Card[] | null {
  if (!adapter) return botChoosePlay(ctx.hand, ctx.prev);

  const state = buildDouZeroPlayState(ctx);
  try {
    const action = adapter.choosePlay(state);
    if (!action) return botChoosePlay(ctx.hand, ctx.prev);
    if (action.length === 0) return ctx.prev ? null : botChoosePlay(ctx.hand, ctx.prev);
    if (!state.legalActions.some((legal) => sameDouZeroAction(legal, action))) {
      return botChoosePlay(ctx.hand, ctx.prev);
    }
    const cards = fromDouZeroAction(action, ctx.hand);
    if (!cards || !canPlay(ctx.prev, cards)) return botChoosePlay(ctx.hand, ctx.prev);
    return cards;
  } catch {
    return botChoosePlay(ctx.hand, ctx.prev);
  }
}

/** 打分后的一个出牌建议（映射回真实手牌）。 */
export interface RankedPlay {
  cards: Card[];
  /** 模型/启发式打分，越高越优先；启发式无打分时不填。 */
  score?: number;
}

/**
 * 启发式合法出牌排序（模型不可用时的 fallback）：
 * - 非炸弹/王炸优先（保留炸弹）；
 * - 张数少、关键点数小的优先（"最小代价管上"）；
 * - 炸弹/王炸垫后。
 * 返回全部合法出牌（已按可Play 过滤），调用方取 top-N。
 */
export function rankLegalActionsHeuristic(hand: readonly Card[], prev: Hand | null): Card[][] {
  const actions = listLegalActions(hand, prev);
  const weight = (cards: Card[]): number => {
    const hand0 = identifyHand(cards);
    const heavy = hand0?.type === HandType.BOMB || hand0?.type === HandType.ROCKET ? 1 : 0;
    const sum = cards.reduce((acc, c) => acc + c.rank, 0);
    const mainRank = hand0?.mainRank ?? 0;
    return heavy * 1e9 + sum + mainRank * 0.01 + cards.length * 0.0001;
  };
  return actions
    .map((cards) => ({ cards, w: weight(cards) }))
    .sort((a, b) => a.w - b.w)
    .map((e) => e.cards);
}

/**
 * 出牌提示：返回 top-N 合法出牌（按模型分从高到低；模型不可用回退到启发式）。
 * - 模型路径：取 adapter.rankPlays 的 top-N，映射回真实手牌，再经 legalActions + canPlay 复校；
 * - 启发式路径：rankLegalActionsHeuristic 取前 topN；
 * - 所有输出均经 canPlay 校验（安全链不变）；提示仅作建议，权威仍在服务端出牌时复校。
 */
export function rankPlaysWithDouZero(
  ctx: BotPlayContext,
  adapter: DouZeroBotAdapter | undefined,
  topN = 3,
): RankedPlay[] {
  const legalActions = listLegalActions(ctx.hand, ctx.prev);
  const legalKeys = new Set(legalActions.map(actionKey));
  const isLegal = (cards: Card[]): boolean => legalKeys.has(actionKey(cards)) && canPlay(ctx.prev, cards);

  if (adapter?.rankPlays) {
    try {
      const state = buildDouZeroPlayState(ctx);
      const ranked = adapter.rankPlays(state, topN);
      if (ranked && ranked.length > 0) {
        const seen = new Set<string>();
        const out: RankedPlay[] = [];
        for (const { action, score } of ranked) {
          if (action.length === 0) continue; // 提示不出牌，用户用「不出」按钮
          const cards = fromDouZeroAction(action, ctx.hand);
          if (!cards || !isLegal(cards)) continue;
          const key = actionKey(cards);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ cards, score });
          if (out.length >= topN) break;
        }
        if (out.length > 0) return out;
      }
    } catch {
      // 落到启发式
    }
  }

  return rankLegalActionsHeuristic(ctx.hand, ctx.prev)
    .slice(0, Math.max(1, topN))
    .map((cards) => ({ cards }));
}
