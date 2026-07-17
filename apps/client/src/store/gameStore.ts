import { create } from 'zustand';
import type {
  BidChoice,
  Card,
  GamePhase,
  GameResult,
  GameStateSnapshot,
  HintSuggestion,
  PlayRecord,
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

/** 默认提示请求返回的候选数。 */
const HINT_TOP_N = 3;

interface UiState {
  status: ConnStatus;
  myName: string;
  mySeat: number | null;
  roomId: string | null;
  myHand: Card[];
  selected: string[];
  snapshot: GameStateSnapshot | null;
  lastError: UiError | null;
  /** 服务端返回的 top-N 出牌建议（按优先级从高到低）。 */
  hints: HintSuggestion[];
  /** 当前选中的建议下标（-1 表示未选中任何建议）。 */
  hintIndex: number;
  /** 建议对应的 turnSeat，轮次变化即作废。 */
  hintTurnSeat: number | null;
  /** 是否正在等待服务端返回建议。 */
  hintLoading: boolean;

  /** 订阅 socket（应用挂载时调用一次）。 */
  init: () => void;
  join: (name: string, roomId?: string) => void;
  start: (fillBots?: boolean) => void;
  bid: (choice: BidChoice) => void;
  play: () => void;
  pass: () => void;
  toggleSelect: (id: string) => void;
  clearSelect: () => void;
  dismissError: () => void;
  /** 请求 top-N 出牌建议；已有有效建议时改为循环下一条。 */
  hint: () => void;
  /** 清空当前建议（轮次/手牌变化时调用）。 */
  clearHints: () => void;
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
  hintIndex: -1,
  hintTurnSeat: null,
  hintLoading: false,

  init: () => {
    connect();
    onStatus((s) => set({ status: s }));
    onEvent((e) => {
      switch (e.type) {
        case 'you_joined':
          set({ mySeat: e.seat, roomId: e.roomId });
          break;
        case 'snapshot': {
          // 轮次变化后旧建议作废（不是我的回合 / 上家牌变了都算）。
          const prevTurn = get().hintTurnSeat;
          const turnChanged = prevTurn !== null && e.state.turnSeat !== prevTurn;
          set({
            snapshot: e.state,
            ...(turnChanged
              ? { hints: [], hintIndex: -1, hintTurnSeat: null, hintLoading: false }
              : {}),
          });
          break;
        }
        case 'dealt': {
          const hand = e.hand
            .map((id) => cardOf(id))
            .filter((c): c is Card => !!c);
          set({ myHand: hand, selected: [], hints: [], hintIndex: -1, hintTurnSeat: null, hintLoading: false });
          break;
        }
        case 'hint': {
          // 选中首条建议：把它对应的手牌高亮选中，玩家可直接点「出牌」。
          const hints = e.suggestions;
          const first = hints[0];
          const selected = first ? first.hand.cards.map((c) => c.id) : get().selected;
          set({
            hints,
            hintIndex: hints.length > 0 ? 0 : -1,
            selected,
            hintTurnSeat: get().snapshot?.turnSeat ?? null,
            hintLoading: false,
          });
          break;
        }
        case 'played': {
          const mySeat = get().mySeat;
          if (e.seat === mySeat) {
            const playedIds = new Set(e.hand.cards.map((card) => card.id));
            set((st) => ({
              myHand: st.myHand.filter((card) => !playedIds.has(card.id)),
              selected: st.selected.filter((id) => !playedIds.has(id)),
              hints: [],
              hintIndex: -1,
              hintTurnSeat: null,
            }));
          }
          break;
        }
        case 'error':
          set({ lastError: { code: e.code, message: e.message, at: Date.now() }, hintLoading: false });
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
    set({ selected: [], hints: [], hintIndex: -1, hintTurnSeat: null });
  },

  toggleSelect: (id) =>
    set((st) => ({
      selected: st.selected.includes(id)
        ? st.selected.filter((x) => x !== id)
        : [...st.selected, id],
    })),

  clearSelect: () => set({ selected: [] }),

  dismissError: () => set({ lastError: null }),

  hint: () => {
    const st = get();
    // 已有当前轮的建议：循环到下一条并自动选中。
    if (st.hints.length > 0) {
      const next = (st.hintIndex + 1) % st.hints.length;
      const suggestion = st.hints[next];
      set({
        hintIndex: next,
        selected: suggestion ? suggestion.hand.cards.map((c) => c.id) : st.selected,
      });
      return;
    }
    // 否则向服务端请求（仅本人回合会返回建议；否则服务端回 error）。
    set({ hintLoading: true });
    send({ type: 'hint', topN: HINT_TOP_N });
  },

  clearHints: () =>
    set({ hints: [], hintIndex: -1, hintTurnSeat: null, hintLoading: false }),
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
