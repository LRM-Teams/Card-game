import { describe, expect, it } from 'vitest';
import { identifyHand, RANK } from '@card-game/rules';
import type { Card, Seat } from '@card-game/rules';
import { botBid, botChoosePlay } from '../src/game/bot';
import { GameRoom } from '../src/game/GameRoom';
import { RoomRegistry } from '../src/registry';

/** 构造一张最小 Card（用于白盒构造判定场景）。 */
function card(rank: number, id?: string): Card {
  return { id: id ?? `c${rank}`, rank, display: String(rank), suit: 'spade' };
}

/** 3 真人房间并开局（不补机器人，便于控制叫牌/出牌）。 */
function threeHumans(): GameRoom {
  const r = new GameRoom('room-test');
  r.addHuman('A');
  r.addHuman('B');
  r.addHuman('C');
  return r;
}

/** 座位 0 叫(claim)、其余 pass → 地主为 0，进入出牌阶段、轮到 0。 */
function landlordAt0(): GameRoom {
  const r = threeHumans();
  r.start();
  r.handleBid(0, 'claim');
  r.handleBid(1, 'pass');
  r.handleBid(2, 'pass');
  return r;
}

describe('GameRoom · 房间 / 开局', () => {
  it('1 真人开局自动补机器人到 3 人', () => {
    const r = new GameRoom('r1');
    expect(r.addHuman('A').ok).toBe(true);
    expect(r.start().ok).toBe(true);
    expect(r.playerCount).toBe(3);
    expect(r.humanCount).toBe(1);
    expect(r.phase).toBe('bidding'); // 第一个叫牌者是真人 → 停在叫地主
  });

  it('3 真人开局：发牌 17/17/17 + 3 底牌', () => {
    const r = threeHumans();
    expect(r.start().ok).toBe(true);
    expect(r.players[0]!.hand).toHaveLength(17);
    expect(r.players[1]!.hand).toHaveLength(17);
    expect(r.players[2]!.hand).toHaveLength(17);
    expect(r.bottom).toHaveLength(3);
    expect(r.phase).toBe('bidding');
    expect(r.bottomRevealed).toBe(false);
  });

  it('房间满后再加人被拒', () => {
    const r = threeHumans();
    const res = r.addHuman('D');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('room_full');
  });
});

describe('GameRoom · 叫地主（抢地主 A，规则在 game-rules.resolveBidding）', () => {
  it('叫地主阶段公开 turnSeat，客户端可按 snapshot/turn 渲染当前叫牌者', () => {
    const r = threeHumans();
    const start = r.start();
    expect(start.ok).toBe(true);
    expect(r.phase).toBe('bidding');
    expect(r.turnSeat).toBe(0);
    if (start.ok) {
      expect(start.events.some((e) => e.event.type === 'turn' && e.event.seat === 0)).toBe(true);
    }

    const bid = r.handleBid(0, 'pass');
    expect(bid.ok).toBe(true);
    expect(r.turnSeat).toBe(1);
    if (bid.ok) {
      expect(bid.events.some((e) => e.event.type === 'turn' && e.event.seat === 1)).toBe(true);
    }
  });

  it('最后一个 claim 者为地主、拿底牌共 20 张，其他人农民', () => {
    const r = threeHumans();
    r.start();
    expect(r.handleBid(0, 'claim').ok).toBe(true); // 0 叫
    expect(r.handleBid(1, 'pass').ok).toBe(true);
    expect(r.handleBid(2, 'claim').ok).toBe(true); // 2 抢 → 最后 claim → 地主
    expect(r.landlordSeat).toBe(2);
    expect(r.players[2]!.role).toBe('landlord');
    expect(r.players[0]!.role).toBe('farmer');
    expect(r.players[1]!.role).toBe('farmer');
    expect(r.players[2]!.hand).toHaveLength(20);
    expect(r.bottomRevealed).toBe(true);
    expect(r.phase).toBe('playing');
    expect(r.turnSeat).toBe(2);
  });

  it('全员 pass → 流局重发，重新叫牌', () => {
    const r = threeHumans();
    r.start();
    r.handleBid(0, 'pass');
    r.handleBid(1, 'pass');
    r.handleBid(2, 'pass');
    expect(r.phase).toBe('bidding'); // 仍在叫地主（重发后）
    expect(r.landlordSeat).toBeNull();
  });

  it('未轮到叫 / 非法 choice → 拒', () => {
    const r = threeHumans();
    r.start();
    expect(r.handleBid(1, 'claim').ok).toBe(false); // 不是 seat0
    // @ts-expect-error 非法 choice
    const res = r.handleBid(0, 'maybe');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid_bid');
  });
});

describe('RoomRegistry · 房间加入 / 断线重连', () => {
  it('指定不存在的 roomId 时拒绝加入，不隐式创建好友房', () => {
    const registry = new RoomRegistry();
    const res = registry.join('A', 'socket-a', 'missing-room');
    expect(res.result.ok).toBe(false);
    if (!res.result.ok) expect(res.result.code).toBe('not_in_room');
    expect(registry.get('missing-room')).toBeUndefined();
  });

  it('满房开局后同名玩家可用原 roomId 重连原座位并拿回私有手牌', () => {
    const registry = new RoomRegistry();
    const a = registry.join('A', 'socket-a');
    registry.join('B', 'socket-b', a.room.roomId);
    registry.join('C', 'socket-c', a.room.roomId);
    a.room.start();

    const beforeHand = a.room.players[0]!.hand.map((c) => c.id);
    const disconnected = registry.disconnect(a.room.roomId, 0, 'socket-a');
    expect(disconnected.ok).toBe(true);
    expect(a.room.players[0]!.connected).toBe(false);

    const reconnected = registry.join('A', 'socket-a2', a.room.roomId);
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
    const a = registry.join('A', 'socket-a');
    registry.join('B', 'socket-b', a.room.roomId);
    registry.join('C', 'socket-c', a.room.roomId);

    const res = registry.join('D', 'socket-d', a.room.roomId);
    expect(res.result.ok).toBe(false);
    if (!res.result.ok) expect(res.result.code).toBe('room_full');
  });
});

describe('GameRoom · 出牌权威校验（规则不另写，全走 @card-game/rules）', () => {
  it('领出（自由出牌）不能 pass', () => {
    const r = landlordAt0();
    const res = r.handlePass(0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('must_play_when_leading');
  });

  it('轮不到你出牌 → 拒', () => {
    const r = landlordAt0(); // turn=0
    const id = r.players[1]!.hand[0]!.id;
    const res = r.handlePlay(1, [id]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('not_your_turn');
  });

  it('手里没这张牌 → 拒', () => {
    const r = landlordAt0();
    const res = r.handlePlay(0, ['not-a-real-card']);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal_play');
  });

  it('两张不同点数（不是合法牌型）→ 拒', () => {
    const r = landlordAt0();
    const hand = r.players[0]!.hand;
    const a = hand[0]!;
    const b = hand.find((c) => c.rank !== a.rank)!;
    const res = r.handlePlay(0, [a.id, b.id]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal_play');
  });

  it('领出合法单牌通过：手牌 -1、轮到下家、lastPlay 记录', () => {
    const r = landlordAt0();
    const id = r.players[0]!.hand[0]!.id;
    const before = r.players[0]!.hand.length;
    const res = r.handlePlay(0, [id]);
    expect(res.ok).toBe(true);
    expect(r.players[0]!.hand.length).toBe(before - 1);
    expect(r.turnSeat).toBe(1);
    expect(r.lastPlay).not.toBeNull();
  });

  it('压不过上家 → 拒；能压过 → 通过', () => {
    const r = landlordAt0();
    // 白盒构造：上家(0)出了单 5，轮到 seat1
    r.turnSeat = 1;
    r.leaderSeat = 0;
    r.lastPlay = { seat: 0, hand: identifyHand([card(RANK.FIVE)])! };
    // seat1 只有单 3 → 压不过
    r.players[1]!.hand = [card(RANK.THREE, 'c3')];
    let res = r.handlePlay(1, ['c3']);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('illegal_play');
    // 换成单 7 → 能压过
    r.players[1]!.hand = [card(RANK.SEVEN, 'c7')];
    res = r.handlePlay(1, ['c7']);
    expect(res.ok).toBe(true);
  });

  it('两人连过 → 本轮结束、领出者继续领出', () => {
    const r = landlordAt0();
    r.handlePlay(0, [r.players[0]!.hand[0]!.id]); // 0 出单牌
    r.handlePass(1);
    const res = r.handlePass(2);
    expect(res.ok).toBe(true);
    expect(r.lastPlay).toBeNull(); // 新一轮
    expect(r.turnSeat).toBe(0); // 领出者继续
  });
});

describe('GameRoom · 倍数与结算（规则在 game-rules.multiplier / settlement）', () => {
  it('出炸弹/王炸倍数 ×2；结算三家得分和为 0', () => {
    const r = landlordAt0();
    // 白盒：seat0 领出王炸 → 倍数变 2
    r.players[0]!.hand = [card(RANK.SMALL_JOKER, 'JOKER_S'), card(RANK.BIG_JOKER, 'JOKER_B')];
    const res = r.handlePlay(0, ['JOKER_S', 'JOKER_B']);
    expect(res.ok).toBe(true);
    expect(r.mult.multiplier).toBe(2);
    // 三家最终得分和应为 0（零和）
    if (r.result) {
      const sum = r.result.scores.reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    }
  });
});

describe('GameRoom · 全机器人局跑完整一局', () => {
  it('3 机器人自动行棋直到 SETTLED，结果自洽', () => {
    const r = new GameRoom('auto');
    expect(r.start().ok).toBe(true); // 0 人 → 补 3 机器人 → 全自动到结算
    expect(r.phase).toBe('settled');
    expect(r.result).not.toBeNull();
    const winner: Seat = r.result!.winnerSeat;
    expect(r.players[winner]!.hand).toHaveLength(0); // 赢家出完牌
    expect(r.result!.winnerSide).toBe(winner === r.landlordSeat ? 'landlord' : 'farmer');
    const sum = r.result!.scores.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0); // 零和
  });

  it('1 真人 + 2 机器人也能跑完整一局（真人用 bot 逻辑驱动）', () => {
    const r = new GameRoom('mixed');
    r.addHuman('真人');
    r.start();
    const human: Seat = 0;
    for (let guard = 0; guard < 500 && r.phase !== 'settled'; guard++) {
      if (r.phase === 'bidding' && r.bid && r.bid.order[r.bid.index] === human) {
        r.handleBid(human, botBid(r.players[human]!.hand));
        continue;
      }
      if (r.phase === 'playing' && r.turnSeat === human) {
        const prev = r.lastPlay ? r.lastPlay.hand : null;
        const cards = botChoosePlay(r.players[human]!.hand, prev);
        if (cards && cards.length) r.handlePlay(human, cards.map((c) => c.id));
        else if (r.lastPlay === null) r.handlePlay(human, [r.players[human]!.hand[0]!.id]);
        else r.handlePass(human);
        continue;
      }
      break;
    }
    expect(r.phase).toBe('settled');
    expect(r.result).not.toBeNull();
  });
});

describe('bot AI 占位（最小合法）', () => {
  it('领出返回单牌；压不过返回 null（pass）', () => {
    const hand = [card(RANK.THREE), card(RANK.FIVE)];
    const lead = botChoosePlay(hand, null);
    expect(lead).not.toBeNull();
    expect(lead!).toHaveLength(1);
    const prev = identifyHand([card(RANK.NINE)])!;
    expect(botChoosePlay(hand, prev)).toBeNull();
  });

  it('botBid 返回 claim 或 pass', () => {
    expect(['claim', 'pass']).toContain(botBid([card(RANK.THREE)]));
  });
});
