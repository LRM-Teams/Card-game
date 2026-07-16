# 部署 Runbook（试玩版）

目标：在单台服务器（如 `82.157.184.89`）上把斗地主跑起来，浏览器开 `http://<host>/` 即可玩。

## 架构（单域名 · 单后端进程）
- Node server（`:3000`）：`tsx src/index.ts` 直跑；`CLIENT_DIST` 指向 client 构建产物时，同一进程托管前端静态资源 + SPA 回退 + `/health` + `/socket.io`。
- client 生产构建：`VITE_SERVER_URL=""`（空）→ `socket.io-client` 连**同源**（浏览器 origin → nginx → Node）。
- nginx（`:80`）：纯反代到 `127.0.0.1:3000`，透传 websocket `Upgrade/Connection` 头，覆盖原 502 空反代。见 `deploy/nginx.conf`。

## 方式 A：Docker（推荐，环境干净）
前置：服务器装了 docker。
```bash
git clone https://github.com/LRM-Teams/Card-game.git
cd Card-game
docker build -t ddz:latest .
docker run -d --name ddz --restart unless-stopped -p 127.0.0.1:3000:3000 ddz:latest
```
nginx 按下节接好即可。

## 方式 B：裸机（node + pnpm）
```bash
git clone https://github.com/LRM-Teams/Card-game.git
cd Card-game
corepack enable
pnpm install
# 同源构建前端（VITE_SERVER_URL 必须留空）
VITE_SERVER_URL="" pnpm --filter @card-game/client build
# 起后端，托管前端 dist
PORT=3000 CLIENT_DIST="$PWD/apps/client/dist" nohup pnpm --filter @card-game/server start > /tmp/ddz.log 2>&1 &
```
有 systemd/pm2 就换成托管进程，命令同上。

## 接 nginx（80 → 3000）
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ddz.conf
# 改 server_name 为实际 host；确认 127.0.0.1:3000
sudo ln -sf /etc/nginx/sites-available/ddz.conf /etc/nginx/sites-enabled/ddz.conf
sudo nginx -t && sudo systemctl reload nginx
```
若已有默认 server 块占用 80，删/禁用 default 后再启用本配置。

## 验证
- `curl http://127.0.0.1:3000/health` → `{"ok":true,...}`
- `curl http://127.0.0.1:3000/` → 返回前端 index.html
- 浏览器 `http://<host>/` → 大厅可见，无 console error；建/加入房间 → 发牌 → 叫地主 → 出牌 → 结算。

## 备注
- 规则包 `@card-game/rules` 是 workspace TS 源码包，server 在生产也用 `tsx` 运行期转译（不预编译），故镜像/裸机都需保留 tsx。
- Socket.IO 默认 path `/socket.io`，nginx 全量反代无需特殊 path 配置，只需 websocket 头。
