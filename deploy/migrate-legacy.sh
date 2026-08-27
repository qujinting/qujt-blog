#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${DEPLOY_ROOT:-/opt/qujt-blog}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ ! -L "$ROOT/current" ] || { echo "current already exists: $(readlink -f "$ROOT/current")"; exit 0; }
LEGACY="$ROOT"
RELEASE_ID="legacy-$(date -u +%Y%m%d%H%M%S)"
TARGET="$ROOT/releases/$RELEASE_ID"
mkdir -p "$TARGET/apps/server" "$TARGET/apps/web" "$TARGET/apps/admin" "$TARGET/packages" "$TARGET/deploy" "$ROOT/shared/data" "$ROOT/shared/backups"
chmod 750 "$ROOT/shared/data" "$ROOT/shared/backups"
pm2 stop qujt-api qujt-api-test >/dev/null 2>&1 || true
trap 'pm2 restart qujt-api qujt-api-test >/dev/null 2>&1 || true' ERR
cp -a "$LEGACY/apps/server/.env" "$ROOT/shared/server.env"
chmod 600 "$ROOT/shared/server.env"
cp -a "$LEGACY/apps/server/data/." "$ROOT/shared/data/"
cp -a "$LEGACY/backups/." "$ROOT/shared/backups/" 2>/dev/null || true
rm -rf "$LEGACY/apps/server/data"
ln -s "$ROOT/shared/data" "$LEGACY/apps/server/data"
cp -a "$LEGACY/apps/server/dist" "$LEGACY/apps/server/package.json" "$LEGACY/apps/server/backup.mjs" "$TARGET/apps/server/"
cp -a "$LEGACY/apps/web/dist" "$TARGET/apps/web/"
cp -a "$LEGACY/apps/admin/dist" "$TARGET/apps/admin/"
cp -a "$LEGACY/packages/." "$TARGET/packages/"
cp -a "$LEGACY/deploy/." "$TARGET/deploy/"
cp -a "$SCRIPT_DIR/." "$TARGET/deploy/"
cp -a "$LEGACY/package.json" "$LEGACY/pnpm-lock.yaml" "$LEGACY/pnpm-workspace.yaml" "$TARGET/"
ln -s "$LEGACY/node_modules" "$TARGET/node_modules"
ln -s "$ROOT/shared/server.env" "$TARGET/apps/server/.env"
ln -s "$ROOT/shared/data" "$TARGET/apps/server/data"
ln -s "$ROOT/shared/backups" "$TARGET/backups"
printf '{"releaseId":"%s","commit":"legacy","builtAt":"%s","migration":true}\n' "$RELEASE_ID" "$(date -u +%FT%TZ)" > "$TARGET/release.json"
ln -sfn "$TARGET" "$ROOT/.current.next"
mv -Tf "$ROOT/.current.next" "$ROOT/current"
cp "$ROOT/current/deploy/nginx.conf" /etc/nginx/sites-available/qujt-blog
nginx -t
pm2 startOrRestart "$ROOT/current/deploy/ecosystem.config.js" --update-env
pm2 restart qujt-api-test >/dev/null 2>&1 || true
pm2 save
systemctl reload nginx
cron_line='0 3 * * * /usr/local/bin/node /opt/qujt-blog/current/apps/server/backup.mjs >> /var/log/qujt-backup.log 2>&1'
( crontab -l 2>/dev/null | grep -v '/opt/qujt-blog/.*apps/server/backup.mjs' || true; echo "$cron_line" ) | crontab -
curl -fsS --retry 10 --retry-delay 1 --retry-connrefused http://127.0.0.1/api/health >/dev/null
echo "$RELEASE_ID" > "$ROOT/DEPLOYED_RELEASE"
echo "LEGACY_MIGRATED=$RELEASE_ID"
