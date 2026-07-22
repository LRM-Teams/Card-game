#!/usr/bin/env bash
# 82.157.184.89 试玩部署：容器仅 127.0.0.1:3000，对外 8088 走 nginx 反代。
# 用法：在仓库根目录 sudo ./deploy/deploy-89.sh [git-ref]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-main}"
IMAGE_TAG="${DDZ_IMAGE_TAG:-ddz:latest}"
CONTAINER_NAME="${DDZ_CONTAINER_NAME:-ddz}"

cd "$REPO_ROOT"
git fetch origin "$REF"
git checkout "$REF"
git pull --ff-only origin "$REF" 2>/dev/null || true

echo "==> Build image ${IMAGE_TAG}"
COMMIT="$(git rev-parse HEAD)"
docker build -t "$IMAGE_TAG" --build-arg "GIT_COMMIT=${COMMIT}" .

echo "==> Recreate container (127.0.0.1:3000 only)"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d --name "$CONTAINER_NAME" --restart unless-stopped \
  -e "GIT_COMMIT=${COMMIT}" \
  -p 127.0.0.1:3000:3000 \
  "$IMAGE_TAG"

echo "==> Install nginx 8088 → 3000"
sudo cp deploy/nginx-8088.conf /etc/nginx/sites-available/ddz-8088.conf
sudo ln -sf /etc/nginx/sites-available/ddz-8088.conf /etc/nginx/sites-enabled/ddz-8088.conf
sudo nginx -t
sudo systemctl reload nginx

echo "==> Health checks"
curl -sf "http://127.0.0.1:3000/health" | grep -q '"ok":true'
curl -sf "http://127.0.0.1:8088/health" | grep -q '"ok":true'
curl -sf -o /dev/null -w "public /health HTTP %{http_code}\n" "http://82.157.184.89:8088/health"
curl -sf -o /dev/null -w "public / HTTP %{http_code}\n" "http://82.157.184.89:8088/"

echo "Done. Entry: http://82.157.184.89:8088/ (commit $(git rev-parse --short HEAD))"
