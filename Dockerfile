# syntax=docker/dockerfile:1.7
#
# 斗地主试玩部署镜像（单进程自托管）。
# 说明：用 node:22（corepack 拉起的 pnpm 11 有 ignored-builds 门禁），
# 安装统一加 --ignore-scripts 绕开门禁；esbuild 用按平台的 optional 依赖，不需要 postinstall。

# ---- 构建阶段：装依赖 + 构建 client（同源 Socket.IO）----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/game-rules/package.json packages/game-rules/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN pnpm install --ignore-scripts
COPY . .
# 生产构建：VITE_SERVER_URL 显式置空 → socket.io-client 同源（浏览器 origin → 反代 → 本服务）
# 必须显式设置，否则客户端会回落到写死的 http://localhost:3000，跨机部署时连不上
ENV VITE_SERVER_URL=""
RUN pnpm --filter @card-game/client build
# server 无独立编译步骤（tsx 直跑源码，规则包是 workspace 源码包）

# ---- 运行阶段：瘦镜像，单进程托管 server + client dist ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/game-rules/package.json packages/game-rules/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN pnpm install --prod --ignore-scripts
COPY packages/game-rules packages/game-rules
COPY apps/server apps/server
COPY --from=build /app/apps/client/dist apps/client/dist
ENV PORT=3000
ENV CLIENT_DIST=/app/apps/client/dist
EXPOSE 3000
CMD ["pnpm", "--filter", "@card-game/server", "exec", "tsx", "src/index.ts"]
