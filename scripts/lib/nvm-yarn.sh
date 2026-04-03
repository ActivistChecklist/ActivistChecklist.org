#!/usr/bin/env bash
#
# Shared NVM + Yarn for cron, webhooks, and SSH one-liners.
# Source this file (do not run standalone):
#   source "$SCRIPT_DIR/lib/nvm-yarn.sh"
#
# Configure before nvm_yarn_init:
#   NVM_YARN_PROJECT_DIR   — absolute repo root (required)
#   NVM_YARN_USE_NVM       — 0 (default) or 1 — use "nvm exec <ver> yarn"
#   NVM_YARN_NVM_DIR       — default $HOME/.nvm
#   NVM_YARN_NODE_VERSION  — optional; else first real line of $PROJECT_DIR/.nvmrc
#   NVM_YARN_PATH_EXTRA    — optional PATH prefix
#
# Optional: define nvm_yarn_err(message) before sourcing to route errors
# (e.g. to log_echo or deploy log).
#
# After successful nvm_yarn_init:
#   NVM_YARN_RESOLVED_VERSION — non-empty when Yarn must run via nvm exec
#
# Run Yarn: nvm_yarn install …   (same args as yarn)

nvm_yarn__err() {
  if declare -F nvm_yarn_err >/dev/null 2>&1; then
    nvm_yarn_err "$1"
  else
    printf '%s\n' "$1" >&2
  fi
}

# Echo first Node version line from repo .nvmrc (skip blanks / # comments).
nvm_yarn_read_nvmrc() {
  local project_dir="$1"
  local f="$project_dir/.nvmrc"
  [[ -f "$f" ]] || { printf ''; return 0; }
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    line="${line//$'\r'/}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -n "$line" ]] && { printf '%s' "$line"; return 0; }
  done <"$f"
  printf ''
}

nvm_yarn__prepend_path() {
  if [[ -n "${NVM_YARN_PATH_EXTRA:-}" ]]; then
    export PATH="$NVM_YARN_PATH_EXTRA:$PATH"
  fi
  export PATH="$HOME/bin:$HOME/.local/bin:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"
}

nvm_yarn_init() {
  local project_dir="${NVM_YARN_PROJECT_DIR:-}"
  if [[ -z "$project_dir" ]] || [[ ! -d "$project_dir" ]]; then
    nvm_yarn__err "nvm_yarn_init: NVM_YARN_PROJECT_DIR must be set to repo root"
    return 1
  fi

  nvm_yarn__prepend_path
  NVM_YARN_RESOLVED_VERSION=""
  export NVM_YARN_RESOLVED_VERSION

  if [[ "${NVM_YARN_USE_NVM:-0}" != "1" ]]; then
    if command -v corepack >/dev/null 2>&1; then
      corepack enable >/dev/null 2>&1 || true
    fi
    if ! command -v yarn >/dev/null 2>&1; then
      nvm_yarn__err "nvm_yarn_init: yarn not found (NVM_YARN_USE_NVM=0)"
      return 1
    fi
    return 0
  fi

  local nvm_dir="${NVM_YARN_NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$nvm_dir/nvm.sh" ]]; then
    nvm_yarn__err "nvm_yarn_init: NVM_YARN_USE_NVM=1 but missing $nvm_dir/nvm.sh"
    return 1
  fi

  # Cron and Yarn sometimes export npm_config_prefix (e.g. ~/.config/yarn). nvm
  # refuses to run until it is unset. See: nvm.sh "not compatible with npm_config_prefix".
  unset npm_config_prefix
  unset NPM_CONFIG_PREFIX

  # shellcheck disable=SC1090
  source "$nvm_dir/nvm.sh"

  local ver="${NVM_YARN_NODE_VERSION:-}"
  if [[ -z "$ver" ]]; then
    ver="$(nvm_yarn_read_nvmrc "$project_dir")"
  fi
  if [[ -z "$ver" ]]; then
    nvm_yarn__err "nvm_yarn_init: set NVM_YARN_NODE_VERSION or add .nvmrc under $project_dir"
    return 1
  fi

  if ! nvm exec "$ver" node -v >/dev/null 2>&1; then
    nvm_yarn__err "nvm_yarn_init: nvm exec '$ver' node failed"
    return 1
  fi

  if ! nvm exec "$ver" yarn --version >/dev/null 2>&1; then
    nvm_yarn__err "nvm_yarn_init: yarn not found under Node $ver"
    return 1
  fi

  NVM_YARN_RESOLVED_VERSION="$ver"
  export NVM_YARN_RESOLVED_VERSION
  return 0
}

nvm_yarn() {
  if [[ -n "${NVM_YARN_RESOLVED_VERSION:-}" ]]; then
    unset npm_config_prefix
    unset NPM_CONFIG_PREFIX
    nvm exec "$NVM_YARN_RESOLVED_VERSION" yarn "$@"
  else
    command yarn "$@"
  fi
}
