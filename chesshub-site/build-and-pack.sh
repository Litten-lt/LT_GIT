#!/usr/bin/env bash
# 本地构建 + 打包 dist 目录,生成可直接上传的 tar.gz
# 用法: bash build-and-pack.sh [site|gobang|both]

set -e

MODE="${1:-both}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
LT_GIT="$(dirname "$ROOT")"

build_site() {
  echo "[*] 构建 chesshub-site ..."
  cd "$ROOT"
  if [ ! -d node_modules ]; then
    npm install
  fi
  npm run build
  tar -czf /tmp/chesshub-dist.tar.gz -C dist .
  echo "[✓] /tmp/chesshub-dist.tar.gz"
}

build_gobang() {
  echo "[*] 构建 gobang-web ..."
  cd "$LT_GIT/gobang-web"
  if [ ! -d node_modules ]; then
    npm install
  fi
  npm run build
  tar -czf /tmp/gobang-dist.tar.gz -C dist .
  echo "[✓] /tmp/gobang-dist.tar.gz"
}

case "$MODE" in
  site)
    build_site
    ;;
  gobang)
    build_gobang
    ;;
  both|*)
    build_site
    build_gobang
    ;;
esac

echo ""
echo "[✓] 全部构建完成。包在 /tmp/ 下,可以 scp 到服务器:"
echo "    scp /tmp/chesshub-dist.tar.gz /tmp/gobang-dist.tar.gz root@159.75.97.172:/tmp/"