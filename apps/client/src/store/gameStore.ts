import { create } from 'zustand';
import {
  GamePhase,
  type BidChoice,
  type Card,
  type GameResult,
  type GameStateSnapshot,
  type HandType,
  type PlayRecord,
} from '@card-game/rules';
import { connect, onEvent, onStatus, send, type ConnStatus } from '../net/socket';
import { cardOf } from '../lib/cards';
<<<<<<< Updated upstream
import {
  readIdentity,
  readPlayerSession,
  saveIdentity,
  savePlayerSession,
  shouldAutoRejoinPath,
  type GuestIdentity,
} from '../lib/session';
=======
import { readPlayerSession, savePlayerSession, shouldAutoRejoinPath } from '../lib/session';
import { onPassedFx, onPlayedFx, onSettledFx } from '../lib/audioFx';
>>>>>>> Stashed changes

let autoRejoinAttempted = false;

function tryAutoRejoin(): void {
  if (autoRejoinAttempted || !shouldAutoRejoinPath()) return;
  const st = useGameStore.getState();
  if (st.snapshot || st.mySeat != null) return;
  const session = readPlayerSession();
  if (!session) return;
  autoRejoinAttempted = true;
  const id = readIdentity();
  send({
    type: 'join',
    name: session.name,
    roomId: session.roomId ?? undefined,
    guestId: session.guestId ?? id.guestId,
    avatarId: session.avatarId ?? id.avatarId,
  });
  useGameStore.setState({ myName: session.name });
}

export interface UiError {
  code: string;
  message: string;
  at: number;
}

export type SeatLastPlays = [PlayRecord | null, PlayRecord | null, PlayRecord | null];

export interface PlayFxPulse {
  seat: number;
  handType: HandType;
  id: number;
}

interface UiState {
  status: ConnStatus;
  myName: string;
  guestId: string | null;
  beans: number;
  matching: boolean;
  mySeat: number | null;
  roomId: string | null;
  myHand: Card[];
  selected: string[];
  snapshot: GameStateSnapshot | null;
  lastError: UiError | null;
  hints: string[][];
  hintIndex: number;
  hintMessage: string | null;
  seatLastPlays: SeatLastPlays;
  playFx: PlayFxPulse | null;

  init: () => void;
  join: (identity: GuestIdentity, roomId?: string) => void;
  match: (identity: GuestIdentity) => void;
  cancelMatch: () => void;
  start: (fillBots?: boolean) => void;
  bid: (choice: BidChoice) => void;
  play: () => void;
  pass: () => void;
  toggleSelect: (id: string) => void;
  clearSelect: () => void;
  requestHint: () => void;
  cycleHint: () => void;
  dismissError: () => void;
  clearPlayFx: () => void;
}

export const useGameStore = create<UiState>((set, get) => ({
  status: 'connecting',
  myName: '',
  guestId: null,
  beans: 1000,
  matching: false,
  mySeat: null,
  roomId: null,
  myHand: [],
  selected: [],
  snapshot: null,
  lastError: null,
  hints: [],
  hintIndex: 0,
  hintMessage: null,
  seatLastPlays: [null, null, null],
  playFx: null,

  init: () => {
    const id = readIdentity();
    set({ myName: id.name, guestId: id.guestId, beans: id.beans });
    connect();
    onStatus((s) => {
      set({ status: s });
      if (s === 'connected') tryAutoRejoin();
    });
    onEvent((e) => {
      switch (e.type) {
        case 'matching':
          set({ matching: true, lastError: null });
          break;
        case 'match_cancelled':
          set({ matching: false });
          break;
        case 'you_joined': {
          const prev = readIdentity();
          const next: GuestIdentity = {
            ...prev,
            guestId: e.guestId,
            beans: e.beans,
            name: get().myName || prev.name,
          };
          saveIdentity(next);
          savePlayerSession(next.name, e.roomId, {
            guestId: e.guestId,
            avatarId: next.avatarId,
          });
          set({
            mySeat: e.seat,
            roomId: e.roomId,
            guestId: e.guestId,
            beans: e.beans,
            matching: false,
          });
          break;
        }
        case 'snapshot': {
          const prev = get().snapshot;
          const prevTurn = prev?.turnSeat;
          const turnChanged = prevTurn !== undefined && prevTurn !== e.state.turnSeat;
          const roundCleared =
            prev?.phase === GamePhase.PLAYING &&
            e.state.phase === GamePhase.PLAYING &&
            prev.lastPlay != null &&
            e.state.lastPlay === null;
          const phaseLeftPlaying =
            prev?.phase === GamePhase.PLAYING && e.state.phase !== GamePhase.PLAYING;
          set({
            snapshot: e.state,
            ...(turnChanged ? { hints: [], hintIndex: 0, hintMessage: null } : {}),
            ...(roundCleared || phaseLeftPlaying
              ? { seatLastPlays: [null, null, null] as SeatLastPlays, playFx: null }
              : {}),
          });
          break;
        }
        case 'dealt': {
          const hand = e.hand
            .map((cid) => cardOf(cid))
            .filter((c): c is Card => !!c);
          set({ myHand: hand, selected: [] });
          break;
        }
        case 'played': {
          const mySeat = get().mySeat;
          const playedIds = new Set(e.hand.cards.map((card) => card.id));
          onPlayedFx(e.hand);
          set((st) => {
            const seatLastPlays = [...st.seatLastPlays] as SeatLastPlays;
            seatLastPlays[e.seat] = { seat: e.seat, hand: e.hand };
            return {
              seatLastPlays,
              playFx: { seat: e.seat, handType: e.hand.type, id: Date.now() },
              ...(e.seat === mySeat
                ? {
                    myHand: st.myHand.filter((card) => !playedIds.has(card.id)),
                    selected: st.selected.filter((cid) => !playedIds.has(cid)),
                  }
                : {}),
            };
          });
          break;
        }
        case 'passed': {
          onPassedFx();
          break;
        }
        case 'settled': {
          const st = get();
          const handSizes = (st.snapshot?.players ?? []).reduce(
            (acc, p) => {
              acc[p.seat] = p.handSize;
              return acc;
            },
            [0, 0, 0] as [number, number, number],
          );
          onSettledFx(e.result, st.mySeat, handSizes);
          break;
        }
        case 'hint': {
          const groups = e.suggestions;
          if (groups.length === 0) {
            set({ hints: [], hintIndex: 0, selected: [], hintMessage: 'AI 建议不出（管不上）' });
          } else {
            set({ hints: groups, hintIndex: 0, selected: groups[0] ?? [], hintMessage: null });
          }
          break;
        }
        case 'error':
          set({ lastError: { code: e.code, message: e.message, at: Date.now() }, matching: false });
          break;
        default:
          break;
      }
    });
  },

  join: (identity, roomId) => {
    saveIdentity(identity);
    savePlayerSession(identity.name, roomId, {
      guestId: identity.guestId,
      avatarId: identity.avatarId,
    });
    autoRejoinAttempted = true;
    set({
      myName: identity.name,
      guestId: identity.guestId,
      beans: identity.beans,
      matching: false,
      mySeat: null,
      roomId: null,
      myHand: [],
      selected: [],
      snapshot: null,
      lastError: null,
      hints: [],
      hintIndex: 0,
      hintMessage: null,
      seatLastPlays: [null, null, null],
      playFx: null,
    });
    send({
      type: 'join',
      name: identity.name,
      roomId: roomId?.trim() || undefined,
      guestId: identity.guestId,
      avatarId: identity.avatarId,
    });
  },

  match: (identity) => {
    saveIdentity(identity);
    autoRejoinAttempted = true;
    set({
      myName: identity.name,
      guestId: identity.guestId,
      beans: identity.beans,
      matching: true,
      mySeat: null,
      roomId: null,
      myHand: [],
      selected: [],
      snapshot: null,
      lastError: null,
      seatLastPlays: [null, null, null],
      playFx: null,
    });
    send({
      type: 'match',
      name: identity.name,
      guestId: identity.guestId,
      avatarId: identity.avatarId,
    });
  },

  cancelMatch: () => send({ type: 'cancel_match' }),

  clearPlayFx: () => set({ playFx: null }),

  start: (fillBots) => send({ type: 'start', fillBots }),

  bid: (choice) => send({ type: 'bid', choice }),

  play: () => {
    const ids = get().selected;
    if (ids.length === 0) return;
    send({ type: 'play', cards: ids });
    set({ selected: [] });
  },

  pass: () => {
    send({ type: 'pass' });
    set({ selected: [] });
  },

  toggleSelect: (id) =>
    set((st) => ({
      selected: st.selected.includes(id)
        ? st.selected.filter((x) => x !== id)
        : [...st.selected, id],
    })),

  clearSelect: () => set({ selected: [] }),

  requestHint: () => {
    const { hints } = get();
    if (hints.length > 0) {
      get().cycleHint();
      return;
    }
    set({ hintMessage: null });
    send({ type: 'hint' });
  },

  cycleHint: () =>
    set((st) => {
      if (st.hints.length === 0) return {};
      const next = (st.hintIndex + 1) % st.hints.length;
      return { hintIndex: next, selected: st.hints[next] ?? [], hintMessage: null };
    }),

  dismissError: () => set({ lastError: null }),
}));

export function selectPhase(s: UiState): GamePhase | undefined {
  return s.snapshot?.phase;
}
export function selectLastPlay(s: UiState): PlayRecord | null {
  return s.snapshot?.lastPlay ?? null;
}
export function selectResult(s: UiState): GameResult | null {
  return s.snapshot?.result ?? null;
}
