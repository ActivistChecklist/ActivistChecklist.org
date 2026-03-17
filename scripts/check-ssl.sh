#!/bin/bash
# Check SSL certificate expiry for activistchecklist.org
# Runs at most once per week (based on log file timestamp)

DOMAIN="activistchecklist.org"
LOG_FILE="$(dirname "$0")/../.ssl-check.log"
WARN_DAYS=21

# Skip if log file was modified less than 7 days ago
if [ -f "$LOG_FILE" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    last_check=$(stat -f %m "$LOG_FILE")
  else
    last_check=$(stat -c %Y "$LOG_FILE")
  fi
  now=$(date +%s)
  days_since=$(( (now - last_check) / 86400 ))
  if [ "$days_since" -lt 7 ]; then
    exit 0
  fi
fi

# Check the certificate
expiry_date=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

if [ -z "$expiry_date" ]; then
  echo "[$(date -u '+%Y-%m-%d %H:%M UTC')] WARNING: Could not check SSL cert for $DOMAIN" | tee "$LOG_FILE"
  exit 0
fi

expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null || date -d "$expiry_date" +%s 2>/dev/null)
now_epoch=$(date +%s)
days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

echo "[$(date -u '+%Y-%m-%d %H:%M UTC')] SSL cert for $DOMAIN expires: $expiry_date ($days_left days remaining)" > "$LOG_FILE"

if [ "$days_left" -lt "$WARN_DAYS" ]; then
  echo ""
  echo "============================================"
  echo "  WARNING: SSL certificate for $DOMAIN"
  echo "  expires in $days_left days! ($expiry_date)"
  echo "============================================"
  echo ""
fi
