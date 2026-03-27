#!/usr/bin/env bash
#
# API health monitor for PM2 app.
# - Checks whether APP_NAME is online in PM2
# - Attempts restart/start if not online
# - Sends Healthchecks ping on success
#
# Cron example:
# */5 * * * * /absolute/path/to/repo/scripts/api-health-monitor.sh >/dev/null 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Optional: keep compatibility with environments that rely on ~/.bashrc for nvm/yarn.
if [[ "${API_HEALTH_SOURCE_BASHRC:-0}" == "1" ]] && [[ -f "${HOME}/.bashrc" ]]; then
  # shellcheck disable=SC1090
  source "${HOME}/.bashrc"
fi

# Load repo env values.
# shellcheck disable=SC1091
source "$SCRIPT_DIR/load-env.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/log.sh"

PROJECT_DIR="${PROJECT_DIR:-$ROOT_DIR}"
APP_NAME="${API_APP_NAME:-ac-api}"
API_HEALTHCHECK_PING_URL="${API_HEALTHCHECK_PING_URL:-}"
PM2_HOME="${API_HEALTH_PM2_HOME:-$PROJECT_DIR/.pm2}"
export PM2_HOME
API_HEALTH_USE_NVM="${API_HEALTH_USE_NVM:-1}"
API_HEALTH_NVM_DIR="${API_HEALTH_NVM_DIR:-$HOME/.nvm}"
API_HEALTH_NODE_VERSION="${API_HEALTH_NODE_VERSION:-}"
API_HEALTH_PATH_EXTRA="${API_HEALTH_PATH_EXTRA:-}"

init_scripts_file_log "${API_HEALTH_LOG_DIR:-$PROJECT_DIR/logs}" "api-health-monitor.log" "${API_HEALTH_LOG_LINES_KEEP:-500}"
mkdir -p "$PM2_HOME" "$PM2_HOME/logs" "$PM2_HOME/pids" "$PM2_HOME/modules"

hc_post() {
  local url="$1"
  local body="$2"
  # Never let a failed ping crash the monitor script.
  curl -fsS --max-time 10 --retry 3 --data-raw "$body" "$url" >/dev/null || true
}

hc_fail() {
  local body="$1"
  if [[ -n "$API_HEALTHCHECK_PING_URL" ]]; then
    hc_post "${API_HEALTHCHECK_PING_URL%/}/fail" "$body"
  fi
}

hc_ok() {
  local body="$1"
  if [[ -n "$API_HEALTHCHECK_PING_URL" ]]; then
    hc_post "${API_HEALTHCHECK_PING_URL%/}" "$body"
  fi
}

ensure_yarn() {
  if command -v yarn >/dev/null 2>&1; then
    return 0
  fi

  if [[ -n "$API_HEALTH_PATH_EXTRA" ]]; then
    export PATH="$API_HEALTH_PATH_EXTRA:$PATH"
  fi
  export PATH="$HOME/bin:$HOME/.local/bin:$PATH"

  if [[ "$API_HEALTH_USE_NVM" == "1" ]] && [[ -s "$API_HEALTH_NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "$API_HEALTH_NVM_DIR/nvm.sh"
    if [[ -n "$API_HEALTH_NODE_VERSION" ]]; then
      nvm use "$API_HEALTH_NODE_VERSION" >/dev/null 2>&1 || true
    elif [[ -f "$PROJECT_DIR/.nvmrc" ]]; then
      nvm use >/dev/null 2>&1 || true
    fi
  fi

  command -v yarn >/dev/null 2>&1
}

log_echo "=== API Health Monitor Started ==="
log_echo "Project: $PROJECT_DIR"
log_echo "App: $APP_NAME"
log_echo "Log file: $LOG_FILE"
log_echo "PM2_HOME: $PM2_HOME"

if [[ ! -d "$PROJECT_DIR" ]]; then
  msg="api-health failed ($(date -u +"%Y-%m-%dT%H:%M:%SZ"))\nproject_dir_missing=$PROJECT_DIR\npm2_home=$PM2_HOME"
  log_echo "ERROR: Project directory missing: $PROJECT_DIR"
  hc_fail "$msg"
  exit 1
fi

cd "$PROJECT_DIR"

if ! ensure_yarn; then
  msg=$(
    printf "api-health failed (%s)\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf "reason=yarn_not_found\n"
    printf "project_dir=%s\npm2_home=%s\npath=%s\n" "$PROJECT_DIR" "$PM2_HOME" "$PATH"
  )
  log_echo "ERROR: yarn not found. PATH=$PATH"
  hc_fail "$msg"
  exit 1
fi

YARN_PATH="$(command -v yarn)"
log_echo "Yarn: $YARN_PATH"

PM2_OUTPUT="$("$YARN_PATH" run pm2 status "$APP_NAME" --no-color 2>&1 || true)"
echo "$PM2_OUTPUT" >> "$LOG_FILE"

if echo "$PM2_OUTPUT" | grep -q "online"; then
  log_echo "OK: $APP_NAME is online"
  SERVICE_ONLINE=1
else
  log_echo "WARN: $APP_NAME is not online; attempting start/restart"
  START_OUTPUT="$("$YARN_PATH" api:start 2>&1 || true)"
  echo "$START_OUTPUT" >> "$LOG_FILE"
  sleep 5
  RECHECK_OUTPUT="$("$YARN_PATH" run pm2 status "$APP_NAME" --no-color 2>&1 || true)"
  echo "$RECHECK_OUTPUT" >> "$LOG_FILE"

  if echo "$RECHECK_OUTPUT" | grep -q "online"; then
    log_echo "OK: $APP_NAME is online after restart"
    SERVICE_ONLINE=1
  else
    log_echo "ERROR: $APP_NAME failed to become online"
    SERVICE_ONLINE=0
  fi
fi

if [[ "$SERVICE_ONLINE" -eq 1 ]]; then
  hc_ok "api-health ok $(date -u +"%Y-%m-%dT%H:%M:%SZ") app=$APP_NAME"
  log_echo "OK: API health ping sent"
else
  body=$(
    printf "api-health failed (%s)\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf "app=%s\nproject_dir=%s\npm2_home=%s\n" "$APP_NAME" "$PROJECT_DIR" "$PM2_HOME"
    printf "pm2_status_snippet=%s\n" "$(echo "$PM2_OUTPUT" | tr '\n' ' ' | head -c 400)"
  )
  hc_fail "$body"
  log_echo "WARN: Service not online; sent fail ping"
  exit 1
fi

log_echo "=== API Health Monitor Completed ==="
trim_log
