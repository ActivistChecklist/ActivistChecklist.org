#!/usr/bin/env bash
#
# Shared logging helpers for cron and deploy scripts.
#
# File logging (health checks, etc.):
#   source "$SCRIPT_DIR/log.sh"
#   init_scripts_file_log "$PROJECT_DIR/logs" "my-script.log" "${MY_LOG_LINES_KEEP:-500}"
#   log "line"
#   log_echo "line"    # stdout + file
#   trim_log
#   scripts_log_file_failure_block "FAILED" "$multiline_body"
#
# Stderr-only UTC (deploy logs, webhook output):
#   source "$SCRIPT_DIR/log.sh"
#   log() { log_stderr_utc "$@"; }
#

# Sets LOG_DIR, LOG_FILE, LOG_LINES_KEEP and creates LOG_DIR.
init_scripts_file_log() {
  local log_dir="$1"
  local log_basename="$2"
  LOG_LINES_KEEP="${3:-500}"
  LOG_DIR="$log_dir"
  LOG_FILE="$LOG_DIR/$log_basename"
  mkdir -p "$LOG_DIR"
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE"
}

log_echo() {
  echo "$1"
  log "$1"
}

trim_log() {
  if [[ -f "$LOG_FILE" ]]; then
    tail -n "$LOG_LINES_KEEP" "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi
}

# First line: [local time] label. Remaining lines: body (e.g. Healthchecks fail payload).
scripts_log_file_failure_block() {
  local label="$1"
  local body="$2"
  {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$label"
    printf '%s\n' "$body"
  } >> "$LOG_FILE"
}

log_stderr_utc() {
  printf '[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*" >&2
}
