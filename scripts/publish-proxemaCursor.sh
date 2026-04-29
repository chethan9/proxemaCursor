#!/usr/bin/env bash
# Creates https://github.com/<you>/proxemaCursor and pushes main (requires: gh auth login once).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1 && [[ -x /opt/homebrew/bin/gh ]]; then
  export PATH="/opt/homebrew/bin:$PATH"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Not logged in. Run: gh auth login"
  echo "Then re-run: $0"
  exit 1
fi

REMOTE_NAME="proxemaCursor"
REPO_NAME="proxemaCursor"

if git remote get-url "$REMOTE_NAME" &>/dev/null; then
  echo "Remote '$REMOTE_NAME' already exists. Pushing main..."
  git push -u "$REMOTE_NAME" main
  exit 0
fi

gh repo create "$REPO_NAME" --public --source=. --remote="$REMOTE_NAME" --push \
  --description "Proxima Cursor — WooCommerce sync"

LOGIN=$(gh api user -q .login)
echo "Done: https://github.com/${LOGIN}/${REPO_NAME}"
