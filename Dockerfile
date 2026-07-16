# syntax=docker/dockerfile:1.7

# ---- 构建阶段：装依赖 + 构建 client（同源 Socket.IO）----
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/game-rules/package.json packages/game-rules/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN pnpm install --frozen-lockfile || pnpm install
COPY . .
# 生产构建：VITE_SERVER_URL 留空 → socket.io-client 同源（浏览器 origin → nginx → 本服务）
RUN pnpm --filter @card-game/client build
# server 无独立编译步骤（tsx 直跑源码，规则包是 workspace 源码包）

# ---- 运行阶段：瘦镜像，单进程托管 server + client dist ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/game-rules/package.json packages/game-rules/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod
COPY packages/game-rules packages/game-rules
COPY apps/server apps/server
COPY --from=build /app/apps/client/dist apps/client/dist
ENV PORT=3000
ENV CLIENT_DIST=/app/apps/client/dist
EXPOSE 3000
# tsx 在 devDependencies；为生产运行把它纳入（rules 是 TS 源码包，需运行期转译）
RUN pnpm --filter @card-game/server add tsx@^4
CMD ["pnpm", "--filter", "@card-game/server", "exec", "tsx", "src/index.ts"]
