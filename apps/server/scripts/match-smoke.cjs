/**
 * 快速匹配烟测（LRM-309 / LRM-319）
 *
 * MODE=humans（默认）：两真人入队等待 → 第三人加入立即开局（0 bot）
 * MODE=bots：两真人入队，等 MATCH_FILL_AFTER_MS 超时补机（需服务端超时较短）
 *
 * 用法：
 *   SERVER_URL=http://127.0.0.1:3000 node apps/server/scripts/match-smoke.cjs
 *   MODE=bots SERVER_URL=... node apps/server/scripts/match-smoke.cjs
 *
 * 成桌路径日志（服务端）：
 *   docker logs ddz --since 10m 2>&1 | grep '\[ops\]' | grep 'match.form'
 *   # fillBots:false 满 3 真人立即开；fillBots:true 超时补机
 */
const { createRequire } = require('module');
const path = require('path');
const req = createRequire(path.join(__dirname, '../../client/package.json'));
const { io } = req('socket.io-client');

const URL = process.env.SERVER_URL || 'http://127.0.0.1:3010';
const MODE = (process.env.MODE || 'humans').toLowerCase();
const WAIT_FOR_BOTS_MS = Number(process.env.WAIT_FOR_BOTS_MS || 25_000);

function mkClient(name, guestId) {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  const state = {
    name,
    guestId,
    seat: null,
    roomId: null,
    matching: false,
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
    if (e.type === 'matching') state.matching = true;
    else if (e.type === 'match_cancelled') state.matching = false;
    else if (e.type === 'you_joined') {
      state.seat = e.seat;
      state.roomId = e.roomId;
      state.matching = false;
    } else if (e.type === 'snapshot') state.snapshot = e.state;
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

function playerStats(snap) {
  const players = (snap && snap.players) || [];
  const humans = players.filter((p) => p && !p.isBot).length;
  const bots = players.filter((p) => p && p.isBot).length;
  return { humans, bots, phase: snap && snap.phase };
}

(async () => {
  if (MODE === 'bots') {
    const a = mkClient('配A', 'g-match-bot-a');
    const b = mkClient('配B', 'g-match-bot-b');
    await Promise.all([a.ready, b.ready]);
    a.send({ type: 'match', displayName: '配A', guestId: 'g-match-bot-a', avatarId: 'av-1', beans: 1000 });
    b.send({ type: 'match', displayName: '配B', guestId: 'g-match-bot-b', avatarId: 'av-2', beans: 1000 });
    await waitFor(() => a.state.matching && b.state.matching, 3000, 'matching');
    await waitFor(
      () => a.state.snapshot && a.state.snapshot.phase !== 'waiting',
      WAIT_FOR_BOTS_MS,
      'timeout fill bots',
    );
    const stats = playerStats(a.state.snapshot);
    console.log(JSON.stringify({ mode: 'bots', roomId: a.state.roomId, ...stats }));
    if (stats.humans !== 2 || stats.bots !== 1) {
      throw new Error(`expected 2 humans + 1 bot, got humans=${stats.humans} bots=${stats.bots}`);
    }
    a.socket.close();
    b.socket.close();
    console.log(JSON.stringify({ ok: true, mode: 'bots' }));
    return;
  }

  const a = mkClient('配A', 'g-match-hum-a');
  const b = mkClient('配B', 'g-match-hum-b');
  const c = mkClient('配C', 'g-match-hum-c');
  await Promise.all([a.ready, b.ready, c.ready]);

  a.send({ type: 'match', displayName: '配A', guestId: 'g-match-hum-a', avatarId: 'av-1', beans: 1000 });
  b.send({ type: 'match', displayName: '配B', guestId: 'g-match-hum-b', avatarId: 'av-2', beans: 1000 });
  await waitFor(() => a.state.matching && b.state.matching, 3000, 'matching');
  await sleep(300);
  if (a.state.snapshot && a.state.snapshot.phase !== 'waiting') {
    throw new Error('2 humans should still be waiting (not timed out yet)');
  }

  c.send({ type: 'match', displayName: '配C', guestId: 'g-match-hum-c', avatarId: 'av-3', beans: 1000 });
  await waitFor(
    () => a.state.snapshot && a.state.snapshot.phase !== 'waiting',
    5000,
    'third human auto start',
  );

  const stats = playerStats(a.state.snapshot);
  console.log(JSON.stringify({ mode: 'humans', roomId: a.state.roomId, ...stats }));
  if (stats.humans !== 3 || stats.bots !== 0) {
    throw new Error(`expected 3 humans + 0 bot, got humans=${stats.humans} bots=${stats.bots}`);
  }
  if (a.state.roomId !== b.state.roomId || a.state.roomId !== c.state.roomId) {
    throw new Error('players not in same room');
  }

  a.socket.close();
  b.socket.close();
  c.socket.close();
  console.log(JSON.stringify({ ok: true, mode: 'humans' }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
