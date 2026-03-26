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

hc_post() {
  local url="$1"
  local body="$2"
  curl -fsS --max-time 10 --retry 3 --data-raw "$body" "$url" >/dev/null || true
}

fail() {
  local msg="$1"
  echo "$msg" >&2
  hc_post "${HC_PING_URL%/}/fail" "$msg"
  exit 1
}

errors=()

# Homepage should be reachable and include expected text.
home_body="$(curl -fsS --max-time 15 "$SITE_URL/" 2>/dev/null || true)"
if [[ -z "$home_body" ]]; then
  errors+=("homepage: curl failed ($SITE_URL/)")
elif ! echo "$home_body" | grep -qi "Activist Checklist"; then
  errors+=("homepage: missing expected text \"Activist Checklist\"")
fi

# A stable guide page should resolve.
if ! curl -fsS --max-time 15 "$SITE_URL$GUIDE_PATH" >/dev/null; then
  errors+=("guide: curl failed ($SITE_URL$GUIDE_PATH)")
fi

# News index should resolve.
if ! curl -fsS --max-time 15 "$SITE_URL/news/" >/dev/null; then
  errors+=("news: curl failed ($SITE_URL/news/)")
fi

# API liveness endpoint should resolve.
if ! curl -fsS --max-time 15 "$SITE_URL/api-server/hello" >/dev/null; then
  errors+=("api: curl failed ($SITE_URL/api-server/hello)")
fi

if (( ${#errors[@]} > 0 )); then
  body=$(
    printf "healthcheck-site failed (%s)\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf "site_url=%s guide_path=%s\n" "$SITE_URL" "$GUIDE_PATH"
    printf "%s\n" "${errors[@]}"
  )
  fail "$body"
fi

# All checks passed: ping Healthchecks (POST so we can attach minimal context).
hc_post "${HC_PING_URL%/}" "healthcheck-site ok $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
