#!/usr/bin/env bash
# =============================================================================
# ChessHub 一键部署脚本
# 适用: Ubuntu 24.04 LTS / 2核2G
# 域名: chesshub.fun
# 服务器 IP: 159.75.97.172
# =============================================================================

set -e

# ---------- 配置 ----------
DOMAIN="chesshub.fun"
SERVER_IP="159.75.97.172"
SITE_ROOT="/var/www/chesshub"
GOBANG_ROOT="/var/www/gobang"
NGINX_CONF="/etc/nginx/sites-available/chesshub"
EMAIL="tenglong436@gmail.com"   # Let's Encrypt 注册邮箱

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[*]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }

# ---------- 前置检查 ----------
if [ "$EUID" -ne 0 ]; then
  err "请用 root 运行: sudo bash deploy-server.sh"
  exit 1
fi

log "ChessHub 部署开始 · 域名 $DOMAIN"

# ---------- 1. 系统更新 ----------
log "更新系统包..."
apt update -y && apt upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
ok "系统更新完成"

# ---------- 2. 安装基础工具 ----------
log "安装 Nginx / Git / Certbot / Node..."
apt install -y nginx git curl wget ufw software-properties-common ca-certificates apt-transport-https

# Node.js 20 LTS
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
ok "Nginx $(nginx -v 2>&1) · Node $(node -v) · npm $(npm -v)"

# ---------- 3. 配置防火墙 ----------
log "配置防火墙 (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
ok "防火墙已开启 (22/80/443)"

# ---------- 4. 创建站点目录 ----------
log "创建站点目录..."
mkdir -p "$SITE_ROOT"
mkdir -p "$GOBANG_ROOT"
ok "$SITE_ROOT / $GOBANG_ROOT"

# ---------- 5. 拉取代码 ----------
log "克隆 chesshub-site..."
if [ -d "$SITE_ROOT/.git" ]; then
  cd "$SITE_ROOT" && git pull
else
  # 第一次部署：先在本地 npm run build，然后把 dist 目录 scp 上来
  # 这里假设你已经把 dist/ 传到 /tmp/chesshub-dist.tar.gz
  if [ -f /tmp/chesshub-dist.tar.gz ]; then
    tar -xzf /tmp/chesshub-dist.tar.gz -C "$SITE_ROOT"
  else
    warn "/tmp/chesshub-dist.tar.gz 不存在,跳过站点内容,只配置 Nginx"
    warn "请先在本地构建: cd chesshub-site && npm run build && scp dist.tar.gz root@SERVER_IP:/tmp/"
  fi
fi

log "克隆 gobang-web..."
if [ -f /tmp/gobang-dist.tar.gz ]; then
  tar -xzf /tmp/gobang-dist.tar.gz -C "$GOBANG_ROOT"
else
  warn "/tmp/gobang-dist.tar.gz 不存在,五子棋暂时不可用"
fi

# ---------- 6. Nginx 配置 ----------
log "写入 Nginx 配置..."
cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    # 强制 HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL 证书 (Certbot 会自动填充)
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1000;

    # 主页
    root ${SITE_ROOT};
    index index.html;

    # 默认页
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 五子棋子路径
    location /gobang/ {
        alias ${GOBANG_ROOT}/;
        try_files \$uri \$uri/ /gobang/index.html;
        index index.html;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 日志
    access_log /var/log/nginx/chesshub.access.log;
    error_log  /var/log/nginx/chesshub.error.log;
}

# IP 直接访问重定向到域名
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl http2 default_server;
    server_name _;

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    return 301 https://${DOMAIN}\$request_uri;
}
NGINX

# 启用站点
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
ok "Nginx 配置 OK"

# ---------- 7. 申请 HTTPS 证书 ----------
log "申请 Let's Encrypt 证书..."
apt install -y certbot python3-certbot-nginx

# 先用 standalone 模式拿证书 (避免 Nginx 还没启动完整的问题)
systemctl stop nginx || true
certbot certonly --standalone \
  --non-interactive --agree-tos \
  -m "$EMAIL" \
  -d "$DOMAIN" -d "www.${DOMAIN}" \
  --preferred-challenges http

# 自动续期
systemctl enable certbot.timer
ok "HTTPS 证书已签发"

# ---------- 8. 启动 Nginx ----------
log "启动 Nginx..."
systemctl enable nginx
systemctl restart nginx
sleep 2
systemctl status nginx --no-pager | head -5

# ---------- 9. 验证 ----------
log "检查服务..."
sleep 2
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://${DOMAIN}" || echo "000")
echo ""
ok "部署完成!"
echo ""
echo "=========================================="
echo "  ChessHub 已上线: https://${DOMAIN}"
echo "  HTTP 状态码: $HTTP_CODE"
echo "=========================================="
echo ""
echo "后续:"
echo "  · 更新主页: 本地构建 → scp 到 /tmp/chesshub-dist.tar.gz → 解压到 ${SITE_ROOT}"
echo "  · 更新五子棋: scp 到 /tmp/gobang-dist.tar.gz → 解压到 ${GOBANG_ROOT}"
echo "  · 查看日志: tail -f /var/log/nginx/chesshub.error.log"
echo "  · 证书续期: certbot renew (已配置自动)"