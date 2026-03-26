#!/usr/bin/env bash
#
# Pulled from the repo at scripts/build_deploy.sh.
# public/webhooks/deploy.php runs this and sets REPO_DIR from deploy-webhook.config.local.php (repo_root).
#
# Uses flock so overlapping webhook deliveries do not run two builds at once.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Webhook passes REPO_DIR; for a manual run from a checkout: export REPO_DIR="$(pwd)" first.
if [[ -z "${REPO_DIR:-}" ]]; then
  REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
LOCK_FILE="${LOCK_FILE:-$REPO_DIR/.build_deploy.lock}"
# Set on the server (export, systemd Environment=, etc.) to your site docroot
DEPLOY_TARGET="${DEPLOY_TARGET:-$HOME/public_html}"

log() {
  printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*" >&2
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Another deploy holds the lock; exiting."
  exit 0
fi

if [[ ! -d "$REPO_DIR/content" ]] || [[ ! -d "$REPO_DIR/.git" ]]; then
  log "REPO_DIR does not look like this project root: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

GIT_BRANCH="${GIT_BRANCH:-main}"
git fetch origin --prune
git checkout "$GIT_BRANCH"
git pull --ff-only "origin" "$GIT_BRANCH"

export NODE_ENV=production
yarn install --frozen-lockfile

# Non-interactive: no URL approval prompt; does not write .approved-urls.json
CHECKBUILD_URL_APPROVAL=allow BUILD_MODE=static yarn buildstatic

if [[ ! -d "$REPO_DIR/out" ]]; then
  log "Build did not produce out/: $REPO_DIR/out"
  exit 1
fi

rsync -a --delete "$REPO_DIR/out/" "$DEPLOY_TARGET/"

log "Deploy finished → $DEPLOY_TARGET"
