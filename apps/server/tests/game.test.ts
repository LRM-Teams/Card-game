import { describe, expect, it, vi } from 'vitest';
import { canPlay, identifyHand, RANK } from '@card-game/rules';
import type { Card, Seat } from '@card-game/rules';
import { botBid, botChoosePlay, botDouble, botReveal } from '../src/game/bot';
import { GameRoom } from '../src/game/GameRoom';
import { RoomRegistry } from '../src/registry';
import { IdentityStore } from '../src/identity';

/** 构造一张最小 Card（用于白盒构造判定场景）。 */
function card(rank: number, id?: string): Card {
  return { id: id ?? `c${rank}`, rank, display: String(rank), suit: 'spade' };
}

function mkHuman(name: string, guestId?: string) {
  return {
    name,
    guestId: guestId ?? `g-${name}`,
    avatarId: 'av-1',
    beans: 1000,
  };
}

/** 3 真人房间并开局（不补机器人，便于控制叫牌/出牌）。 */
function threeHumans(): GameRoom {
  const r = new GameRoom('room-test');
  r.addHuman(mkHuman('A'));
  r.addHuman(mkHuman('B'));
  r.addHuman(mkHuman('C'));
  return r;
}

/** 座位 0 叫(claim)、其余 pass → 地主为 0；跳过明牌/加倍 → 进入出牌、轮到 0。 */
async function landlordAt0(): Promise<GameRoom> {
  const r = threeHumans();
  await r.start();
  await r.handleBid(0, 'claim');
  await r.handleBid(1, 'pass');
  await r.handleBid(2, 'pass');
  expect(r.phase).toBe('revealing');
  expect((await r.handleReveal(0, false)).ok).toBe(true);
  expect(r.phase).toBe('doubling');
  expect((await r.handleDouble(0, false)).ok).toBe(true);
  expect((await r.handleDouble(1, false)).ok).toBe(true);
  expect((await r.handleDouble(2, false)).ok).toBe(true);
  expect(r.phase).toBe('playing');
  return r;
}

describe('GameRoom · 房间 / 开局', () => {
  it('1 真人 + fillBots 开局自动补机器人到 3 人', async () => {
    const r = new GameRoom('r1');
    expect(r.addHuman(mkHuman('A')).ok).toBe(true);
    expect((await r.start(true)).ok).toBe(true);
    expect(r.playerCount).toBe(3);
    expect(r.humanCount).toBe(1);
    expect(r.phase).toBe('bidding'); // 第一个叫牌者是真人 → 停在叫地主
  });

  it('不足 3 真人且不补机器人 → not_enough_players，不隐式补机器人', async () => {
    const r = new GameRoom('r-wait');
    expect(r.addHuman(mkHuman('A')).ok).toBe(true);
    expect(r.addHuman(mkHuman('B')).ok).toBe(true);
    const res = await r.start();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('not_enough_players');
    expect(r.playerCount).toBe(2); // 没补机器人
    expect(r.phase).toBe('waiting');
  });

  it('3 真人开局：发牌 17/17/17 + 3 底牌', async () => {
    const r = threeHumans();
    expect((await r.start()).ok).toBe(true);
    expect(r.players[0]!.hand).toHaveLength(17);
    expect(r.players[1]!.hand).toHaveLength(17);
    expect(r.players[2]!.hand).toHaveLength(17);
    expect(r.bottom).toHaveLength(3);
    expect(r.phase).toBe('bidding');
    expect(r.bottomRevealed).toBe(false);
  });

  it('首位加入的真人即房主；snapshot 暴露 hostSeat（房主可决定等人/开局）', () => {
    const r = new GameRoom('host');
    r.addHuman(mkHuman('A'));
    r.addHuman(mkHuman('B'));
    expect(r.hostSeat).toBe(0); // 创建房间者 = 房主
    const snap = r.snapshot();
    expect(snap.hostSeat).toBe(0);
    expect(snap.players).toHaveLength(2);
    expect(snap.players.every((p) => !p.isBot)).toBe(true);
  });

  it('房间满后再加人被拒', () => {
    const r = threeHumans();
    const res = r.addHuman(mkHuman('D'));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('room_full');
  });
});

describe('GameRoom · 叫地主（抢地主 A，规则在 game-rules.resolveBidding）', () => {
  it('叫地主阶段公开 turnSeat，客户端可按 snapshot/turn 渲染当前叫牌者', async () => {
    const r = threeHumans();
    const start = await r.start();
    expect(start.ok).toBe(true);
    expect(r.phase).toBe('bidding');
    expect(r.turnSeat).toBe(0);
    if (start.ok) {
      expect(start.events.some((e) => e.event.type === 'turn' && e.event.seat === 0)).toBe(true);
    }

    const bid = await r.handleBid(0, 'pass');
    expect(bid.ok).toBe(true);
    expect(r.turnSeat).toBe(1);
    if (bid.ok) {
      expect(bid.events.some((e) => e.event.type === 'turn' && e.event.seat === 1)).toBe(true);
    }
  });

  it('最后一个 claim 者为地主、拿底牌共 20 张，其他人农民', async () => {
    const r = threeHumans();
    await r.start();
    expect((await r.handleBid(0, 'claim')).ok).toBe(true); // 0 叫
    expect((await r.handleBid(1, 'pass')).ok).toBe(true);
    expect((await r.handleBid(2, 'claim')).ok).toBe(true); // 2 抢 → 最后 claim → 地主
    expect(r.landlordSeat).toBe(2);
    expect(r.players[2]!.role).toBe('landlord');
    expect(r.players[0]!.role).toBe('farmer');
    expect(r.players[1]!.role).toBe('farmer');
    expect(r.players[2]!.hand).toHaveLength(20);
    expect(r.bottomRevealed).toBe(true);
    expect(r.phase).toBe('revealing');
    expect(r.turnSeat).toBe(2);
    // 跳过明牌/加倍进入出牌
    await r.handleReveal(2, false);
    await r.handleDouble(0, false);
    await r.handleDouble(1, false);
    await r.handleDouble(2, false);
    expect(r.phase).toBe('playing');
    expect(r.turnSeat).toBe(2);
  });

  it('全员 pass → 流局重发，重新叫牌', async () => {
    const r = threeHumans();
    await r.start();
    await r.handleBid(0, 'pass');
    await r.handleBid(1, 'pass');
    await r.handleBid(2, 'pass');
    expect(r.phase).toBe('bidding'); // 仍在叫地主（重发后）
    expect(r.landlordSeat).toBeNull();
  });

  it('未轮到叫 / 非法 choice → 拒', async () => {
    const r = threeHumans();
    await r.start();
    expect((await r.handleBid(1, 'claim')).ok).toBe(false); // 不是 seat0
    // @ts-expect-error 非法 choice
    const res = await r.handleBid(0, 'maybe');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid_bid');
  });
});

describe('RoomRegistry · 房间加入 / 断线重连', () => {
  it('指定不存在的 roomId 时拒绝加入，不隐式创建好友房', () => {
    const registry = new RoomRegistry();
    const res = registry.join(mkHuman('A'), 'socket-a', 'missing-room');
    expect(res.result.ok).toBe(false);
    if (!res.result.ok) expect(res.result.code).toBe('not_in_room');
    expect(registry.get('missing-room')).toBeUndefined();
  });

  it('满房开局后同 guest 可用原 roomId 重连原座位并拿回私有手牌', async () => {
    const registry = new RoomRegistry();
    const a = registry.join(mkHuman('A', 'g-a'), 'socket-a');
    registry.join(mkHuman('B', 'g-b'), 'socket-b', a.room.roomId);
    registry.join(mkHuman('C', 'g-c'), 'socket-c', a.room.roomId);
    await a.room.start();

    const beforeHand = a.room.players[0]!.hand.map((c) => c.id);
    const disconnected = registry.disconnect(a.room.roomId, 0, 'socket-a');
    expect(disconnected.ok).toBe(true);
    expect(a.room.players[0]!.connected).toBe(false);

    const reconnected = registry.join(mkHuman('A', 'g-a'), 'socket-a2', a.room.roomId);
    expect(reconnected.seat).toBe(0);
    expect(a.room.players[0]!.connected).toBe(true);
    expect(registry.socketOf(a.room.roomId, 0)).toBe('socket-a2');
    if (reconnected.result.ok) {
      expect(reconnected.result.events.some((e) => e.event.type === 'you_joined' && e.event.seat === 0)).toBe(true);
      expect(reconnected.result.events.some((e) => e.event.type === 'dealt' && e.event.hand.join(',') === beforeHand.join(','))).toBe(true);
      expect(reconnected.result.events.some((e) => e.event.type === 'snapshot')).toBe(true);
    }
  });

  it('满房没有断线同名座位时仍拒绝新玩家加入', () => {
    const registry = new RoomRegistry();
    const a = registry.join(mkHuman('A'), 'socket-a');
    registry.join(mkHuman('B'), 'socket-b', a.room.roomId);
    registry.join(mkHuman('C'), 'socket-c', a.room.roomId);

    const res = registry.join(mkHuman('D'), 'socket-d', a.room.roomId);
    expect(res.result.ok).toBe(false);
    if (!res.result.ok) expect(res.result.code).toBe('room_full');
  });

  it('快速匹配：1 人超时后 AI 补位并自动开局', async () => {
    vi.useFakeTimers();
    const registry = new RoomRegistry();
    let formed = false;
    registry.setMatchFormedHandler((f) => {
      formed = true;
      expect(f.seats).toHaveLength(1);
      expect(f.startResult.ok).toBe(true);
      expect(f.room.playerCount).toBe(3);
      expect(f.room.humanCount).toBe(1);
      expect(f.room.phase).not.toBe('waiting');
    });
    registry.enqueueMatch(mkHuman('Solo', 'g-solo'), 'sock-solo');
    await vi.advanceTimersByTimeAsync(2100);
    expect(formed).toBe(true);
    vi.useRealTimers();
  });

  it('IdentityStore：同 guestId 改昵称/头像，豆子连续', () => {
    const store = new IdentityStore();
    const a = store.resolve({ name: '甲', guestId: 'g1', avatarId: 'av-2' });
    expect(a.guestId).toBe('g1');
    expect(a.avatarId).toBe('av-2');
    expect(a.beans).toBe(1000);
    store.applyScore('g1', -100);
    const b = store.resolve({ name: '甲改', guestId: 'g1', avatarId: 'av-3' });
    expect(b.name).toBe('甲改');
    expect(b.avatarId).toBe('av-3');
    expect(b.beans).toBe(900);
  });
});

describe('GameRoom · 出牌权威校验（规则不另写，全走 @card-game/rules）', () => {
  it('领出（自由出牌）不能 pass', async () => {
    const r = await landlordAt0();
    const res = await r.handlePass(0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('must_play_when_leading');
  });

  it('轮不到你出牌 → 拒', async () => {
    const r = await landlordAt0(); // turn=0
    const id = r.players[1]!.hand[0]!.id;
    const res = await r.handlePlay(1, [id]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('not_your_turn');
  });

  it('手里没这张牌 → 拒', async () => {
    const r = await landlordAt0();
    const res = await r.handlePlay(0, ['not-a-real-card']);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal_play');
  });

  it('两张不同点数（不是合法牌型）→ 拒', async () => {
    const r = await landlordAt0();
    const hand = r.players[0]!.hand;
    const a = hand[0]!;
    const b = hand.find((c) => c.rank !== a.rank)!;
    const res = await r.handlePlay(0, [a.id, b.id]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal_play');
  });

  it('领出合法单牌通过：手牌 -1、轮到下家、lastPlay 记录', async () => {
    const r = await landlordAt0();
    const id = r.players[0]!.hand[0]!.id;
    const before = r.players[0]!.hand.length;
    const res = await r.handlePlay(0, [id]);
    expect(res.ok).toBe(true);
    expect(r.players[0]!.hand.length).toBe(before - 1);
    expect(r.turnSeat).toBe(1);
    expect(r.lastPlay).not.toBeNull();
  });

  it('压不过上家 → 拒；能压过 → 通过', async () => {
    const r = await landlordAt0();
    // 白盒构造：上家(0)出了单 5，轮到 seat1
    r.turnSeat = 1;
    r.leaderSeat = 0;
    r.lastPlay = { seat: 0, hand: identifyHand([card(RANK.FIVE)])! };
    // seat1 只有单 3 → 压不过
    r.players[1]!.hand = [card(RANK.THREE, 'c3')];
    let res = await r.handlePlay(1, ['c3']);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal_play');
    // 换成单 7 → 能压过
    r.players[1]!.hand = [card(RANK.SEVEN, 'c7')];
    res = await r.handlePlay(1, ['c7']);
    expect(res.ok).toBe(true);
  });

  it('两人连过 → 本轮结束、领出者继续领出', async () => {
    const r = await landlordAt0();
    await r.handlePlay(0, [r.players[0]!.hand[0]!.id]); // 0 出单牌
    await r.handlePass(1);
    const res = await r.handlePass(2);
    expect(res.ok).toBe(true);
    expect(r.lastPlay).toBeNull(); // 新一轮
    expect(r.turnSeat).toBe(0); // 领出者继续
  });
});

describe('GameRoom · 倍数与结算（规则在 game-rules.multiplier / settlement）', () => {
  it('出炸弹/王炸倍数 ×2；结算三家得分和为 0', async () => {
    const r = await landlordAt0();
    // 白盒：seat0 领出王炸 → 倍数变 2
    r.players[0]!.hand = [card(RANK.SMALL_JOKER, 'JOKER_S'), card(RANK.BIG_JOKER, 'JOKER_B')];
    const res = await r.handlePlay(0, ['JOKER_S', 'JOKER_B']);
    expect(res.ok).toBe(true);
    expect(r.mult.multiplier).toBe(2);
    // 三家最终得分和应为 0（零和）
    if (r.result) {
      const sum = r.result.scores.reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    }
  });

  it('结算后 start 可再来一局：同一批玩家重新发牌回到叫地主', async () => {
    const r = await landlordAt0();
    // seat0 直接出完所有牌 → 结算
    for (const seat of [0, 1, 2] as const) {
      r.players[seat]!.hand = [];
    }
    r.players[0]!.hand = [card(3, 'C3')];
    expect((await r.handlePlay(0, ['C3'])).ok).toBe(true);
    expect(r.phase).toBe('settled');
    expect(r.result).toBeTruthy();
    // 再来一局
    const restart = await r.start();
    expect(restart.ok).toBe(true);
    expect(r.phase).toBe('bidding');
    expect(r.result).toBeNull();
    expect(r.players[0]!.hand).toHaveLength(17);
  });

  it('结算下发 remainingHands：赢家空、未出完者亮牌（LRM-183）', async () => {
    const r = await landlordAt0();
    r.players[0]!.hand = [card(3, 'C3')];
    r.players[1]!.hand = [card(4, 'C4'), card(5, 'H5')];
    r.players[2]!.hand = [card(6, 'S6')];
    expect((await r.handlePlay(0, ['C3'])).ok).toBe(true);
    expect(r.phase).toBe('settled');
    expect(r.result?.remainingHands).toEqual([[], ['C4', 'H5'], ['S6']]);
    expect(r.snapshot().bottomRevealed).toBe(true);
    expect(r.snapshot().bottom).toHaveLength(3);
  });
});

describe('GameRoom · 全机器人局跑完整一局', () => {
  it('3 机器人自动行棋直到 SETTLED，结果自洽', async () => {
    const r = new GameRoom('auto');
    expect((await r.start(true)).ok).toBe(true); // 0 人 → 补 3 机器人
    await r.drainBots();
    expect(r.phase).toBe('settled');
    expect(r.result).not.toBeNull();
    const winner: Seat = r.result!.winnerSeat;
    expect(r.players[winner]!.hand).toHaveLength(0); // 赢家出完牌
    expect(r.result!.winnerSide).toBe(winner === r.landlordSeat ? 'landlord' : 'farmer');
    const sum = r.result!.scores.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0); // 零和
  });

  it('1 真人 + 2 机器人也能跑完整一局（真人用 bot 逻辑驱动）', async () => {
    const r = new GameRoom('mixed');
    r.addHuman(mkHuman('真人'));
    await r.start(true);
    await r.drainBots();
    const human: Seat = 0;
    for (let guard = 0; guard < 500 && r.phase !== 'settled'; guard++) {
      if (r.phase === 'bidding' && r.bid && r.bid.order[r.bid.index] === human) {
        await r.handleBid(human, botBid(r.players[human]!.hand));
        await r.drainBots();
        continue;
      }
      if (r.phase === 'revealing' && r.landlordSeat === human) {
        await r.handleReveal(human, botReveal(r.players[human]!.hand));
        await r.drainBots();
        continue;
      }
      if (r.phase === 'doubling' && r.pendingDoubleSeats.includes(human)) {
        await r.handleDouble(human, botDouble(r.players[human]!.hand, human === r.landlordSeat));
        await r.drainBots();
        continue;
      }
      if (r.phase === 'playing' && r.turnSeat === human) {
        const prev = r.lastPlay ? r.lastPlay.hand : null;
        const cards = botChoosePlay(r.players[human]!.hand, prev);
        if (cards && cards.length) await r.handlePlay(human, cards.map((c) => c.id));
        else if (r.lastPlay === null) await r.handlePlay(human, [r.players[human]!.hand[0]!.id]);
        else await r.handlePass(human);
        await r.drainBots();
        continue;
      }
      await r.drainBots();
      continue;
    }
    expect(r.phase).toBe('settled');
    expect(r.result).not.toBeNull();
  });
});

describe('GameRoom · 明牌 / 加倍（LRM-182）', () => {
  it('地主明牌 → 倍数×2 且公开手牌；再加倍可叠加', async () => {
    const r = threeHumans();
    await r.start();
    await r.handleBid(0, 'claim');
    await r.handleBid(1, 'pass');
    await r.handleBid(2, 'pass');
    expect(r.phase).toBe('revealing');
    expect(r.mult.multiplier).toBe(1);

    const rev = await r.handleReveal(0, true);
    expect(rev.ok).toBe(true);
    expect(r.mult.multiplier).toBe(2);
    expect(r.landlordRevealed).toBe(true);
    expect(r.phase).toBe('doubling');
    expect(r.snapshot().players[0]?.openHand).toHaveLength(20);
    if (rev.ok) {
      expect(rev.events.some((e) => e.event.type === 'revealed' && e.event.revealed === true)).toBe(true);
    }

    expect((await r.handleDouble(0, true)).ok).toBe(true);
    expect(r.mult.multiplier).toBe(4);
    expect((await r.handleDouble(1, false)).ok).toBe(true);
    expect((await r.handleDouble(2, true)).ok).toBe(true);
    expect(r.mult.multiplier).toBe(8);
    expect(r.phase).toBe('playing');
    expect(r.snapshot().multiplierBreakdown).toMatchObject({
      reveal: true,
      doubleCount: 2,
      current: 8,
    });
  });

  it('都不选明牌/加倍 → 倍数不变进入出牌', async () => {
    const r = await landlordAt0();
    expect(r.mult.multiplier).toBe(1);
    expect(r.phase).toBe('playing');
    expect(r.snapshot().multiplierBreakdown.reveal).toBe(false);
    expect(r.snapshot().multiplierBreakdown.doubleCount).toBe(0);
  });

  it('窗口超时自动跳过明牌与加倍', async () => {
    const r = threeHumans();
    await r.start();
    await r.handleBid(0, 'claim');
    await r.handleBid(1, 'pass');
    await r.handleBid(2, 'pass');
    expect(r.phase).toBe('revealing');
    // 伪造已过期
    r.decisionDeadlineAt = Date.now() - 1;
    const skipped = r.expireDecisionWindow();
    expect(skipped.length).toBeGreaterThan(0);
    expect(r.phase).toBe('doubling');
    r.decisionDeadlineAt = Date.now() - 1;
    r.expireDecisionWindow();
    expect(r.phase).toBe('playing');
    expect(r.mult.multiplier).toBe(1);
  });

  it('非地主不能明牌；加倍阶段重复选择被拒', async () => {
    const r = threeHumans();
    await r.start();
    await r.handleBid(0, 'claim');
    await r.handleBid(1, 'pass');
    await r.handleBid(2, 'pass');
    expect((await r.handleReveal(1, true)).ok).toBe(false);
    await r.handleReveal(0, false);
    expect((await r.handleDouble(0, false)).ok).toBe(true);
    expect((await r.handleDouble(0, true)).ok).toBe(false);
  });
});

describe('bot AI 普通档（规则包策略）', () => {
  it('领出返回合法牌；压不过返回 null（pass）', () => {
    const hand = [card(RANK.THREE), card(RANK.FIVE)];
    const lead = botChoosePlay(hand, null);
    expect(lead).not.toBeNull();
    expect(canPlay(null, lead!)).toBe(true);
    const prev = identifyHand([card(RANK.NINE)])!;
    expect(botChoosePlay(hand, prev)).toBeNull();
  });

  it('botBid 返回 claim 或 pass', () => {
    expect(['claim', 'pass']).toContain(botBid([card(RANK.THREE)]));
  });

  it('有王炸时 botBid 为 claim', () => {
    expect(botBid([card(RANK.SMALL_JOKER), card(RANK.BIG_JOKER), card(RANK.THREE)])).toBe('claim');
  });
});

describe('GameRoom · 局内表情/快捷语（LRM-177）', () => {
  it('白名单表情广播；冷却内第二次 rate_limited', async () => {
    const r = await landlordAt0();
    const ok1 = await r.handleAction(0, { type: 'social', kind: 'emote', id: 'like' });
    expect(ok1.ok).toBe(true);
    if (ok1.ok) {
      const ev = ok1.events.find((e) => e.event.type === 'social');
      expect(ev?.event).toMatchObject({ type: 'social', seat: 0, kind: 'emote', id: 'like' });
      expect(ev?.scope).toBe('room');
    }
    const denied = await r.handleAction(0, { type: 'social', kind: 'phrase', id: 'hurry' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('rate_limited');
  });

  it('非法 id → invalid_social；等待阶段不可发', async () => {
    const waiting = threeHumans();
    const early = await waiting.handleAction(0, { type: 'social', kind: 'emote', id: 'like' });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe('invalid_action_for_phase');

    const r = await landlordAt0();
    const bad = await r.handleAction(1, {
      type: 'social',
      kind: 'emote',
      id: 'like',
    });
    expect(bad.ok).toBe(true);
    const unknown = await r.handleAction(2, {
      type: 'social',
      kind: 'emote',
      // @ts-expect-error intentional invalid
      id: 'not-real',
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe('invalid_social');
  });
});
