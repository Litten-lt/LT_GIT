#!/bin/bash
# ChessHub 数据备份脚本
# 部署位置: /etc/cron.daily/chesshub-backup.sh
# 权限:     chmod +x
# 安装:     ln -s /etc/cron.daily/chesshub-backup.sh  (或直接放进去)
# 跑法:     /etc/cron.daily/chesshub-backup.sh
# 频率:     每天凌晨 (anacron 或 cron.daily 触发)
# 保留:     7 天, 老的自动删
#
# 注意: 这是模板, 部署时需确保 /var/backups/chesshub 目录存在并可写
#       部署服务器上要 sudo mkdir -p /var/backups/chesshub && sudo chown $USER /var/backups/chesshub

set -euo pipefail

# ---------- 配置 ----------
BACKEND_DIR="${CHESSHUB_BACKEND_DIR:-/opt/chesshub-server}"
UPLOAD_PARENT="${CHESSHUB_UPLOAD_PARENT:-/var/www/chesshub-data}"
BACKUP_ROOT="${CHESSHUB_BACKUP_ROOT:-/var/backups/chesshub}"
RETENTION_DAYS="${CHESSHUB_RETENTION_DAYS:-7}"
LOG_FILE="${CHESSHUB_BACKUP_LOG:-/var/log/chesshub-backup.log}"

DATE=$(date +%Y%m%d-%H%M%S)
TODAY_DIR="$BACKUP_ROOT/$DATE"

# ---------- 准备 ----------
mkdir -p "$BACKUP_ROOT"
mkdir -p "$TODAY_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  local level="$1"; shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log "INFO" "开始备份 → $TODAY_DIR"

# ---------- 备份数据库 + .env ----------
if [ -d "$BACKEND_DIR/data" ]; then
  tar -czf "$TODAY_DIR/data.tar.gz" -C "$BACKEND_DIR" data
  log "INFO" "data/ 备份完成"
else
  log "WARN" "$BACKEND_DIR/data 不存在, 跳过"
fi

if [ -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env" "$TODAY_DIR/.env"
  log "INFO" ".env 备份完成"
else
  log "WARN" "$BACKEND_DIR/.env 不存在, 跳过"
fi

# ---------- 备份上传目录 ----------
if [ -d "$UPLOAD_PARENT/figures" ]; then
  # 上传目录可能很大, 单独打
  tar -czf "$TODAY_DIR/uploads.tar.gz" -C "$UPLOAD_PARENT" figures
  SIZE=$(du -h "$TODAY_DIR/uploads.tar.gz" | cut -f1)
  log "INFO" "uploads/figures 备份完成 ($SIZE)"
else
  log "WARN" "$UPLOAD_PARENT/figures 不存在, 跳过"
fi

# ---------- 清理过期备份 ----------
DELETED=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} + 2>/dev/null | wc -l || true)
log "INFO" "清理 ${RETENTION_DAYS} 天前的备份, 共删除 $DELETED 个目录"

# ---------- 汇总 ----------
TOTAL_SIZE=$(du -sh "$TODAY_DIR" | cut -f1)
log "INFO" "本次备份完成: $TOTAL_SIZE (路径: $TODAY_DIR)"

# ---------- 健康检查: 验证 data.tar.gz 能解 ----------
if tar -tzf "$TODAY_DIR/data.tar.gz" >/dev/null 2>&1; then
  log "INFO" "data.tar.gz 完整性校验通过"
else
  log "ERROR" "data.tar.gz 完整性校验失败! 备份可能损坏"
  exit 1
fi

log "INFO" "备份任务结束"
