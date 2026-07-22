import { create } from 'zustand';
import {
  GamePhase,
  SOCIAL_BUBBLE_MS,
  SOCIAL_COOLDOWN_MS,
  type BidChoice,
  type Card,
  type GameResult,
  type GameStateSnapshot,
  type HandType,
  type PlayRecord,
  type SocialEmoteId,
  type SocialKind,
  type SocialPhraseId,
} from '@card-game/rules';
import { connect, onEvent, onStatus, send, type ConnStatus } from '../net/socket';
import { cardOf } from '../lib/cards';
import {
  readIdentity,
  readPlayerSession,
  saveIdentity,
  savePlayerSession,
  shouldAutoRejoinPath,
  type GuestIdentity,
} from '../lib/session';
import { onPassedFx, onPlayedFx, onSettledFx } from '../lib/audioFx';
import type { SocialBubbleData } from '../lib/socialTypes';

let autoRejoinAttempted = false;
let prevConnStatus: ConnStatus = 'connecting';
const socialBubbleTimers: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null] = [
  null,
  null,
  null,
];

function clearSocialBubble(seat: number): void {
  const t = socialBubbleTimers[seat as 0 | 1 | 2];
  if (t) clearTimeout(t);
  socialBubbleTimers[seat as 0 | 1 | 2] = null;
  useGameStore.setState((st) => {
    const next = [...st.socialBubbles] as [
      SocialBubbleData | null,
      SocialBubbleData | null,
      SocialBubbleData | null,
    ];
    next[seat as 0 | 1 | 2] = null;
    return { socialBubbles: next };
  });
}

function pushSocialBubble(seat: number, kind: SocialKind, id: SocialEmoteId | SocialPhraseId): void {
  clearSocialBubble(seat);
  const bubble: SocialBubbleData = { kind, id, key: Date.now() };
  useGameStore.setState((st) => {
    const next = [...st.socialBubbles] as [
      SocialBubbleData | null,
      SocialBubbleData | null,
      SocialBubbleData | null,
    ];
    next[seat as 0 | 1 | 2] = bubble;
    return { socialBubbles: next };
  });
  socialBubbleTimers[seat as 0 | 1 | 2] = setTimeout(() => clearSocialBubble(seat), SOCIAL_BUBBLE_MS);
}

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
    beans: id.beans,
  });
  useGameStore.setState({ myName: session.name });
}

/** 断线后 socket 恢复：重新 join 绑定座位并拉回 snapshot（LRM-256/276）。 */
function tryReconnectRejoin(): void {
  if (!shouldAutoRejoinPath()) return;
  const st = useGameStore.getState();
  if (st.mySeat == null && !st.roomId) return;
  const session = readPlayerSession();
  if (!session?.roomId) return;
  const id = readIdentity();
  send({
    type: 'join',
    name: session.name,
    roomId: session.roomId,
    guestId: session.guestId ?? id.guestId,
    avatarId: session.avatarId ?? id.avatarId,
    beans: id.beans,
  });
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
  /** 发牌散开动效键；每次 dealt 递增。 */
  dealKey: number;
  /** 各座位当前表情/快捷语气泡。 */
  socialBubbles: [SocialBubbleData | null, SocialBubbleData | null, SocialBubbleData | null];
  /** 本地冷却截止时间（与服务端 SOCIAL_COOLDOWN_MS 对齐）。 */
  socialCooldownUntil: number;
  /** 重连成功后的短暂 toast（LRM-276）。 */
  reconnectToast: boolean;

  init: () => void;
  join: (identity: GuestIdentity, roomId?: string) => void;
  match: (identity: GuestIdentity) => void;
  cancelMatch: () => void;
  start: (fillBots?: boolean) => void;
  bid: (choice: BidChoice) => void;
  reveal: (reveal: boolean) => void;
  double: (doubled: boolean) => void;
  play: () => void;
  pass: () => void;
  toggleSelect: (id: string) => void;
  clearSelect: () => void;
  requestHint: () => void;
  cycleHint: () => void;
  sendSocial: (kind: SocialKind, id: SocialEmoteId | SocialPhraseId) => void;
  dismissError: () => void;
  dismissReconnectToast: () => void;
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
  dealKey: 0,
  socialBubbles: [null, null, null],
  socialCooldownUntil: 0,
  reconnectToast: false,

  init: () => {
    const id = readIdentity();
    set({ myName: id.name, guestId: id.guestId, beans: id.beans });
    connect();
    onStatus((s) => {
      const wasReconnecting =
        prevConnStatus === 'reconnecting' || prevConnStatus === 'reconnect_failed';
      prevConnStatus = s;
      set({ status: s });
      if (s === 'connected') {
        if (wasReconnecting) {
          tryReconnectRejoin();
          set({ reconnectToast: true });
        } else {
          tryAutoRejoin();
        }
      }
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
          // 重连后只有 snapshot、没有中间 played 事件：用 lastPlay 灌回座位出牌区
          const zonesEmpty = get().seatLastPlays.every((x) => x === null);
          let seatLastPlaysPatch: Partial<UiState> = {};
          if (roundCleared || phaseLeftPlaying) {
            seatLastPlaysPatch = { seatLastPlays: [null, null, null] as SeatLastPlays, playFx: null };
          } else if (zonesEmpty && e.state.lastPlay) {
            const hydrated: SeatLastPlays = [null, null, null];
            hydrated[e.state.lastPlay.seat] = e.state.lastPlay;
            seatLastPlaysPatch = { seatLastPlays: hydrated };
          }
          set({
            snapshot: e.state,
            ...(turnChanged ? { hints: [], hintIndex: 0, hintMessage: null } : {}),
            ...seatLastPlaysPatch,
          });
          break;
        }
        case 'dealt': {
          const hand = e.hand
            .map((cid) => cardOf(cid))
            .filter((c): c is Card => !!c);
          set((st) => ({
            myHand: hand,
            selected: [],
            dealKey: st.dealKey + 1,
          }));
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
        case 'beans': {
          const prev = readIdentity();
          const next: GuestIdentity = { ...prev, beans: e.beans };
          saveIdentity(next);
          set({ beans: e.beans });
          break;
        }
        case 'social': {
          pushSocialBubble(e.seat, e.kind, e.id);
          if (e.seat === get().mySeat) {
            set({ socialCooldownUntil: Date.now() + SOCIAL_COOLDOWN_MS });
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
      dealKey: 0,
      socialBubbles: [null, null, null],
      socialCooldownUntil: 0,
    });
    send({
      type: 'join',
      name: identity.name,
      roomId: roomId?.trim() || undefined,
      guestId: identity.guestId,
      avatarId: identity.avatarId,
      beans: identity.beans,
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
      socialBubbles: [null, null, null],
      socialCooldownUntil: 0,
    });
    send({
      type: 'match',
      name: identity.name,
      guestId: identity.guestId,
      avatarId: identity.avatarId,
      beans: identity.beans,
    });
  },

  cancelMatch: () => send({ type: 'cancel_match' }),

  clearPlayFx: () => set({ playFx: null }),

  start: (fillBots) => send({ type: 'start', fillBots }),

  bid: (choice) => send({ type: 'bid', choice }),

  reveal: (reveal) => send({ type: 'reveal', reveal }),

  double: (doubled) => send({ type: 'double', double: doubled }),

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
      if (st.hints.length === 1) {
        return {
          selected: st.hints[0] ?? [],
          hintMessage: '仅 1 组可用提示',
        };
      }
      const next = (st.hintIndex + 1) % st.hints.length;
      const wrapped = next === 0;
      return {
        hintIndex: next,
        selected: st.hints[next] ?? [],
        hintMessage: wrapped ? '已轮完，回到第 1 组' : null,
      };
    }),

  sendSocial: (kind, id) => {
    if (Date.now() < get().socialCooldownUntil) return;
    send({ type: 'social', kind, id });
  },

  dismissError: () => set({ lastError: null }),

  dismissReconnectToast: () => set({ reconnectToast: false }),
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
