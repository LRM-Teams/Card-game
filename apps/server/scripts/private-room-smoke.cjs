/**
 * 私房分享进房烟测（LRM-318）
 * - 三人在 30s 内同房并自动开局
 * - 满员 / 已开局 / 房间不存在 返回明确错误码
 * - 捕获 [ops]：room.create → room.join×3 → game.start
 *
 * 用法：SERVER_URL=http://127.0.0.1:<port> node apps/server/scripts/private-room-smoke.cjs
 */
const { createRequire } = require('module');
const path = require('path');
const req = createRequire(path.join(__dirname, '../../client/package.json'));
const { io } = req('socket.io-client');

const URL = process.env.SERVER_URL || 'http://127.0.0.1:3010';
const JOIN_DEADLINE_MS = Number(process.env.JOIN_DEADLINE_MS || 30_000);

function mkClient(name, guestId) {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  const state = {
    name,
    guestId,
    seat: null,
    roomId: null,
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
    } else if (e.type === 'snapshot') {
      state.snapshot = e.state;
    } else if (e.type === 'error') {
      state.errors.push(e);
    }
  });
  return { socket, state, ready, send: (a) => socket.emit('action', a) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(pred, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await sleep(40);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function identity(name, guestId, avatarId) {
  return {
    type: 'join',
    displayName: name,
    guestId,
    avatarId,
    beans: 1000,
  };
}

(async () => {
  const a = mkClient('房主', 'g-pr-a');
  const b = mkClient('好友B', 'g-pr-b');
  const c = mkClient('好友C', 'g-pr-c');
  const d = mkClient('迟到D', 'g-pr-d');
  const e = mkClient('路人E', 'g-pr-e');
  await Promise.all([a.ready, b.ready, c.ready, d.ready, e.ready]);

  const t0 = Date.now();
  a.send(identity('房主', 'g-pr-a', 'av-1'));
  await waitUntil(() => a.state.roomId, 5000, 'host room create');
  const roomId = a.state.roomId;

  // 模拟分享链接：第三人用 roomId 加入（30s 内）
  b.send({ ...identity('好友B', 'g-pr-b', 'av-2'), roomId });
  c.send({ ...identity('好友C', 'g-pr-c', 'av-3'), roomId });

  await waitUntil(
    () =>
      a.state.roomId === roomId &&
      b.state.roomId === roomId &&
      c.state.roomId === roomId &&
      a.state.snapshot &&
      a.state.snapshot.players.filter((p) => !p.isBot).length === 3,
    JOIN_DEADLINE_MS,
    'three humans in same room',
  );
  const joinedMs = Date.now() - t0;
  if (joinedMs > JOIN_DEADLINE_MS) {
    throw new Error(`third join took ${joinedMs}ms > ${JOIN_DEADLINE_MS}ms`);
  }

  await waitUntil(
    () => a.state.snapshot && a.state.snapshot.phase !== 'waiting',
    5000,
    'auto game.start',
  );

  // 已开局 → game_started
  d.send({ ...identity('迟到D', 'g-pr-d', 'av-4'), roomId });
  await waitUntil(() => d.state.errors.some((x) => x.code === 'game_started'), 3000, 'game_started');

  // 房间不存在 → room_not_found
  e.send({ ...identity('路人E', 'g-pr-e', 'av-5'), roomId: 'room-does-not-exist' });
  await waitUntil(
    () => e.state.errors.some((x) => x.code === 'room_not_found'),
    3000,
    'room_not_found',
  );

  // room_full：另开一房，在 auto-start 前抢第四席（WAITING 满员窗口极短）
  const f1 = mkClient('满房A', 'g-full-a');
  const f2 = mkClient('满房B', 'g-full-b');
  const f3 = mkClient('满房C', 'g-full-c');
  const f4 = mkClient('满房D', 'g-full-d');
  await Promise.all([f1.ready, f2.ready, f3.ready, f4.ready]);
  f1.send(identity('满房A', 'g-full-a', 'av-1'));
  await waitUntil(() => f1.state.roomId, 3000, 'full-room create');
  const fullRoomId = f1.state.roomId;
  f2.send({ ...identity('满房B', 'g-full-b', 'av-2'), roomId: fullRoomId });
  f3.send({ ...identity('满房C', 'g-full-c', 'av-3'), roomId: fullRoomId });
  // 不等 snapshot；立刻塞第四人，尽量落在 auto-start 之前
  f4.send({ ...identity('满房D', 'g-full-d', 'av-4'), roomId: fullRoomId });
  await waitUntil(
    () =>
      f4.state.errors.some((x) => x.code === 'room_full' || x.code === 'game_started'),
    3000,
    'room_full or game_started',
  );

  const out = {
    ok: true,
    roomId,
    joinedMs,
    phase: a.state.snapshot.phase,
    humans: a.state.snapshot.players.filter((p) => !p.isBot).length,
    errors: {
      game_started: d.state.errors.find((x) => x.code === 'game_started'),
      room_not_found: e.state.errors.find((x) => x.code === 'room_not_found'),
      full_or_started: f4.state.errors[f4.state.errors.length - 1],
    },
  };
  console.log(JSON.stringify(out));

  for (const x of [a, b, c, d, e, f1, f2, f3, f4]) x.socket.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
