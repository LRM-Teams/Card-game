#!/usr/bin/env bash
# DouZero 推理探活（LRM-310）。默认探 89 现网 Docker 宿主机网关 8765。
# 用法：
#   ./apps/server/scripts/douzero-health-check.sh
#   DOUZERO_INFER_URL=http://127.0.0.1:8765 ./apps/server/scripts/douzero-health-check.sh
set -euo pipefail

URL="${DOUZERO_INFER_URL:-http://172.17.0.1:8765}"
URL="${URL%/}"
TIMEOUT="${DOUZERO_HEALTH_TIMEOUT_MS:-800}"
TIMEOUT_S=$(awk "BEGIN { printf \"%.3f\", ${TIMEOUT}/1000 }")

echo "==> GET ${URL}/health (timeout ${TIMEOUT_S}s)"
if curl -sf --max-time "${TIMEOUT_S}" "${URL}/health"; then
  echo
  echo "OK: DouZero infer reachable"
  exit 0
fi

echo
echo "WARN: DouZero infer unreachable or unhealthy at ${URL}"
echo "      Game server will fallback to rules bot (normal, LRM-260); play continues."
exit 1
