#!/usr/bin/env bash
# Run from WSL/Linux only after package.json, pnpm-lock.yaml, or pnpm-workspace.yaml changes.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${1:-115.29.149.137}"
USER="${DEPLOY_USER:-root}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/qujt-deploy-key}"
if [ ! -f "$KEY" ] && [ -f /mnt/c/Users/90669/.ssh/qujt-deploy-key ]; then KEY=/mnt/c/Users/90669/.ssh/qujt-deploy-key; fi
[ -f "$KEY" ] || { echo "deployment key not found: $KEY" >&2; exit 2; }

cd "$ROOT"
command -v pnpm >/dev/null
command -v ssh >/dev/null
command -v scp >/dev/null

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
RUNTIME="$STAGE/runtime"
mkdir -p "$RUNTIME/apps"

pnpm install --frozen-lockfile
pnpm --filter @qujt/server exec npm rebuild better-sqlite3 --foreground-scripts
pnpm --filter @qujt/server deploy --prod --legacy "$RUNTIME/apps/server"
cp pnpm-lock.yaml "$RUNTIME/pnpm-lock.yaml"
( cd "$RUNTIME/apps/server" && node -e "require('better-sqlite3');require('argon2');console.log('Linux runtime verified')" )

tar -czf "$STAGE/qujt-runtime.tar.gz" -C "$RUNTIME" .
scp -i "$KEY" -o BatchMode=yes "$STAGE/qujt-runtime.tar.gz" "$USER@$HOST:/tmp/qujt-runtime.tar.gz"
ssh -i "$KEY" -o BatchMode=yes "$USER@$HOST" 'bash -s' <<'REMOTE'
set -Eeuo pipefail
ROOT=/opt/qujt-blog
STAGE="$ROOT/shared/.runtime-incoming"
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -xzf /tmp/qujt-runtime.tar.gz -C "$STAGE"
[ -d "$STAGE/apps/server/node_modules" ]
[ -f "$STAGE/pnpm-lock.yaml" ]
( cd "$STAGE/apps/server" && node -e "require('better-sqlite3');require('argon2');console.log('Shared Linux runtime verified')" )
rm -rf "$ROOT/shared/runtime.previous"
[ ! -d "$ROOT/shared/runtime" ] || mv "$ROOT/shared/runtime" "$ROOT/shared/runtime.previous"
mv "$STAGE" "$ROOT/shared/runtime"
rm -rf "$ROOT/shared/runtime.previous" /tmp/qujt-runtime.tar.gz
echo 'Shared Linux runtime refreshed.'
REMOTE

echo 'Runtime refresh completed. Return to Windows and run publish-production.ps1.'
