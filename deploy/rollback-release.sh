#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${DEPLOY_ROOT:-/opt/qujt-blog}"
CURRENT="$ROOT/current"
TARGET_ID="${1:-}"
ORIGINAL="$(readlink -f "$CURRENT")"
if [ -n "$TARGET_ID" ]; then
  TARGET="$ROOT/releases/$TARGET_ID"
else
  TARGET="$(find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d ! -path "$ORIGINAL" -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
fi
[ -n "$TARGET" ] && [ -d "$TARGET" ] || { echo 'no rollback release found' >&2; exit 2; }
[ -f "$TARGET/release.json" ] || { echo 'invalid rollback release' >&2; exit 2; }
restore_original() {
  code=$?
  echo "rollback target failed health checks; restoring $ORIGINAL" >&2
  ln -sfn "$ORIGINAL" "$ROOT/.current.restore"
  mv -Tf "$ROOT/.current.restore" "$CURRENT"
  cp "$CURRENT/deploy/nginx.conf" /etc/nginx/sites-available/qujt-blog
  pm2 startOrRestart "$CURRENT/deploy/ecosystem.config.js" --update-env || true
  nginx -t && systemctl reload nginx || true
  exit "$code"
}
trap restore_original ERR
ln -sfn "$TARGET" "$ROOT/.current.rollback"
mv -Tf "$ROOT/.current.rollback" "$CURRENT"
cp "$CURRENT/deploy/nginx.conf" /etc/nginx/sites-available/qujt-blog
nginx -t
pm2 startOrRestart "$CURRENT/deploy/ecosystem.config.js" --update-env
pm2 save
systemctl reload nginx
for attempt in {1..20}; do
  if curl -fsS --max-time 3 http://127.0.0.1/api/health >/dev/null     && curl -fsS --max-time 3 http://127.0.0.1/ >/dev/null     && curl -fsS --max-time 3 http://127.0.0.1/admin/ >/dev/null; then break; fi
  [ "$attempt" -lt 20 ] || false
  sleep 1
done
trap - ERR
basename "$TARGET" > "$ROOT/DEPLOYED_RELEASE"
echo "ROLLED_BACK_TO=$(basename "$TARGET")"
