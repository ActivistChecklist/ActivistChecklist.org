#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load env once for local deploy flows.
# shellcheck disable=SC1091
source "$SCRIPT_DIR/load-env.sh"

cd "$ROOT"
yarn buildstatic
bash "$SCRIPT_DIR/deploy-remote.sh"
