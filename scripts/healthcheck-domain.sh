#!/usr/bin/env bash
#
# Domain registration expiry monitor with Healthchecks.io ping.
#
# Cron example (weekly, Mondays at 09:00):
#   0 9 * * 1 /absolute/path/to/repo/scripts/healthcheck-domain.sh >/dev/null 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/load-env.sh"

DOMAIN_NAME="${DOMAIN_NAME:-activistchecklist.org}"
DOMAIN_WARN_DAYS="${DOMAIN_WARN_DAYS:-45}"
DOMAIN_HEALTHCHECK_PING_URL="${DOMAIN_HEALTHCHECK_PING_URL:-}"

if [[ -z "$DOMAIN_HEALTHCHECK_PING_URL" ]]; then
  echo "DOMAIN_HEALTHCHECK_PING_URL is required" >&2
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
  hc_post "${DOMAIN_HEALTHCHECK_PING_URL%/}/fail" "$msg"
  exit 1
}

if ! command -v whois >/dev/null 2>&1; then
  fail "domain-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$DOMAIN_NAME reason=whois_not_installed"
fi

whois_out="$(whois "$DOMAIN_NAME" 2>/dev/null || true)"
if [[ -z "$whois_out" ]]; then
  fail "domain-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$DOMAIN_NAME reason=empty_whois"
fi

# Try common expiry fields across registries/TLDs.
expiry_raw="$(
  echo "$whois_out" | awk -F: '
    BEGIN {IGNORECASE=1}
    $1 ~ /(Registry Expiry Date|Registrar Registration Expiration Date|Expiration Date|Expiry Date|paid-till|renewal date|expire|expires)/ {
      # print first match value and exit
      sub(/^[^:]*:[[:space:]]*/, "", $0)
      print $0
      exit
    }
  '
)"

expiry_raw="$(echo "$expiry_raw" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
if [[ -z "$expiry_raw" ]]; then
  fail "domain-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$DOMAIN_NAME reason=expiry_not_found"
fi

# Normalize: take first token that looks like a date for ISO-ish formats.
# Examples: 2027-01-21T23:59:59Z, 2027-01-21, 2027.01.21, 20270121
expiry_token="$(echo "$expiry_raw" | awk '{print $1}' | sed 's/T.*$//')"
expiry_token="${expiry_token//./-}"

expiry_epoch=""
if [[ "$expiry_token" =~ ^[0-9]{8}$ ]]; then
  # YYYYMMDD
  y="${expiry_token:0:4}"; m="${expiry_token:4:2}"; d="${expiry_token:6:2}"
  expiry_token="${y}-${m}-${d}"
fi

expiry_epoch="$(date -j -f "%Y-%m-%d" "$expiry_token" +%s 2>/dev/null || date -d "$expiry_token" +%s 2>/dev/null || echo "")"
if [[ -z "$expiry_epoch" ]]; then
  fail "domain-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$DOMAIN_NAME reason=could_not_parse_expiry expiry_raw=$(echo "$expiry_raw" | tr '\n' ' ' | head -c 120)"
fi

now_epoch="$(date +%s)"
days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

if [[ "$days_left" -lt 0 ]]; then
  fail "domain-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$DOMAIN_NAME expired_days_ago=$(( -days_left )) expiry=$expiry_token"
fi

if [[ "$days_left" -lt "$DOMAIN_WARN_DAYS" ]]; then
  fail "domain-check failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ")) domain=$DOMAIN_NAME days_left=$days_left warn_days=$DOMAIN_WARN_DAYS expiry=$expiry_token"
fi

hc_post "${DOMAIN_HEALTHCHECK_PING_URL%/}" "domain-check ok $(date -u +"%Y-%m-%dT%H:%M:%SZ") domain=$DOMAIN_NAME days_left=$days_left expiry=$expiry_token"

