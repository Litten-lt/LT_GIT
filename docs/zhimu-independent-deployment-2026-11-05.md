# 知木独立部署与旧站退役

完成日期：2026-11-05。

## 当前结构

- 应用：`zhimu/`，独立依赖、测试、构建、发布脚本。
- 根 npm 命令只代理知木，不再包含旧 workspaces。
- CI 只安装、验证和构建知木，使用 Node 22。
- Nginx：`/etc/nginx/sites-available/zhimu`，由 `zhimu/deploy/nginx.conf` 与 `site.conf` 管理。
- PM2 只保留 `zhimu`，旧 `longteng-api` 已删除且持久化保存进程表。
- 正式数据仍为 `/opt/zhimu-data/`，没有覆盖或迁移至代码目录。
- `/` 跳转 `/zhimu/`；旧 `/api/` 返回 404。域名 HTTP 仍保留 HTTPS 跳转，管理员安全登录要求不变。

## 验证

- 旧服务停用前后各完成一次独立部署，最终 release：`/opt/zhimu/releases/20261105-103546`。
- 本地、服务器 18 项测试通过；本地 Markdown/Mermaid 构建完成。
- 公网根地址跳转知木并返回 200；`/zhimu/api/health` 返回 200；旧 `/api/health` 返回 404。
- SQLite 完整性与外键检查通过，187 篇知识、27 次过程记录、1 张图片。
- 旧服务退出后，成功执行 `zhimu-backup.service` 的真实备份和恢复校验；timer 为 active。
- 浏览器在线可视化检查超时；公网 HTTP 及服务器检查已完成。没有绕过证书警告。
- 本轮不处理备案或续签，也没有将 HTTPS 标记为恢复。

## 清理与归档

本地已删除 `apps/`、`scripts/deploy/` 及根 `node_modules/`；旧文档移入历史归档。Git 历史保留。

本地源码、旧配置、未提交修改、数据归档：

`artifacts/legacy-retirement/20261105-102607/legacy-local-source-and-data.tar.gz`

移出的本地旧运行数据：同目录 `local-runtime/`。

服务器旧源码与数据归档：

`/var/backups/zhimu/legacy-retirement-20261105-103318/legacy-server-source-and-data.tar.gz`

归档校验后删除了旧 API 的源码、测试、依赖、部署脚本，以及旧前端 HTML、构建目录和 assets。自动审批曾拒绝删除整个旧 API 目录，因为其中包含数据库与上传数据；随后改为仅删除明确代码路径，操作成功。

旧数据库和运行文件保留在 `/opt/longteng-api/data`、`.env`；旧上传数据 `/var/www/longteng-data` 及 `figures-data` 历史资料未删除；旧前端 server 目录中残留的源码、构建、依赖和清单经核对后也已清除，非代码文件仍保留，均不再由活动 Nginx 或 PM2 使用。其他棋类站点、无关服务器目录未改动。

`artifacts/zhimu-operations`、`zhimu-offsite-backups` 和 `original-notes-audit` 仍需保留。历史材料属于归档，不是现役应用依赖。源码变更尚未提交 Git。
