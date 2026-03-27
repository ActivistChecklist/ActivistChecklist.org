#!/usr/bin/env bash
#
# SSL expiry monitor with Healthchecks.io ping.
#
# Cron example (daily is fine; the script is cheap):
#   0 9 * * * /absolute/path/to/repo/scripts/healthcheck-ssl.sh >/dev/null 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/load-env.sh"

SSL_DOMAIN="${SSL_DOMAIN:-activistchecklist.org}"
SSL_WARN_DAYS="${SSL_WARN_DAYS:-21}"
SSL_HEALTHCHECK_PING_URL="${SSL_HEALTHCHECK_PING_URL:-}"

if [[ -z "$SSL_HEALTHCHECK_PING_URL" ]]; then
  echo "SSL_HEALTHCHECK_PING_URL is required" >&2
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
  hc_post "${SSL_HEALTHCHECK_PING_URL%/}/fail" "$msg"
  exit 1
}

expiry_date="$(
  echo | openssl s_client -servername "$SSL_DOMAIN" -connect "$SSL_DOMAIN:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null \
    | cut -d= -f2
)"

if [[ -z "$expiry_date" ]]; then
  fail "ssl-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$SSL_DOMAIN reason=could_not_read_cert"
fi

expiry_epoch="$(date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null || date -d "$expiry_date" +%s 2>/dev/null || echo "")"
if [[ -z "$expiry_epoch" ]]; then
  fail "ssl-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$SSL_DOMAIN reason=could_not_parse_expiry expiry_date=$expiry_date"
fi

now_epoch="$(date +%s)"
days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

if [[ "$days_left" -lt 0 ]]; then
  fail "ssl-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$SSL_DOMAIN expired_days_ago=$(( -days_left )) expiry_date=$expiry_date"
fi

if [[ "$days_left" -lt "$SSL_WARN_DAYS" ]]; then
  fail "ssl-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$SSL_DOMAIN days_left=$days_left warn_days=$SSL_WARN_DAYS expiry_date=$expiry_date"
fi

hc_post "${SSL_HEALTHCHECK_PING_URL%/}" "ssl-check ok $(date -u +"%Y-%m-%dT%H:%M:%SZ") domain=$SSL_DOMAIN days_left=$days_left"
