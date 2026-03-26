#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=../.env
source "$ROOT/.env"

: "${FTP_HOST:?Set FTP_HOST in .env}"
: "${FTP_USER:?Set FTP_USER in .env}"
: "${FTP_DIR:?Set FTP_DIR in .env (remote web root, e.g. web or /public_html)}"
: "${ENV_PRODUCTION_PATH:?Set ENV_PRODUCTION_PATH in .env (remote .env.production file path)}"
: "${LOCAL_ENV_PRODUCTION_FILE:=./.env.production.local}"
if [[ "$LOCAL_ENV_PRODUCTION_FILE" != /* ]]; then
  LOCAL_ENV_PRODUCTION_FILE="$ROOT/${LOCAL_ENV_PRODUCTION_FILE#./}"
fi
if [[ ! -f "$LOCAL_ENV_PRODUCTION_FILE" ]]; then
  echo "Missing local production env file: $LOCAL_ENV_PRODUCTION_FILE" >&2
  exit 1
fi

echo "===> Uploading remote .env.production from $LOCAL_ENV_PRODUCTION_FILE..."
rsync -avz "$LOCAL_ENV_PRODUCTION_FILE" "$FTP_USER@$FTP_HOST:$ENV_PRODUCTION_PATH"

echo "===> Syncing public/webhooks/ to $FTP_HOST:$FTP_DIR/webhooks/ ..."
rsync -avz --delete \
  --exclude 'deploy-webhook.error.log' \
  --exclude '*.log' \
  "$ROOT/public/webhooks/" \
  "$FTP_USER@$FTP_HOST:$FTP_DIR/webhooks/"

echo "===> deploy:secrets complete."

