import { spawnSync } from 'node:child_process';
import { canPlay } from '@card-game/rules';
import type { Card, Hand, Seat } from '@card-game/rules';
import { botChoosePlay } from './bot';
import { refinePlaySuggestions } from './hintPostProcess';

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
  choosePlay(state: DouZeroPlayState): Promise<DouZeroAction | null>;
  /**
   * Top-N scored legal actions (resident path only), high to low. Returns `null`
   * when unsupported (e.g. the process-per-move command adapter) so the caller
   * can fall back to a single choosePlay suggestion.
   */
  rankActions?(state: DouZeroPlayState, topN: number): Promise<RankEntry[] | null>;
}

/** A model-scored action, used for ranked top-N suggestions (hint button). */
export interface RankEntry {
  action: DouZeroAction;
  value: number;
}

export interface DouZeroCommandAdapterOptions {
  timeoutMs?: number;
}

export function createDouZeroCommandAdapter(
  command: string,
  options: DouZeroCommandAdapterOptions = {},
): DouZeroBotAdapter {
  const timeoutMs = options.timeoutMs ?? 1500;
  return {
    async choosePlay(state) {
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
  };
}

export interface DouZeroHttpAdapterOptions {
  timeoutMs?: number;
}

/**
 * Resident DouZero inference client (LRM-136). Talks to the long-lived
 * `douzero-server.py` HTTP service that loads the three models once, so each
 * move is a single forward pass instead of a process cold start.
 *
 * Configured via `DOUZERO_INFER_URL` (e.g. http://127.0.0.1:8080). Any network
 * error, non-2xx response, timeout, or invalid payload resolves to `null`, and
 * the caller falls back to the minimal legal bot.
 */
function parseDouZeroAction(payload: unknown): DouZeroAction | null {
  const action = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { action?: unknown }).action)
      ? (payload as { action: unknown[] }).action
      : null;
  return isDouZeroAction(action) ? action : null;
}

function parseRankedTop(payload: unknown): RankEntry[] | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const top = (payload as { top?: unknown }).top;
  if (!Array.isArray(top)) return undefined;
  const entries: RankEntry[] = [];
  for (const entry of top) {
    if (!entry || typeof entry !== 'object') continue;
    const action = (entry as { action?: unknown }).action;
    const value = (entry as { value?: unknown }).value;
    if (Array.isArray(action) && isDouZeroAction(action) && typeof value === 'number') {
      entries.push({ action, value });
    }
  }
  return entries.length > 0 ? entries : undefined;
}

async function postInfer(
  base: string,
  state: DouZeroPlayState,
  timeoutMs: number,
  topN?: number,
): Promise<{ action: DouZeroAction | null; top?: RankEntry[] } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/infer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(topN && topN > 0 ? { ...state, topN } : state),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload: unknown = await res.json();
    return { action: parseDouZeroAction(payload), top: parseRankedTop(payload) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createDouZeroHttpAdapter(url: string, options: DouZeroHttpAdapterOptions = {}): DouZeroBotAdapter {
  const timeoutMs = options.timeoutMs ?? 1500;
  const base = url.replace(/\/+$/, '');
  return {
    async choosePlay(state) {
      const r = await postInfer(base, state, timeoutMs);
      return r?.action ?? null;
    },
    async rankActions(state, topN) {
      const r = await postInfer(base, state, timeoutMs, topN);
      return r?.top ?? null;
    },
  };
}

export function createConfiguredDouZeroAdapter(env: NodeJS.ProcessEnv = process.env): DouZeroBotAdapter | undefined {
  const url = env.DOUZERO_INFER_URL?.trim();
  if (url) return createDouZeroHttpAdapter(url, { timeoutMs: resolveDouZeroTimeout(env) });
  const command = env.DOUZERO_INFER_COMMAND?.trim();
  if (!command) return undefined;
  return createDouZeroCommandAdapter(command, { timeoutMs: resolveDouZeroTimeout(env) });
}

function resolveDouZeroTimeout(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.DOUZERO_INFER_TIMEOUT_MS ?? '1500');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1500;
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

export async function choosePlayWithDouZero(
  ctx: BotPlayContext,
  adapter?: DouZeroBotAdapter,
): Promise<Card[] | null> {
  if (!adapter) return botChoosePlay(ctx.hand, ctx.prev);

  const state = buildDouZeroPlayState(ctx);
  try {
    const action = await adapter.choosePlay(state);
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

function suggestionKey(cards: readonly Card[]): string {
  return cards
    .map((c) => c.id)
    .sort()
    .join(',');
}

/**
 * 用规则引擎合法出牌补足 top-N（LRM-186）：模型只回 1 条或 fallback top-1 时，
 * 连续点「提示」仍可轮换到不同合法牌。排序沿用 LRM-160 后处理。
 */
function padSuggestionsFromLegal(
  ctx: BotPlayContext,
  suggestions: Card[][],
  topN: number,
): Card[][] {
  if (suggestions.length >= topN) return refinePlaySuggestions(ctx.hand, suggestions);
  const seen = new Set(suggestions.map(suggestionKey));
  const legal = listLegalActions(ctx.hand, ctx.prev);
  const rankedLegal = refinePlaySuggestions(ctx.hand, legal);
  for (const cards of rankedLegal) {
    if (suggestions.length >= topN) break;
    const key = suggestionKey(cards);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(cards);
  }
  return refinePlaySuggestions(ctx.hand, suggestions);
}

/**
 * Top-N AI play suggestions for the hint button (LRM-135 / LRM-186). Uses the
 * resident adapter's `rankActions` when available; otherwise falls back to
 * choosePlay then pads with rule-engine legal plays so the hint button can
 * cycle. Every suggestion is revalidated and de-duplicated.
 */
export async function rankPlaySuggestions(
  ctx: BotPlayContext,
  adapter: DouZeroBotAdapter | undefined,
  topN: number,
): Promise<Card[][]> {
  if (!adapter || !adapter.rankActions) {
    const cards = await choosePlayWithDouZero(ctx, adapter);
    const seed = cards && cards.length > 0 ? [cards] : [];
    return padSuggestionsFromLegal(ctx, seed, topN);
  }

  const state = buildDouZeroPlayState(ctx);
  let ranked: RankEntry[] | null;
  try {
    ranked = await adapter.rankActions(state, topN);
  } catch {
    ranked = null;
  }
  if (!ranked || ranked.length === 0) {
    const cards = await choosePlayWithDouZero(ctx, adapter);
    const seed = cards && cards.length > 0 ? [cards] : [];
    return padSuggestionsFromLegal(ctx, seed, topN);
  }

  const seen = new Set<string>();
  const suggestions: Card[][] = [];
  for (const entry of ranked) {
    if (suggestions.length >= topN) break;
    const { action } = entry;
    if (action.length === 0) continue; // pass is not a play suggestion
    if (!state.legalActions.some((legal) => sameDouZeroAction(legal, action))) continue;
    const cards = fromDouZeroAction(action, ctx.hand);
    if (!cards || !canPlay(ctx.prev, cards)) continue;
    const key = suggestionKey(cards);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(cards);
  }
  return padSuggestionsFromLegal(ctx, suggestions, topN);
}
