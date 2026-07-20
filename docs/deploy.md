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

## 目标拓扑（LRM-157 · Frank 2026-07-20）

对外**只暴露网关**（nginx/Caddy 等），应用进程绑定 **本机回环** `127.0.0.1:3000`，禁止长期把 Node `:3000` 或 `docker -p <public>:3000` 当正式入口。

```
浏览器 → :80 / :443 / :8088(nginx) → proxy_pass 127.0.0.1:3000
                              ↑
                    /health + / + /socket.io
```

- **正式试玩**：`deploy/nginx.conf` 接好 80（或独立 `listen 8088` 的 server 块）反代到 `127.0.0.1:3000`；容器仅 `-p 127.0.0.1:3000:3000`，**不要**再 `-p 8088:3000` 直出应用。
- **过渡期**：89 当前仍可用 `http://82.157.184.89:8088/`（`8088:3000` 直映），与上目标不一致；切 nginx 8088→3000 后改认 **nginx 8088**，并在 issue 更新验收入口。
- **CI/CD 探活**：见 `docs/ci-cd.md`（PR 须同时过 server `/health` 与 client 静态入口检查）。

## 89 试玩环境（82.157.184.89）

- **当前对外入口（过渡）**：`http://82.157.184.89:8088/`（**不要**用根路径 `:80`，该端口可能仍 502 且非本服务）。
- 容器内应用**只监听 3000**；过渡映射为 **`宿主机端口:3000`**（还债后改为仅 `127.0.0.1:3000:3000` + nginx 对外端口）：
  ```bash
  docker run -d --name ddz --restart unless-stopped \
    -p 127.0.0.1:3000:3000 \
    -p 8088:3000
  ```
- 错误示例 `-p 8088:8088` → 对外 502（2026-07-20 线上事故）。
- 部署后：`curl http://127.0.0.1:8088/health` 与 `curl http://82.157.184.89:8088/health` 均应 200；issue 举证写 **commit SHA + live bundle 名**。

## 验证
- `curl http://127.0.0.1:3000/health` → `{"ok":true,...}`
- `curl http://127.0.0.1:3000/` → 返回前端 index.html
- 浏览器 `http://<host>/` → 大厅可见，无 console error；建/加入房间 → 发牌 → 叫地主 → 出牌 → 结算。

## 备注
- 规则包 `@card-game/rules` 是 workspace TS 源码包，server 在生产也用 `tsx` 运行期转译（不预编译），故镜像/裸机都需保留 tsx。
- Socket.IO 默认 path `/socket.io`，nginx 全量反代无需特殊 path 配置，只需 websocket 头。
