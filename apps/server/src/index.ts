/**
 * apps/server 入口：HTTP（健康检查）+ Socket.IO，默认 :3000。
 *
 * 运行：pnpm --filter @card-game/server dev
 */
import { createServer } from 'node:http';
import { Server as IoServer } from 'socket.io';
import { createGame } from './transport';

const PORT = Number(process.env.PORT ?? 3000);

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'card-game-server' }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('card-game server (Socket.IO). 用客户端连接 /health 探活。');
});

const io = new IoServer(httpServer, { cors: { origin: '*' } });
createGame(io);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[card-game server] listening on :${PORT} (Socket.IO)`);
});
