/**
 * 私房分享链接 / 边界态烟测（LRM-528，承接 LRM-318）
 *
 * 覆盖（对 SERVER_URL 现网/本地均可）：
 * 1) 房间不存在 → room_not_found（含 # 前缀）
 * 2) 深链：`#roomId` / 空白 / `# roomId` 归一后三人同房并自动开局
 * 3) 已开局新 guest → game_already_started（满桌用户可见边界）
 * 4) 同 guest 重复 join：同 socket → already_in_room；新 socket 指定 roomId → 接管原座位
 *
 * WAITING 态精确 `room_full`（3 座占满尚未开局）由单测覆盖：
 *   apps/server/tests/game.test.ts · 「进房失败写出 [ops]」/「满房没有断线…」
 *
 * 用法：
 *   SERVER_URL=http://127.0.0.1:3000 node apps/server/scripts/private-room-smoke.cjs
 *   SERVER_URL=http://82.157.184.89:8088 node apps/server/scripts/private-room-smoke.cjs
 *
 * 日志核对：
 *   docker logs ddz --since 30m 2>&1 | grep '\[ops\]' | grep -E 'room\.(create|join)|game\.start'
 *   # 错误路径：grep room.join_reject（code=room_not_found|room_full|game_already_started|already_in_room）
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
  const steps = [];
  const host = mkClient('房主', 'g-priv-host');
  const p2 = mkClient('好友2', 'g-priv-p2');
  const p3 = mkClient('好友3', 'g-priv-p3');
  const stranger = mkClient('路人', 'g-priv-stranger');
  await Promise.all([host.ready, p2.ready, p3.ready, stranger.ready]);

  // --- 错误路径：房间不存在（含 #）---
  await expectError(
    stranger,
    joinAction('路人', 'g-priv-stranger', 'room-does-not-exist-lrm528'),
    'room_not_found',
  );
  await expectError(
    stranger,
    joinAction('路人', 'g-priv-stranger', '#room-does-not-exist-lrm528'),
    'room_not_found',
  );
  steps.push('room_not_found');

  // --- 主路径：建房 + 深链 / 空白归一进房 ---
  const t0 = Date.now();
  host.send(joinAction('房主', 'g-priv-host'));
  await waitFor(() => host.state.roomId, 5000, 'host create');
  const roomId = host.state.roomId;
  console.log(JSON.stringify({ step: 'created', roomId, ms: Date.now() - t0 }));

  // 同 socket 重复 join → already_in_room（不误创新房）
  await expectError(host, joinAction('房主', 'g-priv-host'), 'already_in_room');
  steps.push('already_in_room');

  p2.send(joinAction('好友2', 'g-priv-p2', `#${roomId}`));
  await waitFor(() => p2.state.roomId === roomId, 5000, 'p2 deep-link join');
  steps.push('deep_link_join');

  p3.send(joinAction('好友3', 'g-priv-p3', `  ${roomId}  `));
  await waitFor(() => p3.state.roomId === roomId, 5000, 'p3 whitespace join');
  steps.push('whitespace_join');

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
  steps.push('started');

  // --- 已开局 / 满桌：新 guest 不能入座（含 `# roomId` 归一）---
  const late = mkClient('迟到', 'g-priv-late');
  await late.ready;
  await expectError(late, joinAction('迟到', 'g-priv-late', `# ${roomId}`), 'game_already_started');
  steps.push('game_already_started');

  // --- 同 guest 新 socket + 原 roomId → 接管原座位（非创新房）---
  const seatBefore = p2.state.seat;
  p2.close();
  await sleep(200);
  const p2b = mkClient('好友2', 'g-priv-p2');
  await p2b.ready;
  p2b.send(joinAction('好友2', 'g-priv-p2', `#${roomId}`));
  await waitFor(() => p2b.state.seat === seatBefore && p2b.state.roomId === roomId, 5000, 'same guest takeover');
  steps.push('same_guest_rejoin');

  console.log(
    JSON.stringify({
      ok: true,
      roomId,
      joinMs,
      steps,
      tipHint: 'grep [ops] room.create|room.join|room.join_reject|game.start',
    }),
  );

  for (const c of [host, p3, stranger, late, p2b]) c.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
