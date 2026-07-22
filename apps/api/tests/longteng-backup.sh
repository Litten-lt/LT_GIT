#!/bin/bash
# LongTeng 数据备份脚本
# 部署位置: /etc/cron.daily/longteng-backup.sh
# 权限:     chmod +x
# 跑法:     /etc/cron.daily/longteng-backup.sh
# 频率:     每天凌晨 (anacron 或 cron.daily 触发)
# 保留:     7 天, 老的自动删

set -euo pipefail

BACKEND_DIR="${LONGTENG_BACKEND_DIR:-/opt/longteng-api}"
UPLOAD_PARENT="${LONGTENG_UPLOAD_PARENT:-/var/www/longteng-data}"
BACKUP_ROOT="${LONGTENG_BACKUP_ROOT:-/var/backups/longteng}"
RETENTION_DAYS="${LONGTENG_RETENTION_DAYS:-7}"
LOG_FILE="${LONGTENG_BACKUP_LOG:-/var/log/longteng-backup.log}"

DATE=$(date +%Y%m%d-%H%M%S)
TODAY_DIR="$BACKUP_ROOT/$DATE"

mkdir -p "$BACKUP_ROOT" "$TODAY_DIR" "$(dirname "$LOG_FILE")"

log() {
  local level="$1"; shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log "INFO" "开始备份 → $TODAY_DIR"

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

if [ -d "$UPLOAD_PARENT/figures" ]; then
  tar -czf "$TODAY_DIR/uploads.tar.gz" -C "$UPLOAD_PARENT" figures
  SIZE=$(du -h "$TODAY_DIR/uploads.tar.gz" | cut -f1)
  log "INFO" "uploads/figures 备份完成 ($SIZE)"
else
  log "WARN" "$UPLOAD_PARENT/figures 不存在, 跳过"
fi

DELETED=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} + 2>/dev/null | wc -l || true)
log "INFO" "清理 ${RETENTION_DAYS} 天前的备份, 共删除 $DELETED 个目录"

TOTAL_SIZE=$(du -sh "$TODAY_DIR" | cut -f1)
log "INFO" "本次备份完成: $TOTAL_SIZE (路径: $TODAY_DIR)"

if [ -f "$TODAY_DIR/data.tar.gz" ] && tar -tzf "$TODAY_DIR/data.tar.gz" >/dev/null 2>&1; then
  log "INFO" "data.tar.gz 完整性校验通过"
elif [ -f "$TODAY_DIR/data.tar.gz" ]; then
  log "ERROR" "data.tar.gz 完整性校验失败! 备份可能损坏"
  exit 1
fi

log "INFO" "备份任务结束"
