# ChessHub P0 部署报告 (2026-06-18 11:42)

## 目标
把 5 项 P0 安全修复 + 备份 cron 部署到 159.75.97.172。

## 部署方式
- **SSH 工具**: paramiko 5.0.0 (Python 3.13) + ubuntu 账户 + 密码登录
- **提权方式**: `sudo -n bash -c '...'` (sudoers 允许 ubuntu 对 `/bin/bash` NOPASSWD)
- **deploy 子命令**: `backend` (不是 `all` —— 没前端 tar)
- **回滚机制**: deploy.sh 自身备份到 /tmp/.chesshub-deploy.sh.bak + trap restore_self

## 4 步全部完成

| # | 步骤 | 状态 | 备注 |
|---|---|---|---|
| 1 | SFTP 上传 tar + backup.sh | ✅ | `chesshub-server.tar.gz` (49509 B) + `chesshub-backup.sh` |
| 2 | `deploy.sh backend` | ✅ (第二次) | 第一次 `Permission denied` —— 修了 chmod +x |
| 3 | sed 改 CORS + pm2 restart | ✅ | `--update-env` 让 CORS_ORIGIN 生效 |
| 4 | 备份脚本到 /etc/cron.daily/ | ✅ | 跑通 1 次, 19M 备份落盘 |
| 5 | 验证 (health + rate limit + CORS) | ✅ | 见下 |
| 6 | magic bytes 验证 | ⚠️ 未 live 测 | 被 rate limit 锁住, 引用本地 27/27 测试结果 |

## 验证结果

### 服务健康
- `http://127.0.0.1:3000/api/health` → `{"ok":true,...}` HTTP 200
- `pm2 list` chesshub-server: **online**, PID 718161, 25.3 MB

### P0 #1 CORS 白名单
| Origin | ACAO 头 |
|---|---|
| `https://chesshub.fun` | `Access-Control-Allow-Origin: https://chesshub.fun` ✅ |
| `https://evil.com` | **无 ACAO 头** ✅ (符合 spec) |

### P0 #2 Rate limit
| 尝试 | 状态码 |
|---|---|
| 1-10 | 401 (密码错) |
| **11** | **429** (rate limit 触发) ✅ |
| 后续 (5 分钟内) | "登录尝试过于频繁，请 5 分钟后再试" |

### P0 #3 Magic bytes
- **Live 未测** (admin 账号被 rate limit 锁住)
- **代码已确认上线** (server.js md5: `e6c0f42e…` → `721bc5cb…`)
- **本地 27/27 测试通过** (`tests/security.test.mjs` 包含 `php-as-jpeg` → 400, `real-jpeg` → 200 的对照实验)

### P0 #4 备份 cron
- `/etc/cron.daily/chesshub-backup.sh` 已部署 + chmod 755
- `/var/backups/chesshub/` 已建 (root:root, 700)
- 手动跑 1 次成功: `20260618-114022` (19M, 包含 data + .env + uploads/figures)
- data.tar.gz 完整性校验通过

### P0 #5 全局错误 + pino 日志
- pm2 log tail 显示 `[INFO] [chesshub-server] listening on http://127.0.0.1:3000` 走 pino 结构化输出 ✅

## 关键事件

### 第一次 deploy 失败
```
sudo -n bash -c 'cd /opt/chesshub-server && ./chesshub-deploy.sh backend'
  → [stderr rc=126] bash: line 1: ./chesshub-deploy.sh: Permission denied
```
**根因**: 服务器上的 `chesshub-deploy.sh` 是 666 模式 (rw-rw-rw 但没 +x) ——
以前一直用 root 跑所以没暴露这个 bug, ubuntu 用户首次跑就炸。

**修复**: `chmod +x` + 改用 `bash ./chesshub-deploy.sh` 双重保险。

### pm2 ENOENT 警告
deploy 期间 `rm -rf /opt/chesshub-server/*` 把 server.js 干掉了,
旧的 pm2 fork watcher 还在,瞬间打了一行:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/opt/chesshub-server/server.js'
```
**不影响** —— deploy 解包完 pm2 restart 重新拉起, PID 718103 listening OK。

## 还要补的事 (用户自己)

1. **改 admin 密码** —— `.env` 里 `ADMIN_PASS=admin` 还是默认的
2. **改 SSH 密码** —— 你贴的密码已经在聊天记录里暴露了, 改一下:
   `sudo passwd ubuntu`
3. **chesshub.fun:443 还连不上** —— nginx 没起来 / DNS 没解析, 跟今天 P0 部署无关
4. **5 分钟后可以测 magic bytes live** —— 找一个能登录的窗口再上传测试

## 文件清单 (本地)
- `chesshub-server.tar.gz` (49 KB) —— 部署源包
- `deploy-p0.py` (6.1 KB) —— 第一次部署 (失败)
- `deploy-fix.py` (3.7 KB) —— 第二次部署 (chmod fix)
- `magic-bytes-test.py` (2.4 KB) —— magic bytes 验证 (被 rate limit 挡了)
- `probe-ssh.py` / `probe2.py` —— 服务器探测
- `deploy-run.log` —— 第一次部署完整日志
- `deploy.sh.remote` —— 远程 deploy.sh 备份 (21 KB)
- `deploy-fix.log` —— (合并到 deploy-run.log 后的)

