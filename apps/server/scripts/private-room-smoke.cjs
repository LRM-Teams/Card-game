/**
 * 私房房间号/链接进房烟测（LRM-318）
 *
 * ① 房主建房 → 两人用房间号加入 → 30s 内同房开局（满 3 真人自动开）
 * ② 房间不存在 / 满员 / 已开局 返回明确错误码
 *
 * 用法：
 *   SERVER_URL=http://127.0.0.1:3000 node apps/server/scripts/private-room-smoke.cjs
 *   SERVER_URL=http://82.157.184.89:8088 node apps/server/scripts/private-room-smoke.cjs
 *
 * 日志核对：
 *   docker logs ddz --since 30m 2>&1 | grep '\[ops\]' | grep -E 'room\.(create|join)|game\.start'
 */
const { createRequire } = require('module');
const path = require('path');
const req = createRequire(path.join(__dirname, '../../client/package.json'));
const { io } = req('socket.io-client');

const URL = process.env.SERVER_URL || 'http://127.0.0.1:3010';
const JOIN_BUDGET_MS = Number(process.env.JOIN_BUDGET_MS || 30_000);

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
    } else if (e.type === 'snapshot') state.snapshot = e.state;
    else if (e.type === 'error') state.errors.push(e);
  });
  return {
    socket,
    state,
    ready,
    send: (a) => socket.emit('action', a),
    close: () => socket.close(),
  };
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

function joinAction(name, guestId, roomId) {
  return {
    type: 'join',
    displayName: name,
    guestId,
    avatarId: 'av-1',
    beans: 1000,
    roomId,
  };
}

async function expectError(client, action, code) {
  const before = client.state.errors.length;
  client.send(action);
  await waitFor(() => client.state.errors.length > before, 5000, `error ${code}`);
  const last = client.state.errors[client.state.errors.length - 1];
  if (!last || last.code !== code) {
    throw new Error(`expected ${code}, got ${JSON.stringify(last)}`);
  }
  return last;
}

(async () => {
  const host = mkClient('房主', 'g-priv-host');
  const p2 = mkClient('好友2', 'g-priv-p2');
  const p3 = mkClient('好友3', 'g-priv-p3');
  const stranger = mkClient('路人', 'g-priv-stranger');
  await Promise.all([host.ready, p2.ready, p3.ready, stranger.ready]);

  // --- 错误路径：房间不存在 ---
  await expectError(
    stranger,
    joinAction('路人', 'g-priv-stranger', 'room-does-not-exist'),
    'room_not_found',
  );
  // 带 # 的无效号同样 not found
  await expectError(
    stranger,
    joinAction('路人', 'g-priv-stranger', '#room-does-not-exist'),
    'room_not_found',
  );

  // --- 主路径：建房 + 两人用房间号加入（30s 预算）---
  const t0 = Date.now();
  host.send(joinAction('房主', 'g-priv-host'));
  await waitFor(() => host.state.roomId, 5000, 'host create');
  const roomId = host.state.roomId;
  console.log(JSON.stringify({ step: 'created', roomId, ms: Date.now() - t0 }));

  p2.send(joinAction('好友2', 'g-priv-p2', `#${roomId}`));
  await waitFor(() => p2.state.roomId === roomId, 5000, 'p2 join');
  p3.send(joinAction('好友3', 'g-priv-p3', `  ${roomId}  `));
  await waitFor(() => p3.state.roomId === roomId, 5000, 'p3 join');

  await waitFor(
    () =>
      [host, p2, p3].every((c) => c.state.snapshot) &&
      host.state.snapshot.phase !== 'waiting',
    JOIN_BUDGET_MS,
    'auto start within budget',
  );
  const joinMs = Date.now() - t0;
  if (joinMs > JOIN_BUDGET_MS) throw new Error(`join+start took ${joinMs}ms > ${JOIN_BUDGET_MS}`);

  const humans = (host.state.snapshot.players || []).filter((p) => p && !p.isBot).length;
  console.log(
    JSON.stringify({
      step: 'started',
      roomId,
      phase: host.state.snapshot.phase,
      humans,
      joinMs,
    }),
  );

  // --- 满员等待态：再建一个等待房测 room_full ---
  const h2 = mkClient('房主2', 'g-priv-host2');
  const f2 = mkClient('满B', 'g-priv-full-b');
  const f3 = mkClient('满C', 'g-priv-full-c');
  const f4 = mkClient('满D', 'g-priv-full-d');
  await Promise.all([h2.ready, f2.ready, f3.ready, f4.ready]);
  h2.send(joinAction('房主2', 'g-priv-host2'));
  await waitFor(() => h2.state.roomId, 5000, 'host2 create');
  const waitRoom = h2.state.roomId;
  f2.send(joinAction('满B', 'g-priv-full-b', waitRoom));
  f3.send(joinAction('满C', 'g-priv-full-c', waitRoom));
  await waitFor(() => f2.state.roomId === waitRoom && f3.state.roomId === waitRoom, 5000, 'fill wait room');
  // 满 3 人会自动开局；稍等后加入应是 game_already_started
  await waitFor(
    () => h2.state.snapshot && h2.state.snapshot.phase !== 'waiting',
    8000,
    'wait room auto start',
  );
  await expectError(f4, joinAction('满D', 'g-priv-full-d', waitRoom), 'game_already_started');

  console.log(JSON.stringify({ ok: true, roomId, joinMs, tipHint: 'grep room.create|room.join|game.start' }));

  for (const c of [host, p2, p3, stranger, h2, f2, f3, f4]) c.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
