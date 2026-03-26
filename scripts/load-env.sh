#!/usr/bin/env bash
#
# Generic env loader for scripts in this repo.
# Usage:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   # shellcheck disable=SC1091
#   source "$SCRIPT_DIR/load-env.sh"
#
# Behavior:
# - If ENV_FILE is set and readable, load only that file.
# - Otherwise, load the first readable file from:
#     1) .env.production
#     2) .env.local
#     3) .env
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

load_env_file() {
  local file="$1"
  # Export all variables declared while sourcing the file.
  set -a
  # shellcheck disable=SC1090
  source "$file"
  # Stop auto-export behavior after sourcing.
  set +a
}

if [[ -n "${ENV_FILE:-}" ]]; then
  if [[ -r "$ENV_FILE" ]]; then
    load_env_file "$ENV_FILE"
    export LOADED_ENV_FILE="$ENV_FILE"
    return 0
  fi
  echo "ENV_FILE is set but unreadable: $ENV_FILE" >&2
  return 1
fi

for candidate in "$ROOT_DIR/.env.production" "$ROOT_DIR/.env.local" "$ROOT_DIR/.env"; do
  if [[ -r "$candidate" ]]; then
    load_env_file "$candidate"
    export LOADED_ENV_FILE="$candidate"
    return 0
  fi
done

# Not an error: scripts can still run with environment provided externally.
return 0
