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

WEBHOOK_SECRETS_LOCAL="$ROOT/public/webhooks/webhook-secrets.local.php"
if [[ ! -f "$WEBHOOK_SECRETS_LOCAL" ]]; then
  echo "Missing $WEBHOOK_SECRETS_LOCAL" >&2
  echo "Copy public/webhooks/webhook-secrets.example.php → webhook-secrets.local.php and fill in secrets." >&2
  exit 1
fi

echo "===> Uploading remote .env.production from $LOCAL_ENV_PRODUCTION_FILE..."
rsync -avz "$LOCAL_ENV_PRODUCTION_FILE" "$FTP_USER@$FTP_HOST:$ENV_PRODUCTION_PATH"

echo "===> Syncing public/webhooks/ to $FTP_HOST:$FTP_DIR/webhooks/ ..."
# Exclude webhook-secrets.local.php from this pass: with --delete, an absent local copy would
# remove the file from the server; we upload it in the next step instead.
rsync -avz --delete \
  --exclude 'deploy-webhook.error.log' \
  --exclude '*.log' \
  --exclude 'webhook-secrets.local.php' \
  "$ROOT/public/webhooks/" \
  "$FTP_USER@$FTP_HOST:$FTP_DIR/webhooks/"

echo "===> Uploading webhook-secrets.local.php..."
rsync -avz "$WEBHOOK_SECRETS_LOCAL" "$FTP_USER@$FTP_HOST:$FTP_DIR/webhooks/"

echo "===> deploy:secrets complete."

