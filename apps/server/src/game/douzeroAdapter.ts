import { canPlay } from '@card-game/rules';
import type { Card, Hand, Seat } from '@card-game/rules';
import { botChoosePlay } from './bot';

export type DouZeroPosition = 'landlord' | 'landlord_up' | 'landlord_down';
export type DouZeroCard = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | 'X' | 'D';
export type DouZeroAction = DouZeroCard[];

export interface BotPlayHistoryEntry {
  seat: Seat;
  cards: Card[];
  isPass: boolean;
}

export interface DouZeroPlayState {
  position: DouZeroPosition;
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
}

const RANK_TO_DOUZERO = new Map<number, DouZeroCard>([
  [3, '3'],
  [4, '4'],
  [5, '5'],
  [6, '6'],
  [7, '7'],
  [8, '8'],
  [9, '9'],
  [10, '10'],
  [11, 'J'],
  [12, 'Q'],
  [13, 'K'],
  [14, 'A'],
  [15, '2'],
  [16, 'X'],
  [17, 'D'],
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
  const result: Card[][] = [];
  const combo: Card[] = [];

  function visit(index: number): void {
    if (index === hand.length) {
      if (combo.length > 0 && canPlay(prev, combo)) result.push([...combo]);
      return;
    }
    visit(index + 1);
    combo.push(hand[index]!);
    visit(index + 1);
    combo.pop();
  }

  visit(0);
  return result;
}

export function buildDouZeroPlayState(ctx: BotPlayContext): DouZeroPlayState {
  const legalActions = listLegalActions(ctx.hand, ctx.prev);
  const lastMove = ctx.prev ? toDouZeroCards(ctx.prev.cards) : [];
  return {
    position: douZeroPosition(ctx.seat, ctx.landlordSeat),
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
    legalActions: legalActions.map(toDouZeroCards),
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
    if (!action || action.length === 0) return botChoosePlay(ctx.hand, ctx.prev);
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
