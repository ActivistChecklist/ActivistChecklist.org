#!/usr/bin/env bash
#
# Cron-driven health check for static site + API.
# If all checks pass, ping Healthchecks.io.
#
# Setup example:
#   export HEALTHCHECK_PING_URL="https://hc-ping.com/your-uuid"
#   */5 * * * * /absolute/path/to/repo/scripts/healthcheck-site.sh >/dev/null 2>&1
#
# Optional env vars:
#   SITE_URL=https://activistchecklist.org
#   GUIDE_PATH=/essentials/
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Optional env loading from repo env files.
# shellcheck disable=SC1091
source "$SCRIPT_DIR/load-env.sh"

SITE_URL="${SITE_URL:-https://activistchecklist.org}"
GUIDE_PATH="${GUIDE_PATH:-/essentials/}"
HC_PING_URL="${HEALTHCHECK_PING_URL:-}"

if [[ -z "$HC_PING_URL" ]]; then
  echo "HEALTHCHECK_PING_URL is required"
  exit 1
fi

# Homepage should be reachable and include expected text.
if ! curl -fsS --max-time 15 "$SITE_URL/" | grep -qi "Activist Checklist"; then
  exit 1
fi

# A stable guide page should resolve.
curl -fsS --max-time 15 "$SITE_URL$GUIDE_PATH" >/dev/null

# News index should resolve.
curl -fsS --max-time 15 "$SITE_URL/news/" >/dev/null

# API liveness endpoint should resolve.
curl -fsS --max-time 15 "$SITE_URL/api-server/hello" >/dev/null

# All checks passed: ping Healthchecks.
curl -fsS --max-time 15 --retry 3 "$HC_PING_URL" >/dev/null
