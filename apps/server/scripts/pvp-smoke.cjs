const { createRequire } = require('module');
const path = require('path');
const req = createRequire(path.join(__dirname, '../../client/package.json'));
const { io } = req('socket.io-client');

const URL = process.env.SERVER_URL || 'http://127.0.0.1:3010';

function mkClient(name, guestId) {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  const state = {
    name, guestId, seat: null, roomId: null, hand: [], snapshot: null, settled: null, errors: [],
  };
  const ready = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(name + ' connect timeout')), 8000);
    socket.on('connect', () => { clearTimeout(t); resolve(); });
    socket.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
  socket.on('event', (e) => {
    if (e.type === 'you_joined') { state.seat = e.seat; state.roomId = e.roomId; }
    else if (e.type === 'dealt') state.hand = e.hand;
    else if (e.type === 'snapshot') state.snapshot = e.state;
    else if (e.type === 'played' && e.seat === state.seat) {
      const ids = new Set(e.hand.cards.map((c) => c.id));
      state.hand = state.hand.filter((id) => !ids.has(id));
    } else if (e.type === 'settled') state.settled = e.result;
    else if (e.type === 'error') state.errors.push(e);
  });
  return { socket, state, ready, send: (a) => socket.emit('action', a) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function drive(clients) {
  for (let guard = 0; guard < 4000; guard++) {
    const any = clients.find((c) => c.state.settled);
    if (any) return any.state.settled;
    const snap = clients.map((c) => c.state.snapshot).find(Boolean);
    if (!snap) { await sleep(20); continue; }
    if (snap.phase === 'bidding') {
      const c = clients.find((x) => x.state.seat === snap.turnSeat);
      if (c) c.send({ type: 'bid', choice: snap.turnSeat === 0 ? 'claim' : 'pass' });
      await sleep(30); continue;
    }
    if (snap.phase === 'revealing') {
      const c = clients.find((x) => x.state.seat === snap.landlordSeat);
      if (c) c.send({ type: 'reveal', reveal: false });
      await sleep(30); continue;
    }
    if (snap.phase === 'doubling') {
      for (const seat of snap.pendingDoubleSeats || []) {
        const c = clients.find((x) => x.state.seat === seat);
        if (c) c.send({ type: 'double', double: false });
      }
      await sleep(40); continue;
    }
    if (snap.phase === 'playing' && snap.turnSeat != null) {
      const c = clients.find((x) => x.state.seat === snap.turnSeat);
      if (!c || !c.state.hand.length) { await sleep(20); continue; }
      const turnBefore = c.state.snapshot && c.state.snapshot.turnSeat;
      if (!snap.lastPlay) {
        c.send({ type: 'play', cards: [c.state.hand[0]] });
      } else {
        let advanced = false;
        for (const id of c.state.hand.slice()) {
          const errBefore = c.state.errors.length;
          c.send({ type: 'play', cards: [id] });
          await sleep(30);
          const last = c.state.errors[c.state.errors.length - 1];
          if (c.state.errors.length > errBefore && last && last.code === 'illegal_play') continue;
          if ((c.state.snapshot && c.state.snapshot.turnSeat !== turnBefore) || c.state.settled) {
            advanced = true; break;
          }
        }
        if (!advanced) c.send({ type: 'pass' });
      }
      await sleep(40); continue;
    }
    await sleep(20);
  }
  throw new Error('smoke timeout');
}

(async () => {
  const a = mkClient('烟A', 'g-smoke-a');
  const b = mkClient('烟B', 'g-smoke-b');
  const c = mkClient('烟C', 'g-smoke-c');
  await Promise.all([a.ready, b.ready, c.ready]);
  a.send({ type: 'join', name: '烟A', guestId: 'g-smoke-a', avatarId: 'av-1', beans: 1000 });
  await sleep(120);
  const roomId = a.state.roomId;
  if (!roomId) throw new Error('no room');
  b.send({ type: 'join', name: '烟B', guestId: 'g-smoke-b', avatarId: 'av-2', beans: 1000, roomId });
  await sleep(120);
  c.send({ type: 'join', name: '烟C', guestId: 'g-smoke-c', avatarId: 'av-3', beans: 1000, roomId });
  await sleep(300);
  for (let i = 0; i < 60 && (!a.state.snapshot || a.state.snapshot.phase === 'waiting'); i++) await sleep(40);
  if (!a.state.snapshot || a.state.snapshot.phase === 'waiting') {
    a.send({ type: 'start', fillBots: false });
    await sleep(150);
  }
  console.log(JSON.stringify({
    roomId,
    phase: a.state.snapshot && a.state.snapshot.phase,
    humans: a.state.snapshot && a.state.snapshot.players.filter((p) => !p.isBot).length,
    bots: a.state.snapshot && a.state.snapshot.players.filter((p) => p.isBot).length,
  }));
  const result = await drive([a, b, c]);
  console.log(JSON.stringify({ ok: true, roomId, winnerSeat: result.winnerSeat, scores: result.scores }));
  a.socket.close(); b.socket.close(); c.socket.close();
})().catch((e) => { console.error(e); process.exit(1); });
