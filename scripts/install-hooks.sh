#!/bin/sh

# Install git hooks from tracked copies in scripts/
# This runs automatically via the "prepare" script after yarn install

HOOK_DIR="$(git rev-parse --git-dir 2>/dev/null)/hooks"

if [ -z "$HOOK_DIR" ] || [ ! -d "$HOOK_DIR" ]; then
  echo "Not a git repository or hooks directory not found. Skipping hook install."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cp "$SCRIPT_DIR/pre-commit" "$HOOK_DIR/pre-commit"
chmod +x "$HOOK_DIR/pre-commit"
echo "Git pre-commit hook installed."
