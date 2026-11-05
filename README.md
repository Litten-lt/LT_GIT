# 知木 Zhimu

个人知识树与枝叶管理系统。此目录是唯一的项目与 Git 仓库根目录；旧站已退役，星云 demo 已移除。

## 本地启动

建议使用 Node.js 22.12 以上。

```powershell
npm ci
npm start
```

访问 http://127.0.0.1:3210/ 。管理员登录后，通过枝叶管理维护知识和多次过程记录；游客可阅读已发布内容。

## 常用命令

```powershell
npm run dev
npm run verify
npm run build
npm run deploy
```

部署需 Python、paramiko 以及已配置的 SSH 连接。部署脚本为 `scripts/deploy.py`，不依赖上级目录。Markdown/Mermaid 浏览器构建由 `npm run build` 生成。

## 目录与数据

- `src/`、`server.js`：Express + SQLite 服务。
- `public/`、`client/`：封面、知识树、管理界面与 Markdown/Mermaid。
- `tests/`：数据、权限、记录、图片、目录与迁移测试。
- `deploy/`：独立 Nginx 配置。
- `docs/`：运维、迁移及清理记录。
- `.github/`：自动化检查；`.agents/`：开发规则目录。
- `data/`：本地数据库和图片，不提交 Git。

备份、运维密钥和旧项目归档位于项目外的 `../zhimu-local/`，不随源码提交，不能整体删除。每日备份任务已迁往该目录。重新安装运维时，可通过 `ZHIMU_LOCAL_DIR` 指定其他资料目录；安装脚本不用于重置已有管理员。

## 线上

入口：http://159.75.97.172/ ，跳转到 `/zhimu/`。

PM2 服务 `zhimu` 监听本机 3210；代码在 `/opt/zhimu/releases/`，当前版本由 `/opt/zhimu/current` 指向；正式数据独立保存在 `/opt/zhimu-data/`。部署不上传本地数据，不覆盖正式数据库。Nginx 使用 `deploy/nginx.conf` 和 `deploy/site.conf`，旧 API 不再提供服务。

域名备案与 HTTPS 证书尚待处理。生产管理员登录要求 HTTPS，不能通过公网 HTTP 提交密码。本地和线上数据库独立，不自动同步。

## 文档

- [登录与自动备份](docs/zhimu-operations-2026-11-02.md)
- [原笔记迁移](docs/zhimu-original-import-2026-11-02.md)
- [独立部署与旧站退役](docs/zhimu-independent-deployment-2026-11-05.md)
- [仓库根目录迁移](docs/repository-root-migration-2026-11-05.md)
