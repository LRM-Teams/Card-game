# 89 现网运维手册（LRM-275）

入口：`http://82.157.184.89:8088/`  
应用：Docker 容器 `ddz`，仅绑定 `127.0.0.1:3000`；对外由 nginx `:8088` 反代。

## 巡检（每次滚版后必做）

```bash
# 健康检查：须含 ok / commit / bundle
curl -sS http://82.157.184.89:8088/health | jq .

# 期望示例
# {"ok":true,"service":"card-game-server","commit":"6a0846f…","bundle":"index-XXXX.js"}

# 前端入口
curl -sS -o /dev/null -w "%{http_code}\n" http://82.157.184.89:8088/

# 本机回环（登录 89 后）
curl -sS http://127.0.0.1:3000/health | jq .
curl -sS http://127.0.0.1:8088/health | jq .
```

举证写 issue 时带：**commit SHA + live bundle 名 + health 200**。

## 结构化对局日志

服务端 stdout 前缀 `[ops]`，每行一条 JSON：

| event | 含义 |
| --- | --- |
| `room.create` | 新建私房 / 匹配房 |
| `room.join` | 真人入座 |
| `game.start` | 开局（发牌进入叫地主） |
| `game.settle` | 结算（含 winnerSeat / scores） |
| `player.reconnect` | 断线重连接管座位 |
| `match.form` | 快速匹配成桌（`fillBots` / `humanCount` / `waitMs`） |

字段至少含：`roomId`、`phase`、`seat`（若有）、`humanCount`。

快速匹配策略（LRM-309）：队列优先凑满 3 真人立即开局（`fillBots:false`）；
不足时等待 `MATCH_FILL_AFTER_MS`（默认 20s，建议 15–30s）再补机器人（`fillBots:true`）。

```bash
# 登录 89
docker logs ddz --since 30m 2>&1 | grep '\[ops\]'

# 按房间复盘
docker logs ddz --since 2h 2>&1 | grep '\[ops\]' | grep 'room-4'

# 只看开局/结算
docker logs ddz --since 2h 2>&1 | grep '\[ops\]' | grep -E 'game\.(start|settle)'

# 快速匹配成桌（超时补机路径：fillBots:true）
docker logs ddz --since 30m 2>&1 | grep '\[ops\]' | grep 'match.form'
docker logs ddz --since 30m 2>&1 | grep '\[ops\]' | grep 'match.form' | grep '"fillBots":true'
```

烟测一局三真人后，应能 grep 出同一 `roomId` 的  
`room.create` → `room.join`×3 → `game.start` → … → `game.settle`（可夹杂 `player.reconnect`）。

## Docker 重启 SOP

```bash
cd /path/to/Card-game   # 或 sudo ./deploy/deploy-89.sh <ref>

# 推荐：一键（需 root）
sudo ./deploy/deploy-89.sh main

# 或手动
git fetch origin && git checkout <tip> && git pull --ff-only
COMMIT=$(git rev-parse HEAD)
docker build -t ddz:latest \
  --build-arg GIT_COMMIT="$COMMIT" .
docker rm -f ddz 2>/dev/null || true
docker run -d --name ddz --restart unless-stopped \
  -e GIT_COMMIT="$COMMIT" \
  -p 127.0.0.1:3000:3000 \
  ddz:latest

curl -sf http://127.0.0.1:3000/health | grep -q '"ok":true'
curl -sf http://127.0.0.1:8088/health | grep -q '"ok":true'
```

镜像构建会写入 `GIT_COMMIT`（见 Dockerfile `ARG/ENV`）；运行时也可用 `-e GIT_COMMIT=` 覆盖。

## 常见故障

| 现象 | 排查 |
| --- | --- |
| `:8088` 502 | `docker ps` 看 `ddz` 是否 Up；`curl 127.0.0.1:3000/health`；`sudo nginx -t && systemctl reload nginx` |
| health 无 `commit`/`bundle` | 确认已滚含 LRM-275 的 tip；容器环境变量 `GIT_COMMIT`；`CLIENT_DIST` 指向含 `assets/index-*.js` 的 dist |
| Socket 连不上 | 浏览器 Network 看 `/socket.io`；nginx 须透传 `Upgrade`/`Connection`（`deploy/nginx-8088.conf`） |
| 对局卡住 / 疑似断线 | `docker logs ddz --since 30m \| grep '\[ops\]'`，按 `roomId` 查是否有 `player.reconnect` / 是否缺 `game.settle` |
| 版本对不上 | 对比频道回帖 tip 与 `curl …/health` 的 `commit`、`bundle`；不一致则重滚 |

## 边界

- 不做外部 APM / Prometheus；本手册 + `docker logs` 即最小闭环。
- 不改游戏规则；日志仅服务端 stdout。
