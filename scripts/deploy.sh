#!/usr/bin/env bash
# 部署到主機（只有整合者使用）。
#   scripts/deploy.sh             同步原始碼 -> 主機 build -> 重啟 -> 健康檢查
#   scripts/deploy.sh --rollback  換回上一版映像檔
#
# 主機設定寫在 repo 根目錄的 .env.deploy（不進 git）：
#   DEPLOY_HOST=user@host            SSH 連線目標（必填）
#   DEPLOY_REMOTE_PATH=/path/to/bin  主機上 docker 不在預設 PATH 時填（選填）
#   DEPLOY_DIR=se-final-project      主機上的專案目錄（選填）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
[ -f "$ROOT/.env.deploy" ] && . "$ROOT/.env.deploy"
HOST="${DEPLOY_HOST:?請在 .env.deploy 設定 DEPLOY_HOST=user@host}"
BASE="${DEPLOY_DIR:-se-final-project}"
URL="${DEPLOY_URL:-https://class.asdxcvw.com}"
REMOTE_PATH="${DEPLOY_REMOTE_PATH:-}"
COMPOSE="docker compose -p class -f deploy/compose.yml"

remote() {
  local prefix=""
  [ -n "$REMOTE_PATH" ] && prefix="export PATH=\"$REMOTE_PATH:\$PATH\"; "
  ssh -o BatchMode=yes "$HOST" "${prefix}cd ~/$BASE/app && $*"
}

health() {
  echo "健康檢查 $URL/api/health"
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 5 "$URL/api/health" >/dev/null 2>&1; then
      echo "部署完成：$URL"
      return 0
    fi
    sleep 2
  done
  echo "健康檢查失敗，最近的 log："
  remote "$COMPOSE logs --tail=60 app tunnel" || true
  echo "要換回上一版：scripts/deploy.sh --rollback"
  return 1
}

if [ "${1:-}" = "--rollback" ]; then
  remote "docker image inspect class-app:prev >/dev/null && docker tag class-app:prev class-app:latest && $COMPOSE up -d --no-build app"
  health
  exit $?
fi

echo "同步原始碼到 $HOST:~/$BASE/app"
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .env --exclude '.env.*' \
  --exclude .data --exclude dist --exclude coverage --exclude test-results --exclude playwright-report \
  --exclude CLAUDE.local.md --exclude .claude/settings.local.json --exclude '~$*' --exclude .DS_Store \
  "$ROOT/" "$HOST:$BASE/app/"

echo "遠端 build 並重啟"
remote "docker image inspect class-app:latest >/dev/null 2>&1 && docker tag class-app:latest class-app:prev; $COMPOSE up -d --build --remove-orphans"
health
