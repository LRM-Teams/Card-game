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
import { readPlayerSession, savePlayerSession, shouldAutoRejoinPath } from '../lib/session';

let autoRejoinAttempted = false;

function tryAutoRejoin(): void {
  if (autoRejoinAttempted || !shouldAutoRejoinPath()) return;
  const st = useGameStore.getState();
  if (st.snapshot || st.mySeat != null) return;
  const session = readPlayerSession();
  if (!session) return;
  autoRejoinAttempted = true;
  send({ type: 'join', name: session.name, roomId: session.roomId ?? undefined });
  useGameStore.setState({ myName: session.name });
}

/**
 * 客户端游戏状态 = 「镜像服务端」。
 *
 * - 公开状态：来自 ServerEvent 'snapshot'（整张牌桌），原样存。
 * - 私有状态：'dealt'（只发给我本人的手牌 card id）→ 还原成 Card[]。
 * - 本地状态：选中牌 id、连接状态、最近一条 error、匹配中状态。
 *
 * 权威一律在服务端；客户端只展示 + 发动作。出牌按钮的「能否成牌/压过」
 * 仅用 @card-game/rules 做提示，最终由服务端裁决。
 */

export interface UiError {
  code: string;
  message: string;
  at: number;
}

/** 三家各自最近一次有效出牌（分座展示，LRM-156）。 */
export type SeatLastPlays = [PlayRecord | null, PlayRecord | null, PlayRecord | null];

export interface PlayFxPulse {
  seat: number;
  handType: HandType;
  id: number;
}

interface UiState {
  status: ConnStatus;
  myName: string;
  mySeat: number | null;
  roomId: string | null;
  myHand: Card[];
  selected: string[];
  snapshot: GameStateSnapshot | null;
  lastError: UiError | null;
  /** 快速匹配：idle=大厅；queued=匹配中。 */
  matchStatus: 'idle' | 'queued';
  /** 服务端回传的当前排队人数（仅匹配中有意义）。 */
  matchQueueSize: number;
  /** AI 出牌提示：按模型分从高到低的合法出牌建议（每组 card id）；为空表示无建议。 */
  hints: string[][];
  /** 当前选用的提示组下标；点「提示」时循环切换。 */
  hintIndex: number;
  /** 提示文案：如 AI 建议不出（管不上）。 */
  hintMessage: string | null;
  seatLastPlays: SeatLastPlays;
  playFx: PlayFxPulse | null;

  /** 订阅 socket（应用挂载时调用一次）。 */
  init: () => void;
  join: (name: string, roomId?: string) => void;
  /** 快速开始：进入服务端匹配队列。 */
  quickMatch: (name: string) => void;
  /** 取消匹配，回大厅。 */
  cancelMatch: () => void;
  start: (fillBots?: boolean) => void;
  bid: (choice: BidChoice) => void;
  play: () => void;
  pass: () => void;
  toggleSelect: (id: string) => void;
  clearSelect: () => void;
  /** 请求 AI 出牌提示（服务端 DouZero top-N）。 */
  requestHint: () => void;
  /** 在已有提示组中循环切换下一组（top-N 时可用）。 */
  cycleHint: () => void;
  dismissError: () => void;
  clearPlayFx: () => void;
}

export const useGameStore = create<UiState>((set, get) => ({
  status: 'connecting',
  myName: '',
  mySeat: null,
  roomId: null,
  myHand: [],
  selected: [],
  snapshot: null,
  lastError: null,
  matchStatus: 'idle',
  matchQueueSize: 0,
  hints: [],
  hintIndex: 0,
  hintMessage: null,
  seatLastPlays: [null, null, null],
  playFx: null,

  init: () => {
    connect();
    onStatus((s) => {
      set({ status: s });
      if (s === 'connected') tryAutoRejoin();
    });
    onEvent((e) => {
      switch (e.type) {
        case 'match_queued':
          set({ matchStatus: 'queued', matchQueueSize: e.queueSize, lastError: null });
          break;
        case 'match_cancelled':
          set({ matchStatus: 'idle', matchQueueSize: 0 });
          break;
        case 'you_joined':
          set({
            mySeat: e.seat,
            roomId: e.roomId,
            matchStatus: 'idle',
            matchQueueSize: 0,
          });
          savePlayerSession(get().myName, e.roomId);
          break;
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
            .map((id) => cardOf(id))
            .filter((c): c is Card => !!c);
          set({ myHand: hand, selected: [] });
          break;
        }
        case 'played': {
          const mySeat = get().mySeat;
          const playedIds = new Set(e.hand.cards.map((card) => card.id));
          set((st) => {
            const seatLastPlays = [...st.seatLastPlays] as SeatLastPlays;
            seatLastPlays[e.seat] = { seat: e.seat, hand: e.hand };
            return {
              seatLastPlays,
              playFx: { seat: e.seat, handType: e.hand.type, id: Date.now() },
              ...(e.seat === mySeat
                ? {
                    myHand: st.myHand.filter((card) => !playedIds.has(card.id)),
                    selected: st.selected.filter((id) => !playedIds.has(id)),
                  }
                : {}),
            };
          });
          break;
        }
        case 'hint': {
          // 服务端按模型分从高到低返回合法出牌建议；空表示建议不出。
          const groups = e.suggestions;
          if (groups.length === 0) {
            set({ hints: [], hintIndex: 0, selected: [], hintMessage: 'AI 建议不出（管不上）' });
          } else {
            set({ hints: groups, hintIndex: 0, selected: groups[0] ?? [], hintMessage: null });
          }
          break;
        }
        case 'error':
          set({
            lastError: { code: e.code, message: e.message, at: Date.now() },
            // 入队被拒时退出「匹配中」UI，避免卡死
            ...(e.code === 'already_in_room' || e.code === 'already_in_match'
              ? { matchStatus: 'idle' as const, matchQueueSize: 0 }
              : {}),
          });
          break;
        // phase / turn / passed / landlord / settled 均已被 snapshot 覆盖
        default:
          break;
      }
    });
  },

  join: (name, roomId) => {
    savePlayerSession(name, roomId);
    autoRejoinAttempted = true;
    set({
      myName: name,
      mySeat: null,
      roomId: null,
      myHand: [],
      selected: [],
      snapshot: null,
      lastError: null,
      matchStatus: 'idle',
      matchQueueSize: 0,
      hints: [],
      hintIndex: 0,
      hintMessage: null,
      seatLastPlays: [null, null, null],
      playFx: null,
    });
    send({ type: 'join', name, roomId: roomId?.trim() || undefined });
  },

  quickMatch: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    autoRejoinAttempted = true;
    set({
      myName: trimmed,
      mySeat: null,
      roomId: null,
      myHand: [],
      selected: [],
      snapshot: null,
      lastError: null,
      matchStatus: 'queued',
      matchQueueSize: 1,
      hints: [],
      hintIndex: 0,
      hintMessage: null,
      seatLastPlays: [null, null, null],
      playFx: null,
    });
    // 匹配成功前尚无 roomId；成功后 you_joined 会写入 session。
    savePlayerSession(trimmed, null);
    send({ type: 'quick_match', name: trimmed });
  },

  cancelMatch: () => {
    send({ type: 'cancel_match' });
  },

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
    // 若本回合已有提示组，直接循环下一组，避免重复推理；否则向服务端请求。
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

// —— 便捷派生选择器 ——
export function selectPhase(s: UiState): GamePhase | undefined {
  return s.snapshot?.phase;
}
export function selectLastPlay(s: UiState): PlayRecord | null {
  return s.snapshot?.lastPlay ?? null;
}
export function selectResult(s: UiState): GameResult | null {
  return s.snapshot?.result ?? null;
}
