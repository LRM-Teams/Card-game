import { create } from 'zustand';
import { canBeat, identifyHand, type Card, type Hand } from '@card-game/rules';
import { mockDeal } from '../mock/deal';

/**
 * 客户端游戏状态。
 *
 * 当前为静态原型：用 @card-game/rules 的 deal() 在本地造数据，交互也是本地的。
 * 联网后这里改成「镜像服务端事件」：store 只存/展示服务端下发的状态，
 * 不做合法性裁决——出牌按钮是否可点只是「提示」，真正的校验一律在服务端。
 */

export type Phase = 'waiting' | 'dealing' | 'bidding' | 'playing' | 'settled';
export type Role = 'landlord' | 'farmer' | undefined;

export interface SeatInfo {
  seat: number;
  name: string;
  isBot: boolean;
  cardCount: number;
  role: Role;
}

export interface PlayRecord {
  seat: number;
  hand: Hand;
}

interface GameState {
  phase: Phase;
  /** 我所在的座位（0/1/2）。 */
  mySeat: number;
  /** 我的手牌（完整可见）。 */
  myHand: Card[];
  /** 当前选中的手牌 id。 */
  selected: string[];
  /** 上一手有效出牌（用于「能否压过」提示）。 */
  lastPlay: PlayRecord | null;
  /** 轮到谁（0/1/2）。 */
  turn: number;
  /** 三个座位信息。 */
  seats: SeatInfo[];
  /** 操作日志（最近若干条）。 */
  log: string[];

  toggleSelect: (id: string) => void;
  clearSelect: () => void;
  /** 本地 mock 出牌：校验通过后从手牌移除并记为 lastPlay。 */
  play: () => void;
  /** 本地 mock 过牌。 */
  pass: () => void;
  /** 重新发牌（mock）。 */
  reset: () => void;
}

function buildSeats(mineLen: number, leftLen: number, rightLen: number): SeatInfo[] {
  return [
    { seat: 0, name: '我', isBot: false, cardCount: mineLen, role: 'landlord' },
    { seat: 1, name: '上家 · 机器人', isBot: true, cardCount: leftLen, role: 'farmer' },
    { seat: 2, name: '下家 · 机器人', isBot: true, cardCount: rightLen, role: 'farmer' },
  ];
}

function freshState() {
  const { mine, left, right } = mockDeal();
  return {
    phase: 'playing' as Phase,
    mySeat: 0,
    myHand: mine,
    selected: [] as string[],
    lastPlay: null as PlayRecord | null,
    turn: 0,
    seats: buildSeats(mine.length, left.length, right.length),
    log: ['发牌完成：你是地主（20 张），你先出。'] as string[],
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  ...freshState(),

  toggleSelect: (id) =>
    set((st) => ({
      selected: st.selected.includes(id)
        ? st.selected.filter((x) => x !== id)
        : [...st.selected, id],
    })),

  clearSelect: () => set({ selected: [] }),

  play: () => {
    const st = get();
    const cards = st.myHand.filter((c) => st.selected.includes(c.id));
    if (cards.length === 0) return;

    // 规则仅作提示：能否成牌 / 能否压过。真实校验在服务端。
    const hand = identifyHand(cards);
    if (!hand) return;
    if (st.lastPlay && !canBeat(st.lastPlay.hand, hand)) return;

    const remaining = st.myHand.filter((c) => !st.selected.includes(c.id));
    const seats = st.seats.map((s) =>
      s.seat === st.mySeat ? { ...s, cardCount: remaining.length } : s,
    );
    const won = remaining.length === 0;

    set({
      myHand: remaining,
      selected: [],
      lastPlay: { seat: st.mySeat, hand },
      turn: (st.turn + 1) % 3,
      seats,
      phase: won ? 'settled' : st.phase,
      log: [
        ...st.log,
        won
          ? '🎉 你出完所有牌，本局获胜（mock）'
          : `我：${cards.map((c) => c.display).join(' ')}`,
      ].slice(-9),
    });
  },

  pass: () => {
    const st = get();
    set({
      selected: [],
      turn: (st.turn + 1) % 3,
      log: [...st.log, '我：过'].slice(-9),
    });
  },

  reset: () => set({ ...freshState() }),
}));
