#!/usr/bin/env bash
#
# Pulled from the repo at scripts/build-deploy.sh.
# public/webhooks/deploy.php runs this and sets REPO_DIR from webhook-secrets.local.php (repo_root).
#
# Uses flock so overlapping webhook deliveries do not run two builds at once.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Webhook passes REPO_DIR; for a manual run from a checkout: export REPO_DIR="$(pwd)" first.
if [[ -z "${REPO_DIR:-}" ]]; then
  REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
LOCK_FILE="${LOCK_FILE:-$REPO_DIR/.build-deploy.lock}"
# Set on the server (export, systemd Environment=, etc.) to your site docroot
DEPLOY_TARGET="${DEPLOY_TARGET:-$HOME/public_html}"

log() {
  printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*" >&2
}

ensure_yarn() {
  if command -v yarn >/dev/null 2>&1; then
    return 0
  fi

  # Try common user-installed locations (shared hosts often don't expose these to non-login shells).
  export PATH="$HOME/bin:$HOME/.local/bin:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"

  if command -v yarn >/dev/null 2>&1; then
    return 0
  fi

  # Try nvm if present.
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "$HOME/.nvm/nvm.sh"
    if command -v node >/dev/null 2>&1; then
      # Use .nvmrc if present; otherwise keep current.
      if [[ -f "$REPO_DIR/.nvmrc" ]]; then
        nvm use >/dev/null 2>&1 || true
      fi
    fi
  fi

  # If corepack exists, try it (Node 16+).
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi

  if command -v yarn >/dev/null 2>&1; then
    return 0
  fi

  log "ERROR: yarn not found. whoami=$(whoami) HOME=$HOME PATH=$PATH"
  return 127
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "ERROR: Another deploy holds the lock; exiting without deploying."
  # Non-zero so the webhook returns failure to GitHub (do not report success when no deploy ran).
  exit 1
fi

if [[ ! -d "$REPO_DIR/content" ]] || [[ ! -d "$REPO_DIR/.git" ]]; then
  log "REPO_DIR does not look like this project root: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

log "Deploy user=$(whoami) HOME=$HOME"
log "Node=$(command -v node || echo missing) Yarn=$(command -v yarn || echo missing)"

ensure_yarn

GIT_BRANCH="${GIT_BRANCH:-main}"
git fetch origin --prune
git checkout "$GIT_BRANCH"
git pull --ff-only "origin" "$GIT_BRANCH"

# Install must include devDependencies because `yarn buildstatic` runs Next build,
# which needs build-time tools like postcss/autoprefixer and other dev deps.
# Yarn v1 will skip devDependencies when NODE_ENV=production, so force them on.
YARN_PRODUCTION=false yarn install --frozen-lockfile --production=false
export NODE_ENV=production

# Non-interactive: no URL approval prompt; does not write .approved-urls.json
CHECKBUILD_URL_APPROVAL=allow BUILD_MODE=static yarn buildstatic

if [[ ! -d "$REPO_DIR/out" ]]; then
  log "Build did not produce out/: $REPO_DIR/out"
  exit 1
fi

RSYNC_EXCLUDE=()
if [[ -f "$REPO_DIR/.rsync-exclude" ]]; then
  RSYNC_EXCLUDE=(--exclude-from="$REPO_DIR/.rsync-exclude")
fi
rsync -a --delete "${RSYNC_EXCLUDE[@]}" "$REPO_DIR/out/" "$DEPLOY_TARGET/"

# Post-deploy smoke checks (informational only; deploy already published).
SITE_URL="${SITE_URL:-https://activistchecklist.org}"
SMOKE_GUIDE_PATH="${SMOKE_GUIDE_PATH:-/essentials/}"
SMOKE_FAILED=0

if ! curl -fsS --max-time 15 "$SITE_URL/" | grep -qi "Activist Checklist"; then
  log "WARN: smoke check failed for $SITE_URL/"
  SMOKE_FAILED=1
fi
if ! curl -fsS --max-time 15 "$SITE_URL/news/" >/dev/null; then
  log "WARN: smoke check failed for $SITE_URL/news/"
  SMOKE_FAILED=1
fi
if ! curl -fsS --max-time 15 "$SITE_URL$SMOKE_GUIDE_PATH" >/dev/null; then
  log "WARN: smoke check failed for $SITE_URL$SMOKE_GUIDE_PATH"
  SMOKE_FAILED=1
fi
if ! curl -fsS --max-time 15 "$SITE_URL/api-server/hello" >/dev/null; then
  log "WARN: smoke check failed for $SITE_URL/api-server/hello"
  SMOKE_FAILED=1
fi

if [[ "$SMOKE_FAILED" -eq 1 ]]; then
  log "WARN: one or more post-deploy smoke checks failed"
else
  log "Post-deploy smoke checks passed"
fi

log "Deploy finished → $DEPLOY_TARGET"
