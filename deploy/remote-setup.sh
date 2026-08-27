#!/usr/bin/env bash
# 服务器一次性环境初始化（root 执行）
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "==> 基础依赖"
apt-get update -y
apt-get install -y ca-certificates curl tar xz-utils build-essential python3 nginx ufw

echo "==> Node.js 22（官方二进制，避免 NodeSource 网络问题）"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 22 ]; then
  curl -fsSL -o /tmp/node.tar.xz https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz
  tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
fi
node -v

echo "==> pnpm / pm2"
npm i -g pnpm pm2 --registry=https://registry.npmmirror.com

echo "==> 2GB swap（2C2G 内存补充）"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 日志保留"
install -m 0644 /opt/qujt-blog/current/deploy/logrotate.qujt-blog /etc/logrotate.d/qujt-blog
install -d -m 0755 /etc/systemd/journald.conf.d
install -m 0644 /opt/qujt-blog/current/deploy/journald-qujt-blog.conf /etc/systemd/journald.conf.d/qujt-blog.conf
systemctl restart systemd-journald

echo "==> Nginx 站点"
cp /opt/qujt-blog/current/deploy/nginx.conf /etc/nginx/sites-available/qujt-blog
ln -sf /etc/nginx/sites-available/qujt-blog /etc/nginx/sites-enabled/qujt-blog
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo "==> 防火墙（80/22）"
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

echo "REMOTE_SETUP_OK"
