# 知木 Zhimu

个人知识树与枝叶管理系统。当前工作区只维护知木；旧网站已退役，知识星云 demo 已删除。

## 本地启动

需要 Node.js 22.12 或更高版本。

```powershell
npm run setup
npm start
```

访问 http://127.0.0.1:3210/ 。也可以进入 `zhimu/` 独立运行 `npm ci`、`npm start`。

## 目录

- `zhimu/`：独立应用、前端资源、数据库代码、测试和部署配置。
- `docs/`：知木迁移、备份、运维与退役记录。
- `artifacts/`：本机备份、受限运维文件及历史归档，不提交 Git；不能整体删除。
- `.github/workflows/ci.yml`：知木独立安装、验证及构建。

## 检查和部署

```powershell
npm run verify
npm run build
npm run deploy
```

部署需要 Python、paramiko 及已有 SSH 连接配置。生产服务为 PM2 `zhimu`，监听本机 3210；独立 Nginx 配置为 `zhimu/deploy/`。应用发布到 `/opt/zhimu/releases/`，正式数据位于 `/opt/zhimu-data/`，部署不覆盖数据。

线上入口：http://159.75.97.172/ ，会跳转 `/zhimu/`。域名备案与 HTTPS 证书仍需另行完成，不应绕过安全连接要求登录。

更多说明见 [知木说明](zhimu/README.md)、[运维说明](docs/zhimu-operations-2026-11-02.md)、[独立部署与退役记录](docs/zhimu-independent-deployment-2026-11-05.md)。
