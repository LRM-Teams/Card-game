/**
 * 断线重连烟测（LRM-519）
 *
 * 场景：
 * 1) 三真人私房开局 → A 断线 → 同 guest 重连原座位/手牌/回合一致
 * 2) 不存在房间 → room_not_found
 * 3) 对局中新 guest 加入 → game_already_started
 *
 * 用法：
 *   SERVER_URL=http://127.0.0.1:3000 node apps/server/scripts/reconnect-smoke.cjs
 *
 * 服务端日志：
 *   docker logs ddz --since 10m 2>&1 | grep '\[ops\]' | grep -E 'player.reconnect|room.join'
 */
const { createRequire } = require('module');
const path = require('path');
const req = createRequire(path.join(__dirname, '../../client/package.json'));
const { io } = req('socket.io-client');

const URL = process.env.SERVER_URL || 'http://127.0.0.1:3010';

function mkClient(name, guestId) {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  const state = {
    name,
    guestId,
    seat: null,
    roomId: null,
    hand: [],
    snapshot: null,
    errors: [],
  };
  const ready = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(name + ' connect timeout')), 8000);
    socket.on('connect', () => {
      clearTimeout(t);
      resolve();
    });
    socket.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
  socket.on('event', (e) => {
    if (e.type === 'you_joined') {
      state.seat = e.seat;
      state.roomId = e.roomId;
    } else if (e.type === 'dealt') state.hand = e.hand.slice();
    else if (e.type === 'snapshot') state.snapshot = e.state;
    else if (e.type === 'error') state.errors.push(e);
  });
  return { socket, state, ready, send: (a) => socket.emit('action', a) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred, ms, label) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (pred()) return;
    await sleep(40);
  }
  throw new Error(label + ' timeout');
}

(async () => {
  const a = mkClient('重A', 'g-re-a');
  const b = mkClient('重B', 'g-re-b');
  const c = mkClient('重C', 'g-re-c');
  await Promise.all([a.ready, b.ready, c.ready]);

  a.send({ type: 'join', displayName: '重A', guestId: 'g-re-a', avatarId: 'av-1', beans: 1000 });
  await waitFor(() => a.state.roomId, 5000, 'create room');
  const roomId = a.state.roomId;
  b.send({
    type: 'join',
    displayName: '重B',
    roomId,
    guestId: 'g-re-b',
    avatarId: 'av-2',
    beans: 1000,
  });
  c.send({
    type: 'join',
    displayName: '重C',
    roomId,
    guestId: 'g-re-c',
    avatarId: 'av-3',
    beans: 1000,
  });
  await waitFor(
    () => a.state.snapshot && a.state.snapshot.phase !== 'waiting' && a.state.hand.length > 0,
    8000,
    'auto start + deal',
  );

  const beforeHand = a.state.hand.slice().sort().join(',');
  const beforePhase = a.state.snapshot.phase;
  const beforeTurn = a.state.snapshot.turnSeat;
  const seat = a.state.seat;

  a.socket.close();
  await sleep(300);

  const a2 = mkClient('重A', 'g-re-a');
  await a2.ready;
  a2.send({
    type: 'join',
    displayName: '重A',
    roomId: `#${roomId}`,
    guestId: 'g-re-a',
    avatarId: 'av-1',
    beans: 1000,
  });
  await waitFor(
    () => a2.state.seat === seat && a2.state.hand.length > 0 && a2.state.snapshot,
    5000,
    'reconnect restore',
  );

  const afterHand = a2.state.hand.slice().sort().join(',');
  if (afterHand !== beforeHand) {
    throw new Error(`hand mismatch before=${beforeHand} after=${afterHand}`);
  }
  if (a2.state.snapshot.phase !== beforePhase) {
    throw new Error(`phase mismatch before=${beforePhase} after=${a2.state.snapshot.phase}`);
  }
  if (a2.state.snapshot.turnSeat !== beforeTurn) {
    throw new Error(`turnSeat mismatch before=${beforeTurn} after=${a2.state.snapshot.turnSeat}`);
  }
  console.log(
    JSON.stringify({
      ok: true,
      step: 'reconnect',
      roomId,
      seat,
      phase: beforePhase,
      turnSeat: beforeTurn,
      handSize: a2.state.hand.length,
    }),
  );

  const ghost = mkClient('幽灵', 'g-missing');
  await ghost.ready;
  ghost.send({
    type: 'join',
    displayName: '幽灵',
    roomId: 'missing-room-lrm519',
    guestId: 'g-missing',
    avatarId: 'av-1',
    beans: 1000,
  });
  await waitFor(() => ghost.state.errors.some((e) => e.code === 'room_not_found'), 3000, 'room_not_found');
  console.log(JSON.stringify({ ok: true, step: 'room_not_found' }));

  const late = mkClient('迟到', 'g-late');
  await late.ready;
  late.send({
    type: 'join',
    displayName: '迟到',
    roomId,
    guestId: 'g-late',
    avatarId: 'av-1',
    beans: 1000,
  });
  await waitFor(
    () => late.state.errors.some((e) => e.code === 'game_already_started'),
    3000,
    'game_already_started',
  );
  console.log(JSON.stringify({ ok: true, step: 'game_already_started' }));

  b.socket.close();
  c.socket.close();
  a2.socket.close();
  ghost.socket.close();
  late.socket.close();
  console.log(JSON.stringify({ ok: true, all: true }));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
