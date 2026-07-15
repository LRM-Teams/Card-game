import { describe, expect, it } from 'vitest';
import { identifyHand, RANK } from '@card-game/rules';
import type { Card } from '@card-game/rules';
import {
  buildDouZeroPlayState,
  choosePlayWithDouZero,
  createConfiguredDouZeroAdapter,
  createDouZeroCommandAdapter,
  douZeroPosition,
  fromDouZeroAction,
  listLegalActions,
  toDouZeroCards,
} from '../src/game/douzeroAdapter';
import { GameRoom } from '../src/game/GameRoom';

function card(rank: number, id?: string): Card {
  return { id: id ?? `c${rank}`, rank, display: String(rank), suit: 'spade' };
}

describe('DouZero adapter', () => {
  it('转换内部牌到 DouZero 官方不带花色点数编码', () => {
    expect(toDouZeroCards([card(RANK.THREE), card(RANK.TEN), card(RANK.A), card(RANK.TWO)])).toEqual([
      3,
      10,
      14,
      17,
    ]);
    expect(toDouZeroCards([card(RANK.SMALL_JOKER), card(RANK.BIG_JOKER)])).toEqual([20, 30]);
  });

  it('按地主座位映射 DouZero 身份', () => {
    expect(douZeroPosition(1, 1)).toBe('landlord');
    expect(douZeroPosition(2, 1)).toBe('landlord_down');
    expect(douZeroPosition(0, 1)).toBe('landlord_up');
  });

  it('从 DouZero action 回选真实手牌，重复点数按数量消费', () => {
    const hand = [card(RANK.FIVE, '5a'), card(RANK.FIVE, '5b'), card(RANK.SEVEN, '7a')];
    expect(fromDouZeroAction([5, 5], hand)?.map((c) => c.id)).toEqual(['5a', '5b']);
    expect(fromDouZeroAction([5, 5, 5], hand)).toBeNull();
  });

  it('生成当前可压过上家的合法动作列表', () => {
    const hand = [card(RANK.THREE), card(RANK.FIVE), card(RANK.FIVE, '5b'), card(RANK.SMALL_JOKER), card(RANK.BIG_JOKER)];
    const prev = identifyHand([card(RANK.FOUR)])!;
    const actions = listLegalActions(hand, prev).map(toDouZeroCards);
    expect(actions).toContainEqual([5]);
    expect(actions).toContainEqual([20, 30]);
    expect(actions).not.toContainEqual([3]);
  });

  it('构造 DouZero 状态包含身份、底牌、手牌数、历史和合法动作', () => {
    const hand = [card(RANK.FIVE), card(RANK.SIX)];
    const prev = identifyHand([card(RANK.FOUR)])!;
    const state = buildDouZeroPlayState({
      seat: 2,
      landlordSeat: 1,
      hand,
      prev,
      bottom: [card(RANK.A)],
      handCounts: { 0: 17, 1: 20, 2: 2 },
      history: [{ seat: 1, cards: [card(RANK.FOUR)], isPass: false }],
    });

    expect(state.position).toBe('landlord_down');
    expect(state.modelKey).toBe('landlord_down');
    expect(state.hand).toEqual([5, 6]);
    expect(state.lastMove).toEqual([4]);
    expect(state.bottom).toEqual([14]);
    expect(state.handCounts[1]).toBe(20);
    expect(state.playedCards).toEqual([4]);
    expect(state.playHistory[0]).toEqual({ position: 'landlord', action: [4], isPass: false });
    expect(state.legalActions).toContainEqual([5]);
  });

  it('命令适配器可通过 JSON stdin/stdout 返回 DouZero action', () => {
    const adapter = createDouZeroCommandAdapter(
      `node -e "process.stdin.resume();process.stdin.on('data',()=>process.stdout.write(JSON.stringify({action:[5]})))"`,
    );
    const state = buildDouZeroPlayState({
      seat: 0,
      landlordSeat: 0,
      hand: [card(RANK.FIVE)],
      prev: null,
      bottom: [],
      handCounts: { 0: 1, 1: 17, 2: 17 },
      history: [],
    });

    expect(adapter.choosePlay(state)).toEqual([5]);
  });

  it('配置缺失时不启用 DouZero 外部推理适配器', () => {
    expect(createConfiguredDouZeroAdapter({})).toBeUndefined();
  });

  it('非法模型输出会 fallback 到当前最小合法 bot 行为', () => {
    const hand = [card(RANK.THREE), card(RANK.FIVE)];
    const prev = identifyHand([card(RANK.FOUR)])!;
    const chosen = choosePlayWithDouZero(
      {
        seat: 0,
        landlordSeat: 0,
        hand,
        prev,
        bottom: [],
        handCounts: { 0: 2, 1: 17, 2: 17 },
        history: [],
      },
      { choosePlay: () => [3] },
    );

    expect(chosen?.map((c) => c.rank)).toEqual([RANK.FIVE]);
  });

  it('GameRoom 机器人出牌可调用适配器，模型异常时仍能 fallback 跑完', () => {
    const room = new GameRoom('ai-fallback', {
      choosePlay: () => {
        throw new Error('DouZero service unavailable');
      },
    });

    expect(room.start(true).ok).toBe(true);
    expect(room.phase).toBe('settled');
    expect(room.result).not.toBeNull();
    expect(room.playHistory.length).toBeGreaterThan(0);
  });
});
