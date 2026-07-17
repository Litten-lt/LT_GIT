#!/usr/bin/env bash
# =============================================================================
# ChessHub 一键部署脚本 (Ubuntu 24.04 / nginx 1.24 / Node 20+)
# 用法:
#   ./chesshub-deploy.sh all           # 全流程: 解包前后端 + 配 nginx + 重启
#   ./chesshub-deploy.sh frontend      # 只重新部署前端
#   ./chesshub-deploy.sh backend       # 只重新部署后端 (含重启 pm2)
#   ./chesshub-deploy.sh nginx         # 只检查 / 重写 nginx 配置
#   ./chesshub-deploy.sh restart       # 只重启后端 (pm2)
#   ./chesshub-deploy.sh smoke-test    # 只跑冒烟测试
#   ./chesshub-deploy.sh preflight     # 只检查环境
#   ./chesshub-deploy.sh seed          # 只补 seed (首次)
#   ./chesshub-deploy.sh clean         # 清理 /tmp/ 下的旧备份
#
# 假定你已经把以下两个包 scp 到 /tmp/:
#   /tmp/chesshub-dist.tar.gz     (前端 vite build 产物)
#   /tmp/chesshub-server.tar.gz   (后端 Node.js 源码,不含 node_modules / .env / data)
#
# [MANUAL] 标记的步骤需要你单独操作,本脚本不自动做。
# =============================================================================

set -e

# ---------- 自保护: 备份脚本自身 ----------
# 因为脚本在 $BACKEND_ROOT 下,而 deploy_backend 会 rm -rf 该目录,
# 必须先把自己备份到 /tmp/,结束后再 copy 回去
SCRIPT_PATH="$(readlink -f "$0" 2>/dev/null || echo "$0")"
SCRIPT_BAK="/tmp/.chesshub-deploy.sh.bak"
if [ -f "$SCRIPT_PATH" ] && [ "$SCRIPT_PATH" != "$SCRIPT_BAK" ]; then
  cp "$SCRIPT_PATH" "$SCRIPT_BAK"
  chmod +x "$SCRIPT_BAK"
fi

# 自毁/自恢复辅助函数: 做完 rm 后用备份恢复
restore_self() {
  if [ -f "$SCRIPT_BAK" ] && [ ! -f "$SCRIPT_PATH" ]; then
    cp "$SCRIPT_BAK" "$SCRIPT_PATH"
    chmod +x "$SCRIPT_PATH"
    log "脚本已自恢复 (从 $SCRIPT_BAK)"
  fi
}
trap restore_self EXIT  # 脚本退出时尝试恢复

# ---------- 配置 ----------
DOMAIN="chesshub.fun"
SERVER_IP="159.75.97.172"
FRONTEND_ROOT="/var/www/chesshub"
BACKEND_ROOT="/opt/chesshub-server"
UPLOAD_DIR="/var/www/chesshub-data/figures"
GOBANG_ROOT="/var/www/gobang"
NGINX_CONF="/etc/nginx/sites-available/chesshub"
DIST_TAR="/tmp/chesshub-dist.tar.gz"
SERVER_TAR="/tmp/chesshub-server.tar.gz"
PM2_NAME="chesshub-server"
BACKEND_PORT=3000

ADMIN_USER_DEFAULT="admin"
ADMIN_PASS_DEFAULT="admin"

# ---------- 颜色 ----------
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'

log()   { printf "${BLU}[*]${NC} %s\n" "$*"; }
ok()    { printf "${GRN}[✓]${NC} %s\n" "$*"; }
warn()  { printf "${YEL}[!]${NC} %s\n" "$*"; }
err()   { printf "${RED}[✗]${NC} %s\n" "$*"; }
manual(){ printf "${YEL}[MANUAL]${NC} %s\n" "$*"; }

# ---------- 前置检查 ----------
require_root() {
  if [ "$EUID" -ne 0 ]; then
    err "请用 root 跑: sudo $0 $*"
    exit 1
  fi
}

# ---------- 0. preflight ----------
preflight() {
  log "环境检查..."
  local fail=0

  # Node
  if command -v node &>/dev/null; then
    ok "Node: $(node -v)"
  else
    err "Node 未装"
    fail=1
  fi

  # npm
  if command -v npm &>/dev/null; then
    ok "npm: $(npm -v)"
  else
    err "npm 未装"
    fail=1
  fi

  # nginx
  if command -v nginx &>/dev/null; then
    ok "nginx: $(nginx -v 2>&1 | awk -F/ '{print $2}')"
  else
    err "nginx 未装"
    fail=1
  fi

  # pm2
  if command -v pm2 &>/dev/null; then
    ok "pm2: $(pm2 -v)"
  else
    err "pm2 未装 (npm i -g pm2)"
    fail=1
  fi

  # 包
  [ -f "$DIST_TAR" ]  && ok "$DIST_TAR 存在"  || { err "缺 $DIST_TAR"; fail=1; }
  [ -f "$SERVER_TAR" ] && ok "$SERVER_TAR 存在" || { err "缺 $SERVER_TAR"; fail=1; }

  # 目录
  for d in "$FRONTEND_ROOT" "$UPLOAD_DIR" "$GOBANG_ROOT"; do
    [ -d "$d" ] && ok "目录: $d" || { err "缺目录: $d"; fail=1; }
  done
  [ -d "$BACKEND_ROOT" ] || mkdir -p "$BACKEND_ROOT"

  # 端口
  if ss -tln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
    ok "后端端口 $BACKEND_PORT 在监听"
  else
    warn "后端端口 $BACKEND_PORT 未监听 (可能还没启动)"
  fi

  if [ $fail -ne 0 ]; then
    err "环境检查失败,请先解决"
    exit 1
  fi
  ok "环境检查通过"
}

# ---------- 1. frontend ----------
deploy_frontend() {
  log "部署前端 → $FRONTEND_ROOT"
  rm -rf "$FRONTEND_ROOT"/assets \
         "$FRONTEND_ROOT"/index.html \
         "$FRONTEND_ROOT"/figures.html \
         "$FRONTEND_ROOT"/travel.html \
         "$FRONTEND_ROOT"/blog.html \
         "$FRONTEND_ROOT"/login.html

  tar -xzf "$DIST_TAR" -C "$FRONTEND_ROOT/"
  ok "前端已部署 (文件: $(ls $FRONTEND_ROOT | wc -l) 个)"
}

# ---------- 2. backend ----------
deploy_backend() {
  log "部署后端 → $BACKEND_ROOT"

  # 备份 data (重要: SQLite 数据)
  if [ -d "$BACKEND_ROOT/data" ]; then
    local backup="/tmp/chesshub-data-backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$BACKEND_ROOT/data" "$backup"
    ok "已备份 data → $backup"
  fi

  # 备份 .env
  if [ -f "$BACKEND_ROOT/.env" ]; then
    cp "$BACKEND_ROOT/.env" "/tmp/chesshub-env-backup-$(date +%Y%m%d-%H%M%S)"
    ok "已备份 .env"
  fi

  # 清空 + 解包
  # 重要:rm 会清掉脚本自身,先备份(仅当 BAK 还没有时,避免覆盖较新的备份)
  [ -f "$SCRIPT_BAK" ] || cp "$SCRIPT_PATH" "$SCRIPT_BAK" 2>/dev/null || true
  rm -rf "$BACKEND_ROOT"/*
  tar -xzf "$SERVER_TAR" -C "$BACKEND_ROOT/"
  # 恢复脚本自身: 仅当 tar 包没带 deploy.sh 时 (SCRIPT_PATH 缺失),否则保留新版
  if [ ! -f "$SCRIPT_PATH" ] && [ -f "$SCRIPT_BAK" ]; then
    cp "$SCRIPT_BAK" "$SCRIPT_PATH"
    chmod +x "$SCRIPT_PATH"
    ok "脚本已自恢复 (tar 包未包含 deploy.sh)"
  fi
  ok "源码已解包"

  # 装依赖
  log "npm install ..."
  cd "$BACKEND_ROOT"
  npm install --omit=dev --silent
  ok "依赖已装"

  # 恢复 .env
  local latest_env=""
  if compgen -G "/tmp/chesshub-env-backup-*.env" > /dev/null; then
    latest_env=$(ls -t /tmp/chesshub-env-backup-*.env 2>/dev/null | head -1)
    if [ -n "$latest_env" ] && [ ! -f "$BACKEND_ROOT/.env" ]; then
      cp "$latest_env" "$BACKEND_ROOT/.env"
      ok "已恢复 .env ← $latest_env"
    fi
  fi

  # 首次部署: 复制 .env.example
  if [ ! -f "$BACKEND_ROOT/.env" ]; then
    cp "$BACKEND_ROOT/.env.example" "$BACKEND_ROOT/.env"
    warn "已生成默认 .env (admin/admin) — 部署后请改成强密码!"
  fi

  # 恢复 data 目录 (SQLite) - **关键**, 备份在上面做过
  if compgen -G "/tmp/chesshub-data-backup-*" > /dev/null; then
    local latest_data=$(ls -td /tmp/chesshub-data-backup-* 2>/dev/null | head -1)
    if [ -n "$latest_data" ]; then
      mkdir -p "$BACKEND_ROOT/data"
      cp -r "$latest_data"/* "$BACKEND_ROOT/data/"
      local db_count=$(find "$BACKEND_ROOT/data" -name "*.db" | wc -l)
      ok "已恢复 data (含 $db_count 个数据库) ← $latest_data"
    fi
  else
    warn "没找到 data 备份 (首次部署?), seed 将创建空数据库"
  fi
}

# ---------- 3. seed ----------
seed_aobing() {
  # 触发后端 seed: 重启后端就行 (server.js 启动时检查并 seed)
  # 这里只检查图是否到位
  if [ -f "$FRONTEND_ROOT/figures/aobing.jpg" ] && [ ! -f "$UPLOAD_DIR/aobing.jpg" ]; then
    log "Seed 用的 aobing.jpg 还没复制到 $UPLOAD_DIR,启动时 server.js 会自动处理"
  else
    log "Seed 图已就位 (前端 $FRONTEND_ROOT/figures/ 或后端 $UPLOAD_DIR/ 之一存在)"
  fi
}

# ---------- 3.5 backup uploads ----------
backup_uploads() {
  if [ -d "$UPLOAD_DIR" ]; then
    local backup="/tmp/chesshub-uploads-backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$UPLOAD_DIR" "$backup"
    local count=$(find "$UPLOAD_DIR" -type f | wc -l)
    ok "已备份上传目录 ($count 个文件) → $backup"
  else
    warn "上传目录不存在: $UPLOAD_DIR (跳过备份)"
  fi
}

# ---------- 3.6 check orphans ----------
# 部署完后调用:对比数据库和 UPLOAD_DIR,列出"孤儿文件"(数据库没引用但磁盘上有)
check_orphans() {
  if [ ! -d "$UPLOAD_DIR" ]; then return; fi

  # 从数据库取所有 images 字段拼成一个 Set (figures + travels + notes + works 全部)
  local db_files=$(node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$BACKEND_ROOT/data/chesshub.db', { readonly: true });
    const set = new Set();
    for (const t of ['figures','travels','notes','works']) {
      for (const r of db.prepare('SELECT images FROM ' + t).all()) {
        try { JSON.parse(r.images).forEach(f => set.add(f)); } catch {}
      }
    }
    console.log([...set].join('\n'));
  " 2>/dev/null)

  # 扫 UPLOAD_DIR 里所有文件,对比 (排除 hero- / about- 前缀的 Hero 背景图和 About 照片)
  local orphans=()
  while IFS= read -r f; do
    local basename=$(basename "$f")
    # Hero 背景图 / About 照片不算孤儿
    [[ "$basename" == hero-* ]] && continue
    [[ "$basename" == about-* ]] && continue
    if ! echo "$db_files" | grep -qx "$basename"; then
      orphans+=("$f")
    fi
  done < <(find "$UPLOAD_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) 2>/dev/null)

  if [ ${#orphans[@]} -eq 0 ]; then
    ok "无孤儿文件 (上传目录与数据库一致)"
  else
    warn "发现 ${#orphans[@]} 个孤儿文件 (数据库没引用,可能占空间):"
    for o in "${orphans[@]}"; do
      local size=$(du -h "$o" | cut -f1)
      echo "    - $o ($size)"
    done
    echo ""
    echo "    清理命令: ./chesshub-deploy.sh clean-orphans"
  fi
}

clean_orphans() {
  if [ ! -d "$UPLOAD_DIR" ]; then
    err "上传目录不存在"
    return
  fi

  local db_files=$(node -e "
    const Database = require('better-sqlite3');
    const db = new Database('$BACKEND_ROOT/data/chesshub.db', { readonly: true });
    const set = new Set();
    for (const t of ['figures','travels','notes','works']) {
      for (const r of db.prepare('SELECT images FROM ' + t).all()) {
        try { JSON.parse(r.images).forEach(f => set.add(f)); } catch {}
      }
    }
    console.log([...set].join('\n'));
  " 2>/dev/null)

  local orphans=()
  while IFS= read -r f; do
    local basename=$(basename "$f")
    # Hero 背景图 / About 照片不算孤儿
    [[ "$basename" == hero-* ]] && continue
    [[ "$basename" == about-* ]] && continue
    if ! echo "$db_files" | grep -qx "$basename"; then
      orphans+=("$f")
    fi
  done < <(find "$UPLOAD_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) 2>/dev/null)

  if [ ${#orphans[@]} -eq 0 ]; then
    ok "无孤儿文件"
    return
  fi

  warn "准备删除 ${#orphans[@]} 个孤儿文件:"
  for o in "${orphans[@]}"; do
    echo "    - $o"
  done
  echo ""

  if [ -t 0 ]; then
    # 交互式终端才询问
    read -p "    确认删除? [y/N] " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      warn "已取消"
      return
    fi
  else
    warn "非交互模式,自动跳过 (用 'y' 强制: echo y | ...)"
    return
  fi

  local count=0
  for o in "${orphans[@]}"; do
    rm -f "$o" && count=$((count+1))
  done
  ok "已删除 $count 个孤儿文件"
}

# ---------- 4. nginx ----------
deploy_nginx() {
  log "写入 Nginx 配置 → $NGINX_CONF"
  cat > "$NGINX_CONF" <<NGINX_EOF
# ===== HTTP default_server (IP 访问 + 其他 host,只服务静态) =====
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml image/jpeg image/png;
    gzip_min_length 1000;

    # 上传图片静态托管
    location /data/ {
        alias /var/www/chesshub-data/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # 后端 API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        client_max_body_size 10m;
        proxy_read_timeout 60s;
    }

    root ${FRONTEND_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }

    location /gobang/ {
        alias ${GOBANG_ROOT}/;
        try_files \$uri \$uri/ /gobang/index.html;
        index index.html;
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }

    location /login   { try_files \$uri /login.html; }
    location /travel  { try_files \$uri /travel.html; }
    location /blog    { try_files \$uri /blog.html; }
    location /figures { try_files \$uri /figures.html; }
    location /life    { try_files \$uri /life.html; }
    location /work    { try_files \$uri /work.html; }
    location /study   { try_files \$uri /study.html; }

    access_log /var/log/nginx/chesshub.access.log;
    error_log  /var/log/nginx/chesshub.error.log;
}

# ===== HTTPS (chesshub.fun / www.chesshub.fun) — 2026-07-10 加上 =====
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name chesshub.fun www.chesshub.fun;

    ssl_certificate     /etc/letsencrypt/live/chesshub.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chesshub.fun/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml image/jpeg image/png;
    gzip_min_length 1000;

    location /data/ {
        alias /var/www/chesshub-data/figures/;
        expires 30d;
        add_header Cache-Control "public";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        client_max_body_size 10m;
        proxy_read_timeout 60s;
    }

    root ${FRONTEND_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /gobang/ {
        alias ${GOBANG_ROOT}/;
        try_files \$uri \$uri/ /gobang/index.html;
        index index.html;
    }

    location /login   { try_files \$uri /login.html; }
    location /travel  { try_files \$uri /travel.html; }
    location /blog    { try_files \$uri /blog.html; }
    location /figures { try_files \$uri /figures.html; }
    location /life    { try_files \$uri /life.html; }
    location /work    { try_files \$uri /work.html; }
    location /study   { try_files \$uri /study.html; }

    access_log /var/log/nginx/chesshub.access.log;
    error_log  /var/log/nginx/chesshub.error.log;
}

# ===== 80 -> 443 redirect (chesshub.fun 域名强制 HTTPS) =====
server {
    listen 80;
    listen [::]:80;
    server_name chesshub.fun www.chesshub.fun;

    location / {
        return 301 https://\$host\$request_uri;
    }
}
NGINX_EOF

  # 启用 + 测试
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/chesshub
  rm -f /etc/nginx/sites-enabled/default

  if nginx -t 2>&1 | grep -q "syntax is ok"; then
    ok "Nginx 配置 OK"
  else
    err "Nginx 配置有问题,先修"
    nginx -t
    exit 1
  fi
}

# ---------- 5. restart ----------
restart_backend() {
  log "重启后端 (pm2)..."
  cd "$BACKEND_ROOT"

  if pm2 describe "$PM2_NAME" &>/dev/null; then
    pm2 restart "$PM2_NAME"
    ok "pm2 重启完成"
  else
    pm2 start server.js --name "$PM2_NAME"
    pm2 save
    ok "pm2 首次启动完成"
  fi

  sleep 2

  # 检查启动
  local out=$(pm2 logs "$PM2_NAME" --lines 8 --nostream --raw 2>/dev/null)
  if echo "$out" | grep -q "listening on"; then
    ok "后端启动成功"
    echo "$out" | tail -5 | sed 's/^/    /'
  else
    err "后端可能没正常启动,看完整日志:"
    pm2 logs "$PM2_NAME" --lines 20 --nostream --raw
    exit 1
  fi
}

restart_nginx() {
  log "重启 Nginx..."
  systemctl restart nginx
  sleep 1
  if systemctl is-active --quiet nginx; then
    ok "Nginx active"
  else
    err "Nginx 没起来,看 status"
    systemctl status nginx --no-pager
    exit 1
  fi
}

# ---------- 6. smoke-test ----------
smoke_test() {
  log "冒烟测试..."
  local fail=0

  # 主页
  local code=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_IP}/")
  if [ "$code" = "200" ]; then
    ok "主页: HTTP $code"
  else
    err "主页: HTTP $code (期望 200)"
    fail=1
  fi

  # login
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_IP}/login")
  if [ "$code" = "200" ] || [ "$code" = "301" ]; then
    ok "login: HTTP $code"
  else
    err "login: HTTP $code"
    fail=1
  fi

  # figures
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_IP}/figures")
  if [ "$code" = "200" ] || [ "$code" = "301" ]; then
    ok "figures: HTTP $code"
  else
    err "figures: HTTP $code"
    fail=1
  fi

  # gobang
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_IP}/gobang/")
  if [ "$code" = "200" ]; then
    ok "gobang: HTTP $code"
  else
    err "gobang: HTTP $code"
    fail=1
  fi

  # 后端 health (走 Nginx 反代)
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_IP}/api/health")
  if [ "$code" = "200" ]; then
    ok "API health: HTTP $code"
  else
    err "API health: HTTP $code"
    fail=1
  fi

  # 后端 login (管理员)
  local resp=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"${ADMIN_USER_DEFAULT}\",\"password\":\"${ADMIN_PASS_DEFAULT}\"}" \
    "http://${SERVER_IP}/api/auth/login")
  if echo "$resp" | grep -q '"role":"admin"'; then
    ok "API 管理员登录: 成功"
  else
    err "API 管理员登录: $resp"
    fail=1
  fi

  # 列出 figures
  resp=$(curl -s "http://${SERVER_IP}/api/figures")
  local count=$(echo "$resp" | grep -o '"id"' | wc -l)
  ok "API figures 列表: $count 条"

  if [ $fail -ne 0 ]; then
    err "冒烟测试有失败,看上面详情"
    exit 1
  fi
  ok "冒烟测试全部通过"
}

# ---------- all ----------
deploy_all() {
  echo ""
  echo "════════════════════════════════════════════"
  echo " ChessHub 一键部署"
  echo "════════════════════════════════════════════"
  echo ""
  preflight
  echo ""
  deploy_frontend
  echo ""
  deploy_backend
  echo ""
  seed_aobing
  echo ""
  backup_uploads
  echo ""
  deploy_nginx
  echo ""
  restart_backend
  echo ""
  restart_nginx
  echo ""
  smoke_test
  echo ""
  check_orphans
  echo ""
  echo "════════════════════════════════════════════"
  ok "部署完成!"
  echo "  访问: http://${SERVER_IP}/"
  echo "  登录: admin / admin  (部署后请改密码!)"
  echo "════════════════════════════════════════════"
  echo ""
  manual "部署后 [MANUAL] 任务:"
  echo "  1. 改 admin 密码:  nano $BACKEND_ROOT/.env  →  pm2 restart $PM2_NAME"
  echo "  2. 域名 DNS 解析:  $DOMAIN → $SERVER_IP (在域名服务商控制台)"
  echo "  3. HTTPS 证书:    certbot --nginx -d $DOMAIN (DNS 解析生效后)"
  echo ""
}

# ---------- 7. clean ----------
clean_backups() {
  log "清理 /tmp/ 下的旧备份 (保留最近 5 份)..."
  local cleaned=0
  for pattern in "chesshub-data-backup-*" "chesshub-env-backup-*.env" "chesshub-dist.tar.gz" "chesshub-server.tar.gz"; do
    # 列出来按时间倒序
    local files=($(ls -t /tmp/$pattern 2>/dev/null))
    local count=${#files[@]}
    if [ "$count" -gt 5 ]; then
      for ((i=5; i<count; i++)); do
        rm -rf "${files[$i]}" 2>/dev/null && cleaned=$((cleaned+1))
      done
    fi
  done
  ok "清理完成 (删除 $cleaned 个旧文件)"

  # 显示当前 /tmp/ 状态
  log "当前 /tmp/chesshub-* 文件:"
  ls -la /tmp/chesshub-* 2>/dev/null | sed 's/^/    /'
}

# ---------- 帮助 ----------
usage() {
  cat <<EOF
ChessHub 一键部署脚本

用法: $0 <command>

命令:
  all           完整部署 (推荐,等价于 preflight + frontend + backend + nginx + restart + smoke-test)
  frontend      只重新部署前端
  backend       只重新部署后端
  nginx         只重写 nginx 配置并 reload
  restart       只重启后端 (pm2)
  smoke-test    只跑冒烟测试
  preflight     只检查环境
  seed          只 seed aobing.jpg (首次)
  clean         清理 /tmp/ 旧备份 (保留最近 5 份)
  orphans       列出上传目录里的孤儿文件 (数据库没引用的)
  clean-orphans 交互式删除孤儿文件
  help          显示帮助

注意: 脚本自身有自保护机制,即使被自身 rm -rf 删了,退出时也会从 /tmp/ 备份恢复。

准备:
  1. 本地构建前端:   cd apps/web && npm run build
  2. 打包前端:       tar -czf dist.tar.gz -C dist .
  3. 打包后端:       cd apps/api && tar -czf server.tar.gz --exclude=node_modules --exclude=.env --exclude=data .
  4. 上传:           scp dist.tar.gz server.tar.gz root@${SERVER_IP}:/tmp/
  5. 重命名为:       mv /tmp/dist.tar.gz /tmp/chesshub-dist.tar.gz
                    mv /tmp/server.tar.gz /tmp/chesshub-server.tar.gz
  6. 跑:             $0 all

EOF
}

# ---------- 入口 ----------
case "${1:-help}" in
  all)         require_root "$@"; deploy_all ;;
  frontend)    require_root "$@"; deploy_frontend; restart_nginx; smoke_test ;;
  backend)     require_root "$@"; deploy_backend; seed_aobing; restart_backend; smoke_test ;;
  nginx)       require_root "$@"; deploy_nginx; restart_nginx ;;
  restart)     require_root "$@"; restart_backend ;;
  smoke-test)  smoke_test ;;
  preflight)   preflight ;;
  seed)        require_root "$@"; seed_aobing; restart_backend ;;
  clean)       clean_backups ;;
  orphans)     require_root "$@"; check_orphans ;;
  clean-orphans) require_root "$@"; clean_orphans ;;
  help|-h|--help) usage ;;
  *) err "未知命令: $1"; usage; exit 1 ;;
esac
