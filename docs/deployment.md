# 工作笔记部署与维护

站点采用 React/Vite、Express、SQLite、Nginx 与 PM2。当前版本是无账号的个人笔记本：没有登录页、游客会话、Token 或角色校验。任何能够访问站点的人都能够使用管理中心及写入接口。

## 本地开发与验证

```powershell
npm ci
npm run dev:web
npm run dev:api
npm run verify
```

配置参考 `apps/api/.env.example`。保留 PORT、DATA_DIR、UPLOAD_DIR、CORS_ORIGIN、PUBLIC_BASE_URL、NODE_ENV 等运行配置；不再使用管理员账号和 JWT 密钥。

## 部署

```powershell
npm run verify
python scripts/deploy/backend.py
tar -czf artifacts/longteng-web.tar.gz -C apps/web/dist .
python scripts/deploy/frontend.py
```

部署脚本使用 SSH 密钥或 SSH_PASS，并支持 LT_DEPLOY_HOST、LT_DEPLOY_USER。后端脚本备份源码、依赖清单和 SQLite 一致性快照，上传 server.js、src、package.json、package-lock.json，清理已移除依赖并重启 PM2。前端脚本先备份静态目录再发布构建产物。

## 生产目录

- `/var/www/longteng`：前端静态文件。
- `/opt/longteng-api`：后端代码、依赖与运行配置。
- `/opt/longteng-api/data/longteng.db`：笔记数据库。
- `/var/www/longteng-data/figures`：上传图片。

API 监听 127.0.0.1:3000，由 Nginx 转发 `/api/`。Nginx 提供 `/data/figures/` 静态图片。HTML 使用 `Cache-Control: no-store, max-age=0`，带内容哈希的 JS/CSS 可以长期缓存。

## 数据兼容

保留历史数据库的结构升级与工作/学习记录导入，避免旧笔记丢失。生活内容及其接口已移除。旧 work.html、study.html 仍跳转到笔记页。停用登录接口和旧分类内容 CRUD，不再创建示例内容。现有数据库中的旧可见范围字段仅供兼容，无身份隔离功能。

## 检查

验证首页、工作笔记、搜索、关于、管理中心、写笔记；检查新增、编辑、补记、图片上传、历史版本、分类、定时发布和回收站。

```bash
curl -fsS http://127.0.0.1:3000/api/health
sudo pm2 status
sudo nginx -t
```

## 备份与恢复

长期保存数据库、上传目录和运行配置。仓库提供 `apps/api/tests/longteng-backup.sh`，备份应额外同步到服务器之外并定期验证恢复。

日常发布会在 `/tmp/longteng-api-backup-时间戳.tar.gz`、`/tmp/longteng-db-backup-时间戳.db` 和 `/tmp/longteng-web-backup-时间戳.tar.gz` 保留恢复点。普通代码回滚优先恢复代码；只有数据库故障才恢复数据库快照，因为快照之后新增的内容会丢失。恢复后重启 longteng-api，检查健康接口、笔记数量与图片。
