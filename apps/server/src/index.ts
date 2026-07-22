/**
 * apps/server 入口：HTTP（健康检查 + 可选静态托管）+ Socket.IO，默认 :3000。
 *
 * - 开发：`pnpm --filter @card-game/server dev`（tsx watch），CLIENT_DIST 未设置时只暴露 /health + Socket.IO。
 * - 生产：`CLIENT_DIST=<client dist 绝对路径> pnpm --filter @card-game/server start`，额外托管 client 静态资源并做 SPA 回退，
 *   便于单进程部署（nginx 仅做 80→3000 反代，带 websocket 升级头）。
 *
 * Socket.IO 仍挂在同一 httpServer 上处理 `/socket.io/*`，本回调对其直接放行，不参与应答。
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { Server as IoServer } from 'socket.io';
import { logInferProbeOnBoot } from './game/douzeroConfig';
import { buildHealthPayload } from './observability';
import { createGame } from './transport';

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = process.env.CLIENT_DIST ? resolve(process.env.CLIENT_DIST) : '';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(absPath: string): { status: number; body: Buffer; contentType: string } | null {
  // 防目录穿越：规范化后必须仍在 CLIENT_DIST 内
  const safe = normalize(absPath);
  if (!safe.startsWith(CLIENT_DIST)) return null;
  if (!existsSync(safe) || !statSync(safe).isFile()) return null;
  return {
    status: 200,
    body: readFileSync(safe),
    contentType: MIME[extname(safe).toLowerCase()] ?? 'application/octet-stream',
  };
}

const httpServer = createServer((req, res) => {
  const url = req.url ?? '/';

  if (url === '/health' || url.startsWith('/health?')) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(buildHealthPayload(CLIENT_DIST)));
    return;
  }

  // /socket.io/* 交给 Socket.IO 引擎处理，这里不参与应答。
  if (url.startsWith('/socket.io')) return;

  if (CLIENT_DIST) {
    // 先按字面路径找静态文件；找不到再回退 index.html（SPA）
    const file = serveStatic(join(CLIENT_DIST, url));
    const hit = file ?? serveStatic(join(CLIENT_DIST, 'index.html'));
    if (hit) {
      res.writeHead(hit.status, { 'content-type': hit.contentType });
      res.end(hit.body);
      return;
    }
  }

  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('card-game server (Socket.IO)。生产环境请设置 CLIENT_DIST 托管前端；用 /health 探活。');
});

const io = new IoServer(httpServer, { cors: { origin: '*' } });
createGame(io);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[card-game server] listening on :${PORT} (Socket.IO)${CLIENT_DIST ? ' + static' : ''}`);
  // LRM-310：启动探活 8765；失败只打日志，不阻断开服（fallback 规则机器人）
  void logInferProbeOnBoot();
});
