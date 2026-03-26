#!/usr/bin/env bash
set -e

# Load deploy/upload vars from .env (FTP_*, ENV_PRODUCTION_PATH, REMOTE_*)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=../.env
source "$ROOT/.env"

: "${REMOTE_SSH_HOST:?Set REMOTE_SSH_HOST in .env (e.g. user@host or SSH alias)}"

REMOTE_SKIP_GIT="${REMOTE_SKIP_GIT:-0}"
REMOTE_SKIP_API="${REMOTE_SKIP_API:-0}"

if [[ "$REMOTE_SKIP_GIT" != "1" ]] || [[ "$REMOTE_SKIP_API" != "1" ]]; then
  : "${REMOTE_REPO_PATH:?Set REMOTE_REPO_PATH in .env to absolute path of git checkout on the server (or set REMOTE_SKIP_GIT=1 and REMOTE_SKIP_API=1)}"
fi

echo "===> Uploading built site (out/) to $FTP_HOST..."
RSYNC_EXCLUDE=()
if [[ -f "$ROOT/.rsync-exclude" ]]; then
  RSYNC_EXCLUDE=(--exclude-from="$ROOT/.rsync-exclude")
fi
rsync -avz --delete "${RSYNC_EXCLUDE[@]}" "$ROOT/out/" "$FTP_USER@$FTP_HOST:$FTP_DIR"

echo "===> Uploading .env.production..."
rsync -avz "$ROOT/.env.production" "$FTP_USER@$FTP_HOST:$ENV_PRODUCTION_PATH"

if [[ "$REMOTE_SKIP_GIT" == "1" ]]; then
  echo "===> Skipping git pull (REMOTE_SKIP_GIT=1)."
else
  echo "===> Connecting to remote and running: git pull..."
  # Default remote shell (not bash -l): avoids  login shell landing in $HOME and breaking cd into include/.
  ssh "$REMOTE_SSH_HOST" "cd $(printf %q "$REMOTE_REPO_PATH") && git pull"
fi

if [[ "$REMOTE_SKIP_API" == "1" ]]; then
  echo "===> Skipping API restart (REMOTE_SKIP_API=1)."
else
  echo "===> Restarting API (yarn api:restart)..."
  # Login shell so nvm/yarn from ~/.bashrc are on PATH.
  ssh "$REMOTE_SSH_HOST" "bash -lc \"cd $(printf %q "$REMOTE_REPO_PATH") && yarn api:restart\""
fi

echo "===> Deploy complete."
