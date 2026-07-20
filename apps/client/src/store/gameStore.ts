import { create } from 'zustand';
import {
  GamePhase,
  type BidChoice,
  type BidEntry,
  type Card,
  type GameResult,
  type GameStateSnapshot,
  type PlayRecord,
} from '@card-game/rules';
import { connect, onEvent, onStatus, send, type ConnStatus } from '../net/socket';
import { cardOf } from '../lib/cards';

/**
 * 客户端游戏状态 = 「镜像服务端」。
 *
 * - 公开状态：来自 ServerEvent 'snapshot'（整张牌桌），原样存。
 * - 私有状态：'dealt'（只发给我本人的手牌 card id）→ 还原成 Card[]。
 * - 本地状态：选中牌 id、连接状态、最近一条 error。
 *
 * 权威一律在服务端；客户端只展示 + 发动作。出牌按钮的「能否成牌/压过」
 * 仅用 @card-game/rules 做提示，最终由服务端裁决。
 */

export interface UiError {
  code: string;
  message: string;
  at: number;
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
  /** AI 出牌提示：按模型分从高到低的合法出牌建议（每组 card id）；为空表示无建议。 */
  hints: string[][];
  /** 当前选用的提示组下标；点「提示」时循环切换。 */
  hintIndex: number;
  /** 提示文案：如 AI 建议不出（管不上）。 */
  hintMessage: string | null;
  /** 当前轮叫牌顺序记录（来自服务端 bid 事件；发牌/重发时清空）。 */
  bidHistory: BidEntry[];

  /** 订阅 socket（应用挂载时调用一次）。 */
  init: () => void;
  join: (name: string, roomId?: string) => void;
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
  hints: [],
  hintIndex: 0,
  hintMessage: null,
  bidHistory: [],

  init: () => {
    connect();
    onStatus((s) => set({ status: s }));
    onEvent((e) => {
      switch (e.type) {
        case 'you_joined':
          set({ mySeat: e.seat, roomId: e.roomId });
          break;
        case 'snapshot': {
          const prevTurn = get().snapshot?.turnSeat;
          const turnChanged = prevTurn !== undefined && prevTurn !== e.state.turnSeat;
          set({
            snapshot: e.state,
            ...(e.state.phase !== GamePhase.BIDDING ? { bidHistory: [] } : {}),
            ...(turnChanged ? { hints: [], hintIndex: 0, hintMessage: null } : {}),
          });
          break;
        }
        case 'bid':
          set((st) => ({
            bidHistory: [...st.bidHistory, { seat: e.seat, choice: e.choice }],
          }));
          break;
        case 'dealt': {
          const hand = e.hand
            .map((id) => cardOf(id))
            .filter((c): c is Card => !!c);
          set({ myHand: hand, selected: [], bidHistory: [] });
          break;
        }
        case 'played': {
          const mySeat = get().mySeat;
          if (e.seat === mySeat) {
            const playedIds = new Set(e.hand.cards.map((card) => card.id));
            set((st) => ({
              myHand: st.myHand.filter((card) => !playedIds.has(card.id)),
              selected: st.selected.filter((id) => !playedIds.has(id)),
            }));
          }
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
          set({ lastError: { code: e.code, message: e.message, at: Date.now() } });
          break;
        // phase / turn / passed / landlord / settled 均已被 snapshot 覆盖
        default:
          break;
      }
    });
  },

  join: (name, roomId) => {
    set({
      myName: name,
      mySeat: null,
      roomId: null,
      myHand: [],
      selected: [],
      snapshot: null,
      lastError: null,
      hints: [],
      hintIndex: 0,
      hintMessage: null,
      bidHistory: [],
    });
    send({ type: 'join', name, roomId: roomId?.trim() || undefined });
  },

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
