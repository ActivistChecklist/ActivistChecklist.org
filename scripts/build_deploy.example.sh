#!/usr/bin/env bash
#
# Server-only deploy script — copy to ~/include/build_deploy.sh (do not commit).
#   chmod 750 ~/include/build_deploy.sh
#
# Uses flock so overlapping webhook deliveries do not run two builds at once.
#
set -euo pipefail

LOCK_FILE="${LOCK_FILE:-${HOME}/include/.build_deploy.lock}"
REPO_DIR="${REPO_DIR:-${HOME}/include/ActivistChecklist.org}"
# Static site output destination (adjust for your host)
DEPLOY_TARGET="${DEPLOY_TARGET:-${HOME}/public_html}"

log() {
  printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*" >&2
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Another deploy holds the lock; exiting."
  exit 0
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  log "REPO_DIR is not a git checkout: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

# Match the branch your webhook allows (usually main)
GIT_BRANCH="${GIT_BRANCH:-main}"
git fetch origin --prune
git checkout "$GIT_BRANCH"
git pull --ff-only "origin" "$GIT_BRANCH"

export NODE_ENV=production
# Install native deps (sharp, etc.) for this OS; omit --frozen-lockfile if you
# intentionally change lockfile on server (not recommended).
yarn install --frozen-lockfile

# Non-interactive deploy: do not prompt for URL approvals and do not write
# to .approved-urls.json. New URLs will be printed but won't fail the build.
CHECKBUILD_URL_APPROVAL=allow BUILD_MODE=static yarn buildstatic

if [[ ! -d "$REPO_DIR/out" ]]; then
  log "Build did not produce out/: $REPO_DIR/out"
  exit 1
fi

rsync -a --delete "$REPO_DIR/out/" "$DEPLOY_TARGET/"

# If you run a Node API from the same repo (see scripts/deploy-remote.sh):
# ( cd "$REPO_DIR" && yarn api:restart )

log "Deploy finished → $DEPLOY_TARGET"
