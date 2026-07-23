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
| `player.disconnect` | 真人断线（座位保留，等重连） |
| `player.reconnect` | 断线重连接管座位 |
| `match.form` | 快速匹配成桌（`fillBots` / `humanCount` / `waitMs`） |
| `bot.decision` | 机器人决策（`kind`: bid_claim/bid_pass/lead/beat/bomb/pass；含 `reason`/`strength`） |

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

# 断线重连路径（LRM-519）
docker logs ddz --since 30m 2>&1 | grep '\[ops\]' | grep -E 'player\.(disconnect|reconnect)|room\.join'

# 机器人决策类型（LRM-523：bid_claim / lead / beat / pass）
docker logs ddz --since 30m 2>&1 | grep '\[ops\]' | grep 'bot.decision'
```

烟测一局三真人后，应能 grep 出同一 `roomId` 的  
`room.create` → `room.join`×3 → `game.start` → … → `game.settle`（可夹杂 `player.disconnect` / `player.reconnect`）。

断线重连烟测：

```bash
SERVER_URL=http://127.0.0.1:3000 node apps/server/scripts/reconnect-smoke.cjs
```

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

## DouZero 推理脚手架探活（LRM-310）

现网约定：`DOUZERO_INFER_URL=http://172.17.0.1:8765`（容器经 docker bridge 访问宿主机推理口）。**训模冻结期可不启 8765**；游戏服启动仍会探活，失败只打日志，出牌 fallback 规则机器人普通档（LRM-260），不得卡局。

```bash
# 宿主机 / 可达 docker0
curl -sS -m 3 http://127.0.0.1:8765/health | jq .
curl -sS -m 2 http://172.17.0.1:8765/health | jq .
# 期望示例
# {"status":"ok","models":["landlord","landlord_up","landlord_down"],"modelId":"default","ckptDir":null}

# 从 ddz 容器视角
docker exec ddz printenv DOUZERO_INFER_URL
docker exec ddz sh -c 'curl -sS -m 2 "$DOUZERO_INFER_URL/health"' || true

# 游戏服启动探活日志
docker logs ddz --since 10m 2>&1 | grep -E 'douzero\.probe\.(ok|fail|skip)'
```

ckpt 切换（无需改代码，重启推理进程即可）：

| 环境变量 | 含义 |
| --- | --- |
| `DOUZERO_MODEL_ID` / `DOUZERO_CKPT` | 逻辑模型 id（写进 `/health`） |
| `DOUZERO_CKPT_DIR` | ckpt 根目录（stub，训模 Agent 约定） |
| `DOUZERO_LANDLORD_CKPT` / `_UP_` / `_DOWN_` | 三角色真实路径 |
| `DOUZERO_INFER_TIMEOUT_MS` | 游戏服 HTTP 超时（默认 1500） |

接口说明：`docs/douzero-adapter.md`、`docs/douzero-adapter-contract.md`。

## 常见故障

| 现象 | 排查 |
| --- | --- |
| `:8088` 502 | `docker ps` 看 `ddz` 是否 Up；`curl 127.0.0.1:3000/health`；确认 `8088:3000` 端口映射未丢；`sudo nginx -t && systemctl reload nginx` |
| health 无 `commit`/`bundle` | 确认已滚含 LRM-275 的 tip；容器环境变量 `GIT_COMMIT`；`CLIENT_DIST` 指向含 `assets/index-*.js` 的 dist |
| Socket 连不上 | 浏览器 Network 看 `/socket.io`；nginx 须透传 `Upgrade`/`Connection`（`deploy/nginx-8088.conf`） |
| 对局卡住 / 疑似断线 | `docker logs ddz --since 30m \| grep '\[ops\]'`，按 `roomId` 查是否有 `player.reconnect` / 是否缺 `game.settle` |
| 重连回归烟测 | `SERVER_URL=http://127.0.0.1:3000 node apps/server/scripts/reconnect-smoke.cjs`（覆盖重连手牌一致、`room_not_found`、`game_already_started`） |
| 版本对不上 | 对比频道回帖 tip 与 `curl …/health` 的 `commit`、`bundle`；不一致则重滚 |
| DouZero 探活失败 | 训模冻结期正常；确认不卡局即可。解冻后查 8765 进程与 `DOUZERO_*_CKPT` |

## 边界

- 不做外部 APM / Prometheus；本手册 + `docker logs` 即最小闭环。
- 不改游戏规则；日志仅服务端 stdout。
- DouZero：**不接新 ckpt / 不上线人机对战**，直至训模 Agent + PO 点名；本手册只保留探活与 fallback 脚手架。
