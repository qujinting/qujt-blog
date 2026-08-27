#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE_ID="${1:?release id required}"
ARCHIVE="${2:?release archive required}"
ROOT="${DEPLOY_ROOT:-/opt/qujt-blog}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RELEASES="$ROOT/releases"
SHARED="$ROOT/shared"
TARGET="$RELEASES/$RELEASE_ID"
INCOMING="$RELEASES/.incoming-$RELEASE_ID"
CURRENT="$ROOT/current"
PREVIOUS=""
SWITCHED=0

[[ "$RELEASE_ID" =~ ^[A-Za-z0-9._-]{7,80}$ ]] || { echo "invalid release id" >&2; exit 2; }
[ -f "$ARCHIVE" ] || { echo "release archive not found: $ARCHIVE" >&2; exit 2; }
mkdir -p "$RELEASES" "$SHARED/data" "$SHARED/backups"
[ -f "$SHARED/server.env" ] || { echo "missing $SHARED/server.env; run migrate-legacy.sh first" >&2; exit 2; }
[ ! -e "$TARGET" ] || { echo "release already exists: $TARGET" >&2; exit 2; }
rm -rf "$INCOMING"
mkdir -p "$INCOMING"
trap 'rm -rf "$INCOMING"' EXIT

tar -xzf "$ARCHIVE" -C "$INCOMING"
node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(p.releaseId!==process.argv[2])process.exit(1)' "$INCOMING/release.json" "$RELEASE_ID"
for required in apps/server/dist/index.js apps/web/dist/index.html apps/admin/dist/index.html deploy/ecosystem.config.js deploy/nginx.conf; do
  [ -f "$INCOMING/$required" ] || { echo "missing artifact: $required" >&2; exit 2; }
done

ln -s "$SHARED/server.env" "$INCOMING/apps/server/.env"
ln -s "$SHARED/data" "$INCOMING/apps/server/data"
ln -s "$SHARED/backups" "$INCOMING/backups"

if [ ! -d "$INCOMING/apps/server/node_modules" ]; then
  RUNTIME="$SHARED/runtime"
  [ -d "$RUNTIME/apps/server/node_modules" ] || { echo "missing shared Linux runtime; run refresh-production-runtime.sh from WSL/Linux" >&2; exit 2; }
  cmp -s "$INCOMING/pnpm-lock.yaml" "$RUNTIME/pnpm-lock.yaml" || { echo "dependency lockfile changed; run refresh-production-runtime.sh from WSL/Linux before deploying" >&2; exit 2; }
  ln -s "$RUNTIME/apps/server/node_modules" "$INCOMING/apps/server/node_modules"
fi

cd "$INCOMING"
(cd apps/server && node -e "require('better-sqlite3');require('argon2');console.log('native dependencies ok')")

mv "$INCOMING" "$TARGET"
trap - EXIT
if [ -L "$CURRENT" ]; then PREVIOUS="$(readlink -f "$CURRENT")"; fi

rollback() {
  code=$?
  if [ "$SWITCHED" = 1 ] && [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "activation failed; rolling back to $PREVIOUS" >&2
    ln -sfn "$PREVIOUS" "$ROOT/.current.rollback"
    mv -Tf "$ROOT/.current.rollback" "$CURRENT"
    cp "$CURRENT/deploy/nginx.conf" /etc/nginx/sites-available/qujt-blog
    pm2 startOrRestart "$CURRENT/deploy/ecosystem.config.js" --update-env || true
    nginx -t && systemctl reload nginx || true
  fi
  exit "$code"
}
trap rollback ERR

ln -sfn "$TARGET" "$ROOT/.current.next"
mv -Tf "$ROOT/.current.next" "$CURRENT"
SWITCHED=1
install -m 0644 "$CURRENT/deploy/logrotate.qujt-blog" /etc/logrotate.d/qujt-blog
install -d -m 0755 /etc/systemd/journald.conf.d
install -m 0644 "$CURRENT/deploy/journald-qujt-blog.conf" /etc/systemd/journald.conf.d/qujt-blog.conf
cp "$CURRENT/deploy/nginx.conf" /etc/nginx/sites-available/qujt-blog
nginx -t
pm2 startOrRestart "$CURRENT/deploy/ecosystem.config.js" --update-env
pm2 save
systemctl reload nginx

for attempt in {1..20}; do
  if curl -fsS --max-time 3 http://127.0.0.1/api/health >/dev/null     && curl -fsS --max-time 3 http://127.0.0.1/ >/dev/null     && curl -fsS --max-time 3 http://127.0.0.1/admin/ >/dev/null; then
    break
  fi
  [ "$attempt" -lt 20 ] || { echo "health check failed" >&2; false; }
  sleep 1
done

cron_line='0 3 * * * /usr/local/bin/node /opt/qujt-blog/current/apps/server/backup.mjs >> /var/log/qujt-backup.log 2>&1'
( crontab -l 2>/dev/null | grep -v '/opt/qujt-blog/.*apps/server/backup.mjs' || true; echo "$cron_line" ) | crontab -

echo "$RELEASE_ID" > "$ROOT/DEPLOYED_RELEASE"
mapfile -t old_releases < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -name '.incoming-*' -printf '%T@ %p\n' | sort -nr | tail -n +$((KEEP_RELEASES + 1)) | cut -d' ' -f2-)
for old in "${old_releases[@]}"; do
  [ "$old" = "$(readlink -f "$CURRENT")" ] || rm -rf "$old"
done

echo "RELEASE_ACTIVATED=$RELEASE_ID"
