#!/usr/bin/env bash
# 89 人人对战三会话烟测（LRM-319）
# 用法：从仓库根目录执行 ./apps/server/scripts/smoke-89.sh
# 环境变量：SERVER_URL（默认 http://82.157.184.89:8088）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SERVER_URL="${SERVER_URL:-http://82.157.184.89:8088}"
HEALTH_URL="${SERVER_URL%/}/health"

echo "== health =="
HEALTH_JSON="$(curl -sS -m 8 "$HEALTH_URL")"
echo "$HEALTH_JSON"
COMMIT="$(echo "$HEALTH_JSON" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')"
BUNDLE="$(echo "$HEALTH_JSON" | sed -n 's/.*"bundle":"\([^"]*\)".*/\1/p')"
echo "tip: ${COMMIT:-unknown}  bundle: ${BUNDLE:-unknown}"

echo ""
echo "== match smoke (3 humans, quick match) =="
SERVER_URL="$SERVER_URL" node "$ROOT/apps/server/scripts/match-smoke.cjs"

echo ""
echo "== private room smoke (3 humans, full game) =="
SERVER_URL="$SERVER_URL" node "$ROOT/apps/server/scripts/pvp-smoke.cjs"

echo ""
echo "== 89 日志 grep（登录 89 后执行）=="
echo "docker logs ddz --since 15m 2>&1 | grep '\\[ops\\]' | grep 'match.form'"
echo "docker logs ddz --since 15m 2>&1 | grep '\\[ops\\]' | grep 'room.join'"
echo "docker logs ddz --since 15m 2>&1 | grep '\\[ops\\]' | grep -E 'game\\.(start|settle)'"
echo ""
echo "ok: smoke scripts finished against $SERVER_URL"
